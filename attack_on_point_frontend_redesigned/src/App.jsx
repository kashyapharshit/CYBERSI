import { useEffect, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { api, compactMoney, formatDate, isDemoMode, money, sourceLabel } from './api';
import { useAuth } from './auth';
import { BarChart, CoverageBars, DonutChart, LineChart } from './charts';
import { AuditPageV2, AnalystPageV2, ForecastPanel, InvestmentPageV2, PortfolioLevels, ViewerDashboard } from './enhancements';

const navByRole = {
  admin: [
    { to: '/', label: 'Executive command', icon: '◈' }, { to: '/attacks', label: 'Live attacks', icon: '◉' },
    { to: '/assets', label: 'Asset risk', icon: '⌘' }, { to: '/vulnerabilities', label: 'Findings', icon: '△' },
    { to: '/investment', label: 'Investment lab', icon: '↗' }, { to: '/controls', label: 'Controls', icon: '◌' },
    { to: '/audit', label: 'Audit evidence', icon: '✓' }, { to: '/operations', label: 'Evidence pipeline', icon: '⇄' }, { to: '/analyst', label: 'Analyst copilot', icon: '✦' },
  ],
  analyst: [
    { to: '/', label: 'Technical command', icon: '◈' }, { to: '/attacks', label: 'Live attacks', icon: '◉' },
    { to: '/assets', label: 'Asset risk', icon: '⌘' }, { to: '/vulnerabilities', label: 'Findings', icon: '△' },
    { to: '/incidents', label: 'Incidents', icon: '!' }, { to: '/operations', label: 'Evidence pipeline', icon: '⇄' }, { to: '/analyst', label: 'Analyst copilot', icon: '✦' },
  ],
  viewer: [
    { to: '/', label: 'Board summary', icon: '◈' }, { to: '/assets', label: 'Asset risk', icon: '⌘' },
    { to: '/attacks', label: 'Attack watch', icon: '◉' }, { to: '/audit', label: 'Audit evidence', icon: '✓' },
  ],
};

const emptyData = { settings: {}, assets: [], vulnerabilities: [], controls: [], incidents: [], events: [], risks: [], audit: null, trend: [], attackPressure: [], regulatoryCoverage: [], ingestionJobs: [], scenarios: [], blockchainStatus: {} };
const routeLabels = { '/incidents': 'Incident ledger', '/operations': 'Evidence pipeline', '/analyst': 'Analyst copilot', '/audit': 'Audit evidence', '/investment': 'Investment lab', '/controls': 'Controls' };
const arr = (value) => Array.isArray(value) ? value : [];
const payload = (response) => response?.data ?? response ?? [];
const hasValue = (value) => value !== undefined && value !== null && value !== '';
const displayMoney = (value) => hasValue(value) ? compactMoney(value) : 'Not available';

function useWorkspaceData() {
  const { user } = useAuth();
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncedAt, setSyncedAt] = useState(null);
  const refresh = async () => {
    setLoading(true); setError('');
    const canOperate = user.role !== 'viewer';
    const canSeeBlockchain = user.role === 'admin';
    const results = await Promise.allSettled([
      api.settings(), api.assets(), canOperate ? api.vulnerabilities() : Promise.resolve({ data: [] }), canOperate ? api.controls() : Promise.resolve({ data: [] }),
      canOperate ? api.incidents() : Promise.resolve({ data: [] }), api.events(), api.risks(), api.auditReport(), api.riskTrend(),
      canOperate ? api.attackPressure() : Promise.resolve({ data: [] }), api.regulatoryCoverage(), canOperate ? api.ingestionJobs() : Promise.resolve({ data: [] }),
      canOperate ? api.scenarios() : Promise.resolve({ data: [] }), canSeeBlockchain ? api.blockchainStatus() : Promise.resolve({ data: {} }),
    ]);
    const [settings, assets, vulnerabilities, controls, incidents, events, risks, audit, trend, attackPressure, regulatoryCoverage, ingestionJobs, scenarios, blockchainStatus] = results;
    setData((current) => ({
      ...current,
      settings: settings.status === 'fulfilled' ? payload(settings.value) : current.settings,
      assets: assets.status === 'fulfilled' ? arr(payload(assets.value)) : current.assets,
      vulnerabilities: vulnerabilities.status === 'fulfilled' ? arr(payload(vulnerabilities.value)) : current.vulnerabilities,
      controls: controls.status === 'fulfilled' ? arr(payload(controls.value)) : current.controls,
      incidents: incidents.status === 'fulfilled' ? arr(payload(incidents.value)) : current.incidents,
      events: events.status === 'fulfilled' ? arr(payload(events.value)) : current.events,
      risks: risks.status === 'fulfilled' ? arr(payload(risks.value)) : current.risks,
      audit: audit.status === 'fulfilled' ? (audit.value?.report || payload(audit.value)) : current.audit,
      trend: trend.status === 'fulfilled' ? arr(payload(trend.value)) : current.trend,
      attackPressure: attackPressure.status === 'fulfilled' ? arr(payload(attackPressure.value)) : current.attackPressure,
      regulatoryCoverage: regulatoryCoverage.status === 'fulfilled' ? arr(payload(regulatoryCoverage.value)) : current.regulatoryCoverage,
      ingestionJobs: ingestionJobs.status === 'fulfilled' ? arr(payload(ingestionJobs.value)) : current.ingestionJobs,
      scenarios: scenarios.status === 'fulfilled' ? arr(payload(scenarios.value)) : current.scenarios,
      blockchainStatus: blockchainStatus.status === 'fulfilled' ? payload(blockchainStatus.value) : current.blockchainStatus,
    }));
    const failure = results.find((result) => result.status === 'rejected');
    if (failure && !isDemoMode()) setError(failure.reason?.message || 'Some backend data is unavailable');
    setSyncedAt(new Date()); setLoading(false);
  };
  useEffect(() => { refresh(); }, [user.role]);
  useEffect(() => { const timer = setInterval(async () => { try { const result = await api.events(); setData((current) => ({ ...current, events: arr(payload(result)) })); } catch { /* Preserve the last successful feed. */ } }, 5000); return () => clearInterval(timer); }, []);
  return { data, loading, error, syncedAt, refresh };
}

