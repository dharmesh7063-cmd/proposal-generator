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
    const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
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

// JPEG bytes for one image slot on a page, at the export resolution and never
// larger than the source pixels (no upscaling).
export async function renderSlot(record, crop, boxWmm, { dpi, jpeg }) {
  const { img, release } = await loadImg(record.blob);
  try {
    const sw = img.naturalWidth * crop.w;
    const sh = img.naturalHeight * crop.h;
    const outW = Math.min(sw, (boxWmm / 25.4) * dpi);
    const outH = outW * (sh / sw);
    const out = drawScaled(
      img,
      img.naturalWidth * crop.x,
      img.naturalHeight * crop.y,
      sw,
      sh,
      outW,
      outH,
      record.background || '#000000',
    );
    // Line drawings with transparency get a little more quality to keep edges clean.
    const blob = await toBlob(out, 'image/jpeg', record.background ? Math.max(jpeg, 0.92) : jpeg);
    return { bytes: new Uint8Array(await blob.arrayBuffer()), width: out.width, height: out.height };
  } finally {
    release();
  }
}

// Rough output size so the size estimate can be shown before exporting.
export function estimateSlotPixels(record, crop, boxWmm, { dpi }) {
  const sw = record.width * crop.w;
  const sh = record.height * crop.h;
  const outW = Math.min(sw, (boxWmm / 25.4) * dpi);
  return outW * outW * (sh / sw);
}

export function naturalCompare(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}
