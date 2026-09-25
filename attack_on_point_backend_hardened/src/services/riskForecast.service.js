const RiskHistory = require('../models/RiskHistory');

const getRiskForecast = async ({ horizonDays = 30, limit = 30 } = {}) => {
  const safeHorizon = Math.min(Math.max(Number(horizonDays) || 30, 1), 365);
  const safeLimit = Math.min(Math.max(Number(limit) || 30, 2), 100);
  const history = (await RiskHistory.find({ scenario_type: 'actual' }).sort({ timestamp: -1 }).limit(safeLimit).lean()).reverse();
  const observations = history.map((item) => ({
    timestamp: item.timestamp || item.createdAt,
    eal_inr: Number(item.total_expected_annual_loss_inr) || 0,
    var_inr: Number(item.value_at_risk_inr) || 0,
    scenario_id: item.scenario_id
  })).filter((item) => item.timestamp);
  const origin = observations[0] ? new Date(observations[0].timestamp).getTime() : Date.now();
  const points = observations.map((item) => ({ ...item, day: (new Date(item.timestamp).getTime() - origin) / 86400000 }));
  const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const regressionSlope = (key) => {
    if (points.length < 2) return 0;
    const meanX = mean(points.map((point) => point.day));
    const meanY = mean(points.map((point) => point[key]));
    const denominator = points.reduce((sum, point) => sum + ((point.day - meanX) ** 2), 0);
    return denominator ? points.reduce((sum, point) => sum + ((point.day - meanX) * (point[key] - meanY)), 0) / denominator : 0;
  };
  const latest = points[points.length - 1] || { eal_inr: 0, var_inr: 0 };
  const ealSlope = regressionSlope('eal_inr');
  const varSlope = regressionSlope('var_inr');
  const direction = ealSlope > 0.5 ? 'increasing' : ealSlope < -0.5 ? 'decreasing' : 'stable';
  return {
    direction,
    horizon_days: safeHorizon,
    current_eal_inr: Math.round(latest.eal_inr),
    current_var_inr: Math.round(latest.var_inr),
    forecast_eal_inr: Math.round(Math.max(0, latest.eal_inr + ealSlope * safeHorizon)),
    forecast_var_inr: Math.round(Math.max(0, latest.var_inr + varSlope * safeHorizon)),
    slope_eal_inr_per_day: Number(ealSlope.toFixed(2)),
    slope_var_inr_per_day: Number(varSlope.toFixed(2)),
    confidence: Number(Math.min(1, points.length / 10).toFixed(2)),
    observations: points.map(({ day, ...point }) => point),
    method: 'ordinary-least-squares directional trend over actual RiskHistory snapshots; no causal claim',
    assumptions: {
      scenario_type: 'actual',
      minimum_observations_for_slope: 2,
      stable_threshold_inr_per_day: 0.5,
      forecast_floor_inr: 0
    }
  };
};

module.exports = { getRiskForecast };