function attackLabel(event) {
  const raw = `${event.event_type || ''} ${event.type || ''} ${event.raw_payload?.issue_name || ''}`.toLowerCase();
  if (/sql|injection/.test(raw)) return 'SQL injection attempt';
  if (/malware|ransom|trojan/.test(raw)) return 'Malware detected';
  if (/failed|brute|credential|login/.test(raw)) return 'Credential attack signal';
  if (/port|scan|recon/.test(raw)) return 'Network reconnaissance';
  if (/xss|cross.site/.test(raw)) return 'Cross-site scripting';
  if (/phish/.test(raw)) return 'Phishing signal';
  if (/vulnerab|cve|exploit/.test(raw)) return 'Exploitable vulnerability';
  return event.event_type || `${event.type || 'Unknown'} telemetry`;
}

function RiskBadge({ value }) { const normalized = String(value || 'unknown').toLowerCase().replaceAll(' ', '_'); return <span className={`risk-badge ${normalized}`}>{value || 'Unknown'}</span>; }
function Empty({ title, copy }) { return <div className="empty-state"><div className="empty-symbol">◌</div><h3>{title}</h3><p>{copy}</p></div>; }
function Metric({ label, value, detail, tone = 'teal' }) { return <div className={`metric-card ${tone}`}><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-detail">{detail}</div></div>; }

function LiveFeed({ events, full = false, onSimulate }) {
  const list = arr(events).slice(0, full ? 20 : 5);
  const newest = list[0];
  const live = newest && (Date.now() - new Date(newest.observed_at || newest.timestamp || newest.createdAt).getTime()) < 30000;
  return <section className={`panel live-feed-panel ${full ? 'full-feed' : ''}`}><div className="panel-heading"><div><p className="eyebrow">Continuous telemetry</p><h2>{full ? 'Attack watch' : 'Live attack monitor'}</h2><p className="panel-subtitle">Signals are evidence; confirmation remains an analyst decision.</p></div><div className="feed-actions"><span className={live ? 'live-indicator active' : 'live-indicator'}><span className="pulse-dot" />{live ? 'Live signal' : 'Monitoring'}</span>{isDemoMode() && onSimulate && <button className="button demo-button" onClick={onSimulate}>Simulate demo attack</button>}</div></div>{list.length ? <div className="attack-feed">{list.map((event, index) => <div className={index === 0 ? 'attack-row newest' : 'attack-row'} key={`${event._id || event.createdAt || event.timestamp}-${index}`}><div className="attack-severity"><span>{String(event.severity || 'info').slice(0, 1).toUpperCase()}</span></div><div className="attack-main"><strong>{attackLabel(event)}</strong><small>{sourceLabel(event.source || event.type)} · {event.asset_id || 'UNMAPPED'}{event.endpoint ? ` · ${event.endpoint}` : ''}{event.source_ip ? ` · ${event.source_ip}` : ''}</small></div><RiskBadge value={event.severity || 'info'} /><time>{formatDate(event.observed_at || event.timestamp || event.createdAt)}</time></div>)}</div> : <Empty title="No attack signal observed" copy="Send Wazuh, Burp, OpenVAS, Nmap, EDR, IAM, CSPM, or threat-intel telemetry to see the signal here." />}</section>;
}

function Shell({ children, syncedAt, onRefresh, onRunAnalysis, analysisBusy, notice }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const items = navByRole[user.role] || navByRole.viewer;
  const current = items.find((item) => item.to === location.pathname) || { label: routeLabels[location.pathname] || items[0].label };
  return <div className="app-shell"><aside className="sidebar"><div className="brand-lockup"><span className="brand-mark">AP</span><span>Attack On Point</span></div><div className="sidebar-caption">Internal cyber risk command</div><div className="role-banner"><span className="role-dot" /><div><strong>{user.role === 'admin' ? 'Executive workspace' : user.role === 'analyst' ? 'Technical workspace' : 'Read-only workspace'}</strong><small>Role-based access active</small></div></div><nav className="side-nav" aria-label="Primary navigation">{items.map((item) => <NavLink key={item.to} end={item.to === '/'} to={item.to} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}><span className="nav-icon">{item.icon}</span>{item.label}</NavLink>)}</nav><div className="sidebar-bottom"><div className="pipeline-status"><span className="pulse-dot" /><span><strong>Evidence pipeline live</strong><small>5 second event refresh</small></span></div><div className="user-chip"><span className="avatar">{user.name?.slice(0, 1).toUpperCase()}</span><span className="user-meta"><strong>{user.name}</strong><small>{user.role}{user.demo ? ' · demo' : ''}</small></span><button className="icon-button" title="Sign out" onClick={signOut}>↪</button></div></div></aside><main className="main-content"><header className="topbar"><div><div className="topbar-context"><span>{user.role === 'admin' ? 'Board decision intelligence' : user.role === 'analyst' ? 'Security operations intelligence' : 'Board risk briefing'}</span><span className="project-tag">SIH26105</span></div><h1>{current.label}</h1></div><div className="topbar-actions"><span className="pipeline-chip"><span className="pulse-dot" /> Live / evidence pipeline</span><span className="last-sync">{syncedAt ? `Synced ${formatDate(syncedAt)}` : 'Awaiting sync'}</span><button className="button ghost" onClick={onRefresh}>Refresh</button>{user.role === 'admin' && <><button className="button outline-accent" onClick={onRunAnalysis} disabled={analysisBusy}>{analysisBusy ? 'Starting...' : 'Run analysis'}</button><button className="button primary" onClick={() => navigate('/investment')}>Model a decision <span>↗</span></button></>}</div></header><div className="mobile-nav" aria-label="Mobile navigation">{items.map((item) => <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => isActive ? 'mobile-nav-item active' : 'mobile-nav-item'}>{item.icon} {item.label}</NavLink>)}</div>{notice && <div className={`toast show ${notice.kind}`} role="status">{notice.text}</div>}{children}</main></div>;
}

