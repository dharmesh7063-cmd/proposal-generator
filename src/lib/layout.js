// Turns the proposal (rooms + images) into a list of page specs in millimetres.
// The on-screen preview (PageSvg) and the PDF (pdf.js) both draw these specs, so
// what you see is what gets exported. Nothing here touches the DOM except
// through the injected `measure` function.
import { PAGE_W as W, PAGE_H as H, A4_RATIO, COLORS, LOW_DPI, BRAND } from './constants';
import { textWidth, truncate as truncateWith, wrap as wrapWith } from './text';

const MARGIN = 12; // around framed images
const FOOT = 16; // caption strip under framed images
const GUTTER = 8; // between paired portraits
const MIN_PANEL = 66; // narrowest useful info panel beside an image
const BLEED_TOLERANCE = 0.02; // fill the page only if that trims at most 2% of the image
const PANORAMA_RATIO = 2;
export const SIDE_MAX_RATIO = (W - MIN_PANEL) / H; // ≈ 1.10

const S = {
  label: { font: 'medium', size: 9, tracking: 0.35, color: COLORS.accent },
  room: { font: 'medium', size: 9, tracking: 0.35, color: COLORS.creamMuted },
  caption: { font: 'regular', size: 10.5, color: COLORS.cream },
  badge: { font: 'medium', size: 7.5, tracking: 0.3, color: COLORS.white },
  pill: { font: 'regular', size: 8.5, color: COLORS.cream },
  panelRoom: { font: 'light', size: 16, tracking: 0.2, color: COLORS.cream, leading: 7 },
  panelCaption: { font: 'regular', size: 11, color: COLORS.creamMuted, leading: 5.6 },
  titleHead: { font: 'medium', size: 16, tracking: 0.35, color: COLORS.accent },
  titleName: { font: 'regular', size: 14, tracking: 0.15, color: COLORS.accent, leading: 6.5 },
  titleRooms: { font: 'regular', size: 14, tracking: 0.15, color: COLORS.accent, leading: 6.5 },
  titleRoomsMany: { font: 'regular', size: 11.5, tracking: 0.15, color: COLORS.accent, leading: 5.6 },
  titleSite: { font: 'regular', size: 11, tracking: 0.15, color: COLORS.accent, leading: 5 },
  titleMeta: { font: 'light', size: 9, tracking: 0.3, color: COLORS.accent },
  dividerIndex: { font: 'medium', size: 9, tracking: 0.4, color: COLORS.accent },
  dividerName: { font: 'light', size: 26, tracking: 0.3, color: COLORS.accent, leading: 11 },
  dividerMeta: { font: 'light', size: 9, tracking: 0.3, color: COLORS.accent },
};

