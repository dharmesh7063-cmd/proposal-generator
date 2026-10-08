import { describe, expect, it } from 'vitest';
import { PAGE_W as W, PAGE_H as H, PT, A4_RATIO } from './constants';
import { autoLayout, cropLoss, fileNameFor, planPages } from './layout';

// Deterministic stand-in for canvas text measurement.
const measure = (text, style) => text.length * style.size * PT * 0.55 + (style.tracking || 0) * text.length;

let seq = 0;
const img = (width, height, extra = {}) => ({
  id: `img${++seq}`,
  name: `${width}x${height}.jpg`,
  width,
  height,
  caption: '',
  layout: 'auto',
  flip: false,
  focal: { x: 0.5, y: 0.5 },
  pairNext: false,
  ...extra,
});

function plan(rooms, projectExtra = {}) {
  const images = {};
  const projectRooms = rooms.map(([name, list], i) => {
    list.forEach((im) => (images[im.id] = im));
    return { id: `room${i}`, name, imageIds: list.map((im) => im.id) };
  });
  const project = {
    salutation: 'Mr.',
    clientName: 'Rahul Sharma',
    siteLocation: 'Ahmedabad',
    date: '2026-10-08',
    revision: 1,
    quality: 'share',
    rooms: projectRooms,
    ...projectExtra,
  };
  return { pages: planPages({ project, images, logoRatio: 3.75, measure }), project };
}

const slots = (page) => page.items.filter((it) => it.type === 'image');
const views = (pages) => pages.filter((p) => p.kind === 'view');

describe('auto layout by image shape', () => {
  it.each([
    [3000, 4000, 'side'],
    [1080, 1920, 'side'],
    [2000, 2000, 'side'],
    [3840, 2160, 'framed'],
    [1600, 1200, 'framed'],
    [3000, 2000, 'framed'],
    [3508, 2480, 'bleed'],
    [6000, 2000, 'band'],
  ])('%ix%i → %s', (w, h, expected) => {
    expect(autoLayout(w / h)).toBe(expected);
  });
});

describe('no cropping unless asked', () => {
  const shapes = [
    [3000, 4000], [1080, 1920], [2000, 2000], [3840, 2160], [1600, 1200], [3000, 2000], [6000, 2000], [8000, 2000],
    [2400, 1800], [1200, 1600],
  ];
  const { pages } = plan([['Living room', shapes.map(([w, h]) => img(w, h))]]);

  it('shows every image whole, undistorted, and inside the page', () => {
    for (const page of views(pages)) {
      for (const s of slots(page)) {
        expect(s.crop).toEqual({ x: 0, y: 0, w: 1, h: 1 });
        expect(s.x).toBeGreaterThanOrEqual(-1e-9);
        expect(s.y).toBeGreaterThanOrEqual(-1e-9);
        expect(s.x + s.w).toBeLessThanOrEqual(W + 1e-9);
        expect(s.y + s.h).toBeLessThanOrEqual(H + 1e-9);
      }
    }
  });

  it('keeps each image at its own aspect ratio', () => {
    const { pages: p, project } = plan([['Room', shapes.map(([w, h]) => img(w, h))]]);
    const all = Object.fromEntries(project.rooms[0].imageIds.map((id, i) => [id, shapes[i]]));
    for (const page of views(p)) {
      for (const s of slots(page)) {
        const [w, h] = all[s.ref];
        expect(s.w / s.h).toBeCloseTo(w / h, 6);
      }
    }
  });

  it('only fills the page edge to edge when that trims 2% or less', () => {
    const { pages: p } = plan([['Room', [img(3508, 2480), img(3600, 2480)]]]);
    const [a, b] = views(p);
    expect(a.layout).toBe('bleed');
    expect(cropLoss(slots(a)[0].crop)).toBeLessThanOrEqual(0.02);
    expect(slots(a)[0].w / slots(a)[0].h).toBeCloseTo(A4_RATIO, 6);
    expect(b.layout).toBe('framed'); // 3600:2480 would lose ~2.6%
  });

  it('crops a portrait only when full page is chosen, and says how much', () => {
    const { pages: p } = plan([['Room', [img(3000, 4000, { layout: 'bleed', focal: { x: 0.5, y: 0 } })]]]);
    const s = slots(views(p)[0])[0];
    expect(cropLoss(s.crop)).toBeCloseTo(1 - 0.75 / A4_RATIO, 4);
    expect(s.crop.y).toBe(0); // focal point at the top keeps the top
  });
});

