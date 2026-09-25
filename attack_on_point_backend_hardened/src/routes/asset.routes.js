const express = require('express');
const router = express.Router();
const { upsertAsset, getAllAssets, getAssetById } = require('../controllers/asset.controller');
const { authenticateApiKey } = require('../middleware/auth.middleware');
const { protect } = require('../middleware/userAuth.middleware');

// Ingestion — Nmap/manual asset scripts push data using x-api-key
router.post('/', authenticateApiKey, upsertAsset);

// Frontend dashboard reads — logged-in user, JWT required
router.get('/', protect, getAllAssets);
router.get('/:asset_id', protect, getAssetById);

module.exports = router;