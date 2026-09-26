import { DEMO_USERS, loadDemoData, saveDemoData } from './demoData';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

export const isDemoMode = () => localStorage.getItem('aop.demo') === 'true';

const demoEnvelope = (data) => Promise.resolve({ success: true, data });

function demoLogin(email, password) {
  const account = DEMO_USERS[email?.toLowerCase()];
  if (!account || account.password !== password) return null;
  return { ...account, token: `demo-token-${account.role}`, demo: true };
}

const demoReduction = (current, value, overlapFactor = 0.65, maximum = 0.85) => {
  const reduction = Math.min(1, Math.max(0, Number(value || 0) / 100));
  return Math.min(maximum, current + reduction * (1 - current) * overlapFactor);
};

function demoCurve(data) {
  let totalReduction = 0;
  let spend = 0;
  return [...data.controls].sort((a, b) => Number(a.cost_inr || 0) - Number(b.cost_inr || 0)).map((control) => {
    const claimed = Number(control.claimed_effectiveness_pct ?? control.risk_reduction_pct ?? 0);
    const measured = Number(control.measured_effectiveness_pct ?? Math.round(claimed * 0.8));
    totalReduction = demoReduction(totalReduction, measured);
    spend += Number(control.cost_inr || 0);
    const reductionInr = data.settings.total_expected_annual_loss_inr * totalReduction;
    const rosi = reductionInr - spend;
    return { ...control, effective_effectiveness_pct: measured, cumulative_investment_inr: spend, cumulative_risk_reduction_pct: totalReduction * 100, estimated_risk_reduction_inr: reductionInr, estimated_rosi_inr: rosi, estimated_rosi_pct: spend ? (rosi / spend) * 100 : 0, rosi_inr: rosi, rosi_pct: spend ? (rosi / spend) * 100 : 0 };
  });
}

function demoImpact(asset) {
  const records = Number(asset.total_records || asset.stored_records_count || 0);
  const breach = Number(asset.breach_exposure_inr ?? records * Number(asset.cost_per_record_inr || asset.cost_per_breached_record || 0));
  const downtime = Number(asset.downtime_exposure_inr ?? Number(asset.hourly_downtime_cost_inr || 0) * Number(asset.downtime_hours_assumption || 24));
  const regulatory = Number(asset.regulatory_penalty_inr ?? Math.round(breach * 0.15));
  const reputation = Number(asset.reputation_loss_inr ?? Math.round(breach * 0.1));
  return { breach_inr: breach, downtime_inr: downtime, regulatory_inr: regulatory, reputation_inr: reputation, total_inr: breach + downtime + regulatory + reputation };
}

function demoPortfolio(data) {
  const riskMap = Object.fromEntries(data.risks.map((risk) => [risk.asset_id, risk]));
  const assets = data.assets.map((asset) => {
    const risk = riskMap[asset.asset_id] || {};
    return { asset_id: asset.asset_id, hostname: asset.hostname || asset.asset_id, business_unit: asset.business_unit || 'Unassigned', eal_inr: Number(risk.eal_inr ?? asset.asset_eal_inr ?? 0), var_inr: Number(risk.var_inr ?? Number(asset.asset_eal_inr || 0) * 1.35), risk_score: Number(risk.score ?? asset.risk_score ?? 0), risk_level: risk.level || asset.risk_level || 'unassessed', impact_breakdown: demoImpact(asset) };
  });
  const grouped = {};
  assets.forEach((asset) => {
    grouped[asset.business_unit] ||= { name: asset.business_unit, asset_count: 0, eal_inr: 0, var_inr: 0, average_risk_score: 0, impact_breakdown: { breach_inr: 0, downtime_inr: 0, regulatory_inr: 0, reputation_inr: 0, total_inr: 0 } };
    const unit = grouped[asset.business_unit];
    unit.asset_count += 1;
    unit.eal_inr += asset.eal_inr;
    unit.var_inr += asset.var_inr;
    unit.average_risk_score += asset.risk_score;
    Object.keys(unit.impact_breakdown).forEach((key) => { unit.impact_breakdown[key] += Number(asset.impact_breakdown[key] || 0); });
  });
  const business_units = Object.values(grouped).map((unit) => ({ ...unit, average_risk_score: unit.asset_count ? Math.round(unit.average_risk_score / unit.asset_count) : 0 }));
  return { enterprise: { name: 'Enterprise', asset_count: assets.length, eal_inr: data.settings.total_expected_annual_loss_inr, var_inr: data.settings.value_at_risk_inr, note: 'Demo VaR is based on the supplied fixture.' }, business_units, assets, control_effectiveness: data.controls.map((control) => ({ ...control, ...demoEffectiveness(control) })) };
}

