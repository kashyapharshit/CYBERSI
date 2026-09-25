# Attack On Point: Copy-Paste Change Guide

This guide maps the screenshot recommendations to the current project. Apply the changes in order. Make a backup before editing.

## What Is Already Present

- EAL/VaR and the four financial inputs already exist.
- An investment-curve endpoint already exists, but the active Investment Lab does not show it.
- Business unit exists on assets, but there is no enterprise/business-unit aggregation endpoint.
- Ingestion jobs and 5-second dashboard refresh exist, but there is no explicit stream mode.
- Historical risk trend exists, but there is no forecast.

## 1. Add Shared Decision Analytics Service

Create this file:

`work/backend/src/services/decisionAnalytics.service.js`

Paste the complete file:

```js
const number = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const round = (value) => Math.round(number(value));
const pct = (value) => Math.min(100, Math.max(0, number(value)));

const impactBreakdown = (asset = {}, incidents = []) => {
  const related = incidents.filter((item) => item.asset_id === asset.asset_id);
  const observedAffectedRecords = related.reduce((sum, item) => sum + number(item.affected_records), 0);
  const modeledRecords = Math.max(
    number(asset.total_records || asset.stored_records_count),
    observedAffectedRecords
  );
  const downtimeHours = number(asset.downtime_hours_assumption, 24) || 24;
  const breach = modeledRecords * number(asset.cost_per_record_inr || asset.cost_per_breached_record_inr);
  const downtime = number(asset.hourly_downtime_cost_inr) * downtimeHours;
  const regulatory = number(asset.regulatory_penalty_inr);
  const reputation = number(asset.reputation_loss_inr);

  return {
    breach_inr: round(breach),
    downtime_inr: round(downtime),
    regulatory_inr: round(regulatory),
    reputation_inr: round(reputation),
    total_inr: round(breach + downtime + regulatory + reputation),
    assumptions: {
      modeled_records: modeledRecords,
      observed_affected_records: observedAffectedRecords,
      downtime_hours: downtimeHours,
      incident_count: related.length
    }
  };
};

const controlEffectiveness = (control = {}, incidents = []) => {
  const claimed = pct(control.claimed_effectiveness_pct ?? control.risk_reduction_pct);
  const configuration = pct(control.configuration_coverage_pct ?? 100) / 100;
  const compliance = pct(control.compliance_coverage_pct ?? 100) / 100;
  const related = incidents.filter((item) => item.control_id === control.control_id);
  const observedFailures = related.filter((item) => !['closed', 'contained'].includes(String(item.compromise_status).toLowerCase())).length;
  const incidentFailureRate = related.length
    ? (observedFailures / related.length) * 100
    : pct(control.incident_failure_rate_pct);
  const measured = control.measured_effectiveness_pct == null
    ? claimed * configuration * compliance * (1 - incidentFailureRate / 100)
    : pct(control.measured_effectiveness_pct);

  return {
    claimed_effectiveness_pct: round(claimed),
    measured_effectiveness_pct: round(measured),
    configuration_coverage_pct: round(configuration * 100),
    compliance_coverage_pct: round(compliance * 100),
    incident_failure_rate_pct: round(incidentFailureRate),
    evidence_source: control.evidence_source || 'configuration telemetry + incident history + compliance status',
    confidence: round(Math.min(100, 40 + configuration * 25 + compliance * 25 + (related.length ? 10 : 0)))
  };
};

const sumImpact = (rows) => rows.reduce((total, row) => {
  const impact = row.impact_breakdown || {};
  total.breach_inr += number(impact.breach_inr);
  total.downtime_inr += number(impact.downtime_inr);
  total.regulatory_inr += number(impact.regulatory_inr);
  total.reputation_inr += number(impact.reputation_inr);
  total.total_inr += number(impact.total_inr);
  return total;
}, { breach_inr: 0, downtime_inr: 0, regulatory_inr: 0, reputation_inr: 0, total_inr: 0 });

const aggregatePortfolio = ({ assets = [], risks = [], controls = [], incidents = [] } = {}) => {
  const riskMap = new Map(risks.map((risk) => [risk.asset_id, risk]));
  const rows = assets.map((asset) => {
    const risk = riskMap.get(asset.asset_id) || {};
    const impact = impactBreakdown(asset, incidents);
    return {
      asset_id: asset.asset_id,
      hostname: asset.hostname || asset.asset_id,
      business_unit: asset.business_unit || 'Unassigned',
      eal_inr: number(risk.eal_inr ?? asset.asset_eal_inr),
      var_inr: number(risk.var_inr ?? asset.asset_var_inr),
      risk_score: number(risk.score ?? asset.risk_score),
      risk_level: risk.level || asset.risk_level || 'unassessed',
      impact_breakdown: impact
    };
  });

  const summarize = (name, items) => ({
    name,
    asset_count: items.length,
    eal_inr: round(items.reduce((sum, item) => sum + item.eal_inr, 0)),
    var_inr: round(items.reduce((sum, item) => sum + item.var_inr, 0)),
    average_risk_score: items.length ? round(items.reduce((sum, item) => sum + item.risk_score, 0) / items.length) : 0,
    impact_breakdown: sumImpact(items),
    note: 'VaR is allocated as the sum of asset VaR values. Portfolio VaR should use correlated simulation when correlation data is available.'
  });

  const groups = new Map();
  rows.forEach((row) => {
    if (!groups.has(row.business_unit)) groups.set(row.business_unit, []);
    groups.get(row.business_unit).push(row);
  });

  return {
    enterprise: summarize('Enterprise', rows),
    business_units: [...groups.entries()].map(([name, items]) => summarize(name, items)),
    assets: rows,
    generated_at: new Date().toISOString(),
    control_effectiveness: controls.map((control) => ({
      control_id: control.control_id,
      name: control.name,
      status: control.status,
      ...controlEffectiveness(control, incidents)
    }))
  };
};

const buildInvestmentCurve = (controls = [], baselineEal = 0, incidents = []) => {
  let investment = 0;
  let combinedReduction = 0;
  return controls.slice().sort((a, b) => number(a.cost_inr) - number(b.cost_inr)).map((control) => {
    const effectiveness = controlEffectiveness(control, incidents);
    const reduction = Math.min(0.95, number(effectiveness.measured_effectiveness_pct) / 100);
    investment += number(control.cost_inr);
    combinedReduction = Math.min(0.85, combinedReduction + reduction * (1 - combinedReduction) * 0.65);
    const riskReduction = number(baselineEal) * combinedReduction;
    const rosi = riskReduction - investment;
    return {
      control_id: control.control_id,
      name: control.name,
      cost_inr: round(control.cost_inr),
      effective_effectiveness_pct: round(effectiveness.measured_effectiveness_pct),
      cumulative_investment_inr: round(investment),
      cumulative_risk_reduction_pct: round(combinedReduction * 100),
      estimated_risk_reduction_inr: round(riskReduction),
      rosi_inr: round(rosi),
      rosi_pct: investment ? Number(((rosi / investment) * 100).toFixed(2)) : 0
    };
  });
};

const forecastRiskTrend = (history = [], horizonDays = 30) => {
  const points = history
    .filter((item) => item.scenario_type === 'actual' && item.timestamp)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .map((item, index) => ({ x: index, y: number(item.total_expected_annual_loss_inr), timestamp: item.timestamp }));
  if (points.length < 2) return { model: 'linear-trend-v1', forecast: [], confidence: 0, note: 'At least two actual history points are required.' };
  const meanX = points.reduce((sum, item) => sum + item.x, 0) / points.length;
  const meanY = points.reduce((sum, item) => sum + item.y, 0) / points.length;
  const denominator = points.reduce((sum, item) => sum + ((item.x - meanX) ** 2), 0) || 1;
  const slope = points.reduce((sum, item) => sum + ((item.x - meanX) * (item.y - meanY)), 0) / denominator;
  const intercept = meanY - slope * meanX;
  const residual = Math.sqrt(points.reduce((sum, item) => sum + ((item.y - (intercept + slope * item.x)) ** 2), 0) / points.length);
  const last = new Date(points[points.length - 1].timestamp);
  const forecast = Array.from({ length: Math.max(1, Math.ceil(number(horizonDays) / 7)) }, (_, index) => {
    const y = Math.max(0, intercept + slope * (points.length + index));
    const timestamp = new Date(last.getTime() + (index + 1) * 7 * 24 * 60 * 60 * 1000);
    return { timestamp, predicted_eal_inr: round(y), lower_inr: round(Math.max(0, y - residual * 1.28)), upper_inr: round(y + residual * 1.28) };
  });
  return { model: 'linear-trend-v1', horizon_days: number(horizonDays, 30), confidence: 0.8, slope_per_period_inr: round(slope), forecast, note: 'Directional forecast only; it is not a threat prediction.' };
};

module.exports = { impactBreakdown, controlEffectiveness, aggregatePortfolio, buildInvestmentCurve, forecastRiskTrend };
```

