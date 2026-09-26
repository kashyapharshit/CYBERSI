import { useEffect, useState } from 'react';
import { api, compactMoney, formatDate, isDemoMode, sourceLabel } from './api';
import { useAuth } from './auth';

const safeArray = (value) => Array.isArray(value) ? value : [];
const unwrap = (response) => response?.data ?? response ?? [];
const hasValue = (value) => value !== undefined && value !== null && value !== '';
const displayMoney = (value) => hasValue(value) ? compactMoney(value) : 'Not available';
const displayNumber = (value) => hasValue(value) ? Number(value).toLocaleString('en-IN') : 'Not available';

function StatusChip({ value }) {
  const text = String(value || 'unknown').replaceAll('_', ' ');
  return <span className={`status-chip ${String(value || '').toLowerCase()}`}>{text}</span>;
}

function EmptyState({ title, copy }) {
  return <div className="empty-state"><div className="empty-symbol">◌</div><h3>{title}</h3><p>{copy}</p></div>;
}

function PlainMetric({ label, value, detail, tone = 'teal' }) {
  return <div className={`plain-metric ${tone}`}><small>{label}</small><strong>{value}</strong><span>{detail}</span></div>;
}

export function ViewerDashboard({ data }) {
  const settings = data.settings || {};
  const riskMap = Object.fromEntries(safeArray(data.risks).map((risk) => [risk.asset_id, risk]));
  const assets = safeArray(data.assets).map((asset) => ({ ...asset, risk: riskMap[asset.asset_id] || {} })).sort((a, b) => Number(b.risk.score || b.risk.risk_score || b.risk_score || 0) - Number(a.risk.score || a.risk.risk_score || a.risk_score || 0));
  const topRisk = assets[0];
  const openFindings = safeArray(data.vulnerabilities).filter((finding) => finding.status !== 'fixed');
  const urgent = openFindings.filter((finding) => ['critical', 'high'].includes(String(finding.severity).toLowerCase())).length;
  const recentEvents = safeArray(data.events).slice(0, 4);
  return <>
    <section className="viewer-hero">
      <div><p className="eyebrow">Plain-language board briefing</p><h2>What needs attention next?</h2><p>This view translates security evidence into business impact. You do not need to read scanner output to understand the decision.</p></div>
      <div className="viewer-signal"><small>Most urgent asset</small><strong>{topRisk?.hostname || topRisk?.asset_id || 'No urgent asset'}</strong><span>{topRisk ? `Risk score ${topRisk.risk.score || topRisk.risk.risk_score || 'Not available'} / 99` : 'Waiting for assessment'}</span></div>
    </section>
    <section className="plain-metric-grid">
      <PlainMetric label="Possible yearly loss" value={displayMoney(settings.total_expected_annual_loss_inr)} detail="Estimated exposure if risks remain" tone="teal" />
      <PlainMetric label="Worst-case planning view" value={displayMoney(settings.value_at_risk_inr)} detail="High-loss scenario estimate" tone="amber" />
      <PlainMetric label="Urgent findings" value={urgent} detail="High or critical open findings" tone="red" />
      <PlainMetric label="Protected assets tracked" value={assets.length} detail="Business systems in scope" tone="blue" />
    </section>
    <section className="viewer-grid">
      <div className="panel viewer-panel"><div className="panel-heading"><div><p className="eyebrow">Decision focus</p><h2>Where the exposure is concentrated</h2></div></div>{assets.slice(0, 4).map((asset, index) => <div className="viewer-risk-row" key={asset.asset_id}><span className="viewer-rank">0{index + 1}</span><div><strong>{asset.hostname || asset.asset_id}</strong><small>{asset.business_unit || 'Business system'} · {asset.internet_exposed ? 'Internet-facing' : 'Internal'}</small></div><div className="viewer-risk-value"><b>{asset.risk.score || asset.risk.risk_score || 'N/A'}</b><small>{displayMoney(asset.risk.eal_inr ?? asset.asset_eal_inr)} annual loss</small></div></div>)}</div>
      <div className="panel viewer-panel"><div className="panel-heading"><div><p className="eyebrow">In simple terms</p><h2>What this means</h2></div></div><div className="plain-explanation"><div><span className="plain-icon red">!</span><p><strong>Urgent does not mean breach.</strong><br />It means the evidence suggests a higher chance or higher business impact and deserves faster action.</p></div><div><span className="plain-icon teal">INR</span><p><strong>Money figures are estimates.</strong><br />They are based on the supplied evidence and assumptions, not confirmed financial loss.</p></div><div><span className="plain-icon blue">i</span><p><strong>The next decision is controllable.</strong><br />Leadership can compare remediation cost against expected exposure in the Investment Lab.</p></div></div></div>
    </section>
    <section className="panel viewer-panel"><div className="panel-heading"><div><p className="eyebrow">Recent evidence</p><h2>What changed recently</h2></div><StatusChip value={recentEvents.length ? 'monitoring' : 'quiet'} /></div>{recentEvents.length ? recentEvents.map((event) => <div className="viewer-event" key={event._id || event.createdAt || event.observed_at}><span className={`event-dot ${String(event.severity || 'info').toLowerCase()}`} /><div><strong>{event.event_type || 'Security signal detected'}</strong><small>{sourceLabel(event.source || event.type)} · {event.asset_id || 'Unmapped asset'}</small></div><time>{formatDate(event.observed_at || event.timestamp || event.createdAt)}</time></div>) : <p className="soft-note">No recent signals are available. The monitoring pipeline is ready for scanner input.</p>}</section>
  </>;
}

