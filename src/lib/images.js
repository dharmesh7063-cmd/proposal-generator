// Decoding uploads, building previews, and producing the pixels that go into the PDF.
const PREVIEW_EDGE = 1600;
const MAX_CANVAS_PX = 16_000_000; // iOS Safari refuses canvases above ~16.7 MP
const GRID = { cols: 24, rows: 24 };

export class ImportError extends Error {}

const isHeic = (file) => /hei[cf]$/i.test(file.type) || /\.(heic|heif)$/i.test(file.name || '');

function loadImg(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => resolve({ img, release: () => URL.revokeObjectURL(url) });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode failed'));
    };
    img.src = url; // <img> applies EXIF rotation, so phone photos come in upright
  });
}

async function decode(file) {
  try {
    return { blob: file, ...(await loadImg(file)) };
  } catch {
    if (!isHeic(file)) throw new ImportError(`${file.name} isn't an image this browser can open.`);
  }
  // Chrome can't read iPhone HEIC photos; convert them to JPEG first.
  try {
    const { default: heic2any } = await import('heic2any');
    const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 1 });
    const blob = Array.isArray(out) ? out[0] : out;
    return { blob, ...(await loadImg(blob)) };
  } catch {
    throw new ImportError(`${file.name} is a HEIC photo that couldn't be converted. Export it as JPG and add it again.`);
  }
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function toBlob(c, type, quality) {
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), type, quality),
  );
}

// Draws a source rectangle at an exact output size. Large reductions are done in
// halving steps so fine lines in renders don't turn jagged.
function drawScaled(source, sx, sy, sw, sh, outW, outH, background) {
  let src = source;
  let rect = { x: sx, y: sy, w: sw, h: sh };
  while (rect.w / 2 >= outW * 1.05 && rect.h / 2 >= outH * 1.05) {
    let w = Math.round(rect.w / 2);
    let h = Math.round(rect.h / 2);
    if (w * h > MAX_CANVAS_PX) {
      const k = Math.sqrt(MAX_CANVAS_PX / (w * h));
      w = Math.floor(w * k);
      h = Math.floor(h * k);
    }
    const step = canvas(w, h);
    const sctx = step.getContext('2d');
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(src, rect.x, rect.y, rect.w, rect.h, 0, 0, step.width, step.height);
    src = step;
    rect = { x: 0, y: 0, w: step.width, h: step.height };
  }
  const out = canvas(outW, outH);
  const ctx = out.getContext('2d');
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, out.width, out.height);
  }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, rect.x, rect.y, rect.w, rect.h, 0, 0, out.width, out.height);
  return out;
}

// Transparency check + the average brightness of what's drawn, so cut-outs and
// line drawings get a backdrop they stay readable on.
function inspectAlpha(img) {
  const s = Math.min(1, 256 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = canvas(img.naturalWidth * s, img.naturalHeight * s);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  let transparent = 0;
  let lum = 0;
  let opaque = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 250) transparent++;
    if (a > 16) {
      lum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
      opaque++;
    }
  }
  if (transparent / (data.length / 4) < 0.001) return null;
  const mean = opaque ? lum / opaque : 0;
  return mean < 0.5 ? '#FFFFFF' : '#000000';
}

