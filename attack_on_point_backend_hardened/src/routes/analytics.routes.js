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

// 1. Fix #5: Risk Trend Graph Data Endpoint
router.get('/risk-trend', protect, async (req, res, next) => {
  try {
    const history = await RiskHistory.find().sort({ timestamp: 1 }).limit(30);
    res.status(200).json({
      success: true,
      count: history.length,
      data: history
    });
  } catch (err) {
    next(err);
  }
});

// 2. Fix #6: What-If Simulation Engine Endpoint
router.post('/what-if', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { simulated_control_ids = [], delay_days = 0 } = req.body;
    if (!Array.isArray(simulated_control_ids) || Number(delay_days) < 0) {
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
    const delayFactor = 1 + Number(delay_days || 0) * 0.005;
    const simulatedEal = originalEal * (1 - combinedReduction) * delayFactor;
    const riskDelta = originalEal - simulatedEal;

    res.status(200).json({
      success: true,
      simulation_params: { simulated_control_ids, delay_days },
      original_eal_inr: Math.round(originalEal),
      simulated_eal_inr: Math.round(simulatedEal),
      risk_reduction_achieved_inr: Math.round(riskDelta),
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
    const controls = await Control.find().sort({ cost_inr: 1 });
    const settings = await Settings.getSettings();
    const baselineEal = Number(settings.total_expected_annual_loss_inr) || 0;
    let cumulativeInvestment = 0;
    let cumulativeReduction = 0;

    const curveData = controls.map((ctrl) => {
      cumulativeInvestment += ctrl.cost_inr || 0;
      const reduction = normalizeReduction(ctrl.risk_reduction_pct);
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
        cumulative_risk_reduction_pct: cumulativeReduction * 100,
        estimated_risk_reduction_inr: Math.round(riskReductionInr),
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

    const frameworkStats = {};
    for (const control of controls) {
      for (const framework of control.compliance_frameworks || []) {
        if (!frameworkStats[framework]) frameworkStats[framework] = { total: 0, implemented: 0, partial: 0 };
        frameworkStats[framework].total += 1;
        if (control.status === 'implemented') frameworkStats[framework].implemented += 1;
        if (control.status === 'partial') frameworkStats[framework].partial += 1;
      }
    }
    for (const stats of Object.values(frameworkStats)) {
      stats.coverage_pct = stats.total ? Number((((stats.implemented + stats.partial * 0.5) / stats.total) * 100).toFixed(2)) : 0;
    }

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
