const crypto = require('crypto');

const applyLocalEnrichment = (finding = {}) => {
  const regulatoryRefs = new Set(finding.regulatory_refs || []);
  for (const option of finding.remediation_options || []) {
    if (option.framework) regulatoryRefs.add(String(option.framework));
  }

  const observedAt = finding.observed_at || finding.last_seen_at || new Date();
  const rawHash = finding.raw_hash || crypto.createHash('sha256').update(JSON.stringify(finding)).digest('hex');
  const exploitability = finding.cisa_kev || finding.exploit_available ? 'high' : Number(finding.epss) >= 0.5 ? 'medium' : 'low';
  return {
    ...finding,
    regulatory_refs: [...regulatoryRefs],
    enrichment_status: 'local',
    enrichment_version: 'local-v1',
    enrichment: {
      exploitability,
      public_exploit: Boolean(finding.exploit_available),
      confidence: finding.cisa_kev || finding.exploit_available ? 0.9 : 0.65,
      provider: 'local'
    },
    observed_at: observedAt,
    raw_hash: rawHash
  };
};

module.exports = { applyLocalEnrichment };
