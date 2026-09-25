const SecurityEvent = require('../models/SecurityEvent');
const crypto = require('crypto');

const normalizeTelemetry = (type, rawData = {}, ingestionJobId = '', parsedData = {}, options = {}) => {
  const data = { ...rawData, ...parsedData };
  const observedAtCandidate = new Date(data.observed_at || data.timestamp || new Date());
  const observedAt = Number.isNaN(observedAtCandidate.getTime()) ? new Date() : observedAtCandidate;
  return {
    type,
    ingestion_mode: options.mode || data.ingestion_mode || 'batch',
    asset_id: data.asset_id ? String(data.asset_id).trim() : 'UNMAPPED',
    source: data.source ? String(data.source).trim() : type,
    source_event_id: String(data.source_event_id || data.event_id || data.id || ''),
    event_type: data.event_type ? String(data.event_type).trim() : 'telemetry',
    severity: data.severity ? String(data.severity).trim().toLowerCase() : 'info',
    source_ip: data.source_ip ? String(data.source_ip).trim() : '',
    failed_attempts: Number(data.failed_attempts) || 0,
    successful_login: Boolean(data.successful_login),
    open_ports: Array.isArray(data.open_ports) ? data.open_ports.map(Number).filter(Number.isFinite) : [],
    services: Array.isArray(data.services) ? data.services.map(String) : [],
    exposure: data.exposure ? String(data.exposure).trim() : '',
    endpoint: data.endpoint ? String(data.endpoint).trim() : '',
    affected_role: data.affected_role ? String(data.affected_role).trim() : '',
    timestamp: observedAt,
    observed_at: observedAt,
    confidence: Number.isFinite(Number(data.confidence)) ? Math.min(1, Math.max(0, Number(data.confidence))) : (['high', 'critical'].includes(String(data.severity).toLowerCase()) ? 0.85 : 0.6),
    ingestion_job_id: String(ingestionJobId || data.ingestion_job_id || ''),
    raw_hash: crypto.createHash('sha256').update(JSON.stringify(rawData, Object.keys(rawData).sort())).digest('hex'),
    raw_payload: rawData
  };
};

const ingestTelemetryService = async (type, rawData, context = {}) => {
  if (Array.isArray(rawData)) {
    return SecurityEvent.insertMany(rawData.map((item) => normalizeTelemetry(type, item, context.job_id, {}, { mode: context.mode || context.ingestion_mode })));
  }
  return SecurityEvent.create(normalizeTelemetry(type, rawData, context.job_id, {}, { mode: context.mode || context.ingestion_mode }));
};

const getRecentTelemetryService = async (limit = 40) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 40, 1), 100);
  return SecurityEvent.find()
    .sort({ observed_at: -1, timestamp: -1, createdAt: -1 })
    .limit(safeLimit)
    .lean();
};

module.exports = { normalizeTelemetry, ingestTelemetryService, getRecentTelemetryService };
