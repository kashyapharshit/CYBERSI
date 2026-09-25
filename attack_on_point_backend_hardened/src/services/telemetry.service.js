const SecurityEvent = require('../models/SecurityEvent');

const normalizeTelemetry = (type, rawData = {}) => ({
  type,
  asset_id: rawData.asset_id ? String(rawData.asset_id).trim() : 'UNMAPPED',
  source: rawData.source ? String(rawData.source).trim() : type,
  event_type: rawData.event_type ? String(rawData.event_type).trim() : 'telemetry',
  severity: rawData.severity ? String(rawData.severity).trim().toLowerCase() : 'info',
  source_ip: rawData.source_ip ? String(rawData.source_ip).trim() : '',
  failed_attempts: Number(rawData.failed_attempts) || 0,
  successful_login: Boolean(rawData.successful_login),
  open_ports: Array.isArray(rawData.open_ports) ? rawData.open_ports.map(Number).filter(Number.isFinite) : [],
  services: Array.isArray(rawData.services) ? rawData.services.map(String) : [],
  exposure: rawData.exposure ? String(rawData.exposure).trim() : '',
  endpoint: rawData.endpoint ? String(rawData.endpoint).trim() : '',
  affected_role: rawData.affected_role ? String(rawData.affected_role).trim() : '',
  observed_at: rawData.timestamp ? new Date(rawData.timestamp) : new Date(),
  raw_payload: rawData
});

const ingestTelemetryService = async (type, rawData) => {
  if (Array.isArray(rawData)) {
    return SecurityEvent.insertMany(rawData.map((item) => normalizeTelemetry(type, item)));
  }
  return SecurityEvent.create(normalizeTelemetry(type, rawData));
};

const getRecentTelemetryService = async (limit = 40) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 40, 1), 100);
  return SecurityEvent.find()
    .sort({ observed_at: -1, timestamp: -1, createdAt: -1 })
    .limit(safeLimit)
    .lean();
};

module.exports = { ingestTelemetryService, getRecentTelemetryService };