function demoEffectiveness(control) {
  const claimed = Number(control.claimed_effectiveness_pct ?? control.risk_reduction_pct ?? 0);
  return { claimed_effectiveness_pct: claimed, measured_effectiveness_pct: Number(control.measured_effectiveness_pct ?? Math.round(claimed * 0.8)), configuration_coverage_pct: Number(control.configuration_coverage_pct ?? 80), compliance_coverage_pct: Number(control.compliance_coverage_pct ?? 80), incident_failure_rate_pct: Number(control.incident_failure_rate_pct ?? 0), evidence_source: control.evidence_source || 'Demo configuration telemetry + compliance status', confidence: Number(control.confidence ?? 82) };
}

function demoRequest(path, options = {}) {
  const data = loadDemoData();
  if (path === '/settings') return demoEnvelope(data.settings);
  if (path === '/assets') return demoEnvelope(data.assets);
  if (path.startsWith('/assets/')) return demoEnvelope(data.assets.find((item) => item.asset_id === decodeURIComponent(path.split('/').pop())) || null);
  if (path === '/vulnerabilities') return demoEnvelope(data.vulnerabilities);
  if (path.startsWith('/vulnerabilities/asset/')) return demoEnvelope(data.vulnerabilities.filter((item) => item.asset_id === decodeURIComponent(path.split('/').pop())));
  if (path === '/controls') return demoEnvelope(data.controls);
  if (path === '/incidents' && options.method === 'POST') {
    data.incidents = [{ ...options.body }, ...data.incidents];
    saveDemoData(data);
    return Promise.resolve({ success: true, data: options.body });
  }
  if (path === '/incidents') return demoEnvelope(data.incidents);
  if (path === '/telemetry/events?limit=40') return demoEnvelope(data.events);
  if (path === '/risks') return demoEnvelope(data.risks);
  if (path.startsWith('/risks/asset/')) return demoEnvelope(data.risks.find((item) => item.asset_id === decodeURIComponent(path.split('/').pop())) || null);
  if (path === '/analytics/risk-trend') return demoEnvelope(data.trend);
  if (path === '/analytics/portfolio') return demoEnvelope(demoPortfolio(data));
  if (path === '/analytics/control-effectiveness') return demoEnvelope(data.controls.map((control) => ({ ...control, ...demoEffectiveness(control), effectiveness: demoEffectiveness(control) })));
  if (path.startsWith('/analytics/risk-forecast')) {
    const current = Number(data.settings.total_expected_annual_loss_inr || 0);
    const forecast = Array.from({ length: 4 }, (_, index) => {
      const predicted = Math.max(0, current - (index + 1) * 1000000);
      return { timestamp: new Date(Date.now() + (index + 1) * 7 * 86400000).toISOString(), predicted_eal_inr: predicted, lower_inr: Math.max(0, predicted - 3000000), upper_inr: predicted + 3000000 };
    });
    return demoEnvelope({ model: 'demo-linear-trend-v1', horizon_days: 30, confidence: 0.8, slope_per_period_inr: -1000000, forecast, note: 'Demo directional trend only; not threat prediction.' });
  }
  if (path === '/analytics/attack-pressure') return demoEnvelope(data.events.length ? [{ asset_id: data.events[0].asset_id, signal_count: data.events.length, high_critical_signal_count: data.events.filter((event) => ['high', 'critical'].includes(event.severity)).length, failed_attempts: data.events.reduce((sum, event) => sum + Number(event.failed_attempts || 0), 0), pressure_score: 0.84, pressure_level: 'critical', confidence: 0.85 }] : []);
  if (path === '/analytics/regulatory-coverage') return demoEnvelope(Object.entries(data.audit?.regulatory_compliance_breakdown || {}).map(([framework, item]) => ({ framework, total_controls: item.total || 0, implemented_controls: item.implemented || 0, partial_controls: item.partial || 0, coverage_pct: item.coverage_pct || 0, mapped_assets: data.assets.length, open_findings: 0 })));
  if (path === '/ingestion/jobs') return demoEnvelope(data.events.slice(0, 8).map((event, index) => ({ job_id: `DEMO-JOB-${index + 1}`, source: event.source || event.type, status: 'completed', record_count: 1, created_count: 1, failed_count: 0, completed_at: event.observed_at })));
  if (path === '/analytics/scenarios') return demoEnvelope([]);
  if (path.startsWith('/analytics/dependencies/')) return demoEnvelope({ asset_id: decodeURIComponent(path.split('/').pop()), direct_dependencies: [], reverse_dependencies: [], impacted_asset_ids: [], dependency_depth: 0, blast_radius_score: 0, cycle_detected: false, assets: [] });
  if (path === '/analytics/investment-curve') return demoEnvelope(demoCurve(data));
  if (path === '/analytics/audit-report') return Promise.resolve({ success: true, report: data.audit });
  if (path === '/ai/verify-data') return Promise.resolve({ status: 'SECURE', message: 'Demo report evidence is authentic and unchanged.', report_hash: 'demo-report-anchor', tx_hash: 'demo-chain-anchor' });
  if (path === '/ai/blockchain-status') return Promise.resolve({ success: true, data: { configured: false, rpc_url_configured: false, reachable: false, error: 'Demo blockchain provider is not configured.' } });
  if (path === '/ai/audit-ledger') return demoEnvelope([{ chain_index: 1, verification_status: 'anchored', report_hash: 'demo-report-anchor', tx_hash: 'demo-chain-anchor', network: 'demo-local', signer: 'demo-wallet', payload_version: 'risk-report-v2', createdAt: new Date().toISOString() }]);
  if (path === '/ai/verify-data/tamper-test') return Promise.resolve({ success: true, status: 'TAMPERED', message: 'Demo tamper test detected the in-memory payload change.', tx_hash: 'demo-chain-anchor' });
  if (path === '/ai/run-analysis') {
    data.settings.total_expected_annual_loss_inr = Math.max(0, data.settings.total_expected_annual_loss_inr - 1500000);
    data.settings.executive_summary = 'Demo analysis completed. Patch SLA and phishing-resistant MFA are the highest-value controls under the current budget.';
    saveDemoData(data);
    return Promise.resolve({ success: true, message: 'Demo analysis completed.', data: { report_hash: 'demo-report-anchor' } });
  }
  if (path === '/demo/simulate-attack') {
    const templates = [
      { type: 'wazuh', source: 'Wazuh', event_type: 'credential_stuffing_detected', severity: 'critical', asset_id: 'AST-IDENT-01', source_ip: '185.22.14.8', endpoint: '/auth/login', failed_attempts: 540 },
      { type: 'burp', source: 'Burp Suite', event_type: 'SQL Injection attempt', severity: 'critical', asset_id: 'AST-CORE-01', source_ip: '103.44.19.7', endpoint: '/api/payments' },
      { type: 'edr', source: 'EDR', event_type: 'ransomware_like_process', severity: 'high', asset_id: 'AST-STAFF-01', endpoint: 'laptop-042' },
    ];
    const event = { _id: `EV-DEMO-${Date.now()}`, ...templates[data.events.length % templates.length], observed_at: new Date().toISOString() };
    data.events = [event, ...data.events];
    data.settings.total_expected_annual_loss_inr += event.severity === 'critical' ? 500000 : 150000;
    data.risks = data.risks.map((risk) => risk.asset_id === event.asset_id ? { ...risk, score: Math.min(99, risk.score + 4), level: risk.level === 'medium' ? 'high' : risk.level } : risk);
    saveDemoData(data);
    return Promise.resolve({ success: true, data: event });
  }
  if (path === '/analytics/what-if') {
    const selected = options.body?.simulated_control_ids || [];
    const controls = data.controls.filter((control) => selected.includes(control.control_id));
    const combinedReduction = controls.reduce((value, control) => demoReduction(value, control.risk_reduction_pct), 0);
    const original = data.settings.total_expected_annual_loss_inr;
    const simulated = original * (1 - combinedReduction) * (1 + Number(options.body?.delay_days || 0) * 0.005);
    return Promise.resolve({ success: true, original_eal_inr: original, simulated_eal_inr: simulated, risk_reduction_achieved_inr: original - simulated, combined_reduction_pct: combinedReduction * 100, warning: 'Demo calculation uses the bounded-overlap control approximation.' });
  }
  if (path === '/analytics/optimize') return Promise.resolve({ success: true, data: { status: 'DEMO', recommended_control_ids: ['CTRL-PATCH-01', 'CTRL-MFA-01'], message: 'Demo optimizer response. Configure PYTHON_OPTIMIZER_URL for live optimization.' } });
  if (path === '/analytics/optimizer-comparison') return Promise.resolve({ success: true, data: { comparison_version: 'demo', budget_inr: data.settings.enterprise_budget_inr, optimizer: { spent_inr: 1180000, estimated_residual_eal_inr: 54000000, combined_reduction_pct: 31.8, recommended_control_ids: ['CTRL-PATCH-01', 'CTRL-MFA-01'] }, severity_only_baseline: { spent_inr: 1160000, severity_coverage_pct: 58.2, recommended_control_ids: ['CTRL-PATCH-01', 'CTRL-EDR-01'] }, note: 'Demo comparison uses labelled deterministic fixtures.' } });
  if (path === '/incidents' && options.method === 'POST') {
    data.incidents = [{ ...options.body }, ...data.incidents];
    saveDemoData(data);
    return Promise.resolve({ success: true, data: options.body });
  }
  if (path === '/analyst/query') return Promise.resolve({ success: true, data: { answer: 'AST-CORE-01 has the highest demo EAL because it is internet-facing, supports payments, and has a KEV-listed exploitable finding.', confidence_score: 0.91, recommended_actions: ['Execute the 48-hour patch SLA', 'Enforce phishing-resistant MFA for privileged access'], processed_by_role: 'demo analyst' } });
  return demoEnvelope(null);
}