export const LAYOUT_NAMES = {
  bleed: 'Full page',
  framed: 'Framed',
  side: 'Side panel',
  band: 'Panorama',
  pair: 'Two per page',
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const pad2 = (n) => String(n).padStart(2, '0');
export const FULL_CROP = { x: 0, y: 0, w: 1, h: 1 };

export function ratioOf(img) {
  return img.width / img.height;
}

export function describeShape(img) {
  const r = ratioOf(img);
  const known = [
    [9 / 16, '9:16'], [2 / 3, '2:3'], [3 / 4, '3:4'], [4 / 5, '4:5'], [1, '1:1'],
    [5 / 4, '5:4'], [4 / 3, '4:3'], [A4_RATIO, 'A4'], [3 / 2, '3:2'], [16 / 9, '16:9'], [2, '2:1'], [3, '3:1'],
  ];
  const [, name] = known.reduce((best, k) => (Math.abs(k[0] - r) < Math.abs(best[0] - r) ? k : best));
  const close = known.some(([v, n]) => n === name && Math.abs(v / r - 1) < 0.03);
  const kind = r < 0.95 ? 'Portrait' : r <= 1.05 ? 'Square' : r > PANORAMA_RATIO ? 'Panorama' : 'Landscape';
  return close ? `${kind} ${name}` : `${kind} ${r.toFixed(2)}:1`;
}

export function autoLayout(r) {
  if (Math.abs(r / A4_RATIO - 1) <= BLEED_TOLERANCE) return 'bleed';
  if (r <= SIDE_MAX_RATIO) return 'side';
  if (r > PANORAMA_RATIO) return 'band';
  return 'framed';
}

// Which layouts make sense for this image (used by the UI to build the menu).
export function layoutOptions(img) {
  const opts = ['auto', 'framed', 'bleed'];
  if (ratioOf(img) <= SIDE_MAX_RATIO) opts.splice(1, 0, 'side');
  return opts;
}

export function resolveLayout(img) {
  const r = ratioOf(img);
  if (img.layout === 'bleed' || img.layout === 'framed') return img.layout;
  if (img.layout === 'side' && r <= SIDE_MAX_RATIO) return 'side';
  return autoLayout(r);
}

// Two portraits side by side: both must be portraits shown in the side-panel layout.
export function canPair(a, b) {
  return Boolean(
    a && b && ratioOf(a) < 0.95 && ratioOf(b) < 0.95 && resolveLayout(a) === 'side' && resolveLayout(b) === 'side',
  );
}

// Crop that makes the image cover the page, centred on the focal point (0–1).
export function coverCrop(r, focal = { x: 0.5, y: 0.5 }) {
  if (r > A4_RATIO) {
    const w = A4_RATIO / r;
    return { x: clamp(focal.x - w / 2, 0, 1 - w), y: 0, w, h: 1 };
  }
  const h = r / A4_RATIO;
  return { x: 0, y: clamp(focal.y - h / 2, 0, 1 - h), w: 1, h };
}

export function cropLoss(crop) {
  return 1 - crop.w * crop.h;
}

function fit(r, boxW, boxH) {
  return r > boxW / boxH ? { w: boxW, h: boxW / r } : { w: boxH * r, h: boxH };
}

// --- page item helpers -------------------------------------------------------

const text = (x, y, lines, style) => ({ type: 'text', x, y, lines, style });
const rect = (x, y, w, h, fill, extra = {}) => ({ type: 'rect', x, y, w, h, fill, ...extra });

function imageSlot(img, x, y, w, h, crop = FULL_CROP) {
  const dpi = (img.width * crop.w) / (w / 25.4);
  return { type: 'image', ref: img.id, x, y, w, h, crop, dpi };
}

// Average brightness (0–1) of the part of an image that sits under a page rectangle.
function brightnessUnder(img, slot, area) {
  const grid = img.lumGrid;
  if (!grid) return 0;
  const u0 = slot.crop.x + ((area.x - slot.x) / slot.w) * slot.crop.w;
  const u1 = slot.crop.x + ((area.x + area.w - slot.x) / slot.w) * slot.crop.w;
  const v0 = slot.crop.y + ((area.y - slot.y) / slot.h) * slot.crop.h;
  const v1 = slot.crop.y + ((area.y + area.h - slot.y) / slot.h) * slot.crop.h;
  const c0 = clamp(Math.floor(u0 * grid.cols), 0, grid.cols - 1);
  const c1 = clamp(Math.ceil(u1 * grid.cols) - 1, c0, grid.cols - 1);
  const r0 = clamp(Math.floor(v0 * grid.rows), 0, grid.rows - 1);
  const r1 = clamp(Math.ceil(v1 * grid.rows) - 1, r0, grid.rows - 1);
  let sum = 0;
  let n = 0;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      sum += grid.data[r * grid.cols + c];
      n++;
    }
  }
  return n ? sum / n : 0;
}

function makeKit(measure, logoRatio) {
  return {
    width: (t, s) => measure(t, s),
    truncate: (t, s, w) => truncateWith(t, s, w, measure),
    wrap: (t, s, w, max) => wrapWith(t, s, w, max, measure),
    logo(x, y, w, tone = 'light', opacity = 0.9) {
      return { type: 'logo', x, y, w, h: w / logoRatio, tone, opacity };
    },
    logoRatio,
  };
}

