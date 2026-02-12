import { jsPDF } from 'jspdf';

// A4 landscape dimensions in mm
const W = 297;
const H = 210;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function imgToDataUrl(img, maxW = 1920, maxH = 1080) {
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  // Downscale large images to keep PDF size reasonable
  if (w > maxW || h > maxH) {
    const ratio = Math.min(maxW / w, maxH / h);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.85);
}

// Draw a dark page background
function drawDarkBg(doc, bgColor) {
  doc.setFillColor(bgColor);
  doc.rect(0, 0, W, H, 'F');
}

// Cover page: dark bg, company name, tagline, website, instagram
function drawCoverPage(doc, branding) {
  drawDarkBg(doc, branding.bgColor);

  // Accent line
  doc.setDrawColor(branding.accentColor);
  doc.setLineWidth(0.8);
  doc.line(W / 2 - 30, 78, W / 2 + 30, 78);

  // Company name
  doc.setTextColor('#FFFFFF');
  doc.setFontSize(36);
  doc.setFont('helvetica', 'bold');
  doc.text(branding.companyName, W / 2, 95, { align: 'center' });

  // Tagline
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#CCCCCC');
  doc.text(branding.tagline, W / 2, 108, { align: 'center' });

  // Accent line below tagline
  doc.setDrawColor(branding.accentColor);
  doc.line(W / 2 - 30, 115, W / 2 + 30, 115);

  // Website
  doc.setFontSize(9);
  doc.setTextColor('#999999');
  doc.text(branding.website, W / 2, 135, { align: 'center' });

  // Instagram
  doc.setFontSize(9);
  doc.text(branding.instagram, W / 2, 142, { align: 'center' });
}

// Title page: PROPOSAL 3D FOR / CLIENT NAME / ROOM NAME
function drawTitlePage(doc, clientName, roomName, branding) {
  drawDarkBg(doc, branding.bgColor);

  // "PROPOSAL 3D FOR"
  doc.setTextColor('#999999');
  doc.setFontSize(13);
  doc.setFont('helvetica', 'normal');
  doc.text('PROPOSAL 3D FOR', W / 2, 80, { align: 'center' });

  // Client name
  doc.setTextColor('#FFFFFF');
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text(`MR. ${clientName.toUpperCase()}`, W / 2, 100, { align: 'center' });

  // Room name
  doc.setFontSize(18);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(branding.accentColor);
  doc.text(roomName.toUpperCase(), W / 2, 115, { align: 'center' });

  // Decorative line
  doc.setDrawColor(branding.accentColor);
  doc.setLineWidth(0.8);
  doc.line(W / 2 - 25, 122, W / 2 + 25, 122);

  // Company name small at bottom
  doc.setFontSize(8);
  doc.setTextColor('#666666');
  doc.text(branding.companyName, W / 2, 185, { align: 'center' });
}

// Image page: full-bleed image with gradient overlay, view badge, watermark
function drawImagePage(doc, dataUrl, index, branding) {
  // Full-bleed image - cover the entire page
  // We use the image dimensions to calculate cover-fit
  doc.addImage(dataUrl, 'JPEG', 0, 0, W, H);

  // Gradient overlay at bottom (simulated with semi-transparent rectangles)
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
  // Reset opacity
  doc.setGState(new doc.GState({ opacity: 1 }));

  // View badge (bottom-left)
  const badgeText = `VIEW ${String(index + 1).padStart(2, '0')}`;
  const badgeW = 32;
  const badgeH = 8;
  const badgeX = 12;
  const badgeY = H - 16;

  // Badge background with accent color
  doc.setFillColor(branding.accentColor);
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1.5, 1.5, 'F');

  // Badge text
  doc.setTextColor('#FFFFFF');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text(badgeText, badgeX + badgeW / 2, badgeY + 5.5, { align: 'center' });

  // Watermark (bottom-right)
  doc.setFontSize(6);
  doc.setTextColor('#FFFFFF');
  doc.setGState(new doc.GState({ opacity: 0.5 }));
  doc.text(branding.companyName, W - 12, H - 10, { align: 'right' });
  doc.setGState(new doc.GState({ opacity: 1 }));
}

// Thank you page
function drawThankYouPage(doc, branding) {
  drawDarkBg(doc, branding.bgColor);

  // Accent line above
  doc.setDrawColor(branding.accentColor);
  doc.setLineWidth(0.8);
  doc.line(W / 2 - 30, 80, W / 2 + 30, 80);

  // THANK YOU
  doc.setTextColor('#FFFFFF');
  doc.setFontSize(36);
  doc.setFont('helvetica', 'bold');
  doc.text('THANK YOU', W / 2, 100, { align: 'center' });

  // Accent line below
  doc.setDrawColor(branding.accentColor);
  doc.line(W / 2 - 30, 108, W / 2 + 30, 108);

  // Website
  doc.setFontSize(10);
  doc.setTextColor('#CCCCCC');
  doc.text(branding.website, W / 2, 128, { align: 'center' });

  // Instagram
  doc.setFontSize(10);
  doc.setTextColor('#999999');
  doc.text(branding.instagram, W / 2, 136, { align: 'center' });

  // Company branding at bottom
  doc.setFontSize(7);
  doc.setTextColor('#555555');
  doc.text(branding.companyName, W / 2, 185, { align: 'center' });
}

/**
 * Generate the proposal PDF.
 * @param {Object} params
 * @param {string} params.clientName
 * @param {string} params.roomName
 * @param {Array<string>} params.imageSrcs - array of data URLs or object URLs
 * @param {Object} params.branding
 * @param {function} params.onProgress - callback(percent: 0-100)
 * @returns {Promise<void>}
 */
export async function generatePdf({ clientName, roomName, imageSrcs, branding, onProgress }) {
  const totalSteps = imageSrcs.length + 3; // cover + title + images + thankyou
  let step = 0;

  const report = (label) => {
    step++;
    onProgress?.(Math.round((step / totalSteps) * 100));
  };

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // 1. Cover page
  drawCoverPage(doc, branding);
  report('cover');

  // 2. Title page
  doc.addPage();
  drawTitlePage(doc, clientName, roomName, branding);
  report('title');

  // 3. Image pages
  for (let i = 0; i < imageSrcs.length; i++) {
    doc.addPage();
    const img = await loadImage(imageSrcs[i]);
    const dataUrl = imgToDataUrl(img);
    drawImagePage(doc, dataUrl, i, branding);
    report(`image-${i}`);
  }

  // 4. Thank you page
  doc.addPage();
  drawThankYouPage(doc, branding);
  report('thankyou');

  // Save
  const safeName = (s) => s.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const fileName = `${safeName(clientName)}_${safeName(roomName)}.pdf`;
  doc.save(fileName);
}
