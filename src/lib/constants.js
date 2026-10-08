// Every layout and renderer works in millimetres on an A4 landscape page.
export const PAGE_W = 297;
export const PAGE_H = 210;
export const A4_RATIO = PAGE_W / PAGE_H;

// Millimetres per typographic point.
export const PT = 25.4 / 72;

export const COLORS = {
  matte: '#000000', // image pages; matches the black of the cover and thank-you art
  cream: '#F2E6D8', // text on black, same cream as the logo on the cover
  creamMuted: '#A9A197', // cream at ~70% on black, kept opaque so PDF and preview match
  titleBg: '#EDE0D4', // title and room divider pages
  accent: '#C0623A', // terracotta for labels and title-page text
  white: '#FFFFFF',
};

export const QUALITY = {
  share: { label: 'Share', hint: 'Smaller file for WhatsApp and email', dpi: 200, jpeg: 0.82 },
  print: { label: 'Print', hint: 'Full resolution for printing', dpi: 300, jpeg: 0.9 },
};

// Below this, a render looks soft on the page.
export const LOW_DPI = 150;

export const SALUTATIONS = ['Mr.', 'Mrs.', 'Ms.', 'Mr. & Mrs.', 'Dr.', ''];

export const BRAND = {
  name: 'INTARA DESIGNS',
  website: 'https://www.intaradesigns.com',
  instagram: 'https://www.instagram.com/intara_designs',
};
