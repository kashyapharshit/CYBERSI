const { getBlockchainStatus } = require('../services/blockchain.service');
const { tamperTestLatestAudit } = require('../services/audit.service');
const RiskAudit = require('../models/RiskAudit');

const blockchainStatus = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: await getBlockchainStatus() });
  } catch (error) {
    next(error);
  }
};

const tamperTest = async (req, res, next) => {
  try {
    const result = await tamperTestLatestAudit();
    res.status(result.status === 'UNAVAILABLE' ? 503 : 200).json({ success: result.status !== 'UNAVAILABLE', ...result });
  } catch (error) {
    next(error);
  }
};

const auditLedger = async (req, res, next) => {
  try {
    const entries = await RiskAudit.find()
      .sort({ chain_index: -1, createdAt: -1 })
      .limit(25)
      .select('report_hash tx_hash verification_status chain_index previous_report_hash block_number network signer anchored_at payload_version createdAt')
      .lean();
    res.status(200).json({ success: true, count: entries.length, data: entries });
  } catch (error) {
    next(error);
  }
};

module.exports = { blockchainStatus, tamperTest, auditLedger };
