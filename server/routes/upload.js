const path = require('path');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const upload = require('../upload');
const Document = require('../models/Document');
const { sendSigningLinkEmail } = require('../services/emailService');

const router = express.Router();

router.post('/', upload.single('file'), async (req, res) => {
  try {
    const candidateEmail = String(req.body.candidateEmail || '').trim().toLowerCase();
    const rawSignatureFields = String(req.body.signatureFields || '[]');

    if (!candidateEmail || !req.file) {
      res.status(400).json({ error: 'Candidate email and PDF file are required' });
      return;
    }

    let signatureFields;
    try {
      signatureFields = JSON.parse(rawSignatureFields);
    } catch (_error) {
      res.status(400).json({ error: 'signatureFields must be valid JSON' });
      return;
    }

    if (!Array.isArray(signatureFields) || signatureFields.length === 0) {
      res.status(400).json({ error: 'At least one signature field is required' });
      return;
    }

    const normalizedFields = signatureFields.map((field) => ({
      page: Number.isInteger(field?.page) ? field.page : 0,
      x_pct: Number(field?.x_pct),
      y_pct: Number(field?.y_pct),
      width_pct: Number(field?.width_pct || 0.24)
    }));

    const hasInvalidField = normalizedFields.some(
      (field) =>
        field.page < 0 ||
        Number.isNaN(field.x_pct) ||
        Number.isNaN(field.y_pct) ||
        Number.isNaN(field.width_pct) ||
        field.x_pct < 0 ||
        field.x_pct > 1 ||
        field.y_pct < 0 ||
        field.y_pct > 1 ||
        field.width_pct < 0.05 ||
        field.width_pct > 1
    );

    if (hasInvalidField) {
      res.status(400).json({ error: 'Invalid signature field coordinates' });
      return;
    }

    const token = uuidv4().replace(/-/g, '');
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 48 * 60 * 60 * 1000);
    const templatePath = path.resolve(req.file.path);

    await Document.create({
      candidate_email: candidateEmail,
      token,
      template_path: templatePath,
      signature_fields: normalizedFields,
      status: 'pending',
      created_at: createdAt,
      expires_at: expiresAt
    });

    const appBaseUrl = String(process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
    const signingLink = `${appBaseUrl}/sign/${token}`;

    await sendSigningLinkEmail({
      to: candidateEmail,
      signingLink
    });

    res.status(201).json({
      message: 'Document uploaded and signing email sent',
      token,
      signingLink
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to upload document' });
  }
});

module.exports = router;
