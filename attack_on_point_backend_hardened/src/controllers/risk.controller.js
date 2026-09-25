const {
  upsertRiskService,
  getAllRisksService,
  getRiskByAssetService
} = require('../services/risk.service');

const upsertRisk = async (req, res, next) => {
  try {
    const result = await upsertRiskService(req.body);
    res.status(201).json({
      success: true,
      message: 'Risk score record stored successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getAllRisks = async (req, res, next) => {
  try {
    const risks = await getAllRisksService();
    res.status(200).json({
      success: true,
      count: risks.length,
      data: risks
    });
  } catch (error) {
    next(error);
  }
};

const getRiskByAsset = async (req, res, next) => {
  try {
    const risk = await getRiskByAssetService(req.params.asset_id);
    if (!risk) {
      return res.status(404).json({
        success: false,
        message: `No risk assessment found for asset_id: ${req.params.asset_id}`
      });
    }
    res.status(200).json({
      success: true,
      data: risk
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  upsertRisk,
  getAllRisks,
  getRiskByAsset
};