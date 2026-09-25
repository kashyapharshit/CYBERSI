const Risk = require('../models/Risk');

const normalizeRisk = (rawData = {}) => {
  return {
    asset_id: rawData.asset_id ? String(rawData.asset_id).trim() : '',
    criticality: rawData.criticality ? String(rawData.criticality).trim() : '',
    internet_exposed: Boolean(rawData.internet_exposed),
    severity: rawData.severity ? String(rawData.severity).trim() : '',
    exploit_available: Boolean(rawData.exploit_available),
    evidence_confidence: isNaN(Number(rawData.evidence_confidence)) ? 0 : Number(rawData.evidence_confidence),
    score: isNaN(Number(rawData.score)) ? 0 : Number(rawData.score),
    level: rawData.level ? String(rawData.level).trim() : 'Medium',
    assessed_at: rawData.assessed_at ? new Date(rawData.assessed_at) : new Date()
  };
};

const upsertRiskService = async (rawData) => {
  if (Array.isArray(rawData)) {
    const normalizedArray = rawData.map((item) => normalizeRisk(item));
    const operations = normalizedArray.map((item) => ({
      updateOne: {
        filter: { asset_id: item.asset_id },
        update: { $set: item },
        upsert: true
      }
    }));
    return await Risk.bulkWrite(operations);
  } else {
    const normalized = normalizeRisk(rawData);
    return await Risk.findOneAndUpdate(
      { asset_id: normalized.asset_id },
      { $set: normalized },
      { new: true, upsert: true, runValidators: true }
    );
  }
};

const getAllRisksService = async () => {
  return await Risk.find().sort({ score: -1 });
};

const getRiskByAssetService = async (asset_id) => {
  return await Risk.findOne({ asset_id });
};

module.exports = {
  upsertRiskService,
  getAllRisksService,
  getRiskByAssetService
};