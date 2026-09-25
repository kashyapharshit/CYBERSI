const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../controllers/settings.controller');
const { protect, authorize } = require('../middleware/userAuth.middleware');

// Executive dashboard reads EAL/VaR/budget — logged-in user
router.get('/', protect, getSettings);

// Budget/config update — logged-in user, admin only (recommended)
router.post('/', protect, authorize('admin'), updateSettings);

module.exports = router;