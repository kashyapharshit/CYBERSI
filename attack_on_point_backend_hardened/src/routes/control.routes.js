const express = require('express');
const router = express.Router();
const { upsertControl, getAllControls, getControlById } = require('../controllers/control.controller');
const { authenticateApiKey } = require('../middleware/auth.middleware');
const { protect } = require('../middleware/userAuth.middleware');

// Ingestion — control catalog data pushed via x-api-key
router.post('/', authenticateApiKey, upsertControl);

// Frontend dashboard reads — logged-in user, JWT required
router.get('/', protect, getAllControls);
router.get('/:control_id', protect, getControlById);

module.exports = router;