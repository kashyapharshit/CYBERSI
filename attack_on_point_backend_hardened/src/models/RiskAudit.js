const mongoose = require('mongoose');

const riskAuditSchema = new mongoose.Schema({
  report_hash: { type: String, required: true, index: true },
  tx_hash: { type: String, default: null, index: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  verification_status: { type: String, enum: ['anchored', 'unanchored'], default: 'unanchored' },
  chain_index: { type: Number, default: 0 },
  previous_report_hash: { type: String, default: null },
  block_number: { type: Number, default: null },
  network: { type: String, default: null },
  signer: { type: String, default: null },
  anchored_at: { type: Date, default: null },
  payload_version: { type: String, default: 'risk-report-v2' },
  created_by: { type: String, default: 'ai-engine' }
}, { timestamps: true });

module.exports = mongoose.model('RiskAudit', riskAuditSchema);
