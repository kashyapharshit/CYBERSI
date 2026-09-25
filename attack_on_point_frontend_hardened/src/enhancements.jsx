import { useEffect, useState } from 'react';
import { api, compactMoney, formatDate, isDemoMode, sourceLabel } from './api';

const safeArray = (value) => Array.isArray(value) ? value : [];
const unwrap = (response) => response?.data ?? response ?? [];

function StatusChip({ value }) {
  const text = String(value || 'unknown').replaceAll('_', ' ');
  return <span className={`status-chip ${String(value || '').toLowerCase()}`}>{text}</span>;
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
      <div className="viewer-signal"><small>Most urgent asset</small><strong>{topRisk?.hostname || topRisk?.asset_id || 'No urgent asset'}</strong><span>{topRisk ? `Risk score ${topRisk.risk.score || topRisk.risk.risk_score || 0} / 99` : 'Waiting for assessment'}</span></div>
    </section>
    <section className="plain-metric-grid">
      <PlainMetric label="Possible yearly loss" value={compactMoney(settings.total_expected_annual_loss_inr)} detail="Estimated exposure if risks remain" tone="teal" />
      <PlainMetric label="Worst-case planning view" value={compactMoney(settings.value_at_risk_inr)} detail="High-loss scenario estimate" tone="amber" />
      <PlainMetric label="Urgent findings" value={urgent} detail="High or critical open findings" tone="red" />
      <PlainMetric label="Protected assets tracked" value={assets.length} detail="Business systems in scope" tone="blue" />
    </section>
    <section className="viewer-grid">
      <div className="panel viewer-panel"><div className="panel-heading"><div><p className="eyebrow">Decision focus</p><h2>Where the exposure is concentrated</h2></div></div>{assets.slice(0, 4).map((asset, index) => <div className="viewer-risk-row" key={asset.asset_id}><span className="viewer-rank">0{index + 1}</span><div><strong>{asset.hostname || asset.asset_id}</strong><small>{asset.business_unit || 'Business system'} · {asset.internet_exposed ? 'Internet-facing' : 'Internal'}</small></div><div className="viewer-risk-value"><b>{asset.risk.score || asset.risk.risk_score || 0}</b><small>{compactMoney(asset.risk.eal_inr || asset.asset_eal_inr)} annual loss</small></div></div>)}</div>
      <div className="panel viewer-panel"><div className="panel-heading"><div><p className="eyebrow">In simple terms</p><h2>What this means</h2></div></div><div className="plain-explanation"><div><span className="plain-icon red">!</span><p><strong>Urgent does not mean breach.</strong><br />It means the evidence suggests a higher chance or higher business impact and deserves faster action.</p></div><div><span className="plain-icon teal">INR</span><p><strong>Money figures are estimates.</strong><br />They are based on the supplied synthetic fixture and assumptions, not confirmed financial loss.</p></div><div><span className="plain-icon blue">i</span><p><strong>The next decision is controllable.</strong><br />Leadership can compare remediation cost against expected exposure in the Investment Lab.</p></div></div></div>
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
  return <section className="panel portfolio-panel"><div className="panel-heading"><div><p className="eyebrow">Enterprise hierarchy</p><h2>Enterprise to business unit to asset</h2></div><span className="status-chip monitoring">Live portfolio</span></div><div className="portfolio-metrics"><div><small>Enterprise EAL</small><strong>{compactMoney(portfolio.enterprise?.eal_inr)}</strong></div><div><small>Enterprise VaR</small><strong>{compactMoney(portfolio.enterprise?.var_inr)}</strong></div><div><small>Business units</small><strong>{units.length}</strong></div><div><small>Assets in scope</small><strong>{portfolio.enterprise?.asset_count ?? assets.length}</strong></div></div><div className="hierarchy-tree"><div className="hierarchy-enterprise"><span className="hierarchy-kicker">ENTERPRISE</span><strong>{portfolio.enterprise?.name || 'Enterprise'}</strong></div>{units.length ? units.map((unit) => { const unitAssets = assets.filter((asset) => (asset.business_unit || 'Unassigned') === unit.name); return <article className="hierarchy-unit" key={unit.name}><div className="hierarchy-unit-heading"><div><span className="hierarchy-kicker">BUSINESS UNIT</span><strong>{unit.name}</strong><small>{unit.asset_count || unitAssets.length} assets · average score {unit.average_risk_score ?? '—'}</small></div><strong>{compactMoney(unit.eal_inr)}</strong></div><div className="hierarchy-assets">{unitAssets.map((asset) => <div className="hierarchy-asset" key={asset.asset_id}><div><strong>{asset.hostname || asset.asset_id}</strong><small>{asset.asset_id} · {asset.risk_level || 'unassessed'} risk</small></div><span>{compactMoney(asset.eal_inr)}</span></div>)}</div></article>; }) : <p className="soft-note">No business units have been returned.</p>}</div><p className="soft-note">{portfolio.enterprise?.note || 'Enterprise totals are assembled from the current asset and risk evidence.'}</p></section>;
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
  const directionClass = direction.toLowerCase();
  return <section className="panel forecast-panel"><div className="panel-heading"><div><p className="eyebrow">Directional outlook</p><h2>Risk trend forecast</h2></div>{result && <span className={`forecast-direction ${directionClass}`}>{direction}</span>}</div>{result ? points.length ? <div className="forecast-list">{points.map((point) => <div className="forecast-row" key={String(point.timestamp)}><div><strong>{formatDate(point.timestamp)}</strong><small>Range {compactMoney(point.lower_inr)} - {compactMoney(point.upper_inr)}</small></div><strong>{compactMoney(point.predicted_eal_inr)}</strong></div>)}</div> : <p className="soft-note">At least two actual risk-history points are required.</p> : <p className="soft-note">Directional forecast is loading...</p>}<p className="soft-note">{result?.note || 'This is a directional trend, not threat prediction.'}</p></section>;
}