function ExecutiveDashboard({ data, onSimulate }) {
  const settings = data.settings || {};
  const riskMap = Object.fromEntries(data.risks.map((item) => [item.asset_id, item]));
  const open = data.vulnerabilities.filter((item) => item.status !== 'fixed');
  const severity = { critical: open.filter((x) => x.severity === 'critical').length, high: open.filter((x) => x.severity === 'high').length, medium: open.filter((x) => x.severity === 'medium').length, low: open.filter((x) => x.severity === 'low').length };
  const top = data.assets.map((asset) => ({ ...asset, risk_score: riskMap[asset.asset_id]?.score ?? asset.risk_score ?? 0 })).sort((a, b) => b.risk_score - a.risk_score);
  const coverage = data.audit?.regulatory_compliance_breakdown || {};
  return <><section className="board-hero"><div><p className="eyebrow">Board risk briefing / live portfolio</p><h2>Make the exposure legible.</h2><p>One view from technical evidence to annual loss, investment choices, and governance proof.</p></div><div className="decision-banner"><span className="decision-kicker">Decision signal</span><strong>{displayMoney(settings.total_expected_annual_loss_inr)} annual exposure</strong><small>{data.controls.length} controls competing for {displayMoney(settings.enterprise_budget_inr)} budget</small></div></section><section className="metric-grid"><Metric label="Expected annual loss" value={displayMoney(settings.total_expected_annual_loss_inr)} detail="Portfolio financial exposure" tone="teal" /><Metric label="Value at risk" value={displayMoney(settings.value_at_risk_inr)} detail="Tail-loss estimate" tone="amber" /><Metric label="Budget available" value={displayMoney(settings.enterprise_budget_inr)} detail="Explicit investment constraint" tone="blue" /><Metric label="Priority findings" value={severity.critical + severity.high} detail={`${severity.critical} critical · ${severity.high} high`} tone="red" /></section><section className="chart-grid executive-charts"><div className="panel chart-panel"><div className="panel-heading"><div><p className="eyebrow">Portfolio trend</p><h2>Exposure is moving</h2></div><span className="chart-chip">INR</span></div><LineChart data={data.trend} label="EAL" /></div><div className="panel chart-panel"><div className="panel-heading"><div><p className="eyebrow">Concentration</p><h2>Risk by asset</h2></div></div><BarChart items={top} labelKey="hostname" valueKey="risk_score" /></div></section><section className="chart-grid executive-charts"><div className="panel"><div className="panel-heading"><div><p className="eyebrow">Finding mix</p><h2>What is driving attention</h2></div></div><DonutChart {...severity} /></div><div className="panel"><div className="panel-heading"><div><p className="eyebrow">Framework coverage</p><h2>Governance posture</h2></div></div><CoverageBars frameworks={coverage} /></div></section><LiveFeed events={data.events} onSimulate={onSimulate} /></>;
}

