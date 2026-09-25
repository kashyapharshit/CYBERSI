const Asset = require('../models/Asset');
const { normalizeAsset, normalizeAssetsBulk } = require('../normalizers/asset.normalizer');

const upsertAssetService = async (rawData) => {
  if (Array.isArray(rawData)) {
    const normalizedArray = normalizeAssetsBulk(rawData);
    const operations = normalizedArray.map((item) => ({
      updateOne: {
        filter: { asset_id: item.asset_id },
        update: { $set: item },
        upsert: true
      }
    }));
    return await Asset.bulkWrite(operations);
  } else {
    const normalized = normalizeAsset(rawData);
    return await Asset.findOneAndUpdate(
      { asset_id: normalized.asset_id },
      { $set: normalized },
      { new: true, upsert: true, runValidators: true }
    );
  }
};

const getAllAssetsService = async () => {
  return await Asset.find().sort({ createdAt: -1 });
};

const getAssetByIdService = async (asset_id) => {
  return await Asset.findOne({ asset_id });
};

module.exports = {
  upsertAssetService,
  getAllAssetsService,
  getAssetByIdService
};