function brightnessGrid(c) {
  const g = canvas(GRID.cols, GRID.rows);
  const ctx = g.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(c, 0, 0, GRID.cols, GRID.rows);
  const { data } = ctx.getImageData(0, 0, GRID.cols, GRID.rows);
  const out = [];
  for (let i = 0; i < data.length; i += 4) {
    out.push(Math.round(((0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255) * 100) / 100);
  }
  return { ...GRID, data: out };
}

// Reads an uploaded file once and returns everything the app needs to know about it.
export async function importImage(file) {
  if (file.type && !file.type.startsWith('image/') && !isHeic(file)) {
    throw new ImportError(`${file.name} isn't an image.`);
  }
  const { blob, img, release } = await decode(file);
  try {
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    if (!width || !height) throw new ImportError(`${file.name} looks empty.`);
    const background = inspectAlpha(img);
    const s = Math.min(1, PREVIEW_EDGE / Math.max(width, height));
    const preview = drawScaled(img, 0, 0, width, height, width * s, height * s, background);
    return {
      name: file.name,
      blob,
      width,
      height,
      background,
      lumGrid: brightnessGrid(preview),
      previewBlob: await toBlob(preview, 'image/jpeg', 0.86),
    };
  } finally {
    release();
  }
}

const ascii = (u, o, n) => String.fromCharCode(...u.subarray(o, o + n));

// EXIF orientation from the TIFF block that starts at `t`; 1 means upright.
function exifOrientation(u, t, end) {
  const le = u[t] === 0x49; // "II" byte order
  const r16 = (o) => (le ? u[t + o] | (u[t + o + 1] << 8) : (u[t + o] << 8) | u[t + o + 1]);
  const r32 = (o) => (le ? r16(o) + r16(o + 2) * 65536 : r16(o) * 65536 + r16(o + 2));
  const ifd = r32(4);
  for (let k = 0, n = r16(ifd); k < n; k++) {
    const e = ifd + 2 + k * 12;
    if (t + e + 12 > end) break;
    if (r16(e) === 0x0112) return r16(e + 8);
  }
  return 1;
}

// True when an ICC profile's description names sRGB. Handles v2 'desc' (ASCII) and
// v4 'mluc' (UTF-16) text by dropping the zero bytes.
function isSrgbProfile(p) {
  const r32 = (o) => ((p[o] << 24) | (p[o + 1] << 16) | (p[o + 2] << 8) | p[o + 3]) >>> 0;
  for (let k = 0, n = r32(128); k < n && 144 + k * 12 <= p.length; k++) {
    const e = 132 + k * 12;
    if (ascii(p, e, 4) !== 'desc') continue;
    const o = r32(e + 4);
    return /srgb/i.test(ascii(p, o, Math.min(r32(e + 8), 512)).replace(/\0/g, ''));
  }
  return false;
}

// Whether a JPEG can go into the PDF byte for byte, with no decoding or recompression.
// That's safe when a PDF viewer will show it exactly as the browser does: 8-bit RGB or
// grey, upright (no EXIF rotation), sRGB or untagged colour, and headers jsPDF reads right.
export function canEmbedJpeg(u) {
  if (u[0] !== 0xff || u[1] !== 0xd8) return false;
  for (let i = 2; i + 4 <= u.length; ) {
    if (u[i] !== 0xff) return false;
    const m = u[i + 1];
    const len = (u[i + 2] << 8) | u[i + 3];
    const seg = i + 4;
    if (m === 0xc0 || m === 0xc1 || m === 0xc2) return u[seg] === 8 && (u[seg + 5] === 1 || u[seg + 5] === 3);
    // Fill bytes, stray markers, scan data with no frame header, a Huffman table ahead of
    // the frame header (jsPDF would misread it as one), or lossless/arithmetic coding.
    if (m === 0xff || m === 0x01 || (m >= 0xd0 && m <= 0xda) || (m >= 0xc3 && m <= 0xcf)) return false;
    if (m === 0xe1 && ascii(u, seg, 6) === 'Exif\0\0' && exifOrientation(u, seg + 6, i + 2 + len) > 1) return false;
    if (m === 0xe2 && ascii(u, seg, 12) === 'ICC_PROFILE\0' && u[seg + 12] === 1) {
      if (!isSrgbProfile(u.subarray(seg + 14, i + 2 + len))) return false;
    }
    i += 2 + len;
  }
  return false;
}

const isJpegBlob = (blob) => /jpe?g/i.test(blob.type);
const isLossyBlob = (blob) => /jpe?g|hei[cf]|webp|avif/i.test(blob.type);

// Full-size redraw for images that can't go in as they are. Only a browser that can't
// hold the whole image in a canvas (iOS stops at ~16.7 MP) gets a smaller one.
async function encodeFull(img, background, type) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  try {
    return await toBlob(drawScaled(img, 0, 0, w, h, w, h, background), type, 1);
  } catch (err) {
    if (w * h <= MAX_CANVAS_PX) throw err;
    const k = Math.sqrt(MAX_CANVAS_PX / (w * h));
    return toBlob(drawScaled(img, 0, 0, w, h, Math.floor(w * k), Math.floor(h * k), background), type, 1);
  }
}

// The whole image, at its full resolution, ready for jsPDF; pages crop it with a clip,
// so pixels are never resampled. Uploaded JPEGs go in untouched when they can. Anything
// else is redrawn once at full size: PNG for lossless sources and transparent drawings,
// top-quality JPEG for photos.
export async function pdfImage(record) {
  const bytes = new Uint8Array(await record.blob.arrayBuffer());
  if (isJpegBlob(record.blob) && canEmbedJpeg(bytes)) return { bytes, format: 'JPEG' };
  const { img, release } = await loadImg(record.blob);
  try {
    const lossless = record.background || !isLossyBlob(record.blob);
    const blob = await encodeFull(img, record.background || '#000000', lossless ? 'image/png' : 'image/jpeg');
    return { bytes: new Uint8Array(await blob.arrayBuffer()), format: lossless ? 'PNG' : 'JPEG' };
  } finally {
    release();
  }
}

// Rough bytes an image adds to the PDF, for the size estimate shown before exporting.
export function estimatePdfBytes(record) {
  return isJpegBlob(record.blob) ? record.blob.size : record.width * record.height * 1.5;
}

export function naturalCompare(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}