export function AnalystPageV2() {
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
      const result = unwrap(await api.analystQuery({ query: query.trim() }));
      setAnswer(result); setHistory((items) => [{ query: query.trim(), answer: result.answer || 'Answer received.' }, ...items].slice(0, 4)); setQuery('');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return <section className="page-section"><div className="section-intro"><div><p className="eyebrow">Evidence-grounded assistant</p><h2>Analyst copilot</h2><p>Ask a business or technical question. The service answers from the current risk payload and clearly labels its provider.</p></div><span className="service-pill"><span className="pulse-dot" /> {isDemoMode() ? 'Demo evidence mode' : 'FastAPI / Ollama service'}</span></div><div className="copilot-v2"><aside className="copilot-side"><div className="copilot-orb large">AI</div><h3>Ask without hunting through tables</h3><p>Use these prompts to start. Answers are guidance, not proof of a breach or a financial guarantee.</p><div className="prompt-list">{prompts.map((prompt) => <button key={prompt} onClick={() => setQuery(prompt)}>{prompt}<span>+</span></button>)}</div>{history.length ? <div className="copilot-history"><small>Recent questions</small>{history.map((item, index) => <button key={`${item.query}-${index}`} onClick={() => setAnswer({ answer: item.answer })}>{item.query}</button>)}</div> : null}</aside><div className="chat-panel upgraded-chat"><div className="chat-header"><span className="pulse-dot" /> <strong>Analyst service</strong><small>Evidence only</small></div><div className="chat-body">{answer ? <div className="answer-card"><div className="answer-label">Answer</div><p>{answer.answer || answer.executive_summary || 'Structured response received.'}</p><div className="answer-meta"><span>Provider: {answer.llm_provider || 'deterministic fallback'}</span><span>Confidence: {Math.round(Number(answer.confidence_score || 0) * 100)}%</span></div>{answer.recommended_actions?.length ? <div className="action-list"><strong>Suggested next actions</strong>{answer.recommended_actions.map((action) => <span key={action}>Check: {action}</span>)}</div> : null}</div> : <div className="chat-placeholder"><span className="chat-spark">AI</span><p>Ask a question to see a plain-language explanation of the current evidence.</p></div>}</div><form className="chat-form" onSubmit={ask}><input aria-label="Ask the analyst copilot" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Example: What should leadership fund first?" /><button className="button dark" disabled={busy}>{busy ? 'Thinking...' : 'Ask copilot'}</button></form>{error && <div className="error-box">{error}</div>}</div></div></section>;
}