// Label row + caption under a framed image: "VIEW 03  MASTER BEDROOM" / caption.
function footer(k, { x, y, w, view, roomName, caption, withLogo }) {
  const items = [];
  let right = x + w;
  if (withLogo) {
    const lw = 19;
    items.push(k.logo(right - lw, y + 3.6, lw));
    right -= lw + 8;
  }
  const label = `VIEW ${pad2(view)}`;
  items.push(text(x, y + 7, [label], S.label));
  const roomX = x + k.width(label, S.label) + 3;
  if (roomName && right - roomX > 12) {
    items.push(text(roomX, y + 7, [k.truncate(roomName.toUpperCase(), S.room, right - roomX)], S.room));
  }
  if (caption) items.push(text(x, y + 13, [k.truncate(caption, S.caption, right - x)], S.caption));
  return items;
}

// --- image page layouts -------------------------------------------------------

function bleedPage(k, img, view) {
  const crop = coverCrop(ratioOf(img), img.focal);
  const slot = imageSlot(img, 0, 0, W, H, crop);
  const items = [slot];
  const label = `VIEW ${pad2(view)}`;
  const by = H - 16;
  const bw = k.width(label, S.badge) + 8;
  items.push(rect(12, by, bw, 8, COLORS.accent, { radius: 1.5 }));
  items.push(text(16, by + 5.3, [label], S.badge));
  const lw = 24;
  const lh = lw / k.logoRatio;
  const logoArea = { x: W - 12 - lw, y: by + (8 - lh) / 2, w: lw, h: lh };
  if (img.caption) {
    const px = 12 + bw + 3;
    const maxW = logoArea.x - 8 - px;
    const line = k.truncate(img.caption, S.pill, maxW - 8);
    if (line) {
      items.push(rect(px, by, k.width(line, S.pill) + 8, 8, COLORS.matte, { radius: 1.5, opacity: 0.55 }));
      items.push(text(px + 4, by + 5.3, [line], S.pill));
    }
  }
  const tone = brightnessUnder(img, slot, logoArea) > 0.55 ? 'dark' : 'light';
  items.push(k.logo(logoArea.x, logoArea.y, lw, tone));
  return { layout: 'bleed', items, crop };
}

function framedPage(k, img, view, roomName) {
  const box = fit(ratioOf(img), W - 2 * MARGIN, H - 2 * MARGIN - FOOT);
  const x = (W - box.w) / 2;
  const y = (H - box.h - FOOT) / 2;
  return {
    layout: 'framed',
    items: [
      imageSlot(img, x, y, box.w, box.h),
      ...footer(k, { x, y: y + box.h, w: box.w, view, roomName, caption: img.caption, withLogo: true }),
    ],
  };
}

function bandPage(k, img, view, roomName) {
  const h = W / ratioOf(img);
  const y = (H - h - FOOT) / 2;
  return {
    layout: 'band',
    items: [
      imageSlot(img, 0, y, W, h),
      ...footer(k, { x: MARGIN, y: y + h, w: W - 2 * MARGIN, view, roomName, caption: img.caption, withLogo: true }),
    ],
  };
}