## 2. Add the Missing Fields

### `work/backend/src/models/Asset.js`

Add these fields before the closing `}, { timestamps: true });`:

```js
  downtime_hours_assumption: { type: Number, default: 24, min: 0 },
  cmdb_id: { type: String, default: '' },
  inventory_source: { type: String, default: 'Asset inventory / CMDB' },
  source_kind: { type: String, default: 'asset_inventory' },
  environment: { type: String, default: 'production' },
  lifecycle_status: { type: String, default: 'active' },
  owner: { type: String, default: '' },
  last_inventory_sync_at: { type: Date, default: null }
```

### `work/backend/src/models/Control.js`

Add these fields after `risk_reduction_pct`:

```js
  claimed_effectiveness_pct: { type: Number, default: null, min: 0, max: 100 },
  measured_effectiveness_pct: { type: Number, default: null, min: 0, max: 100 },
  configuration_coverage_pct: { type: Number, default: 100, min: 0, max: 100 },
  compliance_coverage_pct: { type: Number, default: 100, min: 0, max: 100 },
  incident_failure_rate_pct: { type: Number, default: 0, min: 0, max: 100 },
  last_tested_at: { type: Date, default: null },
  evidence_source: { type: String, default: '' }
```

### `work/backend/src/models/Incident.js`

