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

// Convert image to data URL with cover-fit crop (centered)
function imgToCoverDataUrl(img, targetW = 1920, targetH = 1080) {
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;
  const targetRatio = targetW / targetH;
  const srcRatio = srcW / srcH;

  let cropX = 0, cropY = 0, cropW = srcW, cropH = srcH;

  if (srcRatio > targetRatio) {
    // Image is wider — crop sides, keep full height
    cropW = Math.round(srcH * targetRatio);
    cropX = Math.round((srcW - cropW) / 2);
  } else {
    // Image is taller — crop top/bottom, keep full width
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

// Draw a dark page background
function drawDarkBg(doc, bgColor) {
  doc.setFillColor(bgColor);
  doc.rect(0, 0, W, H, 'F');
}

// Cover page: dark bg, logo, company name, tagline, website, instagram
function drawCoverPage(doc, branding, logoDataUrl) {
  drawDarkBg(doc, branding.bgColor);

  let contentY = 70;

  // Logo
  if (logoDataUrl) {
    const logoH = 22;
    const logoW = 22;
    doc.addImage(logoDataUrl, 'PNG', W / 2 - logoW / 2, contentY, logoW, logoH);
    contentY += logoH + 8;
  }

  // Accent line
  doc.setDrawColor(branding.accentColor);
  doc.setLineWidth(0.8);
  doc.line(W / 2 - 30, contentY, W / 2 + 30, contentY);
  contentY += 17;

  // Company name
  doc.setTextColor('#FFFFFF');
  doc.setFontSize(36);
  doc.setFont('helvetica', 'bold');
  doc.text(branding.companyName, W / 2, contentY, { align: 'center' });
  contentY += 13;

  // Tagline
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#CCCCCC');
  doc.text(branding.tagline, W / 2, contentY, { align: 'center' });
  contentY += 7;

  // Accent line below tagline
  doc.setDrawColor(branding.accentColor);
  doc.line(W / 2 - 30, contentY, W / 2 + 30, contentY);
  contentY += 20;

  // Website
  doc.setFontSize(9);
  doc.setTextColor('#999999');
  doc.text(branding.website, W / 2, contentY, { align: 'center' });
  contentY += 7;

  // Instagram
  doc.setFontSize(9);
  doc.text(branding.instagram, W / 2, contentY, { align: 'center' });
}

// Title page: PROPOSAL 3D FOR / CLIENT NAME / ROOM NAME
function drawTitlePage(doc, clientName, roomName, branding, logoDataUrl) {
  drawDarkBg(doc, branding.bgColor);

  let contentY = 72;

  // Logo
  if (logoDataUrl) {
    const logoH = 18;
    const logoW = 18;
    doc.addImage(logoDataUrl, 'PNG', W / 2 - logoW / 2, contentY - 25, logoW, logoH);
  }

  // "PROPOSAL 3D FOR"
  doc.setTextColor('#999999');
  doc.setFontSize(13);
  doc.setFont('helvetica', 'normal');
  doc.text('PROPOSAL 3D FOR', W / 2, contentY + 8, { align: 'center' });

  // Client name
  doc.setTextColor('#FFFFFF');
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text(`MR. ${clientName.toUpperCase()}`, W / 2, contentY + 28, { align: 'center' });

  // Room name
  doc.setFontSize(18);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(branding.accentColor);
  doc.text(roomName.toUpperCase(), W / 2, contentY + 43, { align: 'center' });

  // Decorative line
  doc.setDrawColor(branding.accentColor);
  doc.setLineWidth(0.8);
  doc.line(W / 2 - 25, contentY + 50, W / 2 + 25, contentY + 50);

  // Company name small at bottom
  doc.setFontSize(8);
  doc.setTextColor('#666666');
  doc.text(branding.companyName, W / 2, 185, { align: 'center' });
}

// Image page: cover-fit centered image with gradient overlay, view badge, logo watermark
function drawImagePage(doc, dataUrl, index, branding, logoDataUrl) {
  // Full-bleed cover-fit image (already cropped/centered)
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

  doc.setFillColor(branding.accentColor);
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1.5, 1.5, 'F');

  doc.setTextColor('#FFFFFF');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text(badgeText, badgeX + badgeW / 2, badgeY + 5.5, { align: 'center' });

  // Logo watermark (bottom-right) — use logo image if available, else text
  if (logoDataUrl) {
    const wmH = 10;
    const wmW = 10;
    doc.setGState(new doc.GState({ opacity: 0.5 }));
    doc.addImage(logoDataUrl, 'PNG', W - 12 - wmW, H - 10 - wmH, wmW, wmH);
    doc.setGState(new doc.GState({ opacity: 1 }));
  } else {
    doc.setFontSize(6);
    doc.setTextColor('#FFFFFF');
    doc.setGState(new doc.GState({ opacity: 0.5 }));
    doc.text(branding.companyName, W - 12, H - 10, { align: 'right' });
    doc.setGState(new doc.GState({ opacity: 1 }));
  }
}

// Thank you page
function drawThankYouPage(doc, branding, logoDataUrl) {
  drawDarkBg(doc, branding.bgColor);

  let contentY = 68;

  // Logo
  if (logoDataUrl) {
    const logoH = 20;
    const logoW = 20;
    doc.addImage(logoDataUrl, 'PNG', W / 2 - logoW / 2, contentY, logoW, logoH);
    contentY += logoH + 8;
  }

  // Accent line above
  doc.setDrawColor(branding.accentColor);
  doc.setLineWidth(0.8);
  doc.line(W / 2 - 30, contentY, W / 2 + 30, contentY);
  contentY += 20;

  // THANK YOU
  doc.setTextColor('#FFFFFF');
  doc.setFontSize(36);
  doc.setFont('helvetica', 'bold');
  doc.text('THANK YOU', W / 2, contentY, { align: 'center' });
  contentY += 8;

  // Accent line below
  doc.setDrawColor(branding.accentColor);
  doc.line(W / 2 - 30, contentY, W / 2 + 30, contentY);
  contentY += 20;

  // Website
  doc.setFontSize(10);
  doc.setTextColor('#CCCCCC');
  doc.text(branding.website, W / 2, contentY, { align: 'center' });
  contentY += 8;

  // Instagram
  doc.setFontSize(10);
  doc.setTextColor('#999999');
  doc.text(branding.instagram, W / 2, contentY, { align: 'center' });

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
 * @param {string|null} params.logoSrc - logo data URL or object URL
 * @param {function} params.onProgress - callback(percent: 0-100)
 * @returns {Promise<void>}
 */
export async function generatePdf({ clientName, roomName, imageSrcs, branding, logoSrc, onProgress }) {
  const totalSteps = imageSrcs.length + 3;
  let step = 0;

  const report = () => {
    step++;
    onProgress?.(Math.round((step / totalSteps) * 100));
  };

  // Load logo if provided
  let logoDataUrl = null;
  if (logoSrc) {
    try {
      const logoImg = await loadImage(logoSrc);
      const c = document.createElement('canvas');
      c.width = logoImg.naturalWidth;
      c.height = logoImg.naturalHeight;
      c.getContext('2d').drawImage(logoImg, 0, 0);
      logoDataUrl = c.toDataURL('image/png');
    } catch { /* no logo */ }
  }

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // 1. Cover page
  drawCoverPage(doc, branding, logoDataUrl);
  report();

  // 2. Title page
  doc.addPage();
  drawTitlePage(doc, clientName, roomName, branding, logoDataUrl);
  report();

  // 3. Image pages (cover-fit centered)
  for (let i = 0; i < imageSrcs.length; i++) {
    doc.addPage();
    const img = await loadImage(imageSrcs[i]);
    const dataUrl = imgToCoverDataUrl(img);
    drawImagePage(doc, dataUrl, i, branding, logoDataUrl);
    report();
  }

  // 4. Thank you page
  doc.addPage();
  drawThankYouPage(doc, branding, logoDataUrl);
  report();

  // Save
  const safeName = (s) => s.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const fileName = `${safeName(clientName)}_${safeName(roomName)}.pdf`;
  doc.save(fileName);
}
