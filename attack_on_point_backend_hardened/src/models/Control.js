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
  claimed_effectiveness: { type: Number, default: null },
  configuration_coverage: { type: Number, default: null },
  compliance_coverage: { type: Number, default: null },
  incident_history: { type: mongoose.Schema.Types.Mixed, default: [] },
  incident_history_count: { type: Number, default: 0 },
  measured_effectiveness: { type: Number, default: null },

  // Fix #9: Proper Compliance Mapping Array (ISO, NIST, RBI, CIS, SEBI)
  compliance_frameworks: [{ type: String }],
  data_source: { type: String, default: '' },
  dataset_version: { type: String, default: '' },
  evidence_source: { type: String, default: '' },
  evidence_id: { type: String, default: '' },
  evidence_confidence: { type: Number, default: 0 },
  evidence_timestamp: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Control', controlSchema);