export async function apiRequest(path, options = {}) {
  if (isDemoMode()) return demoRequest(path, options);
  const { body, headers = {}, ...rest } = options;
  const token = localStorage.getItem('aop.jwt');
  const requestHeaders = { ...headers };

  if (token) requestHeaders.Authorization = `Bearer ${token}`;
  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof data === 'object' ? data.message : data;
    const error = new Error(message || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  login: async (body) => {
    const demo = demoLogin(body.email, body.password);
    if (demo) return demo;
    return apiRequest('/auth/login', { method: 'POST', body });
  },
  register: (body) => apiRequest('/auth/register', { method: 'POST', body }),
  me: () => isDemoMode() ? Promise.resolve(JSON.parse(localStorage.getItem('aop.user') || 'null')) : apiRequest('/auth/me'),
  settings: () => apiRequest('/settings'),
  updateBudget: (body) => apiRequest('/settings', { method: 'POST', body }),
  assets: () => apiRequest('/assets'),
  asset: (id) => apiRequest(`/assets/${encodeURIComponent(id)}`),
  vulnerabilities: () => apiRequest('/vulnerabilities'),
  vulnerabilitiesByAsset: (id) => apiRequest(`/vulnerabilities/asset/${encodeURIComponent(id)}`),
  controls: () => apiRequest('/controls'),
  incidents: () => apiRequest('/incidents'),
  events: () => apiRequest('/telemetry/events?limit=40'),
  createIncident: (body) => apiRequest('/incidents', { method: 'POST', body }),
  risks: () => apiRequest('/risks'),
  riskByAsset: (id) => apiRequest(`/risks/asset/${encodeURIComponent(id)}`),
  riskTrend: () => apiRequest('/analytics/risk-trend'),
  whatIf: (body) => apiRequest('/analytics/what-if', { method: 'POST', body }),
  investmentCurve: () => apiRequest('/analytics/investment-curve'),
  portfolio: () => apiRequest('/analytics/portfolio'),
  controlEffectiveness: () => apiRequest('/analytics/control-effectiveness'),
  riskForecast: (days = 30) => apiRequest(`/analytics/risk-forecast?horizon_days=${days}`),
  auditReport: () => apiRequest('/analytics/audit-report'),
  attackPressure: () => apiRequest('/analytics/attack-pressure'),
  regulatoryCoverage: () => apiRequest('/analytics/regulatory-coverage'),
  ingestionJobs: () => apiRequest('/ingestion/jobs'),
  scenarios: () => apiRequest('/analytics/scenarios'),
  dependencies: (id) => apiRequest(`/analytics/dependencies/${encodeURIComponent(id)}`),
  verifyAudit: () => apiRequest('/ai/verify-data'),
  blockchainStatus: () => apiRequest('/ai/blockchain-status'),
  tamperTest: () => apiRequest('/ai/verify-data/tamper-test', { method: 'POST' }),
  auditLedger: () => apiRequest('/ai/audit-ledger'),
  runAnalysis: (body) => apiRequest('/ai/run-analysis', { method: 'POST', body }),
  optimize: (body) => apiRequest('/analytics/optimize', { method: 'POST', body }),
  optimizerComparison: (body) => apiRequest('/analytics/optimizer-comparison', { method: 'POST', body }),
  analystQuery: (body) => apiRequest('/analyst/query', { method: 'POST', body }),
  simulateAttack: () => apiRequest('/demo/simulate-attack', { method: 'POST' })
};

export function money(value = 0) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

export function sourceLabel(value = '') {
  const raw = typeof value === 'object' && value !== null ? (value.source || value.name || value.type || value.source_kind || '') : value;
  const source = String(raw || '').trim().toLowerCase();
  if (source.includes('wazuh') || source === 'siem') return 'SIEM / Wazuh';
  if (source.includes('cmdb') || source.includes('inventory') || source === 'asset_inventory') return 'Asset inventory / CMDB';
  if (['edr', 'iam', 'cspm'].includes(source)) return `SIEM / ${source.toUpperCase()}`;
  return String(raw || 'Telemetry');
}

export function compactMoney(value = 0) {
  const amount = Number(value) || 0;
  if (Math.abs(amount) >= 10000000) return `INR ${(amount / 10000000).toFixed(1)} Cr`;
  if (Math.abs(amount) >= 100000) return `INR ${(amount / 100000).toFixed(1)} L`;
  return money(amount);
}

export function formatDate(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}