function InvestmentCurve({ curve }) {
  const points = safeArray(curve);
  return <section className="panel curve-panel"><div className="panel-heading"><div><p className="eyebrow">Investment versus risk reduction</p><h2>ROSI curve</h2></div><span className="chart-chip">INR</span></div>{points.length ? <div className="curve-list">{points.map((point) => { const reduction = Math.min(100, Math.max(0, Number(point.cumulative_risk_reduction_pct ?? point.risk_reduction_pct ?? 0))); const effectiveness = Number(point.effective_effectiveness_pct ?? point.measured_effectiveness_pct ?? point.risk_reduction_pct ?? 0); const rosi = Number(point.rosi_pct ?? point.estimated_rosi_pct ?? 0); const rosiInr = point.rosi_inr ?? point.estimated_rosi_inr; return <div className="curve-row" key={point.control_id || point.name}><div className="curve-label"><strong>{point.name || point.control_id || 'Control'}</strong><small>{effectiveness.toFixed(0)}% measured effectiveness · {compactMoney(point.cumulative_investment_inr ?? point.cost_inr)} invested</small></div><div className="curve-track" title={`${reduction.toFixed(1)}% cumulative reduction`}><span style={{ width: `${reduction}%` }} /></div><strong>{rosi.toFixed(1)}%<small>{compactMoney(rosiInr)} ROSI</small></strong></div>; })}</div> : <p className="soft-note">Run the backend analysis to populate the ROSI curve.</p>}</section>;
}

