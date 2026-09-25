const express = require('express');
const router = express.Router();
const { upsertIncident, getAllIncidents, getIncidentsByAsset } = require('../controllers/incident.controller');
const { authenticateApiKey } = require('../middleware/auth.middleware');
const { protect, authorize } = require('../middleware/userAuth.middleware');

// Incident logging — analyst logs it from the frontend after login (JWT)
// Agar future me automated tool bhi incident push karega, alag route bana lena
router.post('/', protect, authorize('admin', 'analyst'), upsertIncident);

// Frontend dashboard reads — logged-in user, JWT required
router.get('/', protect, authorize('admin', 'analyst'), getAllIncidents);
router.get('/asset/:asset_id', protect, authorize('admin', 'analyst'), getIncidentsByAsset);

module.exports = router;
