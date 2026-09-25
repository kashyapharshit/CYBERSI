const normalizeControl = (rawData = {}) => {
  const allowedStatus = ['implemented', 'partial', 'not_implemented'];
  const statusVal = String(rawData.status || '').toLowerCase();
  const riskReduction = isNaN(Number(rawData.risk_reduction_pct))
    ? (isNaN(Number(rawData.effectiveness)) ? 0 : Number(rawData.effectiveness))
    : Number(rawData.risk_reduction_pct);

  return {
    control_id: rawData.control_id ? String(rawData.control_id).trim() : (rawData.id ? String(rawData.id).trim() : ''),
    name: rawData.name ? String(rawData.name).trim() : (rawData.title ? String(rawData.title).trim() : ''),
    category: rawData.category ? String(rawData.category).trim() : (rawData.framework ? String(rawData.framework).trim() : ''),
    status: allowedStatus.includes(statusVal) ? statusVal : 'not_implemented',
    owner: rawData.owner ? String(rawData.owner).trim() : '',
    description: rawData.description ? String(rawData.description).trim() : '',
    cost_inr: isNaN(Number(rawData.cost_inr)) ? 0 : Number(rawData.cost_inr),
    target_asset_id: rawData.target_asset_id ? String(rawData.target_asset_id).trim() : '',
    risk_reduction_pct: riskReduction,
    claimed_effectiveness: isNaN(Number(rawData.claimed_effectiveness)) ? riskReduction : Number(rawData.claimed_effectiveness),
    configuration_coverage: rawData.configuration_coverage === undefined ? undefined : Number(rawData.configuration_coverage) || 0,
    compliance_coverage: rawData.compliance_coverage === undefined ? undefined : Number(rawData.compliance_coverage) || 0,
    incident_history: Array.isArray(rawData.incident_history) ? rawData.incident_history : (rawData.incident_history ?? []),
    incident_history_count: isNaN(Number(rawData.incident_history_count)) ? 0 : Number(rawData.incident_history_count),
    measured_effectiveness: isNaN(Number(rawData.measured_effectiveness)) ? undefined : Number(rawData.measured_effectiveness),
    compliance_frameworks: Array.isArray(rawData.compliance_frameworks)
      ? rawData.compliance_frameworks.map(String)
      : (rawData.framework ? [String(rawData.framework).trim()] : []),
    evidence_source: String(rawData.evidence_source || '').trim(),
    evidence_id: String(rawData.evidence_id || '').trim(),
    evidence_confidence: isNaN(Number(rawData.evidence_confidence)) ? 0 : Number(rawData.evidence_confidence),
    evidence_timestamp: rawData.evidence_timestamp || null,
    data_source: String(rawData.data_source || '').trim(),
    dataset_version: String(rawData.dataset_version || '').trim()
  };
};

const normalizeControlsBulk = (data) => {
  if (Array.isArray(data)) {
    return data.map((item) => normalizeControl(item));
  }
  return normalizeControl(data);
};

module.exports = { normalizeControl, normalizeControlsBulk };
