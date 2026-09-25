const express = require('express');
const router = express.Router();
const { upsertRisk, getAllRisks, getRiskByAsset } = require('../controllers/risk.controller');
const { authenticateApiKey } = require('../middleware/auth.middleware');
const { protect } = require('../middleware/userAuth.middleware');

// Risk scores written by AI engine / internal service — x-api-key
router.post('/', authenticateApiKey, upsertRisk);

// Frontend dashboard reads — logged-in user, JWT required
router.get('/', protect, getAllRisks);
router.get('/asset/:asset_id', protect, getRiskByAsset);

module.exports = router;