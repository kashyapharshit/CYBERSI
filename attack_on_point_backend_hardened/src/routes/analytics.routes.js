const express = require('express');
const router = express.Router();
const RiskHistory = require('../models/RiskHistory');
const Control = require('../models/Control');
const Settings = require('../models/Settings');
const Asset = require('../models/Asset');
const Vulnerability = require('../models/Vulnerability');
const { protect, authorize } = require('../middleware/userAuth.middleware');
const { combineReductions, normalizeReduction, applyMarginalReduction, getReductionSettings } = require('../services/controlReduction.service');
const { runExternalOptimizer, runOptimizerComparison } = require('../services/optimizer.service');
const { getAttackPressure } = require('../services/attackPressure.service');
const { getDependencyProfile } = require('../services/dependencyCorrelation.service');
const { getRegulatoryCoverage } = require('../services/regulatoryCoverage.service');
const { calculateControlEffectiveness } = require('../services/controlEffectiveness.service');
const { getRiskAggregation } = require('../services/aggregation.service');
const { getRiskForecast } = require('../services/riskForecast.service');
const Incident = require('../models/Incident');
const crypto = require('crypto');

const snapshotHash = (value) => crypto.createHash('sha256').update(JSON.stringify(value, (_key, item) => item instanceof Date ? item.toISOString() : item)).digest('hex');

const buildScenarioEvidence = async () => {
  const [assets, vulnerabilities, controls, attackPressure, regulatoryCoverage] = await Promise.all([
    Asset.find().sort({ asset_id: 1 }).lean(),
    Vulnerability.find().sort({ finding_id: 1 }).lean(),
    Control.find().sort({ control_id: 1 }).lean(),
    getAttackPressure({ windowHours: 24 }),
    getRegulatoryCoverage()
  ]);
  const assetSnapshots = assets.map((asset) => ({ asset_id: asset.asset_id, score: asset.risk_score || 0, level: asset.risk_level || '', eal_inr: asset.asset_eal_inr || 0, var_inr: asset.asset_var_inr || 0 }));
  return {
    input_snapshot_hash: snapshotHash({ assets, vulnerabilities, controls }),
    finding_snapshot_hash: snapshotHash(vulnerabilities),
    asset_snapshots: assetSnapshots,
    attack_pressure_snapshot: attackPressure,
    regulatory_coverage_snapshot: regulatoryCoverage
  };
};

// 1. Fix #5: Risk Trend Graph Data Endpoint
router.get('/risk-trend', protect, async (req, res, next) => {
  try {
    const history = await RiskHistory.find({ scenario_type: 'actual' }).sort({ timestamp: 1 }).limit(30);
    res.status(200).json({
      success: true,
      count: history.length,
      data: history
    });
  } catch (err) {
    next(err);
  }
});

router.get('/risk-forecast', protect, authorize('admin', 'analyst'), async (req, res, next) => {
  try {
    const forecast = await getRiskForecast({ horizonDays: req.query.horizon_days, limit: req.query.limit });
    res.status(200).json({ success: true, data: forecast });
  } catch (err) {
    next(err);
  }
});

