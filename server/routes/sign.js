const express = require('express');
const Document = require('../models/Document');
const Signature = require('../models/Signature');
const { embedSignatureIntoPdf } = require('../services/pdfService');
const { sendSignedPdfToAdmin, sendSignedPdfToRecipient } = require('../services/emailService');

const router = express.Router();

function resolveIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0];
  }

  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }

  return req.socket.remoteAddress || '';
}

router.post('/', async (req, res) => {
  try {
    const token = String(req.body.token || '').trim();
    const name = String(req.body.name || '').trim();
    const signatureDataUrl = String(req.body.signatureDataUrl || '').trim();
    const approved = Boolean(req.body.approved);

    if (!token || !name || !signatureDataUrl) {
      res.status(400).json({ error: 'token, name, and signatureDataUrl are required' });
      return;
    }

    if (!approved) {
      res.status(400).json({ error: 'Approval is required before signing' });
      return;
    }

    const document = await Document.findOne({ token });

    if (!document) {
      res.status(404).json({ error: 'Invalid signing token' });
      return;
    }

    if (document.status === 'signed') {
      res.status(409).json({ error: 'Document already signed' });
      return;
    }

    if (new Date(document.expires_at).getTime() < Date.now()) {
      res.status(410).json({ error: 'Signing link has expired' });
      return;
    }

    const signedAt = new Date().toISOString();
    const ipAddress = resolveIp(req);
    const userAgent = String(req.headers['user-agent'] || '');

    const signedPdfPath = await embedSignatureIntoPdf({
      templatePath: document.template_path,
      token,
      name,
      signatureDataUrl,
      signedAt,
      signatureFields: document.signature_fields
    });

    await Signature.create({
      token,
      name,
      ip_address: ipAddress,
      signed_at: new Date(signedAt),
      user_agent: userAgent,
      applied_fields: document.signature_fields || [],
      pdf_path: signedPdfPath
    });

    document.status = 'signed';
    await document.save();

    await sendSignedPdfToAdmin({ token, signedPdfPath });
    await sendSignedPdfToRecipient({
      token,
      signedPdfPath,
      recipient: document.candidate_email,
      subject: 'Your Signed Offer Letter',
      text: 'Your signed offer letter is attached for your records.'
    });

    res.status(200).json({
      message: 'Document signed successfully',
      signedAt,
      downloadUrl: `/api/document/${token}/signed`
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to sign document' });
  }
});

module.exports = router;