function TechnicalDashboard({ data, onSimulate }) {
  const open = data.vulnerabilities.filter((item) => item.status !== 'fixed');
  const active = data.events.filter((item) => ['critical', 'high'].includes(String(item.severity).toLowerCase()));
  const kev = open.filter((item) => item.cisa_kev).length;
  const avgAge = open.length ? Math.round(open.reduce((sum, item) => sum + Number(item.patch_age_days || 0), 0) / open.length) : 0;
  const riskMap = Object.fromEntries(data.risks.map((item) => [item.asset_id, item]));
  const top = data.assets.map((asset) => ({ ...asset, risk_score: riskMap[asset.asset_id]?.score ?? asset.risk_score ?? 0 })).sort((a, b) => b.risk_score - a.risk_score);
  return <><section className="board-hero technical-hero"><div><p className="eyebrow">SOC view / evidence first</p><h2>What is happening right now?</h2><p>Investigate active attack signals, unpatched exposure, and the assets that translate technical severity into business loss.</p></div><div className="live-callout"><span className="pulse-dot" /><strong>{active.length} high-priority signals</strong><small>from the current telemetry window</small></div></section><section className="metric-grid"><Metric label="Active attack signals" value={active.length} detail="High or critical telemetry" tone="red" /><Metric label="KEV findings" value={kev} detail="Known exploited vulnerabilities" tone="amber" /><Metric label="Average patch age" value={`${avgAge}d`} detail="Open finding backlog" tone="blue" /><Metric label="Assets monitored" value={data.assets.length} detail="Business-linked inventory" tone="teal" /></section><LiveFeed events={data.events} onSimulate={onSimulate} /><section className="chart-grid executive-charts"><div className="panel chart-panel"><div className="panel-heading"><div><p className="eyebrow">Risk ranking</p><h2>Assets needing attention</h2></div></div><BarChart items={top} labelKey="hostname" valueKey="risk_score" color="#ff4560" /></div><div className="panel"><div className="panel-heading"><div><p className="eyebrow">Telemetry coverage</p><h2>Source activity</h2></div></div><div className="telemetry-grid">{['Wazuh', 'Burp Suite', 'OpenVAS', 'Nmap', 'EDR', 'IAM'].map((source) => <div className="telemetry-tile" key={source}><span>{source}</span><strong>{data.events.filter((event) => String(event.source || event.type).toLowerCase().includes(source.split(' ')[0].toLowerCase())).length}</strong><small>events</small></div>)}</div></div></section></>;
}

function AssetsPage({ data }) {
  const [selected, setSelected] = useState(null);
  const riskMap = Object.fromEntries(data.risks.map((item) => [item.asset_id, item]));
  return <section className="page-section"><div className="section-intro"><div><p className="eyebrow">Business-linked inventory</p><h2>Asset risk register</h2><p>Technical findings are ranked by business criticality, exposure, dependencies, and financial impact.</p></div><span className="stat-chip">{data.assets.length} monitored assets</span></div><div className="table-panel"><table><thead><tr><th>Asset</th><th>Business unit</th><th>Criticality</th><th>Exposure</th><th>Risk score</th><th>Annual loss</th><th /></tr></thead><tbody>{data.assets.length ? data.assets.map((asset) => { const risk = riskMap[asset.asset_id] || {}; return <tr key={asset.asset_id}><td><strong>{asset.hostname || asset.asset_id}</strong><small>{asset.asset_id}</small></td><td>{asset.business_unit || 'Unassigned'}</td><td><RiskBadge value={asset.criticality} /></td><td>{asset.internet_exposed ? <span className="danger-text">Internet exposed</span> : <span className="muted">Internal</span>}</td><td><strong>{risk.score ?? asset.risk_score ?? 'N/A'}</strong><small>{risk.level || asset.risk_level || 'Not assessed'}</small></td><td>{displayMoney(risk.eal_inr ?? asset.asset_eal_inr)}</td><td><button className="table-action" onClick={() => setSelected({ asset, risk })}>Inspect</button></td></tr>; }) : <tr><td colSpan="7"><Empty title="No assets returned" copy="The live asset inventory is empty." /></td></tr>}</tbody></table></div>{selected && <AssetDrawer {...selected} onClose={() => setSelected(null)} />}</section>;
}

