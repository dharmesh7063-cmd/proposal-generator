# Proposal Generator — INTARA DESIGNS

A client-side web app that generates professional landscape A4 PDF proposals for interior design clients. Upload images, customize branding, and download a polished PDF — no backend required.

## Features

- **Client details form** — enter client name and room name
- **Image upload** — drag-and-drop or file picker, reorder with arrows, remove with one click
- **Customizable branding** — company name, tagline, website, Instagram, accent color, background color
- **One-click PDF generation** — landscape A4 PDF with cover page, title page, image pages (with gradient overlays and view badges), and thank-you page
- **Progress bar** — real-time feedback during PDF generation
- **PDF preview summary** — see page flow as chips before generating
- **Dark theme UI** — #0e0e0e background, responsive design
- **100% client-side** — no backend, no API keys, no data leaves your browser

## Tech Stack

- React 19 + Vite
- Tailwind CSS v4
- jsPDF (client-side PDF generation)
- Google Fonts (DM Sans + Playfair Display)

## Setup

```bash
# Clone the repo
git clone <your-repo-url>
cd proposal-generator

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open http://localhost:5173 in your browser.

## Build for Production

```bash
npm run build
npm run preview   # preview the production build locally
```

## Deploy to Vercel

### Option A: Vercel CLI

```bash
npm install -g vercel
vercel
```

### Option B: GitHub Integration

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import the repo
3. Vercel auto-detects Vite — just click Deploy

## PDF Output

The generated PDF includes:

1. **Cover page** — dark background, company name, tagline, website, Instagram
2. **Title page** — "PROPOSAL 3D FOR / MR. [CLIENT NAME] / [ROOM NAME]"
3. **Image pages** — full-bleed images with gradient overlay, "VIEW 01/02/03..." badge, company watermark
4. **Thank You page** — dark background, "THANK YOU", website, Instagram

Output filename: `CLIENTNAME_ROOMNAME.pdf`

## Default Branding

| Field | Default |
|-------|---------|
| Company | INTARA DESIGNS |
| Tagline | INTERIOR \| ARCHITECTURAL \| PLANNING |
| Website | www.intaradesigns.com |
| Instagram | @intara_designs |
| Accent Color | #C0623A |

All branding is customizable in the expandable "Company Branding" section.
