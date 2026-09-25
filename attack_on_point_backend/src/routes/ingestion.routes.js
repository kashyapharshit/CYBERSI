const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/userAuth.middleware');
const { listIngestionJobs, getIngestionJobById } = require('../controllers/ingestion.controller');

router.get('/jobs', protect, authorize('admin', 'analyst'), listIngestionJobs);
router.get('/jobs/:job_id', protect, authorize('admin', 'analyst'), getIngestionJobById);

module.exports = router;
