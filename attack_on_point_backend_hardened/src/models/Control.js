const mongoose = require('mongoose');

const controlSchema = new mongoose.Schema({
  control_id: { type: String, required: true, unique: true, trim: true },
  name: { type: String, default: '' },
  category: { type: String, default: '' },
  status: {
    type: String,
    enum: ['implemented', 'partial', 'not_implemented'],
    default: 'not_implemented'
  },
  owner: { type: String, default: '' },
  description: { type: String, default: '' },
  cost_inr: { type: Number, default: 0 },
  target_asset_id: { type: String, default: '' },
  risk_reduction_pct: { type: Number, default: 0 },

  // Fix #9: Proper Compliance Mapping Array (ISO, NIST, RBI, CIS, SEBI)
  compliance_frameworks: [{ type: String }],
  data_source: { type: String, default: '' },
  dataset_version: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Control', controlSchema);
