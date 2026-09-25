const RiskAudit = require('../models/RiskAudit');
const { generateHash, getHashFromBlockchain } = require('./blockchain.service');

const latestAnchoredAudit = async () => RiskAudit
  .findOne({ tx_hash: { $ne: null }, verification_status: 'anchored' })
  .sort({ createdAt: -1 })
  .lean();

const tamperTestLatestAudit = async () => {
  const audit = await latestAnchoredAudit();
  if (!audit) {
    return {
      status: 'UNAVAILABLE',
      message: 'No anchored audit report is available for tamper testing.'
    };
  }

  const tamperedPayload = JSON.parse(JSON.stringify(audit.payload));
  tamperedPayload.audit_test_marker = `tamper-test-${Date.now()}`;
  const tamperedHash = generateHash(tamperedPayload);
  const anchoredHash = await getHashFromBlockchain(audit.tx_hash);
  const status = anchoredHash && anchoredHash === tamperedHash ? 'SECURE' : 'TAMPERED';

  return {
    status,
    message: status === 'TAMPERED'
      ? 'Tamper test detected a payload change against the anchored report.'
      : 'Tamper test unexpectedly matched the anchored report.',
    audit_id: audit._id,
    tx_hash: audit.tx_hash,
    original_report_hash: audit.report_hash,
    tampered_report_hash: tamperedHash,
    anchored_hash: anchoredHash
  };
};

module.exports = { latestAnchoredAudit, tamperTestLatestAudit };
