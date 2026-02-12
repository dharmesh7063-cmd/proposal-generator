import { jsPDF } from 'jspdf';
import coverImg from './assets/cover.jpg';
import thankyouImg from './assets/thankyou.jpg';
import logoWhite from './assets/logo-white.png';

// A4 landscape dimensions in mm
const W = 297;
const H = 210;

// Title page background color (beige/cream from reference)
const TITLE_BG = '#EDE0D4';
// Text color on title page (terracotta)
const TITLE_TEXT = '#C0623A';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Convert image to data URL with cover-fit crop (centered)
// Target ratio matches A4 landscape (297:210 = 1.4143)
function imgToCoverDataUrl(img, targetW = 2970, targetH = 2100) {
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;
  const targetRatio = targetW / targetH;
  const srcRatio = srcW / srcH;

  let cropX = 0, cropY = 0, cropW = srcW, cropH = srcH;

  if (srcRatio > targetRatio) {
    cropW = Math.round(srcH * targetRatio);
    cropX = Math.round((srcW - cropW) / 2);
  } else {
    cropH = Math.round(srcW / targetRatio);
    cropY = Math.round((srcH - cropH) / 2);
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);
  return canvas.toDataURL('image/jpeg', 0.85);
}

// Convert any image src to a base64 data URL
function imgToDataUrl(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext('2d').drawImage(img, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.92);
}

function imgToPngDataUrl(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext('2d').drawImage(img, 0, 0);
  return canvas.toDataURL('image/png');
}

// Page 1: Cover — hardcoded full-bleed image
function drawCoverPage(doc, coverDataUrl) {
  doc.addImage(coverDataUrl, 'JPEG', 0, 0, W, H);
}

// Page 2: Title — solid beige bg, text positioned right-of-center
function drawTitlePage(doc, clientName, roomName) {
  // Solid beige background
  doc.setFillColor(TITLE_BG);
  doc.rect(0, 0, W, H, 'F');

  // Text block positioned at ~60% from left, ~60% from top (matching reference)
  const textX = W * 0.58;
  const textY = H * 0.58;

  // "PROPOSAL 3D FOR" — bold, terracotta
  doc.setTextColor(TITLE_TEXT);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('PROPOSAL 3D FOR', textX, textY, { align: 'left' });

  // "MR. CLIENT NAME" — normal weight, terracotta
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(`MR. ${clientName.toUpperCase()}`, textX, textY + 12, { align: 'left' });

  // Room name — normal weight, terracotta, with slight gap
  doc.setFontSize(14);
  doc.text(roomName.toUpperCase(), textX, textY + 28, { align: 'left' });
}

// Image pages: cover-fit centered image with gradient overlay, view badge, logo watermark
function drawImagePage(doc, dataUrl, index, accentColor, logoDataUrl) {
  // Full-bleed cover-fit image
  doc.addImage(dataUrl, 'JPEG', 0, 0, W, H);

  // Gradient overlay at bottom
  const gradientSteps = 40;
  const gradientHeight = 50;
  for (let i = 0; i < gradientSteps; i++) {
    const alpha = (i / gradientSteps) * 0.7;
    const y = H - gradientHeight + (i * gradientHeight) / gradientSteps;
    const stepH = gradientHeight / gradientSteps + 0.5;
    doc.setFillColor(0, 0, 0);
    doc.setGState(new doc.GState({ opacity: alpha }));
    doc.rect(0, y, W, stepH, 'F');
  }
  doc.setGState(new doc.GState({ opacity: 1 }));

  // View badge (bottom-left)
  const badgeText = `VIEW ${String(index + 1).padStart(2, '0')}`;
  const badgeW = 32;
  const badgeH = 8;
  const badgeX = 12;
  const badgeY = H - 16;

  doc.setFillColor(accentColor);
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1.5, 1.5, 'F');

  doc.setTextColor('#FFFFFF');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text(badgeText, badgeX + badgeW / 2, badgeY + 5.5, { align: 'center' });

  // Logo watermark (bottom-right)
  if (logoDataUrl) {
    const wmW = 28;
    const wmH = 9; // aspect ratio ~3.14:1
    doc.setGState(new doc.GState({ opacity: 0.45 }));
    doc.addImage(logoDataUrl, 'PNG', W - 12 - wmW, H - 8 - wmH, wmW, wmH);
    doc.setGState(new doc.GState({ opacity: 1 }));
  }
}

// Last page: Thank You — hardcoded full-bleed image
function drawThankYouPage(doc, thankYouDataUrl) {
  doc.addImage(thankYouDataUrl, 'JPEG', 0, 0, W, H);
}

/**
 * Generate the proposal PDF.
 */
export async function generatePdf({ clientName, roomName, imageSrcs, accentColor, onProgress }) {
  const totalSteps = imageSrcs.length + 3; // cover + title + images + thankyou
  let step = 0;
  const report = () => {
    step++;
    onProgress?.(Math.round((step / totalSteps) * 100));
  };

  // Pre-load all hardcoded assets
  const [coverImgEl, thankyouImgEl, logoImgEl] = await Promise.all([
    loadImage(coverImg),
    loadImage(thankyouImg),
    loadImage(logoWhite),
  ]);

  const coverDataUrl = imgToDataUrl(coverImgEl);
  const thankyouDataUrl = imgToDataUrl(thankyouImgEl);
  const logoDataUrl = imgToPngDataUrl(logoImgEl);

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // 1. Cover page (hardcoded image)
  drawCoverPage(doc, coverDataUrl);
  report();

  // 2. Title page (solid beige + text)
  doc.addPage();
  drawTitlePage(doc, clientName, roomName);
  report();

  // 3. Image pages (user uploads, cover-fit centered)
  for (let i = 0; i < imageSrcs.length; i++) {
    doc.addPage();
    const img = await loadImage(imageSrcs[i]);
    const dataUrl = imgToCoverDataUrl(img);
    drawImagePage(doc, dataUrl, i, accentColor, logoDataUrl);
    report();
  }

  // 4. Thank You page (hardcoded image)
  doc.addPage();
  drawThankYouPage(doc, thankyouDataUrl);
  report();

  // Save
  const safeName = (s) => s.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const fileName = `${safeName(clientName)}_${safeName(roomName)}.pdf`;
  doc.save(fileName);
}
