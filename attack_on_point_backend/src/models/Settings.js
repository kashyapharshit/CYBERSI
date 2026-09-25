const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    enterprise_budget_inr: { type: Number, default: 5000000 },
    total_expected_annual_loss_inr: { type: Number, default: 0 },
    value_at_risk_inr: { type: Number, default: 0 },
    recommended_control_ids: { type: [String], default: [] },
    executive_summary: { type: String, default: '' },
    // Fix Bug 2: Blockchain transaction hash store karne ke liye field add kar di hai
    last_blockchain_tx: { type: String, default: '' },
    dataset_name: { type: String, default: '' },
    dataset_version: { type: String, default: '' },
    dataset_source: { type: String, default: '' }
  },
  { timestamps: true }
);

// Singleton Pattern: Find or create the single config document
settingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({ enterprise_budget_inr: 5000000 });
  }
  return settings;
};

// Singleton Pattern: Update existing config document
settingsSchema.statics.updateBudget = async function (amount) {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({ enterprise_budget_inr: Number(amount) || 0 });
  } else {
    settings.enterprise_budget_inr = Number(amount) || 0;
    await settings.save();
  }
  return settings;
};

module.exports = mongoose.model('Settings', settingsSchema);
