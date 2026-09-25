const express = require('express');
const router = express.Router();
const { processAnalystQuery } = require('../controllers/analystQuery.controller');
const { protect, authorize } = require('../middleware/userAuth.middleware');

// POST /analyst/query -> Protected via JWT (Logged-in Analyst/User Only)
router.post('/query', protect, authorize('admin', 'analyst'), processAnalystQuery);

module.exports = router;
