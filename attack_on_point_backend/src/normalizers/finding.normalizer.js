const crypto = require('crypto');

const normalizeFinding = (rawData = {}) => {
  const allowedSeverities = ['low', 'medium', 'high', 'critical', 'info', 'unknown'];
  const sevVal = String(rawData.severity || '').toLowerCase();

  let patchDate = null;
  if (rawData.patch_available_date) {
    const parsedDate = new Date(rawData.patch_available_date);
    if (!isNaN(parsedDate.getTime())) {
      patchDate = parsedDate;
    }
  }

  const assetId = rawData.asset_id ? String(rawData.asset_id).trim() : '';
  const source = String(rawData.source || rawData.scanner || 'unknown').trim().toLowerCase();
  const sourceFindingId = String(rawData.source_finding_id || rawData.finding_id || rawData.id || rawData.vuln_id || rawData.cve || rawData.cve_id || rawData.finding_type || rawData.type || 'finding').trim();
  const findingId = String(rawData.finding_id || `FND-${crypto.createHash('sha1').update(`${assetId}|${source}|${sourceFindingId}`).digest('hex').slice(0, 16)}`);
  const observedAtCandidate = new Date(rawData.observed_at || rawData.timestamp || rawData.last_seen_at || new Date());
  const observedAt = Number.isNaN(observedAtCandidate.getTime()) ? new Date() : observedAtCandidate;
  const rawHash = crypto.createHash('sha256').update(JSON.stringify(rawData, Object.keys(rawData).sort())).digest('hex');

  return {
    finding_id: findingId,
    asset_id: assetId,
    source,
    source_finding_id: sourceFindingId,
    title: String(rawData.title || rawData.name || rawData.finding_type || rawData.type || 'Security finding'),
    description: String(rawData.description || rawData.detail || ''),
    attack_vector: String(rawData.attack_vector || rawData.vector || ''),
    finding_type: rawData.finding_type ? String(rawData.finding_type).trim() : (rawData.type ? String(rawData.type).trim() : 'cve'),
    cve: rawData.cve ? String(rawData.cve).trim() : (rawData.cve_id ? String(rawData.cve_id).trim() : ''),
    cvss: isNaN(Number(rawData.cvss)) ? (isNaN(Number(rawData.cvss_score)) ? 0 : Number(rawData.cvss_score)) : Number(rawData.cvss),
    severity: allowedSeverities.includes(sevVal) ? sevVal : 'unknown',
    exploit_available: rawData.exploit_available !== undefined ? Boolean(rawData.exploit_available) : false,
    epss: isNaN(Number(rawData.epss)) ? (isNaN(Number(rawData.epss_score)) ? 0 : Number(rawData.epss_score)) : Number(rawData.epss),
    cisa_kev: Boolean(rawData.cisa_kev),
    patch_available_date: patchDate,
    patch_age_days: isNaN(Number(rawData.patch_age_days)) ? 0 : Number(rawData.patch_age_days),
    status: ['open', 'in_progress', 'fixed'].includes(rawData.status) ? rawData.status : 'open',
    owner: rawData.owner ? String(rawData.owner).trim() : 'Unassigned',
    due_date: rawData.due_date ? new Date(rawData.due_date) : null,
    remediation_options: Array.isArray(rawData.remediation_options) ? rawData.remediation_options : [],
    first_seen_at: rawData.first_seen_at ? new Date(rawData.first_seen_at) : observedAt,
    last_seen_at: rawData.last_seen_at ? new Date(rawData.last_seen_at) : observedAt,
     observed_at: observedAt,
    linked_event_ids: Array.isArray(rawData.linked_event_ids) ? rawData.linked_event_ids.map(String) : [],
    regulatory_refs: Array.isArray(rawData.regulatory_refs) ? rawData.regulatory_refs.map(String) : [],
    enrichment_status: 'local',
    enrichment_version: 'local-v1',
    raw_hash: rawHash,
    ingestion_job_id: String(rawData.ingestion_job_id || '')
  };
};

const normalizeFindingsBulk = (data) => {
  if (Array.isArray(data)) {
    return data.map((item) => normalizeFinding(item));
  }
  return normalizeFinding(data);
};

module.exports = { normalizeFinding, normalizeFindingsBulk };
