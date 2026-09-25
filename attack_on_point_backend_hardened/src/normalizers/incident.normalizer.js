const normalizeIncident = (rawData = {}) => {
  return {
    incident_id: rawData.incident_id ? String(rawData.incident_id).trim() : '',
    asset_id: rawData.asset_id ? String(rawData.asset_id).trim() : '',
    attack_type: rawData.attack_type ? String(rawData.attack_type).trim() : '',
    compromise_status: rawData.compromise_status ? String(rawData.compromise_status).trim() : '',
    affected_records: isNaN(Number(rawData.affected_records)) ? 0 : Number(rawData.affected_records),
    total_records: isNaN(Number(rawData.total_records)) ? 0 : Number(rawData.total_records),
    service_downtime_minutes: isNaN(Number(rawData.service_downtime_minutes)) ? 0 : Number(rawData.service_downtime_minutes),
    data_modified: Boolean(rawData.data_modified),
    data_deleted: Boolean(rawData.data_deleted),
    evidence_confidence: isNaN(Number(rawData.evidence_confidence)) ? 0 : Number(rawData.evidence_confidence)
  };
};

const normalizeIncidentsBulk = (data) => {
  if (Array.isArray(data)) {
    return data.map((item) => normalizeIncident(item));
  }
  return normalizeIncident(data);
};

module.exports = { normalizeIncident, normalizeIncidentsBulk };