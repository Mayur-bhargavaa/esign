const fs = require('fs/promises');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

async function embedSignatureIntoPdf({
  templatePath,
  token,
  name,
  signatureDataUrl,
  signedAt,
  signatureFields
}) {
  const pdfBytes = await fs.readFile(templatePath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();

  if (pages.length === 0) {
    throw new Error('Invalid PDF template: no pages found');
  }

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const signatureBase64 = signatureDataUrl.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
  const signatureBuffer = Buffer.from(signatureBase64, 'base64');
  const pngImage = await pdfDoc.embedPng(signatureBuffer);

  const fieldsToUse = Array.isArray(signatureFields) ? signatureFields : [];
  if (fieldsToUse.length === 0) {
    throw new Error('No signature fields configured for this document');
  }

  for (const field of fieldsToUse) {
    const pageIndex = Number.isInteger(field.page) ? field.page : 0;
    const page = pages[pageIndex];
    if (!page) {
      continue;
    }

    const { width, height } = page.getSize();
    const signatureWidth = width * field.width_pct;
    const signatureHeight = (pngImage.height / pngImage.width) * signatureWidth;
    const markerX = width * field.x_pct;
    const markerY = height - height * field.y_pct;

    const signatureX = Math.max(4, Math.min(markerX - signatureWidth / 2, width - signatureWidth - 4));
    const signatureY = Math.max(4, Math.min(markerY - signatureHeight / 2, height - signatureHeight - 4));

    page.drawImage(pngImage, {
      x: signatureX,
      y: Math.max(4, signatureY),
      width: signatureWidth,
      height: signatureHeight
    });

    const nameY = Math.max(4, signatureY - 14);
    const dateY = Math.max(4, nameY - 12);

    page.drawText(`Name: ${name}`, {
      x: signatureX,
      y: nameY,
      size: 10,
      font: helvetica,
      color: rgb(0, 0, 0)
    });

    page.drawText(`Date: ${new Date(signedAt).toLocaleDateString()}`, {
      x: signatureX,
      y: dateY,
      size: 10,
      font: helvetica,
      color: rgb(0, 0, 0)
    });
  }

  const signedDir = path.resolve(__dirname, '..', 'storage', 'signed');
  const signedPdfPath = path.resolve(signedDir, `${token}.pdf`);

  const signedPdfBytes = await pdfDoc.save();
  await fs.writeFile(signedPdfPath, signedPdfBytes);

  return signedPdfPath;
}

module.exports = {
  embedSignatureIntoPdf
};
