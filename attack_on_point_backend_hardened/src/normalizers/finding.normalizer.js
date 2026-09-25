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

  return {
    asset_id: rawData.asset_id ? String(rawData.asset_id).trim() : '',
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
    remediation_options: Array.isArray(rawData.remediation_options) ? rawData.remediation_options : []
  };
};

const normalizeFindingsBulk = (data) => {
  if (Array.isArray(data)) {
    return data.map((item) => normalizeFinding(item));
  }
  return normalizeFinding(data);
};

module.exports = { normalizeFinding, normalizeFindingsBulk };
