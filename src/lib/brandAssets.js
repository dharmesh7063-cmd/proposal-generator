import coverUrl from '../assets/cover.jpg';
import thanksUrl from '../assets/thankyou.jpg';
import logoUrl from '../assets/logo-white.png';

const LOGO_WIDTH_PX = 900; // ~24 mm wide at 950 dpi; plenty, and a few KB instead of 10 MB

function load(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Bounds of the wordmark only. The logo file also carries the
// "INTERIOR | ARCHITECTURAL | PLANNING" line underneath, which turns into a
// smudge at watermark size, so keep the first band of rows that has ink in it.
function wordmarkBounds(img) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
  const inked = (y) => {
    for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > 8) return true;
    return false;
  };
  let y0 = 0;
  while (y0 < height && !inked(y0)) y0++;
  let y1 = y0;
  while (y1 < height && inked(y1)) y1++;
  if (y0 >= height) return { x: 0, y: 0, w: width, h: height };
  let x0 = width;
  let x1 = -1;
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
      }
    }
  }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 };
}

function tinted(img, b, color) {
  const c = document.createElement('canvas');
  c.width = LOGO_WIDTH_PX;
  c.height = Math.round((LOGO_WIDTH_PX * b.h) / b.w);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, b.x, b.y, b.w, b.h, 0, 0, c.width, c.height);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}

let assets;
export function loadBrandAssets() {
  assets ??= load(logoUrl).then((img) => {
    const b = wordmarkBounds(img);
    return {
      coverUrl,
      thanksUrl,
      logoRatio: b.w / b.h,
      logo: { light: tinted(img, b, '#F2E6D8'), dark: tinted(img, b, '#111111') },
    };
  });
  return assets;
}
