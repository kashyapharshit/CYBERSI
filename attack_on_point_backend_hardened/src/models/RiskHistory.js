const mongoose = require('mongoose');

const riskHistorySchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  total_expected_annual_loss_inr: { type: Number, default: 0 },
  value_at_risk_inr: { type: Number, default: 0 },
  asset_snapshots: [{
    asset_id: String,
    score: Number,
    level: String,
    eal_inr: Number,
    var_inr: Number
  }]
}, { timestamps: true });

module.exports = mongoose.model('RiskHistory', riskHistorySchema);