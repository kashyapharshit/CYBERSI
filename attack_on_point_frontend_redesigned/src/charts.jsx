import { compactMoney, formatDate } from './api';

function points(values, width, height, padding = 24) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  return values.map((value, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(values.length - 1, 1);
    const y = height - padding - ((value - min) / span) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');
}

export function LineChart({ data = [], valueKey = 'total_expected_annual_loss_inr', color = '#00d4ff', label = 'EAL' }) {
  const values = data.map((item) => Number(item[valueKey] || 0));
  if (!values.length) return <div className="chart-empty">No trend data yet</div>;
  const width = 720;
  const height = 230;
  const line = points(values, width, height);
  const area = `${line} ${width - 24},${height - 24} 24,${height - 24}`;
  return <div className="chart-wrap"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label} trend chart`}><defs><linearGradient id={`fill-${valueKey}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".28" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs><line x1="24" y1="24" x2="24" y2="206" stroke="#e2ebe7" /><line x1="24" y1="206" x2="696" y2="206" stroke="#e2ebe7" /><polygon points={area} fill={`url(#fill-${valueKey})`} /><polyline points={line} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />{values.map((value, index) => { const [x, y] = points(values, width, height).split(' ')[index].split(','); return <circle key={index} cx={x} cy={y} r="4" fill="white" stroke={color} strokeWidth="3" />; })}</svg><div className="chart-foot"><span>{formatDate(data[0]?.timestamp)}</span><strong>{label}: {compactMoney(values[values.length - 1])}</strong><span>{formatDate(data[data.length - 1]?.timestamp)}</span></div></div>;
}

export function BarChart({ items = [], labelKey = 'hostname', valueKey = 'risk_score', color = '#0c8275' }) {
  const max = Math.max(...items.map((item) => Number(item[valueKey] || 0)), 1);
  if (!items.length) return <div className="chart-empty">No comparison data yet</div>;
  return <div className="bar-chart">{items.slice(0, 6).map((item, index) => { const value = Number(item[valueKey] || 0); return <div className="bar-chart-row" key={item.asset_id || index}><div className="bar-chart-label"><span>{item[labelKey] || item.asset_id || 'Asset'}</span><strong>{value}</strong></div><div className="bar-chart-track"><span style={{ width: `${(value / max) * 100}%`, background: color }} /></div></div>; })}</div>;
}

export function DonutChart({ critical = 0, high = 0, medium = 0, low = 0 }) {
  const total = critical + high + medium + low || 1;
  const c = (critical / total) * 100;
  const h = (high / total) * 100;
  const m = (medium / total) * 100;
  return <div className="donut-layout"><div className="donut" style={{ background: `conic-gradient(#bf4a4a 0 ${c}%, #b76a18 ${c}% ${c + h}%, #547fc9 ${c + h}% ${c + h + m}%, #86b5a8 ${c + h + m}% 100%)` }}><div><strong>{total}</strong><small>findings</small></div></div><div className="donut-legend"><span><i className="legend-dot red" />Critical <strong>{critical}</strong></span><span><i className="legend-dot amber" />High <strong>{high}</strong></span><span><i className="legend-dot blue" />Medium <strong>{medium}</strong></span><span><i className="legend-dot teal" />Low <strong>{low}</strong></span></div></div>;
}

export function CoverageBars({ frameworks = {} }) {
  const entries = Object.entries(frameworks);
  if (!entries.length) return <div className="chart-empty">No framework evidence yet</div>;
  return <div className="coverage-chart">{entries.map(([name, value]) => { const pct = Number(value?.coverage_pct ?? value ?? 0); return <div className="coverage-row" key={name}><div><span>{name}</span><strong>{Math.round(pct)}%</strong></div><div className="bar"><span style={{ width: `${Math.min(100, pct)}%` }} /></div></div>; })}</div>;
}
