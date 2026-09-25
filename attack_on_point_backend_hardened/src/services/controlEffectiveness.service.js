const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, Number(value) || 0));

const asRatio = (value, fallback = 0) => {
  if (value === undefined || value === null || value === '') return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return clamp(number > 1 ? number / 100 : number);
};

const incidentCount = (control = {}, incidents = []) => {
  const explicitHistory = Array.isArray(control.incident_history)
    ? control.incident_history.length
    : Number(control.incident_history) || Number(control.incident_history_count) || 0;
  const target = String(control.target_asset_id || '');
  const observed = (incidents || []).filter((incident) => !target || target === 'GLOBAL' || String(incident.asset_id) === target).length;
  return Math.max(0, explicitHistory, observed);
};

const calculateControlEffectiveness = (control = {}, incidents = []) => {
  const statusCoverage = control.status ? ({ implemented: 1, partial: 0.5, not_implemented: 0 }[control.status] ?? 0) : 1;
  const claimed = asRatio(control.claimed_effectiveness ?? control.risk_reduction_pct ?? control.effectiveness);
  const configuration = asRatio(control.configuration_coverage, statusCoverage);
  const compliance = asRatio(control.compliance_coverage, 1);
  const historyCount = incidentCount(control, incidents);
  const incidentFactor = clamp(1 - Math.min(historyCount, 5) * 0.1, 0.5, 1);
  const measured = claimed * configuration * compliance * incidentFactor;

  return {
    claimed_effectiveness: Number((claimed * 100).toFixed(2)),
    configuration_coverage: Number((configuration * 100).toFixed(2)),
    compliance_coverage: Number((compliance * 100).toFixed(2)),
    incident_history_count: historyCount,
    incident_adjustment_factor: Number(incidentFactor.toFixed(4)),
    measured_effectiveness: Number((measured * 100).toFixed(2)),
    effectiveness: Number((measured * 100).toFixed(2)),
    effectiveness_formula: 'measured=claimed x configuration_coverage x compliance_coverage x incident_adjustment_factor'
  };
};

module.exports = { calculateControlEffectiveness, asRatio };
