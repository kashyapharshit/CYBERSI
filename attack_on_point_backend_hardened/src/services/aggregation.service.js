const Asset = require('../models/Asset');
const Risk = require('../models/Risk');
const Vulnerability = require('../models/Vulnerability');
const Incident = require('../models/Incident');
const Control = require('../models/Control');
const { calculateRiskForAsset } = require('./riskCalculation.service');
const { calculateControlEffectiveness } = require('./controlEffectiveness.service');

const emptyTotals = () => ({
  asset_count: 0,
  total_eal_inr: 0,
  total_var_inr: 0,
  average_risk_score: 0,
  average_measured_control_effectiveness_pct: 0,
  incidents: 0,
  risk_levels: { critical: 0, high: 0, medium: 0, low: 0 },
  financial_impact_breakdown: { breach_inr: 0, downtime_inr: 0, regulatory_inr: 0, reputation_inr: 0, total_inr: 0 }
});

const addAsset = (totals, item) => {
  totals.asset_count += 1;
  totals.total_eal_inr += Number(item.eal_inr) || 0;
  totals.total_var_inr += Number(item.var_inr) || 0;
  totals.average_risk_score += Number(item.score) || 0;
  totals.average_measured_control_effectiveness_pct += Number(item.measured_control_effectiveness_pct) || 0;
  totals.incidents += Number(item.incident_count) || 0;
  if (totals.risk_levels[item.level]) totals.risk_levels[item.level] += 1;
  const breakdown = item.financial_impact_breakdown || {};
  for (const key of Object.keys(totals.financial_impact_breakdown)) {
    const alias = { breach_inr: 'breach', downtime_inr: 'downtime', regulatory_inr: 'regulatory', reputation_inr: 'reputation', total_inr: 'total' }[key];
    totals.financial_impact_breakdown[key] += Number(breakdown[key] ?? breakdown[alias]) || 0;
  }
};

const finalizeTotals = (totals) => ({
  ...totals,
  total_eal_inr: Math.round(totals.total_eal_inr),
  total_var_inr: Math.round(totals.total_var_inr),
  eal_inr: Math.round(totals.total_eal_inr),
  var_inr: Math.round(totals.total_var_inr),
  average_risk_score: totals.asset_count ? Number((totals.average_risk_score / totals.asset_count).toFixed(2)) : 0,
  average_measured_control_effectiveness_pct: totals.asset_count ? Number((totals.average_measured_control_effectiveness_pct / totals.asset_count).toFixed(2)) : 0,
  financial_impact_breakdown: (() => {
    const breakdown = Object.fromEntries(Object.entries(totals.financial_impact_breakdown).map(([key, value]) => [key, Math.round(value)]));
    return { ...breakdown, breach: breakdown.breach_inr, downtime: breakdown.downtime_inr, regulatory: breakdown.regulatory_inr, reputation: breakdown.reputation_inr, total: breakdown.total_inr };
  })()
});

const getRiskAggregation = async ({ businessUnit, assetId } = {}) => {
  const [assets, risks, vulnerabilities, incidents, controls] = await Promise.all([
    Asset.find().sort({ business_unit: 1, asset_id: 1 }).lean(),
    Risk.find().lean(),
    Vulnerability.find({ status: { $ne: 'fixed' } }).lean(),
    Incident.find().lean(),
    Control.find().lean()
  ]);
  const riskByAsset = Object.fromEntries(risks.map((risk) => [risk.asset_id, risk]));
  const vulnerabilitiesByAsset = vulnerabilities.reduce((result, item) => ((result[item.asset_id] ||= []).push(item), result), {});
  const incidentsByAsset = incidents.reduce((result, item) => ((result[item.asset_id] ||= []).push(item), result), {});
  const filteredAssets = assets.filter((asset) => (!businessUnit || asset.business_unit === businessUnit) && (!assetId || asset.asset_id === assetId));
  const assetRows = filteredAssets.map((asset) => {
    const storedRisk = riskByAsset[asset.asset_id];
    const calculatedRisk = calculateRiskForAsset(asset, vulnerabilitiesByAsset[asset.asset_id] || [], incidentsByAsset[asset.asset_id] || []);
    const storedBreakdown = storedRisk?.financial_impact_breakdown || storedRisk?.impact_breakdown;
    const risk = {
      ...calculatedRisk,
      ...(storedRisk || {}),
      financial_impact_breakdown: storedBreakdown && Object.keys(storedBreakdown).length ? storedBreakdown : calculatedRisk.financial_impact_breakdown,
      impact_breakdown: storedRisk?.impact_breakdown || calculatedRisk.impact_breakdown
    };
    const controlRows = controls.filter((control) => !control.target_asset_id || control.target_asset_id === 'GLOBAL' || control.target_asset_id === asset.asset_id);
    const measuredEffectiveness = controlRows.length
      ? Number((controlRows.reduce((sum, control) => sum + calculateControlEffectiveness(control, incidentsByAsset[asset.asset_id] || []).measured_effectiveness, 0) / controlRows.length).toFixed(2))
      : 0;
    return {
      asset_id: asset.asset_id,
      hostname: asset.hostname || '',
      business_unit: asset.business_unit || 'Core Operations',
      score: Number(risk.score) || 0,
      level: String(risk.level || asset.risk_level || 'low').toLowerCase(),
      eal_inr: Number(risk.eal_inr ?? asset.asset_eal_inr) || 0,
      var_inr: Number(risk.var_inr ?? asset.asset_var_inr) || 0,
      incident_count: (incidentsByAsset[asset.asset_id] || []).length,
      measured_control_effectiveness_pct: measuredEffectiveness,
      financial_impact_breakdown: risk.financial_impact_breakdown || risk.impact_breakdown || {},
      provenance: {
        cmdb_source: asset.cmdb_source || '',
        cmdb_record_id: asset.cmdb_record_id || '',
        inventory_source: asset.inventory_source || '',
        inventory_record_id: asset.inventory_record_id || '',
        last_inventory_sync_at: asset.last_inventory_sync_at || null,
        ...(asset.provenance || {})
      }
    };
  });

  const enterpriseTotals = emptyTotals();
  assetRows.forEach((row) => addAsset(enterpriseTotals, row));
  const byBusinessUnit = {};
  for (const row of assetRows) {
    const key = row.business_unit || 'Core Operations';
    byBusinessUnit[key] ||= { business_unit: key, ...emptyTotals(), assets: [] };
    byBusinessUnit[key].assets.push(row);
    addAsset(byBusinessUnit[key], row);
  }
  const businessUnits = Object.values(byBusinessUnit).map((item) => ({ ...finalizeTotals(item), assets: item.assets }));
  return {
    aggregation_level: assetId ? 'asset' : businessUnit ? 'business_unit' : 'enterprise',
    filters: { business_unit: businessUnit || null, asset_id: assetId || null },
    enterprise: { scope: 'enterprise', name: 'Enterprise', ...finalizeTotals(enterpriseTotals) },
    business_units: businessUnits,
    assets: assetRows,
    data: assetId ? assetRows[0] || null : businessUnit ? businessUnits : { scope: 'enterprise', ...finalizeTotals(enterpriseTotals) }
  };
};

module.exports = { getRiskAggregation };
