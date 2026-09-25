const parseWazuh = (rawData = {}) => {
  return {
    type: 'wazuh',
    asset_id: rawData.asset_id ? String(rawData.asset_id).trim() : '',
    source: rawData.source ? String(rawData.source).trim() : 'wazuh-agent',
    event_type: rawData.event_type 
      ? String(rawData.event_type).trim() 
      : (rawData.rule_description ? String(rawData.rule_description).trim() : 'alert'),
    severity: rawData.severity ? String(rawData.severity).trim() : 'medium',
    source_ip: rawData.source_ip 
      ? String(rawData.source_ip).trim() 
      : (rawData.src_ip ? String(rawData.src_ip).trim() : ''),
    failed_attempts: isNaN(Number(rawData.failed_attempts)) ? 0 : Number(rawData.failed_attempts),
    successful_login: Boolean(rawData.successful_login),
    open_ports: Array.isArray(rawData.open_ports)
      ? rawData.open_ports.map((p) => Number(p)).filter((p) => !isNaN(p))
      : [],
    services: Array.isArray(rawData.services)
      ? rawData.services.map((s) => String(s).trim())
      : [],
    exposure: rawData.exposure ? String(rawData.exposure).trim() : '',
    endpoint: rawData.endpoint ? String(rawData.endpoint).trim() : '',
    affected_role: rawData.affected_role ? String(rawData.affected_role).trim() : '',
    timestamp: rawData.timestamp ? new Date(rawData.timestamp) : new Date()
  };
};

module.exports = { parseWazuh };