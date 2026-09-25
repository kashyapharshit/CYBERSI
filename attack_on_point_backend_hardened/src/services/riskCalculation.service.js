const crypto = require('crypto');

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, Number(value) || 0));

const criticalityWeight = {
  critical: 1,
  high: 0.8,
  medium: 0.55,
  low: 0.3
};

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = canonicalize(value[key]);
      return result;
    }, {});
  }
  return value;
};

const snapshotHash = (asset, vulnerabilities, incidents = []) => crypto
  .createHash('sha256')
  .update(JSON.stringify(canonicalize({ asset, vulnerabilities, incidents })))
  .digest('hex');

const sourceTimestamp = (asset, vulnerability) => vulnerability?.observed_at || vulnerability?.last_seen_at || vulnerability?.first_seen_at || vulnerability?.updatedAt || vulnerability?.createdAt || asset?.observed_at || asset?.updatedAt || asset?.createdAt || null;

const financialImpactBreakdown = (asset = {}, incidents = []) => {
  const baseRecords = Number(asset.total_records ?? asset.stored_records_count) || 0;
  const incidentRecords = (incidents || []).reduce((sum, incident) => sum + (Number(incident.affected_records) || 0), 0);
  const observedRecords = incidentRecords > 0
    ? Math.min(baseRecords > 0 ? baseRecords : incidentRecords, incidentRecords)
    : baseRecords;
  const recordCost = Number(asset.cost_per_record_inr ?? asset.cost_per_breached_record_inr) || 0;
  const incidentDowntimeMinutes = (incidents || []).reduce((sum, incident) => sum + (Number(incident.service_downtime_minutes) || 0), 0);
  const downtimeHours = incidentDowntimeMinutes > 0 ? incidentDowntimeMinutes / 60 : 24;
  const downtimeRate = Number(asset.hourly_downtime_cost_inr) || 0;
  const breakdown = {
    breach_inr: Math.round(observedRecords * recordCost),
    downtime_inr: Math.round(downtimeHours * downtimeRate),
    regulatory_inr: Math.round(Number(asset.regulatory_penalty_inr) || 0),
    reputation_inr: Math.round(Number(asset.reputation_loss_inr) || 0),
    observed_records: observedRecords,
    downtime_hours: Number(downtimeHours.toFixed(2)),
    incident_count: (incidents || []).length,
    source: incidentRecords > 0 || incidentDowntimeMinutes > 0 ? 'asset-plus-observed-incidents' : 'asset'
  };
  breakdown.total_inr = breakdown.breach_inr + breakdown.downtime_inr + breakdown.regulatory_inr + breakdown.reputation_inr;
  breakdown.breach = breakdown.breach_inr;
  breakdown.downtime = breakdown.downtime_inr;
  breakdown.regulatory = breakdown.regulatory_inr;
  breakdown.reputation = breakdown.reputation_inr;
  breakdown.total = breakdown.total_inr;
  return breakdown;
};