function AssetDrawer({ asset, risk, onClose }) {
  const [profile, setProfile] = useState(null); const [loading, setLoading] = useState(true);
  useEffect(() => { let active = true; setLoading(true); api.dependencies(asset.asset_id).then((response) => { if (active) setProfile(payload(response)); }).catch(() => { if (active) setProfile(null); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [asset.asset_id]);
  const impact = risk?.impact_breakdown || risk?.financial_impact_breakdown || asset.financial_impact || {};
  const dependencies = Array.isArray(asset.dependencies) ? asset.dependencies.join(', ') : 'Not available';
  const frameworks = Array.isArray(asset.applicable_frameworks) ? asset.applicable_frameworks.join(', ') : 'Not mapped';
  const impactRows = [['Breach exposure', impact.breach_inr], ['Downtime exposure', impact.downtime_inr], ['Regulatory exposure', impact.regulatory_inr], ['Reputation exposure', impact.reputation_inr], ['Total modeled impact', impact.total_inr]];
  return <div className="drawer-backdrop" onClick={onClose}><aside className="drawer" onClick={(event) => event.stopPropagation()}><button className="drawer-close" onClick={onClose} aria-label="Close asset details">×</button><p className="eyebrow">Asset drilldown</p><h2>{asset.hostname || asset.asset_id}</h2><p className="muted">{asset.asset_id} · {asset.business_unit || 'Unassigned'}</p><div className="drawer-metrics"><div><small>Risk score</small><strong>{risk?.score ?? asset.risk_score ?? 'Not available'}</strong></div><div><small>Asset EAL</small><strong>{displayMoney(risk?.eal_inr ?? asset.asset_eal_inr)}</strong></div></div><div className="detail-list"><div><span>Criticality</span><RiskBadge value={asset.criticality} /></div><div><span>Exposure</span><strong>{asset.internet_exposed ? 'Internet exposed' : 'Internal'}</strong></div><div><span>Downtime cost</span><strong>{hasValue(asset.hourly_downtime_cost_inr) ? `${money(asset.hourly_downtime_cost_inr)}/hr` : 'Not available'}</strong></div><div><span>Dependencies</span><strong>{dependencies}</strong></div><div><span>Frameworks</span><strong>{frameworks}</strong></div></div><div className="driver-list"><p className="eyebrow">Financial impact breakdown</p><div className="detail-list">{impactRows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{displayMoney(value)}</strong></div>)}</div></div><div className="driver-list"><p className="eyebrow">Blast-radius profile</p>{loading ? <div className="soft-note">Calculating dependency impact...</div> : profile ? <div className="detail-list"><div><span>Direct dependencies</span><strong>{profile.direct_dependencies?.length ?? 'Not available'}</strong></div><div><span>Reverse dependencies</span><strong>{profile.reverse_dependencies?.length ?? 'Not available'}</strong></div><div><span>Impacted assets</span><strong>{profile.impacted_asset_ids?.length ?? 'Not available'}</strong></div><div><span>Cycle detected</span><strong>{profile.cycle_detected === undefined ? 'Not available' : profile.cycle_detected ? 'Yes' : 'No'}</strong></div></div> : <div className="soft-note">Dependency profile unavailable.</div>}</div></aside></div>;
}

function VulnerabilitiesPage({ data }) {
  const [filter, setFilter] = useState('all');
  const items = data.vulnerabilities.filter((item) => filter === 'all' || String(item.severity).toLowerCase() === filter);
  return <section className="page-section"><div className="section-intro"><div><p className="eyebrow">Evidence inventory</p><h2>Findings</h2><p>Exploitability, age, and business context instead of a severity-only queue.</p></div><div className="filter-tabs">{['all', 'critical', 'high', 'medium'].map((value) => <button key={value} className={filter === value ? 'filter-tab active' : 'filter-tab'} onClick={() => setFilter(value)}>{value}</button>)}</div></div><div className="table-panel"><table><thead><tr><th>Finding</th><th>Asset</th><th>Source</th><th>CVSS</th><th>EPSS</th><th>Exploit signals</th><th>Patch age</th><th>Status</th></tr></thead><tbody>{items.length ? items.map((item, index) => <tr key={`${item.asset_id}-${item.cve}-${index}`}><td><strong>{item.cve || item.finding_id || item.finding_type || 'Not available'}</strong><small>{item.finding_type || 'finding'}{item.enrichment?.exploitability ? ` · ${item.enrichment.exploitability}` : ''}</small></td><td>{item.asset_id || 'Not available'}</td><td>{sourceLabel(item.source || item.source_kind || 'scanner')}</td><td><span className="score-cell">{hasValue(item.cvss) ? Number(item.cvss).toFixed(1) : 'N/A'}</span></td><td>{hasValue(item.epss) ? Number(item.epss).toFixed(2) : 'N/A'}</td><td><div className="signal-stack">{item.cisa_kev && <span className="signal danger">KEV</span>}{item.exploit_available && <span className="signal amber">Exploit</span>}{item.enrichment?.public_exploit && <span className="signal danger">Public</span>}</div></td><td>{hasValue(item.patch_age_days) ? `${item.patch_age_days} days` : 'Not available'}</td><td><RiskBadge value={item.status || item.severity} /></td></tr>) : <tr><td colSpan="8"><Empty title="No findings returned" copy="The live vulnerability inventory is empty." /></td></tr>}</tbody></table></div></section>;
}

function ControlsPage({ data }) {
  const [effectiveness, setEffectiveness] = useState([]);
  useEffect(() => { let active = true; api.controlEffectiveness().then((response) => { if (active) setEffectiveness(arr(payload(response))); }).catch(() => {}); return () => { active = false; }; }, []);
  const effectMap = Object.fromEntries(effectiveness.map((item) => [item.control_id, item]));
  return <section className="page-section"><div className="section-intro"><div><p className="eyebrow">Control portfolio</p><h2>Controls and remediations</h2><p>Admin-only view of cost, measured effectiveness, ownership, and regulatory mapping.</p></div><span className="stat-chip">{data.controls.length} candidate controls</span></div><div className="control-grid">{data.controls.length ? data.controls.map((control) => { const effect = effectMap[control.control_id] || control.effectiveness || control; const measured = effect.measured_effectiveness_pct ?? control.measured_effectiveness_pct; const claimed = effect.claimed_effectiveness_pct ?? control.claimed_effectiveness_pct ?? control.risk_reduction_pct; const frameworks = Array.isArray(control.compliance_frameworks) ? control.compliance_frameworks.join(' · ') : 'No framework map'; const evidence = typeof effect.evidence_source === 'string' ? effect.evidence_source : 'Evidence source not available'; return <article className="control-card" key={control.control_id}><div className="control-top"><span className="control-id">{control.control_id}</span><RiskBadge value={control.status?.replaceAll('_', ' ')} /></div><h3>{control.name}</h3><p>{control.description || 'No description provided.'}</p><div className="control-stats"><div><small>Cost</small><strong>{displayMoney(control.cost_inr)}</strong></div><div><small>Measured effectiveness</small><strong>{hasValue(measured) ? `${Number(measured).toFixed(0)}%` : 'N/A'}</strong></div></div><div className="control-evidence"><span>Claimed reduction {hasValue(claimed) ? `${Number(claimed).toFixed(0)}%` : 'Not available'}</span><span>Config {hasValue(effect.configuration_coverage_pct) ? `${Number(effect.configuration_coverage_pct).toFixed(0)}%` : 'N/A'} · Compliance {hasValue(effect.compliance_coverage_pct) ? `${Number(effect.compliance_coverage_pct).toFixed(0)}%` : 'N/A'}</span><small>{evidence}</small></div><div className="control-foot"><span>{control.owner || 'Unassigned'}</span><span>{frameworks}</span></div></article>; }) : <Empty title="No controls returned" copy="The live control portfolio is empty." />}</div></section>;
}

function AttacksPage({ data, onSimulate }) { return <section className="page-section"><div className="section-intro"><div><p className="eyebrow">SOC and governance bridge</p><h2>Attack watch</h2><p>Recent telemetry translated into an explainable attack signal for both technical and executive users.</p></div></div><LiveFeed events={data.events} full onSimulate={onSimulate} /></section>; }

function IncidentsPage({ data, onRefresh }) {
  const [form, setForm] = useState({ incident_id: '', asset_id: '', attack_type: '', compromise_status: 'suspected', affected_records: 0, total_records: 0, service_downtime_minutes: 0, evidence_confidence: .5 });
  const [message, setMessage] = useState('');
  const submit = async (event) => { event.preventDefault(); try { await api.createIncident({ ...form, affected_records: Number(form.affected_records), total_records: Number(form.total_records), service_downtime_minutes: Number(form.service_downtime_minutes), evidence_confidence: Number(form.evidence_confidence) }); setMessage('Incident logged.'); onRefresh(); } catch (err) { setMessage(err.message || 'Incident could not be saved.'); } };
  return <section className="page-section"><div className="section-intro"><div><p className="eyebrow">Governance record</p><h2>Incident ledger</h2><p>Record impact evidence so future quantification improves.</p></div></div><div className="content-grid two-col"><form className="panel form-panel" onSubmit={submit}><div className="panel-heading"><div><p className="eyebrow">New record</p><h2>Log incident</h2></div></div><div className="form-grid"><label>Incident ID<input value={form.incident_id} onChange={(e) => setForm({ ...form, incident_id: e.target.value })} required placeholder="INC-2026-001" /></label><label>Asset ID<input value={form.asset_id} onChange={(e) => setForm({ ...form, asset_id: e.target.value })} required placeholder="AST-CORE-01" /></label><label>Attack type<input value={form.attack_type} onChange={(e) => setForm({ ...form, attack_type: e.target.value })} placeholder="Credential stuffing" /></label><label>Status<select value={form.compromise_status} onChange={(e) => setForm({ ...form, compromise_status: e.target.value })}><option>suspected</option><option>confirmed</option><option>contained</option><option>closed</option></select></label><label>Affected records<input type="number" min="0" value={form.affected_records} onChange={(e) => setForm({ ...form, affected_records: e.target.value })} /></label><label>Downtime minutes<input type="number" min="0" value={form.service_downtime_minutes} onChange={(e) => setForm({ ...form, service_downtime_minutes: e.target.value })} /></label></div>{message && <div className={message === 'Incident logged.' ? 'success-box' : 'error-box'}>{message}</div>}<button className="button primary">Save incident evidence</button></form><div className="panel"><div className="panel-heading"><div><p className="eyebrow">Recent records</p><h2>Incident history</h2></div></div>{data.incidents.length ? data.incidents.map((incident) => <div className="incident-row" key={incident.incident_id}><div className="incident-symbol">!</div><div><strong>{incident.incident_id}</strong><small>{incident.attack_type || 'Attack type not available'} · {incident.asset_id || 'Unmapped asset'}</small></div><RiskBadge value={incident.compromise_status} /></div>) : <Empty title="No incidents recorded" copy="Incident evidence will appear here after the first record." />}</div></div></section>;
}

function OperationsDataPage({ data }) {
  const jobs = data.ingestionJobs.slice(0, 10); const pressure = data.attackPressure.slice(0, 8); const coverage = data.regulatoryCoverage; const scenarios = data.scenarios.slice(0, 8);
  return <section className="page-section"><div className="section-intro"><div><p className="eyebrow">Architecture observability</p><h2>Evidence pipeline</h2><p>Track source ingestion, observed attack pressure, dependency-aware exposure, and governance coverage in one operational surface.</p></div><span className="stat-chip">{jobs.length} recent jobs</span></div><div className="metric-grid"><Metric label="Completed jobs" value={jobs.filter((job) => job.status === 'completed').length} detail="MongoDB-backed ingestion status" tone="teal" /><Metric label="Pressure hotspots" value={pressure.filter((item) => ['elevated', 'critical'].includes(item.pressure_level)).length} detail="Assets with elevated telemetry" tone="red" /><Metric label="Frameworks mapped" value={coverage.length} detail="Regulatory coverage profiles" tone="blue" /><Metric label="Scenario records" value={scenarios.length} detail="Persisted what-if decisions" tone="amber" /></div><div className="content-grid two-col"><div className="panel"><div className="panel-heading"><div><p className="eyebrow">Source-to-finding pipeline</p><h2>Ingestion jobs</h2></div></div>{jobs.length ? <div className="ops-list">{jobs.map((job) => <div className="ops-row" key={job.job_id}><div><strong>{sourceLabel(job.source || job.source_kind || 'unknown source')}</strong><small>{job.job_id} · {job.record_count || 0} records · {job.failed_count || 0} failed</small></div><RiskBadge value={job.status || 'queued'} /><time>{formatDate(job.completed_at || job.createdAt)}</time></div>)}</div> : <Empty title="No ingestion jobs" copy="Scanner and telemetry adapters will appear here after their first run." />}</div><div className="panel"><div className="panel-heading"><div><p className="eyebrow">Attack-linked exposure</p><h2>Pressure hotspots</h2></div></div>{pressure.length ? <div className="ops-list">{pressure.map((item) => <div className="ops-row" key={item.asset_id}><div><strong>{item.asset_id}</strong><small>{item.signal_count || 0} signals · {item.pressure_level || 'Not available'} pressure</small></div><span className="pressure-score">{hasValue(item.pressure_score) ? Math.round(Number(item.pressure_score) * 100) : 'N/A'}</span></div>)}</div> : <Empty title="No pressure hotspots" copy="Attack pressure will appear after telemetry is correlated." />}</div></div></section>;
}

function OperationsPage({ data }) {
  const status = data.blockchainStatus || {};
  const network = status.network && typeof status.network === 'object' ? `${status.network.name || 'Unknown network'} (chain ${status.network.chain_id ?? '—'})` : status.network;
  return <><OperationsDataPage data={data} /><section className="page-section"><div className="panel"><div className="panel-heading"><div><p className="eyebrow">Trust infrastructure</p><h2>Blockchain anchor status</h2></div><span className="status-pill"><span className="pulse-dot" />{status.reachable ? 'Reachable' : status.configured ? 'Configured, unavailable' : 'Not configured'}</span></div><div className="detail-list"><div><span>Provider</span><strong>{network || status.rpc_url || 'Not available'}</strong></div><div><span>Wallet</span><strong>{status.wallet_address || status.signer || 'Not available'}</strong></div><div><span>Latest block</span><strong>{status.block_number ?? 'Not available'}</strong></div><div><span>Purpose</span><strong>Report hash anchoring and tamper verification</strong></div></div></div></section></>;
}

function AccessDenied() { return <div className="page-state error-state"><strong>This view is not available for your role.</strong><span>Access is intentionally separated between executive, analyst, and read-only workspaces.</span></div>; }

export default function AppV2() {
  const { user } = useAuth();
  const { data, loading, error, syncedAt, refresh } = useWorkspaceData();
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  useEffect(() => { if (!notice) return undefined; const timer = setTimeout(() => setNotice(null), 6000); return () => clearTimeout(timer); }, [notice]);
  const onSimulate = async () => { if (isDemoMode()) { await api.simulateAttack(); refresh(); } };
  const demoAction = user.role === 'viewer' ? undefined : onSimulate;
  const runAnalysis = async () => { setAnalysisBusy(true); try { await api.runAnalysis({ reason: 'Frontend Dashboard Manual Trigger' }); setNotice({ kind: 'success', text: 'Analysis accepted. It runs asynchronously; refresh after results arrive.' }); } catch (err) { setNotice({ kind: 'error', text: err.message || 'Analysis could not be started.' }); } finally { setAnalysisBusy(false); } };
  const dashboard = user.role === 'viewer' ? <ViewerDashboard data={data} /> : user.role === 'analyst' ? <TechnicalDashboard data={data} onSimulate={demoAction} /> : <><ExecutiveDashboard data={data} onSimulate={demoAction} /><section className="content-grid two-col admin-analytics"><PortfolioLevels /><ForecastPanel /></section></>;
  if (loading) return <div className="loading-screen"><span className="spinner" /> Loading secure workspace...</div>;
  return <Shell syncedAt={syncedAt} onRefresh={refresh} onRunAnalysis={runAnalysis} analysisBusy={analysisBusy} notice={notice}><>{error && <div className="page-state error-state"><strong>Some live backend data is unavailable.</strong><span>{error}</span></div>}<Routes><Route path="/" element={dashboard} /><Route path="/attacks" element={<AttacksPage data={data} onSimulate={demoAction} />} /><Route path="/assets" element={<AssetsPage data={data} />} /><Route path="/vulnerabilities" element={user.role === 'viewer' ? <AccessDenied /> : <VulnerabilitiesPage data={data} />} /><Route path="/investment" element={user.role === 'admin' ? <InvestmentPageV2 data={data} /> : <Navigate to="/" replace />} /><Route path="/controls" element={user.role === 'admin' ? <ControlsPage data={data} /> : <Navigate to="/" replace />} /><Route path="/audit" element={user.role === 'viewer' || user.role === 'admin' ? <AuditPageV2 data={data} canTamper={user.role === 'admin'} /> : <Navigate to="/" replace />} /><Route path="/operations" element={user.role === 'viewer' ? <Navigate to="/" replace /> : <OperationsPage data={data} />} /><Route path="/analyst" element={user.role === 'viewer' ? <Navigate to="/" replace /> : <AnalystPageV2 />} /><Route path="/incidents" element={user.role === 'viewer' ? <Navigate to="/" replace /> : <IncidentsPage data={data} onRefresh={refresh} />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></></Shell>;
}
