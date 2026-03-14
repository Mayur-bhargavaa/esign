const express = require('express');
const Document = require('../models/Document');
const Signature = require('../models/Signature');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const documents = await Document.find({}).sort({ created_at: -1 }).lean();

    const results = await Promise.all(
      documents.map(async (document) => {
        const signature = await Signature.findOne({ token: document.token }).sort({ signed_at: -1 }).lean();

        return {
          token: document.token,
          candidateEmail: document.candidate_email,
          status: document.status,
          createdAt: document.created_at,
          expiresAt: document.expires_at,
          signedBy: signature?.name || null,
          signedAt: signature?.signed_at || null,
          ipAddress: signature?.ip_address || null,
          userAgent: signature?.user_agent || null,
          signedLocations: signature?.applied_fields || document.signature_fields || []
        };
      })
    );

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to fetch audit records' });
  }
});

router.get('/:token', async (req, res) => {
  try {
    const token = String(req.params.token || '').trim();
    const document = await Document.findOne({ token }).lean();

    if (!document) {
      res.status(404).json({ error: 'Invalid signing token' });
      return;
    }

    const signature = await Signature.findOne({ token }).sort({ signed_at: -1 }).lean();

    res.json({
      token: document.token,
      candidateEmail: document.candidate_email,
      status: document.status,
      createdAt: document.created_at,
      expiresAt: document.expires_at,
      signedBy: signature?.name || null,
      signedAt: signature?.signed_at || null,
      ipAddress: signature?.ip_address || null,
      userAgent: signature?.user_agent || null,
      signedPdfPath: signature?.pdf_path || null,
      signedLocations: signature?.applied_fields || document.signature_fields || []
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to fetch audit record' });
  }
});

module.exports = router;
