const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema({
  asset_id: { type: String, required: true, unique: true, trim: true },
  hostname: { type: String, default: '' }, // Fix #21: Added hostname field
  ip_address: { type: String, default: '' },
  asset_type: { type: String, default: '' },
  business_function: { type: String, default: '' },
  business_unit: { type: String, default: 'Core Operations' }, // Fix #16: Business Unit
  criticality: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  internet_exposed: { type: Boolean, default: false },
  hourly_downtime_cost_inr: { type: Number, default: 0 },
  total_records: { type: Number, default: 0 },
  cost_per_record_inr: { type: Number, default: 0 },
  
  // Fix #21: Active controls & Frameworks array
  active_controls: [{ type: String }],
  applicable_frameworks: [{ type: String }],
  
  // Fix #19: Asset service dependencies (e.g. ['AST-10001'])
  dependencies: [{ type: String }],
  data_classification: { type: String, default: '' },

  // Fix #16 & #18: Asset-level Risk, Financial & Penalty metrics
  asset_eal_inr: { type: Number, default: 0 },
  asset_var_inr: { type: Number, default: 0 },
  regulatory_penalty_inr: { type: Number, default: 0 },
  reputation_loss_inr: { type: Number, default: 0 },
  risk_score: { type: Number, default: 0 },
  risk_level: { type: String, default: 'Medium' },
  data_source: { type: String, default: '' },
  dataset_version: { type: String, default: '' },
  cmdb_source: { type: String, default: '' },
  cmdb_record_id: { type: String, default: '' },
  inventory_source: { type: String, default: '' },
  inventory_record_id: { type: String, default: '' },
  last_inventory_sync_at: { type: Date, default: null },
  provenance: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

module.exports = mongoose.model('Asset', assetSchema);
