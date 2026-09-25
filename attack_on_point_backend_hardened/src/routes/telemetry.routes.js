const express = require('express');
const router = express.Router();
const { ingestNmap, ingestWazuh, ingestBurp, ingestOpenVas, ingestGenericTelemetry, ingestGenericTelemetryStream, listRecentTelemetry } = require('../controllers/telemetry.controller');
const { authenticateApiKey } = require('../middleware/auth.middleware');
const { protect } = require('../middleware/userAuth.middleware');
const supportedGenericSources = new Set(['edr', 'iam', 'cspm', 'threat-intel']);

// Dashboard reads use JWT so the machine API key is never exposed in the browser.
router.get('/events', protect, listRecentTelemetry);

// Scanner and machine-to-machine writes use the API key.
router.use(authenticateApiKey);

// Scanner Telemetry Ingestion Routes
router.post('/nmap', ingestNmap);
router.post('/wazuh', ingestWazuh);
router.post('/burp', ingestBurp);
router.post('/openvas', ingestOpenVas);

// Unified normalized ingestion for additional telemetry sources.
router.post('/edr', ingestGenericTelemetry('edr'));
router.post('/iam', ingestGenericTelemetry('iam'));
router.post('/cspm', ingestGenericTelemetry('cspm'));
router.post('/threat-intel', ingestGenericTelemetry('threat-intel'));

// Explicit stream mode keeps live telemetry distinguishable from batch uploads.
router.post('/stream/:type', (req, res, next) => {
  const type = String(req.params.type || '').toLowerCase();
  if (!supportedGenericSources.has(type)) return res.status(404).json({ success: false, message: `Unsupported telemetry stream source: ${type}` });
  return ingestGenericTelemetryStream(type)(req, res, next);
});

// Constrained dynamic route keeps the source contract extensible without accepting arbitrary model enum values.
router.post('/:type', (req, res, next) => {
  const type = String(req.params.type || '').toLowerCase();
  if (!supportedGenericSources.has(type)) return res.status(404).json({ success: false, message: `Unsupported telemetry source: ${type}` });
  return ingestGenericTelemetry(type)(req, res, next);
});

module.exports = router;
