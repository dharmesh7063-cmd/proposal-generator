// Draws the page specs from layout.js into a PDF. jsPDF is loaded on first export.
import { PAGE_W as W, PAGE_H as H, PT, BRAND } from './constants';
import { FONTS } from './text';
import { renderSlot } from './images';

async function bytesOf(url) {
  return new Uint8Array(await (await fetch(url)).arrayBuffer());
}

async function base64Of(url) {
  const bytes = await bytesOf(url);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

const nextFrame = () => new Promise((r) => setTimeout(r, 0));

export async function buildPdf({ pages, images, assets, quality, title, onProgress }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });

  for (const f of Object.values(FONTS)) {
    doc.addFileToVFS(`${f.pdfName}.ttf`, await base64Of(f.url));
    doc.addFont(`${f.pdfName}.ttf`, f.pdfName, 'normal');
  }
  // Brand art goes in as the original JPEG bytes: no second round of compression.
  const fixed = { cover: await bytesOf(assets.coverUrl), thanks: await bytesOf(assets.thanksUrl) };

  const steps = pages.reduce((n, p) => n + 1 + p.items.filter((i) => i.type === 'image').length, 0);
  let done = 0;
  const tick = () => onProgress?.(Math.min(1, ++done / steps));

  for (const [index, page] of pages.entries()) {
    if (index) doc.addPage();
    if (page.bg) {
      doc.setFillColor(page.bg);
      doc.rect(0, 0, W, H, 'F');
    }
    for (const it of page.items) {
      if (it.type === 'image') {
        if (fixed[it.ref]) {
          doc.addImage(fixed[it.ref], 'JPEG', it.x, it.y, it.w, it.h, it.ref, 'NONE');
        } else {
          const rec = images[it.ref];
          const { bytes } = await renderSlot(rec, it.crop, it.w, quality);
          doc.addImage(bytes, 'JPEG', it.x, it.y, it.w, it.h, `${page.key}-${it.ref}`, 'NONE');
        }
        tick();
        await nextFrame();
      } else if (it.type === 'rect') {
        if (it.opacity != null && it.opacity < 1) doc.setGState(new doc.GState({ opacity: it.opacity }));
        doc.setFillColor(it.fill);
        if (it.radius) doc.roundedRect(it.x, it.y, it.w, it.h, it.radius, it.radius, 'F');
        else doc.rect(it.x, it.y, it.w, it.h, 'F');
        if (it.opacity != null && it.opacity < 1) doc.setGState(new doc.GState({ opacity: 1 }));
      } else if (it.type === 'text') {
        const s = it.style;
        doc.setFont(FONTS[s.font].pdfName, 'normal');
        doc.setFontSize(s.size);
        doc.setTextColor(s.color);
        it.lines.forEach((line, i) => {
          doc.text(line, it.x, it.y + i * (s.leading || s.size * PT * 1.3), { charSpace: s.tracking || 0 });
        });
      } else if (it.type === 'logo') {
        if (it.opacity < 1) doc.setGState(new doc.GState({ opacity: it.opacity }));
        doc.addImage(assets.logo[it.tone], 'PNG', it.x, it.y, it.w, it.h, `logo-${it.tone}`, 'MEDIUM');
        if (it.opacity < 1) doc.setGState(new doc.GState({ opacity: 1 }));
      } else if (it.type === 'link') {
        doc.link(it.x, it.y, it.w, it.h, { url: it.url });
      }
    }
    tick();
  }

  doc.setProperties({ title, author: BRAND.name, creator: `${BRAND.name} proposal generator` });
  return doc.output('blob');
}
