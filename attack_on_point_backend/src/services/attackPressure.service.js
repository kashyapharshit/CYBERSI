const SecurityEvent = require('../models/SecurityEvent');

const getAttackPressure = async ({ windowHours = 24, assetId } = {}) => {
  const safeHours = Math.min(Math.max(Number(windowHours) || 24, 1), 720);
  const since = new Date(Date.now() - safeHours * 60 * 60 * 1000);
  const query = { observed_at: { $gte: since } };
  if (assetId) query.asset_id = assetId;
  const events = await SecurityEvent.find(query).sort({ observed_at: -1 }).lean();
  const byAsset = {};

  for (const event of events) {
    const id = event.asset_id || 'UNMAPPED';
    const item = byAsset[id] ||= {
      asset_id: id,
      signal_count: 0,
      high_critical_signal_count: 0,
      failed_attempts: 0,
      source_ips: new Set(),
      last_observed_at: null,
      linked_event_ids: []
    };
    item.signal_count += 1;
    if (['high', 'critical'].includes(String(event.severity).toLowerCase())) item.high_critical_signal_count += 1;
    item.failed_attempts += Number(event.failed_attempts) || 0;
    if (event.source_ip) item.source_ips.add(event.source_ip);
    item.last_observed_at = item.last_observed_at || event.observed_at;
    item.linked_event_ids.push(String(event._id));
  }

  return Object.values(byAsset).map((item) => {
    const pressureScore = Math.min(1, (item.failed_attempts / 1000) * 0.6 + Math.min(1, item.high_critical_signal_count / 3) * 0.3 + Math.min(1, item.signal_count / 10) * 0.1);
    return {
      ...item,
      source_ips: [...item.source_ips],
      distinct_source_ips: item.source_ips.size,
      pressure_score: Number(pressureScore.toFixed(4)),
      pressure_level: pressureScore >= 0.7 ? 'critical' : pressureScore >= 0.35 ? 'elevated' : pressureScore > 0 ? 'observed' : 'quiet',
      window_hours: safeHours,
      confidence: item.high_critical_signal_count > 0 ? 0.85 : 0.6
    };
  }).sort((a, b) => b.pressure_score - a.pressure_score);
};

module.exports = { getAttackPressure };