function sidePage(k, img, view, roomName) {
  const iw = H * ratioOf(img);
  const pw = W - iw;
  const imgX = img.flip ? pw : 0;
  const panelX = img.flip ? 0 : iw;
  const pad = clamp(pw * 0.14, 12, 22);
  const tx = panelX + pad;
  const tw = pw - 2 * pad;
  const items = [imageSlot(img, imgX, 0, iw, H)];

  const lw = 22;
  const logo = k.logo(panelX + pw - pad - lw, H - 14 - lw / k.logoRatio, lw);
  const roomLines = roomName ? k.wrap(roomName.toUpperCase(), S.panelRoom, tw, 2) : [];
  const capLines = img.caption ? k.wrap(img.caption, S.panelCaption, tw, 12) : [];
  // Block height measured from the label baseline to the last baseline.
  const roomH = roomLines.length ? 9 + (roomLines.length - 1) * S.panelRoom.leading : 0;
  const capH = capLines.length ? (roomLines.length ? 8 : 9) + (capLines.length - 1) * S.panelCaption.leading : 0;
  const bottomLimit = logo.y - 10;
  const y0 = Math.max(24, Math.min(H * 0.58, bottomLimit - roomH - capH));

  items.push(text(tx, y0, [`VIEW ${pad2(view)}`], S.label));
  if (roomLines.length) items.push(text(tx, y0 + 9, roomLines, S.panelRoom));
  if (capLines.length) items.push(text(tx, y0 + roomH + (roomLines.length ? 8 : 9), capLines, S.panelCaption));
  items.push(logo);
  return { layout: 'side', items };
}

function pairPage(k, a, b, view, roomName) {
  const ra = ratioOf(a);
  const rb = ratioOf(b);
  const h = Math.min(H - 2 * MARGIN - FOOT, (W - 2 * MARGIN - GUTTER) / (ra + rb));
  const wa = ra * h;
  const wb = rb * h;
  const x = (W - wa - wb - GUTTER) / 2;
  const y = (H - h - FOOT) / 2;
  const xb = x + wa + GUTTER;
  return {
    layout: 'pair',
    items: [
      imageSlot(a, x, y, wa, h),
      imageSlot(b, xb, y, wb, h),
      ...footer(k, { x, y: y + h, w: wa, view, roomName, caption: a.caption, withLogo: false }),
      ...footer(k, { x: xb, y: y + h, w: wb, view: view + 1, roomName, caption: b.caption, withLogo: true }),
    ],
  };
}

function imagePage(k, img, view, roomName) {
  switch (resolveLayout(img)) {
    case 'bleed': return bleedPage(k, img, view);
    case 'side': return sidePage(k, img, view, roomName);
    case 'band': return bandPage(k, img, view, roomName);
    default: return framedPage(k, img, view, roomName);
  }
}

// --- fixed pages ----------------------------------------------------------------

function coverPage() {
  return {
    key: 'cover',
    kind: 'cover',
    title: 'Cover',
    bg: COLORS.matte,
    items: [
      { type: 'image', ref: 'cover', x: 0, y: 0, w: W, h: H, crop: FULL_CROP },
      rect(0, 0, W, 0.35, COLORS.matte), // hides a 1px grey line along the top of the artwork
      { type: 'link', x: W * 0.638, y: H * 0.8, w: W * 0.245, h: H * 0.082, url: BRAND.website },
      { type: 'link', x: W * 0.638, y: H * 0.882, w: W * 0.245, h: H * 0.082, url: BRAND.instagram },
    ],
  };
}

