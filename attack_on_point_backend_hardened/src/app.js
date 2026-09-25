const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { notFoundHandler, globalErrorHandler } = require('./middleware/error.middleware');

// Models & Services Imports
const RiskAudit = require('./models/RiskAudit');
const { generateHash, getHashFromBlockchain } = require('./services/blockchain.service');
const analyticsRoutes = require('./routes/analytics.routes');
const { protect } = require('./middleware/userAuth.middleware');

// Routes
const authRoutes = require('./routes/auth.routes');
const settingsRoutes = require('./routes/settings.routes');
const assetRoutes = require('./routes/asset.routes');
const vulnerabilityRoutes = require('./routes/vulnerability.routes');
const controlRoutes = require('./routes/control.routes');
const telemetryRoutes = require('./routes/telemetry.routes');
const incidentRoutes = require('./routes/incident.routes');
const riskRoutes = require('./routes/risk.routes');
const aiRoutes = require('./routes/ai.routes');
const analystRoutes = require('./routes/analyst.routes');

const app = express();

app.use((req, res, next) => {
  const requestId = req.get('x-request-id') || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
});

// 1. Security middlewares
app.use(helmet());
const allowedOrigins = (process.env.CORS_ORIGINS || '*').split(',').map((origin) => origin.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins.includes('*') ? true : allowedOrigins }));

// 2. Logging
app.use(morgan('dev'));

// 3. Body parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// 4. Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date() });
});

// Fix Bug 1: Verification Route Logic
app.get('/ai/verify-data', protect, async (req, res, next) => {
  try {
    const audit = await RiskAudit.findOne({ tx_hash: { $ne: null } }).sort({ createdAt: -1 }).lean();
    if (!audit || !audit.tx_hash) {
      return res.status(404).json({
        status: "NOT_FOUND",
        message: "No blockchain transaction found on record."
      });
    }

    const currentMongoHash = generateHash(audit.payload);
    const originalBlockchainHash = await getHashFromBlockchain(audit.tx_hash);
    const previousAudit = audit.previous_report_hash
      ? await RiskAudit.findOne({ chain_index: audit.chain_index - 1 }).select('report_hash').lean()
      : null;
    const chainValid = !audit.previous_report_hash || previousAudit?.report_hash === audit.previous_report_hash;

    if (currentMongoHash === originalBlockchainHash && currentMongoHash === audit.report_hash && chainValid) {
      return res.json({ status: "SECURE", message: "Risk report evidence is authentic, chained, and untampered.", report_hash: currentMongoHash, tx_hash: audit.tx_hash, chain_index: audit.chain_index, chain_valid: true });
    } else {
      return res.status(409).json({ status: "TAMPERED", message: "WARNING: Stored risk report or its audit chain differs from the anchor.", report_hash: currentMongoHash, tx_hash: audit.tx_hash, chain_index: audit.chain_index, chain_valid: chainValid });
    }
  } catch (error) {
    next(error);
  }
});

// 5. Routes
app.use('/auth', authRoutes);
app.use('/telemetry', telemetryRoutes);
app.use('/ai', aiRoutes);

app.use('/settings', settingsRoutes);
app.use('/assets', assetRoutes);
app.use('/vulnerabilities', vulnerabilityRoutes);
app.use('/controls', controlRoutes);
app.use('/incidents', incidentRoutes);
app.use('/risks', riskRoutes);
app.use('/analyst', analystRoutes);
app.use('/analytics', analyticsRoutes);

// 6. 404 + Global Error Handler
app.use(notFoundHandler);
app.use(globalErrorHandler);

module.exports = app;
