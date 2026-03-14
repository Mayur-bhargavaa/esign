const mongoose = require('mongoose');

const appliedFieldSchema = new mongoose.Schema(
  {
    page: { type: Number, required: true },
    x_pct: { type: Number, required: true },
    y_pct: { type: Number, required: true },
    width_pct: { type: Number, required: true }
  },
  { _id: false }
);

const signatureSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    ip_address: { type: String, required: true },
    signed_at: { type: Date, required: true, index: true },
    user_agent: { type: String, required: true },
    applied_fields: { type: [appliedFieldSchema], default: [] },
    pdf_path: { type: String, required: true }
  },
  { versionKey: false }
);

module.exports = mongoose.model('Signature', signatureSchema);