function thanksPage() {
  return {
    key: 'thanks',
    kind: 'thanks',
    title: 'Thank you',
    bg: COLORS.matte,
    items: [
      { type: 'image', ref: 'thanks', x: 0, y: 0, w: W, h: H, crop: FULL_CROP },
      rect(0, 0, W, 0.35, COLORS.matte),
      { type: 'link', x: W * 0.638, y: H * 0.771, w: W * 0.245, h: H * 0.229, url: BRAND.website },
    ],
  };
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

function titlePage(k, project, roomNames) {
  const x = W * 0.58;
  const maxW = W - x - 14;
  let y = H * 0.58;
  const items = [text(x, y, ['PROPOSAL 3D FOR'], S.titleHead)];

  const who = [project.salutation, project.clientName.trim() || '________'].filter(Boolean).join(' ');
  const nameLines = k.wrap(who.toUpperCase(), S.titleName, maxW, 2);
  y += 8;
  items.push(text(x, y, nameLines, S.titleName));
  y += (nameLines.length - 1) * S.titleName.leading;

  if (roomNames.length) {
    const style = roomNames.length > 1 ? S.titleRoomsMany : S.titleRooms;
    const roomLines = k.wrap(roomNames.join('  ·  ').toUpperCase(), style, maxW, 3);
    y += 10;
    items.push(text(x, y, roomLines, style));
    y += (roomLines.length - 1) * style.leading;
  }
  if (project.siteLocation.trim()) {
    const siteLines = k.wrap(project.siteLocation.trim().toUpperCase(), S.titleSite, maxW, 2);
    y += 10;
    items.push(text(x, y, siteLines, S.titleSite));
    y += (siteLines.length - 1) * S.titleSite.leading;
  }
  const meta = [formatDate(project.date).toUpperCase(), project.revision > 1 ? `R${project.revision}` : '']
    .filter(Boolean)
    .join('  ·  ');
  if (meta) items.push(text(x, y + 10, [meta], S.titleMeta));
  return { key: 'title', kind: 'title', title: 'Title', bg: COLORS.titleBg, items };
}

function dividerPage(k, room, index, total, firstView, count) {
  const x = W * 0.58;
  const y = H * 0.5;
  const nameLines = k.wrap(room.name.trim().toUpperCase(), S.dividerName, W - x - 14, 3);
  const last = nameLines.length - 1;
  const views = count === 1 ? `VIEW ${pad2(firstView)}` : `VIEWS ${pad2(firstView)}–${pad2(firstView + count - 1)}`;
  return {
    key: `room-${room.id}`,
    kind: 'divider',
    title: room.name.trim() || 'Room',
    bg: COLORS.titleBg,
    items: [
      text(x, y - 12, [`ROOM ${pad2(index + 1)} / ${pad2(total)}`], S.dividerIndex),
      text(x, y, nameLines, S.dividerName),
      text(x, y + last * S.dividerName.leading + 10, [views], S.dividerMeta),
    ],
  };
}

// --- whole document ---------------------------------------------------------------

export function planPages({ project, images, logoRatio, measure = textWidth }) {
  const k = makeKit(measure, logoRatio);
  const rooms = project.rooms
    .map((room) => ({ ...room, ids: room.imageIds.filter((id) => images[id]) }))
    .filter((room) => room.ids.length);
  const named = rooms.map((r) => r.name.trim()).filter(Boolean);

  const pages = [coverPage(), titlePage(k, project, named)];
  let view = 0;
  rooms.forEach((room, ri) => {
    const roomName = room.name.trim();
    if (rooms.length > 1) pages.push(dividerPage(k, room, ri, rooms.length, view + 1, room.ids.length));
    for (let i = 0; i < room.ids.length; i++) {
      const a = images[room.ids[i]];
      const b = images[room.ids[i + 1]];
      let page;
      if (a.pairNext && canPair(a, b)) {
        page = { ...pairPage(k, a, b, view + 1, roomName), imageIds: [a.id, b.id] };
        page.title = `Views ${pad2(view + 1)}–${pad2(view + 2)}`;
        view += 2;
        i++;
      } else {
        page = { ...imagePage(k, a, view + 1, roomName), imageIds: [a.id] };
        page.title = `View ${pad2(view + 1)}`;
        view += 1;
      }
      page.key = `view-${page.imageIds.join('-')}`;
      page.kind = 'view';
      page.bg = COLORS.matte;
      page.roomName = roomName;
      page.lowRes = page.items.filter((it) => it.type === 'image' && it.dpi < LOW_DPI).map((it) => it.ref);
      pages.push(page);
    }
  });
  pages.push(thanksPage());
  return pages;
}

export function fileNameFor(project) {
  const safe = (s) => s.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const rooms = project.rooms.filter((r) => r.imageIds.length && r.name.trim());
  const parts = [safe(project.clientName) || 'CLIENT', rooms.length === 1 ? safe(rooms[0].name) : 'PROPOSAL'];
  if (project.revision > 1) parts.push(`R${project.revision}`);
  return `${parts.filter(Boolean).join('_')}.pdf`;
}
