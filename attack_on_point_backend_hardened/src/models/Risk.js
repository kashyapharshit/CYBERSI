const mongoose = require('mongoose');

const riskSchema = new mongoose.Schema(
  {
    asset_id: { type: String, required: true, trim: true },
    criticality: { type: String, default: '' },
    internet_exposed: { type: Boolean, default: false },
    severity: { type: String, default: '' },
    exploit_available: { type: Boolean, default: false },
    evidence_confidence: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    level: { type: String, default: '' },
    eal_inr: { type: Number, default: 0 },
    var_inr: { type: Number, default: 0 },
    likelihood: { type: Number, default: 0 },
    impact_inr: { type: Number, default: 0 },
    financial_impact_breakdown: { type: mongoose.Schema.Types.Mixed, default: {} },
    impact_breakdown: { type: mongoose.Schema.Types.Mixed, default: {} },
    attack_pressure: { type: Number, default: 0 },
    formula: { type: String, default: '' },
    drivers: [{
      factor: { type: String },
      contribution: { type: Number },
      value: { type: mongoose.Schema.Types.Mixed },
      weight: { type: Number },
      source: { type: String },
      source_timestamp: { type: Date, default: null },
      telemetry: { type: Boolean, default: false },
      explanation: { type: String }
    }],
    model_version: { type: String, default: 'prototype' },
    input_snapshot_hash: { type: String, default: '' },
    assessed_at: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Risk', riskSchema);