describe('portraits', () => {
  it('fills the page height with the info panel beside it, on either side', () => {
    const { pages } = plan([['Bedroom', [img(3000, 4000), img(3000, 4000, { flip: true })]]]);
    const [left, right] = views(pages).map((p) => slots(p)[0]);
    expect(left).toMatchObject({ x: 0, y: 0, h: H });
    expect(left.w).toBeCloseTo(H * 0.75, 6);
    expect(right.x + right.w).toBeCloseTo(W, 6);
  });

  it('puts two portraits on one page when asked, without overlap', () => {
    const { pages } = plan([['Bedroom', [img(3000, 4000, { pairNext: true }), img(1080, 1920), img(3000, 4000)]]]);
    const v = views(pages);
    expect(v).toHaveLength(2);
    const [a, b] = slots(v[0]);
    expect(v[0].layout).toBe('pair');
    expect(a.x + a.w).toBeLessThan(b.x);
    expect(a.h).toBeCloseTo(b.h, 6);
    expect(v[0].title).toBe('Views 01–02');
    expect(v[1].title).toBe('View 03');
  });

  it('ignores pairing when the next image is not a portrait', () => {
    const { pages } = plan([['Bedroom', [img(3000, 4000, { pairNext: true }), img(3840, 2160)]]]);
    expect(views(pages).map((p) => p.layout)).toEqual(['side', 'framed']);
  });
});

describe('document structure', () => {
  it('adds a divider per room only when there are several rooms, and numbers views across rooms', () => {
    const one = plan([['Kitchen', [img(3840, 2160)]]]).pages;
    expect(one.map((p) => p.kind)).toEqual(['cover', 'title', 'view', 'thanks']);

    const many = plan([
      ['Kitchen', [img(3840, 2160), img(3840, 2160)]],
      ['Empty room', []],
      ['Bedroom', [img(3000, 4000)]],
    ]).pages;
    expect(many.map((p) => p.kind)).toEqual(['cover', 'title', 'divider', 'view', 'view', 'divider', 'view', 'thanks']);
    expect(views(many).map((p) => p.title)).toEqual(['View 01', 'View 02', 'View 03']);
  });

  it('flags images that will look soft', () => {
    const { pages } = plan([['Room', [img(800, 600), img(3840, 2160)]]]);
    const [low, fine] = views(pages);
    expect(low.lowRes).toHaveLength(1);
    expect(fine.lowRes).toHaveLength(0);
  });

  it('writes the salutation only when one is chosen', () => {
    const text = (pages) => pages[1].items.flatMap((it) => it.lines || []).join(' | ');
    expect(text(plan([['Room', [img(4, 3)]]]).pages)).toContain('MR. RAHUL SHARMA');
    expect(text(plan([['Room', [img(4, 3)]]], { salutation: '' }).pages)).toContain('| RAHUL SHARMA |');
    expect(text(plan([['Room', [img(4, 3)]]], { revision: 3 }).pages)).toContain('8 OCT 2026  ·  R3');
  });

  it('names the file after the client, the room and the revision', () => {
    expect(fileNameFor(plan([['Master Bedroom', [img(4, 3)]]]).project)).toBe('RAHULSHARMA_MASTERBEDROOM.pdf');
    expect(
      fileNameFor(plan([['Kitchen', [img(4, 3)]], ['Bedroom', [img(4, 3)]]], { revision: 2 }).project),
    ).toBe('RAHULSHARMA_PROPOSAL_R2.pdf');
  });

  it('keeps all text inside the page', () => {
    const long = 'A very long caption about the fluted walnut panelling, brass inlays and the concealed lighting detail';
    const { pages } = plan([
      ['A room with a remarkably long name for testing', [img(3000, 4000, { caption: long }), img(3840, 2160, { caption: long }), img(3508, 2480, { caption: long })]],
      ['Second', [img(1080, 1920, { caption: long, pairNext: true }), img(1080, 1920, { caption: long })]],
    ], { clientName: 'Someone With An Extraordinarily Long Family Name', siteLocation: 'Plot 12, Some Very Long Society Name, Ahmedabad' });
    for (const page of pages) {
      for (const it of page.items.filter((t) => t.type === 'text')) {
        for (const line of it.lines) {
          expect(it.x + measure(line, it.style)).toBeLessThanOrEqual(W - 5);
        }
        expect(it.y).toBeLessThan(H - 3);
      }
    }
  });
});
