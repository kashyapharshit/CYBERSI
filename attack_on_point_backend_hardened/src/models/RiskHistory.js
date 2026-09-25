const mongoose = require('mongoose');

const riskHistorySchema = new mongoose.Schema({
  scenario_id: { type: String, default: '', index: true },
  scenario_type: { type: String, enum: ['actual', 'what_if', 'optimizer', 'incident_replay'], default: 'actual' },
  scenario_name: { type: String, default: '' },
  trigger_reason: { type: String, default: '' },
  input_snapshot_hash: { type: String, default: '' },
  finding_snapshot_hash: { type: String, default: '' },
  assumptions: { type: mongoose.Schema.Types.Mixed, default: {} },
  control_ids: [{ type: String }],
  attack_pressure_snapshot: { type: mongoose.Schema.Types.Mixed, default: null },
  regulatory_coverage_snapshot: { type: mongoose.Schema.Types.Mixed, default: null },
  timestamp: { type: Date, default: Date.now },
  total_expected_annual_loss_inr: { type: Number, default: 0 },
  value_at_risk_inr: { type: Number, default: 0 },
  financial_impact_breakdown: { type: mongoose.Schema.Types.Mixed, default: {} },
  asset_snapshots: [{
    asset_id: String,
    score: Number,
    level: String,
    eal_inr: Number,
    var_inr: Number,
    financial_impact_breakdown: mongoose.Schema.Types.Mixed
  }]
}, { timestamps: true });

module.exports = mongoose.model('RiskHistory', riskHistorySchema);
