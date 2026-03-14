const express = require('express');
const path = require('path');
const Document = require('../models/Document');
const Signature = require('../models/Signature');

const router = express.Router();

router.get('/:token', async (req, res) => {
  const token = String(req.params.token || '').trim();
  const document = await Document.findOne({ token });

  if (!document) {
    res.status(404).json({ error: 'Invalid signing token' });
    return;
  }

  if (new Date(document.expires_at).getTime() < Date.now()) {
    res.status(410).json({ error: 'Signing link has expired' });
    return;
  }

  res.json({
    token: document.token,
    status: document.status,
    expiresAt: document.expires_at,
    signatureFields: document.signature_fields || [],
    previewUrl: `/api/document/${token}/preview`
  });
});

router.get('/:token/preview', async (req, res) => {
  const token = String(req.params.token || '').trim();
  const document = await Document.findOne({ token });

  if (!document) {
    res.status(404).json({ error: 'Invalid signing token' });
    return;
  }

  if (new Date(document.expires_at).getTime() < Date.now()) {
    res.status(410).json({ error: 'Signing link has expired' });
    return;
  }

  const resolvedPath = path.resolve(document.template_path);
  res.sendFile(resolvedPath);
});

router.get('/:token/signed', async (req, res) => {
  const token = String(req.params.token || '').trim();
  const document = await Document.findOne({ token });

  if (!document) {
    res.status(404).json({ error: 'Invalid signing token' });
    return;
  }

  if (document.status !== 'signed') {
    res.status(409).json({ error: 'Document is not signed yet' });
    return;
  }

  const signature = await Signature.findOne({ token }).sort({ signed_at: -1 });
  if (!signature) {
    res.status(404).json({ error: 'Signed PDF record not found' });
    return;
  }

  const resolvedPath = path.resolve(signature.pdf_path);
  res.download(resolvedPath, `signed-offer-${token}.pdf`);
});

module.exports = router;
