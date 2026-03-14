const mongoose = require('mongoose');

const signatureFieldSchema = new mongoose.Schema(
  {
    page: { type: Number, required: true, min: 0, default: 0 },
    x_pct: { type: Number, required: true, min: 0, max: 1 },
    y_pct: { type: Number, required: true, min: 0, max: 1 },
    width_pct: { type: Number, required: true, min: 0.05, max: 1, default: 0.24 }
  },
  { _id: false }
);

const documentSchema = new mongoose.Schema(
  {
    candidate_email: { type: String, required: true, lowercase: true, trim: true },
    token: { type: String, required: true, unique: true, index: true },
    template_path: { type: String, required: true },
    signature_fields: { type: [signatureFieldSchema], required: true, default: [] },
    status: { type: String, enum: ['pending', 'signed'], default: 'pending', index: true },
    created_at: { type: Date, required: true },
    expires_at: { type: Date, required: true, index: true }
  },
  { versionKey: false }
);

module.exports = mongoose.model('Document', documentSchema);
