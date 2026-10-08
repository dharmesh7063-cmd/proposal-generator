# Proposal Generator — INTARA DESIGNS

A browser app that turns 3D renders into a branded A4 landscape PDF proposal for a client. Nothing is uploaded anywhere: images, drafts and the PDF all stay in the browser.

## What it does

- **Never crops by accident.** Each image gets a page layout that suits its shape:

  | Image shape | Page layout |
  |---|---|
  | Close to A4 (within 2%) | Full page, edge to edge |
  | Landscape (4:3, 3:2, 16:9…) | Framed on black, caption strip underneath |
  | Portrait or square | Full page height, info panel beside it (either side) |
  | Panorama (wider than 2:1) | Edge-to-edge band, caption underneath |
  | Two portraits | Optional: both on one page |

  You can override any image: *Framed*, *Side panel*, or *Full page (crops)*. When you choose to crop, you drag on the image to pick what stays in frame, and the app shows how much is cut off.
- **Preview = PDF.** The page previews and the PDF are drawn from the same layout data with the same font files (DM Sans), so line breaks and positions match.
- **Rooms.** Add several rooms to one proposal. Each room gets a divider page, the title page lists them, and view numbers run across the whole proposal.
- **Captions** for every view, shown beside or under the image.
- **Title page details:** salutation (Mr., Mrs., Mr. & Mrs., none…), client, rooms, site location, date and revision (R2+ also goes into the file name).
- **Image handling:** no upscaling, high-quality downscaling, transparent PNGs placed on white or black depending on the drawing, iPhone HEIC photos converted automatically, and a warning when an image is too low-resolution for its page.
- **Two quality presets:** *Share* (200 dpi, small enough for WhatsApp and email) and *Print* (300 dpi), with a size estimate before you export.
- **Autosave** to the browser (IndexedDB), so a refresh doesn't lose your work. *New proposal* clears it.
- **Share button** on devices that support sharing files (phones, Safari), which sends the PDF straight to WhatsApp, Mail and so on.

## PDF structure

1. Cover (brand artwork, clickable website and Instagram links)
2. Title page
3. Room divider (only when there's more than one room)
4. View pages
5. Thank-you page (brand artwork, clickable website link)

File name: `CLIENTNAME_ROOMNAME.pdf`, or `CLIENTNAME_PROPOSAL.pdf` for several rooms, plus `_R2` and so on for revisions.

## Code map

| File | Role |
|---|---|
| `src/lib/layout.js` | Picks each page's layout and returns page specs in millimetres. Pure, unit-tested. |
| `src/components/PageSvg.jsx` | Draws a page spec as SVG for the preview. |
| `src/lib/pdf.js` | Draws the same page specs with jsPDF (loaded only when exporting). |
| `src/lib/images.js` | Decoding, HEIC conversion, previews, and the exact pixels each PDF slot needs. |
| `src/lib/text.js` | Font files, text measuring and wrapping shared by preview and PDF. |
| `src/lib/brandAssets.js` | Cover, thank-you and logo (trimmed to the wordmark, light and dark versions). |
| `src/lib/storage.js` | Draft autosave in IndexedDB. |
| `src/state.js` | Reducer for client details, rooms and images. |

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # layout unit tests (vitest)
npm run lint
npm run build
```

## Deploy

The repo is a Vite static site, deployed on Vercel (`vercel.json`). Push to `main` or run `vercel --prod`.

## Fonts

DM Sans (SIL Open Font License, see `src/assets/fonts/OFL.txt`) is bundled so the PDF and the preview use identical metrics.
