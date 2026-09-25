const express = require('express');
const router = express.Router();
const { getAiPayload, saveAiResults } = require('../controllers/ai.controller');
const { triggerAiAnalysis } = require('../services/aiTrigger.service');
const { authenticateApiKey } = require('../middleware/auth.middleware');
const { protect, authorize } = require('../middleware/userAuth.middleware');
const { blockchainStatus, tamperTest, auditLedger } = require('../controllers/audit.controller');

// Machine-to-machine AI Engine Routes (x-api-key required)
router.get('/payload', authenticateApiKey, getAiPayload);
router.post('/results', authenticateApiKey, saveAiResults);

// Fix #13: Frontend Dashboard "Run Analysis" Trigger Button API (JWT protected)
router.post('/run-analysis', protect, authorize('admin', 'analyst'), async (req, res, next) => {
  try {
    const { reason = 'Frontend Dashboard Manual Trigger' } = req.body;
    const triggered = await triggerAiAnalysis(reason);

    if (triggered) {
      return res.status(200).json({
        success: true,
        message: 'AI Analysis engine triggered successfully. Results will update shortly.'
      });
    }

    res.status(502).json({
      success: false,
      message: 'Failed to communicate with AI Engine (FastAPI Service Unavailable).'
    });
  } catch (error) {
    next(error);
  }
});

router.get('/blockchain-status', protect, authorize('admin'), blockchainStatus);
router.get('/audit-ledger', protect, auditLedger);
router.post('/verify-data/tamper-test', protect, authorize('admin'), tamperTest);

module.exports = router;