export function InvestmentPageV2({ data }) {
  const [selected, setSelected] = useState([]);
  const [delay, setDelay] = useState(0);
  const [whatIf, setWhatIf] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [curve, setCurve] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { let active = true; api.investmentCurve().then((response) => { if (active) setCurve(safeArray(unwrap(response))); }).catch(() => {}); return () => { active = false; }; }, []);
  const toggle = (id) => setSelected((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  const run = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const [whatIfResult, comparisonResult] = await Promise.all([api.whatIf({ simulated_control_ids: selected, delay_days: Number(delay) }), api.optimizerComparison({ budget_inr: Number(data.settings.enterprise_budget_inr || 0), objective: 'maximize_risk_reduction' })]);
      setWhatIf(whatIfResult); setComparison(unwrap(comparisonResult));
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const optimizer = comparison?.optimizer;
  const baseline = comparison?.severity_only_baseline;
  return <section className="page-section"><div className="section-intro"><div><p className="eyebrow">Budget-constrained decision support</p><h2>Investment lab</h2><p>Compare the full risk model against a transparent severity-only baseline before funding controls.</p></div><span className="stat-chip">Budget {compactMoney(data.settings.enterprise_budget_inr)}</span></div><div className="content-grid two-col"><form className="panel form-panel" onSubmit={run}><div className="panel-heading"><div><p className="eyebrow">Decision inputs</p><h2>Select controls</h2></div></div><label>Remediation delay days<input type="number" min="0" value={delay} onChange={(event) => setDelay(event.target.value)} /></label><div className="control-picker">{safeArray(data.controls).map((control) => <label className={selected.includes(control.control_id) ? 'picker-row selected' : 'picker-row'} key={control.control_id}><input type="checkbox" checked={selected.includes(control.control_id)} onChange={() => toggle(control.control_id)} /><span><strong>{control.name}</strong><small>{control.control_id} · {compactMoney(control.cost_inr)} · {control.risk_reduction_pct || 0}% stated reduction</small></span></label>)}</div>{error && <div className="error-box">{error}</div>}<button className="button primary full" disabled={busy}>{busy ? 'Calculating...' : 'Compare decision paths'}</button></form><div className="panel result-panel">{whatIf ? <><div className="result-highlight"><small>What-if simulated EAL</small><strong>{compactMoney(whatIf.simulated_eal_inr)}</strong><span>{Number(whatIf.combined_reduction_pct || 0).toFixed(1)}% bounded combined reduction</span></div><div className="result-grid"><div><small>Original EAL</small><strong>{compactMoney(whatIf.original_eal_inr)}</strong></div><div><small>Risk delta</small><strong>{compactMoney(whatIf.risk_reduction_achieved_inr)}</strong></div></div><p className="soft-note">{whatIf.warning}</p></> : <div className="empty-state"><div className="empty-symbol">INR</div><h3>Make the trade-off visible</h3><p>Choose controls and compare expected exposure, spend, and the severity-only baseline.</p></div>}</div></div><InvestmentCurve curve={curve} />{comparison && <div className="panel comparison-panel"><div className="panel-heading"><div><p className="eyebrow">P0 evidence</p><h2>Model comparison at {compactMoney(comparison.budget_inr)}</h2></div><span className="status-chip optimal">{comparison.comparison_version}</span></div><div className="comparison-grid"><div><small>Full optimizer residual EAL</small><strong>{compactMoney(optimizer?.estimated_residual_eal_inr)}</strong><span>Spend {compactMoney(optimizer?.spent_inr)}</span><em>{optimizer?.solver || 'Solver'}</em></div><div><small>Severity-only baseline</small><strong>{compactMoney((data.settings.total_expected_annual_loss_inr || 0) * (1 - Number(baseline?.severity_coverage_pct || 0) / 100))}</strong><span>Spend {compactMoney(baseline?.spent_inr)}</span><em>{baseline?.severity_coverage_pct || 0}% severity coverage</em></div></div><div className="comparison-controls"><span>Optimizer controls: {optimizer?.recommended_control_ids?.join(', ') || 'None'}</span><span>Baseline controls: {baseline?.recommended_control_ids?.join(', ') || 'None'}</span></div><p className="soft-note">{comparison.note}</p></div>}</section>;
}

export function AuditPageV2({ data, canTamper = true }) {
  const [verification, setVerification] = useState(null);
  const [tamper, setTamper] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [busy, setBusy] = useState(false);
  const verify = async () => { setBusy(true); try { setVerification(await api.verifyAudit()); } catch (err) { setVerification(err.data || { status: 'ERROR', message: err.message }); } finally { setBusy(false); } };
  const runTamper = async () => { setBusy(true); try { setTamper(await api.tamperTest()); } catch (err) { setTamper({ status: 'ERROR', message: err.message }); } finally { setBusy(false); } };
  useEffect(() => { api.auditLedger().then((result) => setLedger(safeArray(unwrap(result)))).catch(() => {}); }, []);
  const summary = data.audit?.summary || {};
  return <section className="page-section"><div className="section-intro"><div><p className="eyebrow">Governance proof</p><h2>Audit evidence</h2><p>Verify the current report, inspect the append-only chain, and {canTamper ? 'run a safe tamper test against an in-memory copy.' : 'review the evidence without changing anything.'}</p></div><div className="audit-actions"><button className="button dark" onClick={verify} disabled={busy}>{busy ? 'Working...' : 'Verify latest report'}</button>{canTamper && <button className="button ghost" onClick={runTamper} disabled={busy}>Run tamper test</button>}</div></div><div className="content-grid two-col"><div className="panel verification-panel"><div className="panel-heading"><div><p className="eyebrow">Integrity check</p><h2>{verification?.status || 'Not checked'}</h2></div></div>{verification ? <><div className={`verification-banner ${verification.status === 'SECURE' ? 'secure' : 'warning'}`}><span>{verification.status === 'SECURE' ? 'OK' : '!'}</span><strong>{verification.message}</strong></div><div className="hash-block"><span>Report hash</span><code>{verification.report_hash || 'Unavailable'}</code><span>Transaction</span><code>{verification.tx_hash || 'Unavailable'}</code><span>Chain</span><code>{verification.chain_index ?? 'Unavailable'} / {verification.chain_valid === false ? 'broken' : 'valid'}</code></div></> : <div className="empty-state"><div className="empty-symbol">OK</div><h3>Verification not run</h3><p>Click verify to compare MongoDB evidence with the external anchor.</p></div>}{tamper && <div className={`tamper-result ${tamper.status === 'TAMPERED' ? 'detected' : 'unexpected'}`}><strong>Tamper test: {tamper.status}</strong><span>{tamper.message}</span></div>}</div><div className="panel"><div className="panel-heading"><div><p className="eyebrow">Report snapshot</p><h2>{data.audit?.organization || 'Current evidence'}</h2></div></div><div className="detail-list"><div><span>Generated</span><strong>{formatDate(data.audit?.report_generated_at)}</strong></div><div><span>Assets monitored</span><strong>{summary.total_assets_monitored ?? data.assets.length}</strong></div><div><span>Open vulnerabilities</span><strong>{summary.open_vulnerabilities_count ?? data.vulnerabilities.length}</strong></div><div><span>Critical unpatched CVEs</span><strong>{summary.critical_unpatched_cves ?? 'Not available'}</strong></div><div><span>Interpretation</span><strong>Integrity evidence, not certification</strong></div></div></div></div><div className="panel ledger-panel"><div className="panel-heading"><div><p className="eyebrow">Append-only record view</p><h2>Audit ledger</h2></div><span className="status-chip anchored">{ledger.length} records</span></div>{ledger.length ? ledger.map((entry) => <div className="ledger-row" key={entry._id || entry.chain_index}><span className="ledger-index">#{entry.chain_index || 0}</span><div><strong>{entry.payload_version || 'risk-report'}</strong><small>{entry.network || 'External network unavailable'} · {entry.signer || 'Signer unavailable'} · {formatDate(entry.anchored_at || entry.createdAt)}</small></div><StatusChip value={entry.verification_status} /><code>{String(entry.report_hash || '').slice(0, 18)}...</code></div>) : <p className="soft-note">No ledger records are available yet. The first AI result will create one.</p>}</div></section>;
}
