const {
  upsertAssetService,
  getAllAssetsService,
  getAssetByIdService
} = require('../services/asset.service');

const upsertAsset = async (req, res, next) => {
  try {
    const result = await upsertAssetService(req.body);
    res.status(201).json({
      success: true,
      message: 'Asset data ingested/updated successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getAllAssets = async (req, res, next) => {
  try {
    const assets = await getAllAssetsService();
    res.status(200).json({
      success: true,
      count: assets.length,
      data: assets
    });
  } catch (error) {
    next(error);
  }
};

const getAssetById = async (req, res, next) => {
  try {
    const asset = await getAssetByIdService(req.params.asset_id);
    if (!asset) {
      return res.status(404).json({
        success: false,
        message: `Asset not found with asset_id: ${req.params.asset_id}`
      });
    }
    res.status(200).json({
      success: true,
      data: asset
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  upsertAsset,
  getAllAssets,
  getAssetById
};