Add this field after `asset_id`:

```js
    control_id: { type: String, default: '' },
```

### `work/backend/src/models/Risk.js`

Add this field after `impact_inr`:

```js
    impact_breakdown: { type: mongoose.Schema.Types.Mixed, default: {} },
```

### `work/backend/src/models/RiskHistory.js`

Add this field after `value_at_risk_inr`:

```js
  impact_breakdown: { type: mongoose.Schema.Types.Mixed, default: {} },
```

## 3. Update Normalizers

### `work/backend/src/normalizers/asset.normalizer.js`

Add these properties inside the returned object:

```js
    downtime_hours_assumption: Math.max(0, Number(rawData.downtime_hours_assumption) || 24),
    cmdb_id: rawData.cmdb_id ? String(rawData.cmdb_id).trim() : '',
    inventory_source: rawData.inventory_source ? String(rawData.inventory_source).trim() : 'Asset inventory / CMDB',
    source_kind: rawData.source_kind ? String(rawData.source_kind).trim() : 'asset_inventory',
    environment: rawData.environment ? String(rawData.environment).trim() : 'production',
    lifecycle_status: rawData.lifecycle_status ? String(rawData.lifecycle_status).trim() : 'active',
    owner: rawData.owner ? String(rawData.owner).trim() : '',
    last_inventory_sync_at: rawData.last_inventory_sync_at || null,
```

### `work/backend/src/normalizers/control.normalizer.js`

Add these properties inside the returned object:

```js
    claimed_effectiveness_pct: Number(rawData.claimed_effectiveness_pct ?? rawData.risk_reduction_pct ?? rawData.effectiveness ?? 0),
    measured_effectiveness_pct: rawData.measured_effectiveness_pct == null ? null : Number(rawData.measured_effectiveness_pct),
    configuration_coverage_pct: Number(rawData.configuration_coverage_pct ?? 100),
    compliance_coverage_pct: Number(rawData.compliance_coverage_pct ?? 100),
    incident_failure_rate_pct: Number(rawData.incident_failure_rate_pct ?? 0),
    last_tested_at: rawData.last_tested_at || null,
    evidence_source: rawData.evidence_source ? String(rawData.evidence_source).trim() : '',
```

## 4. Show Financial Components in Both Risk Engines

### Node backend

In `work/backend/src/services/riskCalculation.service.js`, add this import:

```js
const { impactBreakdown: getImpactBreakdown } = require('./decisionAnalytics.service');
```

Change the function signature:

```js
const calculateRiskForAsset = (asset, vulnerabilities = [], incidents = []) => {
```

Replace the current `const impactInr = Math.max(...);` block with:

```js
  const impact_breakdown = getImpactBreakdown(asset, incidents);
  const impactInr = Math.max(1, impact_breakdown.total_inr);
```

Add this field to the returned risk object after `impact_inr`:

```js
    impact_breakdown,
```

### Python AI engine

In `work/ai/app/math_engine.py`, add this helper after `number()`:

```python
def _impact_breakdown(asset: dict[str, Any]) -> dict[str, int]:
    records = number(asset.get("total_records", asset.get("stored_records_count")))
    breach = records * number(asset.get("cost_per_record_inr", asset.get("cost_per_breached_record_inr")))
    downtime = number(asset.get("hourly_downtime_cost_inr")) * number(asset.get("downtime_hours_assumption"), 24)
    regulatory = number(asset.get("regulatory_penalty_inr"))
    reputation = number(asset.get("reputation_loss_inr"))
    return {
        "breach_inr": round(breach),
        "downtime_inr": round(downtime),
        "regulatory_inr": round(regulatory),
        "reputation_inr": round(reputation),
        "total_inr": round(breach + downtime + regulatory + reputation),
    }
```

In `_loss_inputs()`, add this line before the current `impact = max(` line:

```python
    impact_breakdown = _impact_breakdown(asset)
```

Also update the return type annotation so it includes the fifth dictionary value:

```python
def _loss_inputs(asset: dict[str, Any], vulnerabilities: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], float, float, float, dict[str, int]]:
```

Replace the current multi-line `impact = max(...)` expression with:

```python
    impact = max(1.0, float(impact_breakdown["total_inr"]))
```

Change the return line in `_loss_inputs()` to:

```python
    return signals, impact, probability, impact_multiplier, impact_breakdown
```

Update the two unpacking lines:

```python
_, impact, probability, impact_multiplier, _ = _loss_inputs(asset, vulnerabilities)
```

```python
signals, impact, probability, _, impact_breakdown = _loss_inputs(asset, vulnerabilities)
```

Add this field to the dictionary returned by `calculate_asset_risk()`:

```python
        "impact_breakdown": impact_breakdown,
```

### Python optimizer effectiveness

In `work/ai/app/optimizer.py`, add after `_reduction()`:

```python
def _effective_reduction(control: dict[str, Any]) -> float:
    evidence = control.get("effectiveness") if isinstance(control.get("effectiveness"), dict) else {}
    value = control.get(
        "measured_effectiveness_pct",
        evidence.get("measured_effectiveness_pct", control.get("risk_reduction_pct", control.get("effectiveness", 0))),
    )
    return _reduction(value)
```

In both `_items()` and `severity_only_baseline()`, replace:

```python
reduction = _reduction(control.get("risk_reduction_pct", control.get("effectiveness", 0)))
```

with:

```python
reduction = _effective_reduction(control)
```

In the return value of `optimize_payload()`, add:

```python
        "rosi_inr": round(reduction_inr - spent),
        "rosi_pct": round(((reduction_inr - spent) / spent) * 100, 2) if spent else 0,
```

In `work/backend/src/services/aiPayload.service.js`, add this import:

```js
const { impactBreakdown, controlEffectiveness } = require('./decisionAnalytics.service');
```

Inside the asset map, after `const assetIncidents = ...`, add:

```js
    const financialImpact = impactBreakdown(asset, assetIncidents);
```

Inside the formatted asset return object, add:

```js
      financial_impact: financialImpact,
```

Inside the formatted control return object, add:

```js
    claimed_effectiveness_pct: ctrl.claimed_effectiveness_pct ?? ctrl.risk_reduction_pct ?? 0,
    measured_effectiveness_pct: ctrl.measured_effectiveness_pct,
    effectiveness: controlEffectiveness(ctrl, incidents),
```

In `saveAiResultsService`, after `const sourceEvents = ...`, add:

```js
  const sourceIncidents = await Incident.find().lean();
  const incidentsByAsset = sourceIncidents.reduce((result, incident) => {
    (result[incident.asset_id] ||= []).push(incident);
    return result;
  }, {});
```

Add `incidentsByAsset[asset.asset_id] || []` as the third argument to both `calculateRiskForAsset(...)` calls in this file.

In the Risk bulk update `$set`, add:

```js
              impact_breakdown: item.impact_breakdown || {},
```

## 5. Add Enterprise -> Business Unit -> Asset API

In `work/backend/src/routes/analytics.routes.js`, add imports:

```js
const Incident = require('../models/Incident');
const { aggregatePortfolio, buildInvestmentCurve, forecastRiskTrend } = require('../services/decisionAnalytics.service');
```

Add these routes before `module.exports = router;`:

```js
router.get('/portfolio', protect, async (req, res, next) => {
  try {
    const [assets, risks, controls, incidents] = await Promise.all([
      Asset.find().lean(),
      require('../models/Risk').find().lean(),
      Control.find().lean(),
      Incident.find().lean()
    ]);
    res.json({ success: true, data: aggregatePortfolio({ assets, risks, controls, incidents }) });
  } catch (error) {
    next(error);
  }
});

router.get('/control-effectiveness', protect, authorize('admin', 'analyst'), async (req, res, next) => {
  try {
    const [controls, incidents] = await Promise.all([Control.find().lean(), Incident.find().lean()]);
    const data = aggregatePortfolio({ controls, incidents }).control_effectiveness;
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/risk-forecast', protect, async (req, res, next) => {
  try {
    const history = await RiskHistory.find({ scenario_type: 'actual' }).sort({ timestamp: 1 }).limit(90).lean();
    res.json({ success: true, data: forecastRiskTrend(history, req.query.horizon_days || 30) });
  } catch (error) {
    next(error);
  }
});
```

Replace the body of the existing `/investment-curve` handler with this calculation:

```js
    const controls = await Control.find().sort({ cost_inr: 1 }).lean();
    const settings = await Settings.getSettings();
    const incidents = await Incident.find().lean();
    const baselineEal = Number(settings.total_expected_annual_loss_inr) || 0;
    const curveData = buildInvestmentCurve(controls, baselineEal, incidents);
    return res.status(200).json({ success: true, baseline_eal_inr: baselineEal, data: curveData });
```

## 6. Add Explicit Stream Ingestion Mode

In `work/backend/src/models/IngestionJob.js`, add after `source`:

```js
  delivery_mode: { type: String, enum: ['webhook', 'stream', 'scheduler'], default: 'webhook' },
```

In `work/backend/src/services/ingestion.service.js`, change the signature and create object:

```js
const runIngestionJob = async ({ source, rawData, handler, delivery_mode = 'webhook' }) => {
```

Add this property inside `IngestionJob.create({ ... })`:

```js
    delivery_mode,
```

In `work/backend/src/controllers/telemetry.controller.js`, change:

```js
const ingestGenericTelemetry = (type) => async (req, res, next) => {
```

to:

```js
const ingestGenericTelemetry = (type, deliveryMode = 'webhook') => async (req, res, next) => {
```

Then change its `runIngestionJob` call to:

```js
    const result = await runIngestionJob({ source: type, rawData: req.body.records || req.body, delivery_mode: deliveryMode, handler: (body, job) => ingestTelemetryService(type, body, job) });
```

In `work/backend/src/routes/telemetry.routes.js`, add before the dynamic route:

```js
router.post('/stream/:type', (req, res, next) => {
  const type = String(req.params.type || '').toLowerCase();
  if (!supportedGenericSources.has(type)) return res.status(404).json({ success: false, message: `Unsupported stream source: ${type}` });
  return ingestGenericTelemetry(type, 'stream')(req, res, next);
});
```

Send stream batches like this:

```json
{
  "records": [
    {
      "asset_id": "AST-CORE-01",
      "severity": "high",
      "event_type": "authentication_failure",
      "failed_attempts": 12,
      "observed_at": "2026-09-25T18:00:00Z"
    }
  ]
}
```

## 7. Add Predictive Trend Output

The `/analytics/risk-forecast` route above is intentionally a transparent directional forecast. It is not a threat prediction. Add this API method in `work/frontend/src/api.js`:

```js
  portfolio: () => apiRequest('/analytics/portfolio'),
  controlEffectiveness: () => apiRequest('/analytics/control-effectiveness'),
  riskForecast: (days = 30) => apiRequest(`/analytics/risk-forecast?horizon_days=${days}`),
```

## 8. Rename UI Sources

In `work/frontend/src/api.js`, add:

```js
export function sourceLabel(value = '') {
  const source = String(value || '').toLowerCase();
  if (source.includes('wazuh') || source === 'siem') return 'SIEM / Wazuh';
  if (source.includes('cmdb') || source.includes('inventory')) return 'Asset inventory / CMDB';
  if (source === 'edr' || source === 'iam' || source === 'cspm') return `SIEM / ${source.toUpperCase()}`;
  return value || 'Telemetry';
}
```

In `work/frontend/src/App.jsx`, add `sourceLabel` to the import from `./api`, then replace display expressions such as:

```jsx
event.source || event.type || 'telemetry'
```

with:

```jsx
sourceLabel(event.source || event.type)
```

Do the same in `work/frontend/src/enhancements.jsx` for recent evidence and ingestion-job source labels.

## 9. Show Portfolio Levels in the Frontend

Add this component to `work/frontend/src/enhancements.jsx`:

```jsx
export function PortfolioLevels() {
  const [portfolio, setPortfolio] = useState(null);
  useEffect(() => { api.portfolio().then((response) => setPortfolio(unwrap(response))).catch(() => {}); }, []);
  if (!portfolio) return <div className="panel"><p className="soft-note">Portfolio aggregation is loading...</p></div>;
  return <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Enterprise hierarchy</p><h2>Enterprise to business unit to asset</h2></div></div><div className="metric-grid"><div><small>Enterprise EAL</small><strong>{compactMoney(portfolio.enterprise?.eal_inr)}</strong></div><div><small>Business units</small><strong>{portfolio.business_units?.length || 0}</strong></div><div><small>Assets</small><strong>{portfolio.enterprise?.asset_count || 0}</strong></div></div><div className="ops-list">{(portfolio.business_units || []).map((unit) => <div className="ops-row" key={unit.name}><div><strong>{unit.name}</strong><small>{unit.asset_count} assets · average score {unit.average_risk_score}</small></div><strong>{compactMoney(unit.eal_inr)}</strong></div>)}</div><p className="soft-note">{portfolio.enterprise?.note}</p></section>;
}
```

Import it in `App.jsx`:

```js
import { AuditPageV2, AnalystPageV2, InvestmentPageV2, ViewerDashboard, PortfolioLevels } from './enhancements';
```

Render it in `ExecutiveDashboard` after the first metric grid:

```jsx
<PortfolioLevels />
```

Add this forecast panel to `work/frontend/src/enhancements.jsx`:

