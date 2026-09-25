const normalizeAsset = (rawData = {}) => {
  const allowedCriticality = ['low', 'medium', 'high', 'critical'];
  const criticalityVal = String(rawData.criticality || '').toLowerCase();

  return {
    asset_id: rawData.asset_id ? String(rawData.asset_id).trim() : '',
    hostname: rawData.hostname ? String(rawData.hostname).trim() : '',
    ip_address: rawData.ip_address ? String(rawData.ip_address).trim() : '',
    asset_type: rawData.asset_type ? String(rawData.asset_type).trim() : '',
    business_function: rawData.business_function ? String(rawData.business_function).trim() : '',
    business_unit: rawData.business_unit ? String(rawData.business_unit).trim() : 'Core Operations',
    criticality: allowedCriticality.includes(criticalityVal) ? criticalityVal : 'medium',
    internet_exposed: Boolean(rawData.internet_exposed),
    hourly_downtime_cost_inr: isNaN(Number(rawData.hourly_downtime_cost_inr)) ? 0 : Number(rawData.hourly_downtime_cost_inr),
    total_records: isNaN(Number(rawData.total_records)) ? 0 : Number(rawData.total_records),
    cost_per_record_inr: isNaN(Number(rawData.cost_per_record_inr)) ? 0 : Number(rawData.cost_per_record_inr),
    regulatory_penalty_inr: isNaN(Number(rawData.regulatory_penalty_inr)) ? 0 : Number(rawData.regulatory_penalty_inr),
    reputation_loss_inr: isNaN(Number(rawData.reputation_loss_inr)) ? 0 : Number(rawData.reputation_loss_inr),
    active_controls: Array.isArray(rawData.active_controls) ? rawData.active_controls.map(String) : [],
    applicable_frameworks: Array.isArray(rawData.applicable_frameworks) ? rawData.applicable_frameworks.map(String) : [],
    dependencies: Array.isArray(rawData.dependencies) ? rawData.dependencies.map(String) : [],
    data_classification: rawData.data_classification ? String(rawData.data_classification).trim() : '',
    cmdb_source: String(rawData.cmdb_source || rawData.source_system || '').trim(),
    cmdb_record_id: String(rawData.cmdb_record_id || rawData.cmdb_asset_id || '').trim(),
    inventory_source: String(rawData.inventory_source || '').trim(),
    inventory_record_id: String(rawData.inventory_record_id || rawData.inventory_id || '').trim(),
    last_inventory_sync_at: rawData.last_inventory_sync_at || rawData.inventory_last_seen_at || null,
    provenance: rawData.provenance && typeof rawData.provenance === 'object' ? rawData.provenance : {},
    data_source: String(rawData.data_source || '').trim(),
    dataset_version: String(rawData.dataset_version || '').trim()
  };
};

const normalizeAssetsBulk = (data) => {
  if (Array.isArray(data)) {
    return data.map((item) => normalizeAsset(item));
  }
  return normalizeAsset(data);
};

module.exports = { normalizeAsset, normalizeAssetsBulk };
