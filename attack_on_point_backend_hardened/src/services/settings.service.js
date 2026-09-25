const Settings = require('../models/Settings');
const { normalizeSettings } = require('../normalizers/settings.normalizer');

const getSettingsService = async () => {
  const settings = await Settings.getSettings();
  return settings;
};

const updateBudgetService = async (rawData) => {
  const normalized = normalizeSettings(rawData);
  const updatedSettings = await Settings.updateBudget(normalized.enterprise_budget_inr);
  return updatedSettings;
};

module.exports = { getSettingsService, updateBudgetService };
