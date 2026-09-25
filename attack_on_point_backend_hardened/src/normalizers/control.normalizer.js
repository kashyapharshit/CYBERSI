const normalizeControl = (rawData = {}) => {
  const allowedStatus = ['implemented', 'partial', 'not_implemented'];
  const statusVal = String(rawData.status || '').toLowerCase();

  return {
    control_id: rawData.control_id ? String(rawData.control_id).trim() : (rawData.id ? String(rawData.id).trim() : ''),
    name: rawData.name ? String(rawData.name).trim() : (rawData.title ? String(rawData.title).trim() : ''),
    category: rawData.category ? String(rawData.category).trim() : (rawData.framework ? String(rawData.framework).trim() : ''),
    status: allowedStatus.includes(statusVal) ? statusVal : 'not_implemented',
    owner: rawData.owner ? String(rawData.owner).trim() : '',
    description: rawData.description ? String(rawData.description).trim() : '',
    cost_inr: isNaN(Number(rawData.cost_inr)) ? 0 : Number(rawData.cost_inr),
    target_asset_id: rawData.target_asset_id ? String(rawData.target_asset_id).trim() : '',
    risk_reduction_pct: isNaN(Number(rawData.risk_reduction_pct))
      ? (isNaN(Number(rawData.effectiveness)) ? 0 : Number(rawData.effectiveness))
      : Number(rawData.risk_reduction_pct),
    compliance_frameworks: Array.isArray(rawData.compliance_frameworks)
      ? rawData.compliance_frameworks.map(String)
      : (rawData.framework ? [String(rawData.framework).trim()] : [])
  };
};

const normalizeControlsBulk = (data) => {
  if (Array.isArray(data)) {
    return data.map((item) => normalizeControl(item));
  }
  return normalizeControl(data);
};

module.exports = { normalizeControl, normalizeControlsBulk };
