import lightUrl from '../assets/fonts/DMSans-Light.ttf?url';
import regularUrl from '../assets/fonts/DMSans-Regular.ttf?url';
import mediumUrl from '../assets/fonts/DMSans-Medium.ttf?url';
import { PT } from './constants';

// The same TTF files are used by the page preview, for measuring text, and inside
// the PDF, so line breaks in the preview are exactly the line breaks in the PDF.
export const FONTS = {
  light: { weight: 300, url: lightUrl, pdfName: 'DMSans-Light' },
  regular: { weight: 400, url: regularUrl, pdfName: 'DMSans-Regular' },
  medium: { weight: 500, url: mediumUrl, pdfName: 'DMSans-Medium' },
};
export const FONT_FAMILY = 'DM Sans';

let fontsReady;
export function loadFonts() {
  fontsReady ??= Promise.all(
    Object.values(FONTS).map((f) => document.fonts.load(`${f.weight} 16px "${FONT_FAMILY}"`)),
  );
  return fontsReady;
}

let ctx;
const SAMPLE_PX = 100;

// Width in mm of one line set in `style` ({ font, size (pt), tracking (mm) }).
export function textWidth(text, style) {
  if (!ctx) {
    ctx = document.createElement('canvas').getContext('2d');
    if ('fontKerning' in ctx) ctx.fontKerning = 'none'; // jsPDF does not kern
  }
  ctx.font = `${FONTS[style.font].weight} ${SAMPLE_PX}px "${FONT_FAMILY}"`;
  const sizeMm = style.size * PT;
  return (ctx.measureText(text).width / SAMPLE_PX) * sizeMm + (style.tracking || 0) * text.length;
}

export function truncate(text, style, maxWidth, measure = textWidth) {
  if (measure(text, style) <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(text.slice(0, mid).trimEnd() + '…', style) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return lo ? text.slice(0, lo).trimEnd() + '…' : '';
}

// Greedy word wrap; the last allowed line is truncated with an ellipsis.
export function wrap(text, style, maxWidth, maxLines = Infinity, measure = textWidth) {
  const lines = [];
  for (const para of String(text).split(/\n+/)) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (measure(next, style) <= maxWidth || !line) {
        line = next;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = truncate(`${kept[maxLines - 1]} ${lines[maxLines]}`, style, maxWidth, measure);
    if (!kept[maxLines - 1].endsWith('…')) kept[maxLines - 1] += '…';
    return kept;
  }
  // A single word wider than the column still has to fit.
  return lines.map((l) => (measure(l, style) > maxWidth ? truncate(l, style, maxWidth, measure) : l));
}
