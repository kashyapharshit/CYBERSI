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
  return data.controls.map((control) => {
    totalReduction = demoReduction(totalReduction, control.risk_reduction_pct);
    spend += Number(control.cost_inr || 0);
    const reductionInr = data.settings.total_expected_annual_loss_inr * totalReduction;
    return { ...control, cumulative_risk_reduction_pct: totalReduction * 100, estimated_risk_reduction_inr: reductionInr, estimated_rosi_inr: reductionInr - spend, estimated_rosi_pct: spend ? ((reductionInr - spend) / spend) * 100 : 0 };
  });
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
    throw new Error(message || `Request failed with status ${response.status}`);
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
  auditReport: () => apiRequest('/analytics/audit-report'),
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