export function PortfolioLevels() {
  const [portfolio, setPortfolio] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    api.portfolio().then((response) => { if (active) setPortfolio(unwrap(response)); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);
  if (failed) return <section className="panel"><p className="soft-note">Enterprise hierarchy is unavailable from the current evidence service.</p></section>;
  if (!portfolio) return <section className="panel"><p className="soft-note">Portfolio aggregation is loading...</p></section>;
  const assets = safeArray(portfolio.assets);
  const units = safeArray(portfolio.business_units).slice().sort((a, b) => Number(b.eal_inr || 0) - Number(a.eal_inr || 0));
  return <section className="panel portfolio-panel"><div className="panel-heading"><div><p className="eyebrow">Enterprise hierarchy</p><h2>Enterprise to business unit to asset</h2></div><span className="status-chip monitoring">Live portfolio</span></div><div className="portfolio-metrics"><div><small>Enterprise EAL</small><strong>{displayMoney(portfolio.enterprise?.eal_inr)}</strong></div><div><small>Enterprise VaR</small><strong>{displayMoney(portfolio.enterprise?.var_inr)}</strong></div><div><small>Business units</small><strong>{units.length}</strong></div><div><small>Assets in scope</small><strong>{portfolio.enterprise?.asset_count ?? assets.length}</strong></div></div><div className="hierarchy-tree"><div className="hierarchy-enterprise"><span className="hierarchy-kicker">ENTERPRISE</span><strong>{portfolio.enterprise?.name || 'Enterprise'}</strong></div>{units.length ? units.map((unit) => { const unitAssets = assets.filter((asset) => (asset.business_unit || 'Unassigned') === unit.name); return <article className="hierarchy-unit" key={unit.name}><div className="hierarchy-unit-heading"><div><span className="hierarchy-kicker">BUSINESS UNIT</span><strong>{unit.name}</strong><small>{unit.asset_count || unitAssets.length} assets · average score {unit.average_risk_score ?? 'Not available'}</small></div><strong>{displayMoney(unit.eal_inr)}</strong></div><div className="hierarchy-assets">{unitAssets.map((asset) => <div className="hierarchy-asset" key={asset.asset_id}><div><strong>{asset.hostname || asset.asset_id}</strong><small>{asset.asset_id} · {asset.risk_level || 'unassessed'} risk</small></div><span>{displayMoney(asset.eal_inr)}</span></div>)}</div></article>; }) : <p className="soft-note">No business units have been returned.</p>}</div><p className="soft-note">{portfolio.enterprise?.note || 'Enterprise totals are assembled from the current asset and risk evidence.'}</p></section>;
}

export function ForecastPanel() {
  const [result, setResult] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    api.riskForecast(30).then((response) => { if (active) setResult(unwrap(response)); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);
  if (failed) return <section className="panel forecast-panel"><p className="soft-note">Directional forecast is unavailable from the current evidence service.</p></section>;
  const points = safeArray(result?.forecast);
  const first = Number(points[0]?.predicted_eal_inr || 0);
  const last = Number(points[points.length - 1]?.predicted_eal_inr || 0);
  const direction = last > first * 1.01 ? 'Rising' : last < first * 0.99 ? 'Falling' : 'Stable';
  return <section className="panel forecast-panel"><div className="panel-heading"><div><p className="eyebrow">Directional outlook</p><h2>Risk trend forecast</h2></div>{result && <span className={`forecast-direction ${direction.toLowerCase()}`}>{direction}</span>}</div>{result ? points.length ? <div className="forecast-list">{points.map((point) => <div className="forecast-row" key={String(point.timestamp)}><div><strong>{formatDate(point.timestamp)}</strong><small>Range {displayMoney(point.lower_inr)} - {displayMoney(point.upper_inr)}</small></div><strong>{displayMoney(point.predicted_eal_inr)}</strong></div>)}</div> : <p className="soft-note">At least two actual risk-history points are required.</p> : <p className="soft-note">Directional forecast is loading...</p>}<p className="soft-note">{result?.note || 'This is a directional trend, not threat prediction.'}</p></section>;
}

export function AnalystPageV2() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const prompts = ['Which asset has the highest EAL and why?', 'Which control gives the best reduction per rupee?', 'Explain the board risk in simple language.'];
  const ask = async (event) => {
    event.preventDefault();
    if (!query.trim()) return;
    setBusy(true); setError('');
    try {
      const text = query.trim();
      const result = unwrap(await api.analystQuery({ query: text, role: user.role }));
      setAnswer(result); setHistory((items) => [{ query: text, answer: result.answer || 'Answer received.' }, ...items].slice(0, 4)); setQuery('');
    } catch (err) { setError(err.message || 'Analyst service failed.'); }
    finally { setBusy(false); }
  };
  return <section className="page-section"><div className="section-intro"><div><p className="eyebrow">Evidence-grounded assistant</p><h2>Analyst copilot</h2><p>Ask a business or technical question. The service answers from the current risk payload and clearly labels its provider.</p></div><span className="service-pill"><span className="pulse-dot" /> {isDemoMode() ? 'Demo evidence mode' : 'FastAPI / Ollama service'}</span></div><div className="copilot-v2"><aside className="copilot-side"><div className="copilot-orb large">AI</div><h3>Ask without hunting through tables</h3><p>Use these prompts to start. Answers are guidance, not proof of a breach or a financial guarantee.</p><div className="prompt-list">{prompts.map((prompt) => <button key={prompt} type="button" onClick={() => setQuery(prompt)}>{prompt}<span>+</span></button>)}</div>{history.length ? <div className="copilot-history"><small>Recent questions</small>{history.map((item, index) => <button key={`${item.query}-${index}`} type="button" onClick={() => setAnswer({ answer: item.answer })}>{item.query}</button>)}</div> : null}</aside><div className="chat-panel upgraded-chat"><div className="chat-header"><span className="pulse-dot" /> <strong>Analyst service</strong><small>Evidence only</small></div><div className="chat-body">{busy ? <div className="chat-placeholder"><span className="spinner" /><p>Querying current evidence...</p></div> : answer ? <div className="answer-card"><div className="answer-label">Answer</div><p>{answer.answer || answer.executive_summary || 'Structured response received.'}</p><div className="answer-meta"><span>Provider: {answer.llm_provider || 'deterministic fallback'}</span><span>Confidence: {hasValue(answer.confidence_score) ? `${Math.round(Number(answer.confidence_score) * 100)}%` : 'Not available'}</span></div>{answer.recommended_actions?.length ? <div className="action-list"><strong>Suggested next actions</strong>{answer.recommended_actions.map((action) => <span key={action}>Check: {action}</span>)}</div> : null}</div> : <div className="chat-placeholder"><span className="chat-spark">AI</span><p>Ask a question to see a plain-language explanation of the current evidence.</p></div>}</div><form className="chat-form" onSubmit={ask}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ask a business or technical question..." aria-label="Analyst question" /><button className="button primary" disabled={busy || !query.trim()}>{busy ? 'Working...' : 'Ask'}</button></form>{error && <div className="error-box">{error}</div>}</div></div></section>;
}

function numberValue(value) {
  return hasValue(value) && Number.isFinite(Number(value)) ? Number(value) : null;
}

function threatPreview(events) {
  const rows = { ransomware: 0, phishing: 0, insider: 0, supply: 0, apt: 0 };
  safeArray(events).forEach((event) => {
    const raw = `${event.event_type || ''} ${event.type || ''} ${event.source || ''}`.toLowerCase();
    if (/ransom|malware|trojan/.test(raw)) rows.ransomware += 1;
    else if (/phish|bec|credential|login/.test(raw)) rows.phishing += 1;
    else if (/insider|privilege/.test(raw)) rows.insider += 1;
    else if (/supply|vendor|third.party/.test(raw)) rows.supply += 1;
    else if (/apt|zero.day|exploit/.test(raw)) rows.apt += 1;
  });
  return Object.fromEntries(Object.entries(rows).map(([key, count]) => [key, Math.min(80, count * 12)]));
}

function rowsFrom(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.entries(value).map(([name, item]) => ({ name, ...(typeof item === 'object' ? item : { value: item }) }));
  return [];
}

function curveValue(point, key, fallback = null) {
  return hasValue(point?.[key]) ? point[key] : fallback;
}

function InvestmentCurve({ curve }) {
  const points = safeArray(curve);
  return <section className="panel curve-panel"><div className="panel-heading"><div><p className="eyebrow">Investment versus risk reduction</p><h2>ROSI curve</h2></div><span className="chart-chip">Live curve</span></div>{points.length ? <div className="curve-list">{points.map((point) => { const reduction = Math.min(100, Math.max(0, Number(point.cumulative_risk_reduction_pct ?? point.risk_reduction_pct ?? 0))); const effectiveness = Number(point.effective_effectiveness_pct ?? point.measured_effectiveness_pct ?? point.risk_reduction_pct ?? 0); const rosi = curveValue(point, 'rosi_pct', curveValue(point, 'estimated_rosi_pct')); return <div className="curve-row" key={point.control_id || point.name}><div className="curve-label"><strong>{point.name || point.control_id || 'Control'}</strong><small>{effectiveness.toFixed(0)}% measured effectiveness · {displayMoney(point.cumulative_investment_inr ?? point.cost_inr)} invested</small></div><div className="curve-track" title={`${reduction.toFixed(1)}% cumulative reduction`}><span style={{ width: `${reduction}%` }} /></div><strong>{hasValue(rosi) ? `${Number(rosi).toFixed(1)}%` : 'Not available'}<small>{displayMoney(point.rosi_inr ?? point.estimated_rosi_inr)} ROSI</small></strong></div>; })}</div> : <p className="soft-note">The backend has not returned investment curve data yet.</p>}</section>;
}

function threatLabel(key) {
  return { ransomware: 'Ransomware', phishing: 'Phishing / BEC', insider: 'Insider threat', supply: 'Supply chain', apt: 'Zero-day / APT' }[key] || key;
}

export function InvestmentPageV2({ data }) {
  const settings = data.settings || {};
  const controls = safeArray(data.controls);
  const configuredBudget = numberValue(settings.enterprise_budget_inr);
  const [selected, setSelected] = useState([]);
  const [delay, setDelay] = useState(0);
  const [budget, setBudget] = useState(configuredBudget || 0);
  const [threats, setThreats] = useState(() => threatPreview(data.events));
  const [whatIf, setWhatIf] = useState(null);
  const [optimizer, setOptimizer] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [curve, setCurve] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [logs, setLogs] = useState([]);
  useEffect(() => { if (!selected.length && Array.isArray(settings.recommended_control_ids)) setSelected(settings.recommended_control_ids); }, [settings.recommended_control_ids, selected.length]);
  useEffect(() => { if (configuredBudget !== null) setBudget(configuredBudget); }, [configuredBudget]);
  useEffect(() => { let active = true; api.investmentCurve().then((response) => { if (active) setCurve(safeArray(unwrap(response))); }).catch(() => {}); return () => { active = false; }; }, []);
  const budgetMax = Math.max(1000000, (configuredBudget || 0) * 3);
  const selectedSpend = controls.filter((control) => selected.includes(control.control_id)).reduce((sum, control) => sum + Number(control.cost_inr || 0), 0);
  const currentRisk = safeArray(data.risks).map((risk) => numberValue(risk.score)).filter((value) => value !== null);
  const enterpriseRisk = currentRisk.length ? Math.round(currentRisk.reduce((sum, value) => sum + value, 0) / currentRisk.length) : null;
  const toggle = (id) => setSelected((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  const addLog = (status, source, message) => setLogs((items) => [{ id: `${Date.now()}-${items.length}`, time: new Date(), status, source, message }, ...items].slice(0, 8));
  const applyScenario = (scenario) => {
    const byName = (pattern) => controls.find((control) => pattern.test(String(control.name || '').toLowerCase()))?.control_id;
    if (scenario === 'ransomware') { setThreats((items) => ({ ...items, ransomware: 60 })); const id = byName(/edr|endpoint/); if (id) setSelected((items) => items.includes(id) ? items : [...items, id]); }
    if (scenario === 'phishing') { setThreats((items) => ({ ...items, phishing: 55 })); const id = byName(/mfa|phish|identity/); if (id) setSelected((items) => items.includes(id) ? items : [...items, id]); }
    if (scenario === 'cut') setBudget((value) => Math.max(0, Math.round(value * 0.8)));
    if (scenario === 'best') { const best = controls.slice().sort((a, b) => (Number(b.risk_reduction_pct || 0) / Math.max(Number(b.cost_inr || 1), 1)) - (Number(a.risk_reduction_pct || 0) / Math.max(Number(a.cost_inr || 1), 1)))[0]; if (best) setSelected([best.control_id]); }
    setNotice({ kind: 'info', text: 'Preview updated. Nothing was sent to the backend.' });
  };
  const reset = () => { setSelected(Array.isArray(settings.recommended_control_ids) ? settings.recommended_control_ids : []); setDelay(0); setBudget(configuredBudget || 0); setThreats(threatPreview(data.events)); setWhatIf(null); setOptimizer(null); setComparison(null); setError(''); setLogs([]); setNotice({ kind: 'info', text: 'Decision inputs reset to the current baseline.' }); };
  const run = async (event) => {
    event.preventDefault();
    if (!selected.length) { setError('Select at least one control before running the engine.'); setNotice({ kind: 'error', text: 'Select a control to continue.' }); return; }
    setBusy(true); setError(''); setNotice(null); addLog('RUNNING', 'Client', 'Submitting what-if and optimization requests.');
    const body = { simulated_control_ids: selected, delay_days: Number(delay) };
    const optimizerBody = { budget_inr: Number(budget || 0), objective: 'maximize_risk_reduction' };
    try {
      const [whatIfResult, optimizerResult, comparisonResult] = await Promise.all([api.whatIf(body), api.optimize(optimizerBody), api.optimizerComparison(optimizerBody)]);
      setWhatIf(whatIfResult); setOptimizer(unwrap(optimizerResult)); setComparison(unwrap(comparisonResult));
      addLog('OK', 'Analytics API', 'What-if, optimizer, and comparison results received.');
      setNotice({ kind: 'success', text: 'Optimization complete. Values below are from the backend response.' });
    } catch (err) { setError(err.message || 'Optimization request failed.'); addLog('ERROR', 'Analytics API', err.message || 'Backend request failed.'); setNotice({ kind: 'error', text: err.message || 'Backend request failed.' }); }
    finally { setBusy(false); }
  };
  const optimized = comparison?.optimizer || optimizer || {};
  const baseline = comparison?.severity_only_baseline || {};
  const afterEal = whatIf?.simulated_eal_inr ?? optimized.estimated_residual_eal_inr;
  const afterVar = optimized.estimated_residual_var_inr ?? optimized.residual_var_inr;
  const afterRisk = optimized.residual_risk_score ?? optimized.risk_score;
  const afterRosi = optimized.rosi_inr ?? optimized.estimated_rosi_inr;
  const vectorRows = rowsFrom(whatIf?.risk_reduction_by_threat_vector || optimized.risk_reduction_by_threat_vector || comparison?.risk_reduction_by_threat_vector);
  const allocationRows = rowsFrom(optimized.control_allocations || optimized.allocations || optimized.recommended_controls);
  const sector = settings.sector || settings.industry || 'Not configured';
  return <section className="page-section investment-page"><div className="section-intro"><div><p className="eyebrow">Budget-constrained decision support</p><h2>Investment lab</h2><p>Model the next control decision against live risk evidence, not a static dashboard.</p></div><span className="stat-chip">SIH26105 / admin only</span></div><div className="lab-grid"><form className="lab-controls" onSubmit={run}><div className="lab-section"><div className="section-label">Portfolio profile</div><label className="field-label">Sector / profile<select value={sector} disabled aria-label="Configured sector"><option>{sector}</option></select></label></div><div className="lab-section"><div className="section-label">Security budget</div><div className="budget-pill"><span>Available constraint</span><strong>{displayMoney(budget)}</strong><small>{configuredBudget === null ? 'Not available from settings' : 'Preview until the engine runs'}</small></div><input className="range-input" type="range" min="0" max={budgetMax} step="10000" value={budget} disabled={configuredBudget === null} onChange={(event) => setBudget(Number(event.target.value))} aria-label="Security budget" /><div className="range-meta"><span>INR 0</span><span>INR {(budgetMax / 10000000).toFixed(1)} Cr</span></div><div className="budget-spend">Selected controls <strong>{displayMoney(selectedSpend)}</strong></div></div><div className="lab-section"><div className="section-label">Threat environment <span className="preview-label">preview</span></div><p className="field-help">Derived from current telemetry where available. These sliders are not sent with the existing what-if request.</p>{Object.entries(threats).map(([key, value]) => <label className="threat-row" key={key}><span>{threatLabel(key)}</span><input className="range-input" type="range" min="0" max="80" value={value} onChange={(event) => setThreats((items) => ({ ...items, [key]: Number(event.target.value) }))} /><b>{value}%</b></label>)}</div><div className="lab-section"><div className="section-label">Quick scenarios <span className="preview-label">preview</span></div><div className="scenario-grid"><button type="button" className="scenario-button" onClick={() => applyScenario('ransomware')}><strong>Ransomware surge</strong><small>Raise ransomware pressure</small></button><button type="button" className="scenario-button" onClick={() => applyScenario('phishing')}><strong>BEC campaign</strong><small>Raise identity pressure</small></button><button type="button" className="scenario-button" onClick={() => applyScenario('cut')}><strong>Budget cut</strong><small>Reduce preview budget</small></button><button type="button" className="scenario-button" onClick={() => applyScenario('best')}><strong>Best defense only</strong><small>Pick best ratio</small></button></div></div><div className="lab-section"><div className="section-label">Security controls</div><div className="control-picker">{controls.length ? controls.map((control) => <label className={selected.includes(control.control_id) ? 'picker-row selected' : 'picker-row'} key={control.control_id}><input type="checkbox" checked={selected.includes(control.control_id)} onChange={() => toggle(control.control_id)} /><span><strong>{control.name || control.control_id}</strong><small>{control.control_id} · {displayMoney(control.cost_inr)} · {hasValue(control.risk_reduction_pct) ? `${control.risk_reduction_pct}% stated reduction` : 'Reduction not available'}</small><em>{control.owner || 'Owner not available'} · {Array.isArray(control.compliance_frameworks) ? control.compliance_frameworks.join(' / ') : 'Framework not mapped'}</em></span><StatusChip value={control.status} /></label>) : <EmptyState title="No controls returned" copy="The live control portfolio is empty." />}</div></div><label className="field-label">Remediation delay days<input type="number" min="0" value={delay} onChange={(event) => setDelay(event.target.value)} /></label>{error && <div className="error-box">{error}</div>}<button className="button primary full optimize-button" disabled={busy || !controls.length}>{busy ? 'Running engine...' : 'Run AI Optimization Engine'}</button><button type="button" className="button ghost full" onClick={reset} disabled={busy}>Reset to baseline</button></form><div className="lab-results"><div className="results-header"><div><p className="eyebrow">Decision output</p><h2>Live simulation result</h2></div><span className="status-chip monitoring"><span className="pulse-dot" /> Backend values</span></div><section className="kpi-row"><div className="kpi eal"><small>Expected annual loss</small><strong>{displayMoney(afterEal)}</strong><span>{whatIf ? `${Number(whatIf.combined_reduction_pct || 0).toFixed(1)}% combined reduction` : 'Run a simulation'}</span></div><div className="kpi var"><small>Value at risk</small><strong>{displayMoney(afterVar)}</strong><span>{optimized.confidence_label || optimized.var_confidence_label || 'Confidence not available'}</span></div><div className="kpi rosi"><small>ROSI / return</small><strong>{displayMoney(afterRosi)}</strong><span>{hasValue(optimized.rosi_pct) ? `${optimized.rosi_pct}%` : 'Not available'}</span></div><div className="kpi score"><small>Enterprise risk score</small><strong>{afterRisk ?? enterpriseRisk ?? 'Not available'}</strong><span>{afterRisk !== null && afterRisk !== undefined ? 'Optimized response' : enterpriseRisk !== null ? 'Current risk evidence' : 'Score not returned'}</span></div></section><section className="compare-panel"><div className="panel-heading"><div><p className="eyebrow">Before versus after</p><h2>Decision delta</h2></div><span className="chart-chip">{comparison ? 'Result received' : 'Awaiting run'}</span></div>{comparison || whatIf ? <div className="compare-grid"><div className="compare-col before"><span className="compare-tag">Baseline</span><div><span>EAL</span><strong>{displayMoney(whatIf?.original_eal_inr ?? settings.total_expected_annual_loss_inr)}</strong></div><div><span>VaR</span><strong>{displayMoney(settings.value_at_risk_inr)}</strong></div><div><span>Risk score</span><strong>{enterpriseRisk ?? 'Not available'}</strong></div><div><span>Budget spent</span><strong>{displayMoney(baseline.spent_inr)}</strong></div><div><span>ROSI</span><strong>{displayMoney(baseline.rosi_inr)}</strong></div></div><div className="compare-arrow">→</div><div className="compare-col after"><span className="compare-tag">Optimized</span><div><span>EAL</span><strong>{displayMoney(afterEal)}</strong></div><div><span>VaR</span><strong>{displayMoney(afterVar)}</strong></div><div><span>Risk score</span><strong>{afterRisk ?? 'Not available'}</strong></div><div><span>Budget spent</span><strong>{displayMoney(optimized.spent_inr)}</strong></div><div><span>ROSI</span><strong>{displayMoney(afterRosi)}</strong></div></div></div> : <EmptyState title="No result yet" copy="Choose controls and run the engine to populate the comparison." />}</section><div className="results-two-col"><section className="panel compact-panel"><div className="panel-heading"><div><p className="eyebrow">Threat vectors</p><h2>Risk reduction</h2></div></div>{vectorRows.length ? <div className="risk-bars">{vectorRows.map((row, index) => { const value = Number(row.reduction_pct ?? row.risk_reduction_pct ?? row.value ?? 0); return <div className="risk-bar" key={row.name || row.vector || index}><div><span>{row.name || row.vector || 'Threat vector'}</span><b>{hasValue(row.reduction_pct ?? row.risk_reduction_pct ?? row.value) ? `${value.toFixed(1)}%` : 'Not available'}</b></div><div className="bar-track"><span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div></div>; })}</div> : <p className="soft-note">The backend has not returned threat-vector reduction data.</p>}</section><section className="panel compact-panel"><div className="panel-heading"><div><p className="eyebrow">Portfolio allocation</p><h2>Optimized by control</h2></div></div>{allocationRows.length ? <div className="allocation-list">{allocationRows.map((row, index) => { const name = row.name || row.control_name || row.control_id || `Control ${index + 1}`; const value = row.allocation_inr ?? row.allocated_inr ?? row.cost_inr ?? row.spent_inr; return <div className="allocation-row" key={row.control_id || name}><span>{name}</span><i><b style={{ width: `${Math.min(100, Number(value || 0) / Math.max(Number(optimized.spent_inr || value || 1), 1) * 100)}%` }} /></i><strong>{displayMoney(value)}</strong></div>; })}</div> : <p className="soft-note">The optimizer did not return control allocation detail.</p>}</section></div><section className="panel log-panel"><div className="panel-heading"><div><p className="eyebrow">Simulation log</p><h2>Analysis activity</h2></div><span className="mono-label">NO TOKENS / PAYLOADS</span></div>{logs.length ? logs.map((log) => <div className="log-entry" key={log.id}><time>{formatDate(log.time)}</time><StatusChip value={log.status} /><span>{log.source}</span><strong>{log.message}</strong></div>) : <p className="soft-note">Run an analysis to see timestamped request status here.</p>}</section><InvestmentCurve curve={curve} />{notice && <div className={`toast show ${notice.kind}`}>{notice.text}</div>}</div></div></section>;
}

export function AuditPageV2({ data, canTamper = true }) {
  const [verification, setVerification] = useState(null);
  const [tamper, setTamper] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [ledgerError, setLedgerError] = useState('');
  const [busy, setBusy] = useState(false);
  const verify = async () => {
    setBusy(true);
    try { setVerification(await api.verifyAudit()); }
    catch (err) {
      const result = err.data || {};
      if (err.status === 404 || result.status === 'NOT_FOUND') setVerification({ status: 'NOT_FOUND', message: 'Not anchored yet. No blockchain transaction is recorded for this report.' });
      else if (result.status === 'TAMPERED') setVerification(result);
      else setVerification({ status: 'ERROR', message: err.message || 'Verification failed.' });
    } finally { setBusy(false); }
  };
  const anchored = ledger.some((item) => ['anchored', 'secure', 'confirmed'].includes(String(item.verification_status || item.status || '').toLowerCase()) && item.report_hash && item.tx_hash) || ['SECURE', 'TAMPERED'].includes(verification?.status);
  const runTamper = async () => {
    if (!anchored) return;
    setBusy(true);
    try { setTamper(await api.tamperTest()); }
    catch (err) {
      if (err.status === 503) setTamper({ status: 'UNAVAILABLE', message: 'Tamper testing is unavailable until a report is anchored.' });
      else setTamper({ status: 'ERROR', message: err.message || 'Tamper test failed.' });
    } finally { setBusy(false); }
  };
  useEffect(() => { let active = true; api.auditLedger().then((result) => { if (active) setLedger(safeArray(unwrap(result))); }).catch((err) => { if (active) setLedgerError(err.message || 'Audit ledger unavailable.'); }); return () => { active = false; }; }, []);
  const summary = data.audit?.summary || {};
  const verificationTone = verification?.status === 'SECURE' ? 'secure' : verification?.status === 'TAMPERED' ? 'detected' : 'warning';
  return <section className="page-section"><div className="section-intro"><div><p className="eyebrow">Governance proof</p><h2>Audit evidence</h2><p>Verify the current report, inspect the append-only chain, and run a safe tamper test only after an anchor exists.</p></div><div className="audit-actions"><button className="button primary" onClick={verify} disabled={busy}>{busy ? 'Working...' : 'Verify latest report'}</button>{canTamper && <button className="button ghost" onClick={runTamper} disabled={busy || !anchored}>Run tamper test</button>}</div></div><div className="content-grid two-col"><div className="panel verification-panel"><div className="panel-heading"><div><p className="eyebrow">Integrity check</p><h2>{verification?.status === 'NOT_FOUND' ? 'Not anchored yet' : verification?.status || 'Not checked'}</h2></div>{verification?.status && <StatusChip value={verification.status} />}</div>{verification ? <><div className={`verification-banner ${verificationTone}`}><span>{verification.status === 'SECURE' ? 'OK' : verification.status === 'TAMPERED' ? '!' : 'i'}</span><strong>{verification.message}</strong></div><div className="hash-block"><span>Report hash</span><code>{verification.report_hash || 'Not available'}</code><span>Transaction</span><code>{verification.tx_hash || 'Not available'}</code><span>Chain</span><code>{verification.chain_index ?? 'Not available'} / {verification.chain_valid === false ? 'broken' : verification.chain_valid === true ? 'valid' : 'Not available'}</code></div></> : <EmptyState title="Verification not run" copy="Click verify to compare the current report with the external anchor." />}{canTamper && !anchored && <p className="soft-note">Tamper testing is disabled until an anchored ledger record is available.</p>}{tamper && <div className={`tamper-result ${tamper.status === 'TAMPERED' ? 'detected' : 'unexpected'}`}><strong>{tamper.status === 'TAMPERED' ? 'Tamper detected successfully' : `Tamper test: ${tamper.status}`}</strong><span>{tamper.message}</span></div>}</div><div className="panel"><div className="panel-heading"><div><p className="eyebrow">Report snapshot</p><h2>{data.audit?.organization || 'Current evidence'}</h2></div></div><div className="detail-list"><div><span>Generated</span><strong>{formatDate(data.audit?.report_generated_at)}</strong></div><div><span>Assets monitored</span><strong>{summary.total_assets_monitored ?? data.assets.length}</strong></div><div><span>Open vulnerabilities</span><strong>{summary.open_vulnerabilities_count ?? data.vulnerabilities.length}</strong></div><div><span>Critical unpatched CVEs</span><strong>{summary.critical_unpatched_cves ?? 'Not available'}</strong></div><div><span>Interpretation</span><strong>Evidence integrity, not certification</strong></div></div></div></div><section className="panel ledger-panel"><div className="panel-heading"><div><p className="eyebrow">Append-only record</p><h2>Audit ledger</h2></div><span className="status-chip anchored">{ledger.length} record{ledger.length === 1 ? '' : 's'}</span></div>{ledgerError ? <div className="error-box">{ledgerError}</div> : ledger.length ? <div className="ledger-list">{ledger.map((item, index) => <div className="ledger-row" key={item.tx_hash || item.report_hash || index}><span className="ledger-index">#{item.chain_index ?? index + 1}</span><div><strong>{item.verification_status || item.status || 'Recorded'}</strong><small>{formatDate(item.createdAt || item.created_at)} · {item.network || 'Network not available'}</small></div><code>{item.report_hash || 'Report hash not available'}</code><code>{item.tx_hash || 'Transaction not available'}</code></div>)}</div> : <EmptyState title="No anchored report" copy="The ledger is empty. Verification will show Not anchored yet." />}</section></section>;
}