const calculateRiskForAsset = (asset, vulnerabilities = [], incidents = []) => {
  const openVulnerabilities = vulnerabilities.filter((item) => item.status !== 'fixed');
  const maxCvss = openVulnerabilities.reduce((max, item) => Math.max(max, Number(item.cvss ?? item.cvss_score) || 0), 0) / 10;
  const maxEpss = openVulnerabilities.reduce((max, item) => Math.max(max, Number(item.epss ?? item.epss_score) || 0), 0);
  const kevRatio = openVulnerabilities.length
    ? openVulnerabilities.filter((item) => Boolean(item.cisa_kev)).length / openVulnerabilities.length
    : 0;
  const patchAge = clamp(openVulnerabilities.reduce((max, item) => Math.max(max, Number(item.patch_age_days) || 0), 0) / 180);
  const internetExposure = asset.internet_exposed || asset.is_internet_facing ? 1 : 0;
  const tierRisk = criticalityWeight[String(asset.criticality || '').toLowerCase()] || criticalityWeight[{ 1: 'critical', 2: 'high', 3: 'medium', 4: 'low' }[asset.tier]] || 0.3;
  const attackPressure = clamp(asset.attack_pressure ?? ((Number(asset.features?.failed_auth_count) || 0) / 100));

  const signals = [
    { factor: 'CVSS exploitability', value: maxCvss, weight: 0.3, source: 'vulnerability.cvss', source_timestamp: sourceTimestamp(asset, openVulnerabilities.find((item) => Number(item.cvss ?? item.cvss_score) === maxCvss * 10)), explanation: 'Highest open CVSS score across the asset findings.' },
    { factor: 'EPSS likelihood', value: maxEpss, weight: 0.25, source: 'vulnerability.epss', source_timestamp: sourceTimestamp(asset, openVulnerabilities.find((item) => Number(item.epss ?? item.epss_score) === maxEpss)), explanation: 'Highest EPSS score across the asset findings.' },
    { factor: 'CISA KEV exposure', value: kevRatio, weight: 0.2, source: 'vulnerability.cisa_kev', source_timestamp: sourceTimestamp(asset), explanation: 'Share of open findings listed in CISA KEV.' },
    { factor: 'Patch age', value: patchAge, weight: 0.1, source: 'vulnerability.patch_age_days', source_timestamp: sourceTimestamp(asset, openVulnerabilities.find((item) => Number(item.patch_age_days) === patchAge * 180)), explanation: 'Oldest open finding age normalized to 180 days.' },
    { factor: 'Internet exposure', value: internetExposure, weight: 0.1, source: 'asset.internet_exposed', source_timestamp: sourceTimestamp(asset), explanation: 'Whether the asset is reachable from the internet.' },
    { factor: 'Business criticality', value: tierRisk, weight: 0.05, source: 'asset.criticality', source_timestamp: sourceTimestamp(asset), explanation: 'Tier/criticality multiplier for business impact.' },
    { factor: 'Observed attack pressure (telemetry)', value: attackPressure, weight: 0.1, source: 'asset.attack_pressure / asset.features.failed_auth_count', source_timestamp: sourceTimestamp(asset), telemetry: true, explanation: 'Capped observed authentication pressure; not an inferred threat estimate.' }
  ];
  const weightedLikelihood = signals.reduce((sum, signal) => sum + signal.value * signal.weight, 0);
  const likelihood = clamp(weightedLikelihood);
  const impactBreakdown = financialImpactBreakdown(asset, incidents);
  const impactInr = Math.max(1, impactBreakdown.total_inr);
  const impactMultiplier = clamp(0.55 + tierRisk * 0.25 + internetExposure * 0.2, 0.1, 1);
  const probability = clamp(0.05 + likelihood * 0.75, 0.05, 0.8);
  const score = Math.round(clamp((likelihood * 0.65 + tierRisk * 0.35)) * 99);
  const ealInr = Math.round(impactInr * probability * impactMultiplier);
  const varInr = Math.round(ealInr * 1.35);
  const totalContribution = signals.reduce((sum, signal) => sum + signal.value * signal.weight, 0) || 1;
  const drivers = signals
    .map((signal) => ({
      factor: signal.factor,
      contribution: Number(((signal.value * signal.weight) / totalContribution).toFixed(4)),
      value: Number(signal.value.toFixed(4)),
      source: signal.source,
      telemetry: Boolean(signal.telemetry),
      explanation: signal.explanation,
      source_timestamp: signal.source_timestamp || asset.updatedAt || asset.createdAt || null,
      weight: signal.weight
    }))
    .sort((a, b) => b.contribution - a.contribution);

  return {
    asset_id: asset.asset_id,
    criticality: asset.criticality || 'medium',
    internet_exposed: Boolean(asset.internet_exposed || asset.is_internet_facing),
    severity: score >= 80 ? 'critical' : score >= 60 ? 'high' : score >= 35 ? 'medium' : 'low',
    exploit_available: openVulnerabilities.some((item) => Boolean(item.exploit_available || item.cisa_kev)),
    evidence_confidence: 0.75,
    score,
    level: score >= 80 ? 'critical' : score >= 60 ? 'high' : score >= 35 ? 'medium' : 'low',
    eal_inr: ealInr,
    var_inr: varInr,
    likelihood: Number(probability.toFixed(4)),
    impact_inr: Math.round(impactInr),
    attack_pressure: Number(attackPressure.toFixed(4)),
    drivers,
    formula: 'EAL=impact x probability x impact_multiplier; p=clamp(0.05+weighted_likelihood x 0.75); observed telemetry is capped before weighting',
    model_version: 'backend-deterministic-v2',
    financial_impact_breakdown: impactBreakdown,
    impact_breakdown: impactBreakdown,
    input_snapshot_hash: snapshotHash(asset, openVulnerabilities, incidents),
    assessed_at: new Date()
  };
};

module.exports = { calculateRiskForAsset, financialImpactBreakdown };