const aggregationHandler = async (req, res, next) => {
  try {
    const data = await getRiskAggregation({ businessUnit: req.query.business_unit, assetId: req.query.asset_id });
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

router.get('/aggregation', protect, authorize('admin', 'analyst'), aggregationHandler);
router.get('/aggregations', protect, authorize('admin', 'analyst'), aggregationHandler);
router.get('/portfolio', protect, authorize('admin', 'analyst'), aggregationHandler);

router.get('/control-effectiveness', protect, authorize('admin', 'analyst'), async (req, res, next) => {
  try {
    const [controls, incidents] = await Promise.all([Control.find().lean(), Incident.find().lean()]);
    const data = controls.map((control) => {
      const effectiveness = calculateControlEffectiveness(control, incidents);
      return {
        control_id: control.control_id,
        name: control.name,
        status: control.status,
        claimed_effectiveness_pct: effectiveness.claimed_effectiveness,
        measured_effectiveness_pct: effectiveness.measured_effectiveness,
        configuration_coverage_pct: effectiveness.configuration_coverage,
        compliance_coverage_pct: effectiveness.compliance_coverage,
        incident_history_count: effectiveness.incident_history_count,
        evidence_source: control.evidence_source || 'configuration, compliance, and incident evidence',
        confidence: Math.min(100, Math.round((Number(control.evidence_confidence) || 0.7) * 100))
      };
    });
    res.status(200).json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
});

router.get('/scenarios', protect, authorize('admin', 'analyst'), async (req, res, next) => {
  try {
    const scenarios = await RiskHistory.find({ scenario_type: { $ne: 'actual' } }).sort({ timestamp: -1 }).limit(50).lean();
    res.status(200).json({ success: true, count: scenarios.length, data: scenarios });
  } catch (err) {
    next(err);
  }
});

router.get('/attack-pressure', protect, authorize('admin', 'analyst'), async (req, res, next) => {
  try {
    const pressure = await getAttackPressure({ windowHours: req.query.window_hours, assetId: req.query.asset_id });
    res.status(200).json({ success: true, count: pressure.length, data: pressure });
  } catch (err) {
    next(err);
  }
});

router.get('/dependencies/:asset_id', protect, authorize('admin', 'analyst'), async (req, res, next) => {
  try {
    const profile = await getDependencyProfile(req.params.asset_id);
    if (!profile) return res.status(404).json({ success: false, message: 'Asset not found' });
    res.status(200).json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
});

router.get('/regulatory-coverage', protect, async (req, res, next) => {
  try {
    const data = await getRegulatoryCoverage();
    res.status(200).json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
});

// 2. Fix #6: What-If Simulation Engine Endpoint
router.post('/what-if', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { simulated_control_ids = [], delay_days = 0 } = req.body;
    const delayDays = Number(delay_days);
    if (!Array.isArray(simulated_control_ids) || !Number.isFinite(delayDays) || delayDays < 0) {
      return res.status(400).json({ success: false, message: 'simulated_control_ids must be an array and delay_days cannot be negative' });
    }
    const currentSettings = await Settings.getSettings();
    const originalEal = Number(currentSettings.total_expected_annual_loss_inr) || 0;

    // Fetch applied controls
    let combinedReduction = 0;
    let controls = [];
    if (simulated_control_ids.length > 0) {
      controls = await Control.find({ control_id: { $in: simulated_control_ids } });
      combinedReduction = combineReductions(controls).combinedReduction;
    }

    // Delay penalty factor (0.5% risk increase per day delayed)
    const delayFactor = 1 + delayDays * 0.005;
    const simulatedEal = originalEal * (1 - combinedReduction) * delayFactor;
    const riskDelta = originalEal - simulatedEal;

    const scenarioId = `SCN-${crypto.randomUUID()}`;
    const evidence = await buildScenarioEvidence();
    await RiskHistory.create({
      scenario_id: scenarioId,
      scenario_type: 'what_if',
      scenario_name: 'What-if control simulation',
      trigger_reason: 'Investment Lab user scenario',
      timestamp: new Date(),
      total_expected_annual_loss_inr: Math.round(simulatedEal),
      value_at_risk_inr: Number(currentSettings.value_at_risk_inr) || 0,
      control_ids: simulated_control_ids,
      assumptions: { delay_days: delayDays, baseline_eal_inr: originalEal, ...getReductionSettings() },
      ...evidence
    });

    res.status(200).json({
      success: true,
      simulation_params: { simulated_control_ids, delay_days: delayDays },
      original_eal_inr: Math.round(originalEal),
      simulated_eal_inr: Math.round(simulatedEal),
      risk_reduction_achieved_inr: Math.round(riskDelta),
      scenario_id: scenarioId,
      combined_reduction_pct: Number((combinedReduction * 100).toFixed(2)),
      model: 'bounded-overlap-control-approximation',
      assumptions: { ...getReductionSettings(), selected_controls_found: controls.length },
      warning: 'This endpoint is a transparent what-if approximation. Use the Python optimizer endpoint for final portfolio selection.'
    });
  } catch (err) {
    next(err);
  }
});

// 3. Fix #7 & #8: ROSI & Investment vs Risk Reduction Curve Data
router.get('/investment-curve', protect, authorize('admin'), async (req, res, next) => {
  try {
    const [controls, incidents] = await Promise.all([Control.find().sort({ cost_inr: 1 }).lean(), Incident.find().lean()]);
    const settings = await Settings.getSettings();
    const baselineEal = Number(settings.total_expected_annual_loss_inr) || 0;
    let cumulativeInvestment = 0;
    let cumulativeReduction = 0;

    const curveData = controls.map((ctrl) => {
      cumulativeInvestment += ctrl.cost_inr || 0;
      const effectiveness = calculateControlEffectiveness(ctrl, incidents);
      const reduction = normalizeReduction(effectiveness.measured_effectiveness);
      cumulativeReduction = applyMarginalReduction(cumulativeReduction, reduction);
      const riskReductionInr = baselineEal * cumulativeReduction;
      const rosiValue = riskReductionInr - cumulativeInvestment;
      const rosiPct = cumulativeInvestment > 0 ? (rosiValue / cumulativeInvestment) * 100 : 0;

      return {
        control_id: ctrl.control_id,
        name: ctrl.name,
        cost_inr: ctrl.cost_inr,
        cumulative_investment_inr: cumulativeInvestment,
        risk_reduction_pct: reduction * 100,
        claimed_effectiveness: effectiveness.claimed_effectiveness,
        configuration_coverage: effectiveness.configuration_coverage,
        compliance_coverage: effectiveness.compliance_coverage,
        incident_history_count: effectiveness.incident_history_count,
        measured_effectiveness: effectiveness.measured_effectiveness,
        cumulative_risk_reduction_pct: cumulativeReduction * 100,
        estimated_risk_reduction_inr: Math.round(riskReductionInr),
        rosi_inr: Math.round(rosiValue),
        rosi_pct: Number(rosiPct.toFixed(2)),
        estimated_rosi_inr: Math.round(rosiValue),
        estimated_rosi_pct: Number(rosiPct.toFixed(2))
      };
    });

    res.status(200).json({
      success: true,
      data: curveData
    });
  } catch (err) {
    next(err);
  }
});

router.post('/optimize', protect, authorize('admin'), async (req, res, next) => {
  try {
    const result = await runExternalOptimizer(req.body || {});
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.post('/optimizer-comparison', protect, authorize('admin'), async (req, res, next) => {
  try {
    const result = await runOptimizerComparison(req.body || {});
    const comparison = result?.data || result;
    const optimizer = comparison?.optimizer || {};
    const evidence = await buildScenarioEvidence();
    await RiskHistory.create({
      scenario_id: `SCN-${crypto.randomUUID()}`,
      scenario_type: 'optimizer',
      scenario_name: 'Optimizer comparison',
      trigger_reason: 'Investment Lab optimizer comparison',
      timestamp: new Date(),
      total_expected_annual_loss_inr: Number(optimizer.estimated_residual_eal_inr) || 0,
      value_at_risk_inr: Number(optimizer.estimated_residual_var_inr) || 0,
      control_ids: optimizer.recommended_control_ids || [],
      assumptions: { comparison_version: comparison.comparison_version, baseline_version: comparison.severity_only_baseline?.baseline_version },
      ...evidence
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// 4. Fix #10: Audit / Regulatory Compliance Summary Report
router.get('/audit-report', protect, async (req, res, next) => {
  try {
    const assets = await Asset.find().lean();
    const vulnerabilities = await Vulnerability.find({ status: 'open' }).lean();
    const controls = await Control.find().lean();
    const settings = await Settings.getSettings();

    const frameworkCoverage = await getRegulatoryCoverage();
    const frameworkStats = Object.fromEntries(frameworkCoverage.map((item) => [item.framework, item]));

    const report = {
      report_generated_at: new Date(),
      organization: "Enterprise NeoBank",
      summary: {
        total_assets_monitored: assets.length,
        open_vulnerabilities_count: vulnerabilities.length,
        critical_unpatched_cves: vulnerabilities.filter((v) => v.severity === 'critical').length,
        total_expected_annual_loss_inr: settings.total_expected_annual_loss_inr,
        value_at_risk_inr: settings.value_at_risk_inr
      },
      regulatory_compliance_breakdown: frameworkStats,
      compliance_note: 'Coverage is derived from stored control status; it is not a legal or audit certification.'
    };

    res.status(200).json({
      success: true,
      report
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
