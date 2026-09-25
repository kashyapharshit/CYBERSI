const { getSettingsService, updateBudgetService } = require('../services/settings.service');

const getSettings = async (req, res, next) => {
  try {
    const settings = await getSettingsService();
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};

const updateSettings = async (req, res, next) => {
  try {
    const updated = await updateBudgetService(req.body);
    res.status(200).json({
      success: true,
      message: 'Enterprise budget updated successfully',
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getSettings, updateSettings };