```jsx
export function ForecastPanel() {
  const [result, setResult] = useState(null);
  useEffect(() => { api.riskForecast(30).then((response) => setResult(unwrap(response))).catch(() => {}); }, []);
  const points = result?.forecast || [];
  return <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Directional outlook</p><h2>Risk trend forecast</h2></div><span className="stat-chip">{result?.model || 'loading'}</span></div>{points.length ? <div className="ops-list">{points.map((point) => <div className="ops-row" key={String(point.timestamp)}><div><strong>{formatDate(point.timestamp)}</strong><small>Range {compactMoney(point.lower_inr)} - {compactMoney(point.upper_inr)}</small></div><strong>{compactMoney(point.predicted_eal_inr)}</strong></div>)}</div> : <p className="soft-note">At least two actual risk-history points are required.</p>}<p className="soft-note">{result?.note || 'This is a directional trend, not threat prediction.'}</p></section>;
}
```

Import and render it next to `PortfolioLevels` in `App.jsx`:

```js
import { AuditPageV2, AnalystPageV2, InvestmentPageV2, ViewerDashboard, PortfolioLevels, ForecastPanel } from './enhancements';
```

```jsx
<PortfolioLevels />
<ForecastPanel />
```

To show the financial components in the asset drawer, add after the existing Downtime row in `AssetDrawer`:

```jsx
<div><span>Breach exposure</span><strong>{money(risk?.impact_breakdown?.breach_inr || asset.financial_impact?.breach_inr)}</strong></div>
<div><span>Regulatory exposure</span><strong>{money(risk?.impact_breakdown?.regulatory_inr || asset.financial_impact?.regulatory_inr)}</strong></div>
<div><span>Reputation exposure</span><strong>{money(risk?.impact_breakdown?.reputation_inr || asset.financial_impact?.reputation_inr)}</strong></div>
```

To show measured control effectiveness in `ControlsPage`, replace the existing Reduction stat with:

```jsx
<div><small>Measured effectiveness</small><strong>{control.effectiveness?.measured_effectiveness_pct ?? control.measured_effectiveness_pct ?? control.risk_reduction_pct ?? 0}%</strong></div>
```

## 10. Show ROSI in the Active Investment Lab

In `InvestmentPageV2` in `work/frontend/src/enhancements.jsx`:

1. Add state:

```jsx
const [curve, setCurve] = useState([]);
```

2. Add an effect:

```jsx
useEffect(() => { api.investmentCurve().then((response) => setCurve(safeArray(unwrap(response)))).catch(() => {}); }, []);
```

3. Add this block below the existing result panel:

```jsx
<section className="panel"><div className="panel-heading"><div><p className="eyebrow">Investment versus risk reduction</p><h2>ROSI curve</h2></div></div>{curve.length ? <div className="ops-list">{curve.map((point) => <div className="ops-row" key={point.control_id}><div><strong>{point.name}</strong><small>{point.effective_effectiveness_pct}% measured effectiveness · {compactMoney(point.cumulative_investment_inr)} invested</small></div><strong>{point.rosi_pct}% ROSI</strong></div>)}</div> : <p className="soft-note">Run the backend analysis to populate the ROSI curve.</p>}</section>
```

## 11. Seed Credible Values

In `work/backend/seed.js`, add these fields to each `controlDocs` object:

```js
      claimed_effectiveness_pct: (Number(ctrl.effectiveness) || 0) * 100,
      configuration_coverage_pct: ctrl.status === 'implemented' ? 100 : 60,
      compliance_coverage_pct: ctrl.framework ? 80 : 40,
      incident_failure_rate_pct: 0,
      evidence_source: 'seeded configuration telemetry and framework mapping',
```

Add these fields to each `assetDoc` object:

```js
        downtime_hours_assumption: 24,
        cmdb_id: `CMDB-${sourceAsset.asset_id}`,
        inventory_source: 'Asset inventory / CMDB',
        source_kind: 'asset_inventory',
        environment: 'production',
        lifecycle_status: 'active',
        last_inventory_sync_at: new Date(),
```

Before `const assetDoc = {` in the same loop, add these deterministic demo assumptions so the four financial components are visible after reseeding:

```js
       const modeledRecords = Number(sourceAsset.stored_records_count ?? sourceAsset.total_records) || 0;
       const breachRate = Number(sourceAsset.cost_per_breached_record ?? sourceAsset.cost_per_record_inr) || 0;
       const modeledBreachCost = modeledRecords * breachRate;
       const regulatoryPenalty = Number(sourceAsset.regulatory_penalty_inr ?? Math.round(modeledBreachCost * 0.15));
       const reputationLoss = Number(sourceAsset.reputation_loss_inr ?? Math.round(modeledBreachCost * 0.10));
```

Also add these properties to `assetDoc`:

```js
        regulatory_penalty_inr: regulatoryPenalty,
        reputation_loss_inr: reputationLoss,
```

For demo mode, add these branches inside `demoRequest()` in `work/frontend/src/api.js` after the existing `/analytics/risk-trend` branch:

```js
   if (path === '/analytics/portfolio') {
     const units = {};
     data.assets.forEach((asset) => {
       const name = asset.business_unit || 'Unassigned';
       units[name] ||= { name, asset_count: 0, eal_inr: 0, var_inr: 0, average_risk_score: 0 };
       units[name].asset_count += 1;
       units[name].eal_inr += Number(asset.asset_eal_inr || 0);
       units[name].var_inr += Number(asset.asset_eal_inr || 0) * 1.35;
       units[name].average_risk_score += Number(asset.risk_score || 0);
     });
     const business_units = Object.values(units).map((unit) => ({ ...unit, average_risk_score: Math.round(unit.average_risk_score / unit.asset_count) }));
     return demoEnvelope({ enterprise: { name: 'Enterprise', asset_count: data.assets.length, eal_inr: data.settings.total_expected_annual_loss_inr, var_inr: data.settings.value_at_risk_inr, note: 'Demo VaR is based on the supplied fixture.' }, business_units, assets: data.assets, control_effectiveness: data.controls });
   }
   if (path === '/analytics/control-effectiveness') return demoEnvelope(data.controls.map((control) => ({ ...control, claimed_effectiveness_pct: control.risk_reduction_pct, measured_effectiveness_pct: Math.round(Number(control.risk_reduction_pct || 0) * 0.8), configuration_coverage_pct: 80, compliance_coverage_pct: 80, incident_failure_rate_pct: 0 })));
   if (path.startsWith('/analytics/risk-forecast')) return demoEnvelope({ model: 'demo-linear-trend-v1', confidence: 0.8, note: 'Demo directional trend only; not threat prediction.', forecast: [{ timestamp: new Date(Date.now() + 7 * 86400000).toISOString(), predicted_eal_inr: data.settings.total_expected_annual_loss_inr - 1000000, lower_inr: data.settings.total_expected_annual_loss_inr - 4000000, upper_inr: data.settings.total_expected_annual_loss_inr + 2000000 }] });

## 12. Verification Commands

Run from the project root after pasting:

```bash
cd work/backend
npm run check:syntax
npm run seed:replace
```

Run the AI tests:

```bash
cd work/ai
PYTHONPATH=. python -m unittest discover -s tests -v
```

Build the frontend:

```bash
cd work/frontend
npm install
npm run build
```

Check these endpoints with an admin or analyst JWT:

```text
GET  http://localhost:4000/analytics/portfolio
GET  http://localhost:4000/analytics/control-effectiveness
GET  http://localhost:4000/analytics/risk-forecast?horizon_days=30
GET  http://localhost:4000/analytics/investment-curve
POST http://localhost:4000/telemetry/stream/edr
```

## Recommended Order

1. Add the shared service and model fields.
2. Add the backend routes and restart Node.
3. Run `npm run seed:replace`.
4. Add the frontend API methods and panels.
5. Run the syntax checks, AI tests, and frontend build.
6. Take a fresh demo screenshot showing the financial breakdown, control effectiveness, hierarchy, and ROSI curve.

Do not claim the linear forecast is predictive threat intelligence. Label it as a directional trend forecast until it is validated against historical production data.
