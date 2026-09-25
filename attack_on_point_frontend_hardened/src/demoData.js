const ago = (minutes) => new Date(Date.now() - minutes * 60000).toISOString();

export const DEMO_USERS = {
  'admin@demo.attackonpoint.local': { email: 'admin@demo.attackonpoint.local', password: 'admin1234', name: 'Demo CISO', role: 'admin' },
  'analyst@demo.attackonpoint.local': { email: 'analyst@demo.attackonpoint.local', password: 'analyst1234', name: 'Demo Analyst', role: 'analyst' },
  'viewer@demo.attackonpoint.local': { email: 'viewer@demo.attackonpoint.local', password: 'viewer1234', name: 'Demo Board Viewer', role: 'viewer' }
};

export const demoData = {
  settings: {
    enterprise_budget_inr: 2000000,
    total_expected_annual_loss_inr: 82000000,
    value_at_risk_inr: 110000000,
    recommended_control_ids: ['CTRL-PATCH-01', 'CTRL-MFA-01', 'CTRL-EDR-01'],
    executive_summary: 'The largest exposure is concentrated in internet-facing payment and identity assets. A budget-constrained patching, MFA, and EDR portfolio provides the highest measurable reduction.',
  },
  assets: [
    { asset_id: 'AST-CORE-01', hostname: 'payments-api.prod', business_unit: 'Core Banking', criticality: 'critical', internet_exposed: true, hourly_downtime_cost_inr: 48000, total_records: 180000, cost_per_record_inr: 260, asset_eal_inr: 32000000, risk_score: 92, risk_level: 'critical', applicable_frameworks: ['RBI', 'NIST CSF'], dependencies: ['AST-IDENT-01'] },
    { asset_id: 'AST-IDENT-01', hostname: 'identity-gateway.prod', business_unit: 'Identity', criticality: 'critical', internet_exposed: true, hourly_downtime_cost_inr: 35000, total_records: 180000, cost_per_record_inr: 220, asset_eal_inr: 21000000, risk_score: 86, risk_level: 'high', applicable_frameworks: ['RBI', 'ISO 27001'], dependencies: [] },
    { asset_id: 'AST-DATA-01', hostname: 'customer-data-vault', business_unit: 'Data Platform', criticality: 'high', internet_exposed: false, hourly_downtime_cost_inr: 22000, total_records: 460000, cost_per_record_inr: 180, asset_eal_inr: 14000000, risk_score: 74, risk_level: 'high', applicable_frameworks: ['SEBI', 'ISO 27001'], dependencies: [] },
    { asset_id: 'AST-STAFF-01', hostname: 'employee-endpoint-fleet', business_unit: 'Corporate IT', criticality: 'medium', internet_exposed: false, hourly_downtime_cost_inr: 8000, total_records: 0, cost_per_record_inr: 0, asset_eal_inr: 7000000, risk_score: 58, risk_level: 'medium', applicable_frameworks: ['CIS Controls'], dependencies: [] },
    { asset_id: 'AST-DR-01', hostname: 'disaster-recovery-vault', business_unit: 'Resilience', criticality: 'high', internet_exposed: false, hourly_downtime_cost_inr: 14000, total_records: 180000, cost_per_record_inr: 120, asset_eal_inr: 8000000, risk_score: 63, risk_level: 'medium', applicable_frameworks: ['NIST CSF'], dependencies: [] },
  ],
  vulnerabilities: [
    { asset_id: 'AST-CORE-01', finding_type: 'cve', cve: 'CVE-2024-3094', cvss: 10, epss: 0.96, cisa_kev: true, exploit_available: true, severity: 'critical', status: 'open', patch_age_days: 19 },
    { asset_id: 'AST-IDENT-01', finding_type: 'cve', cve: 'CVE-2023-34362', cvss: 9.8, epss: 0.89, cisa_kev: true, exploit_available: true, severity: 'critical', status: 'open', patch_age_days: 41 },
    { asset_id: 'AST-CORE-01', finding_type: 'web', cve: 'WEB-SQL-001', cvss: 9.1, epss: 0.76, cisa_kev: false, exploit_available: true, severity: 'high', status: 'open', patch_age_days: 12 },
    { asset_id: 'AST-DATA-01', finding_type: 'cve', cve: 'CVE-2022-22965', cvss: 8.1, epss: 0.54, cisa_kev: true, exploit_available: true, severity: 'high', status: 'in_progress', patch_age_days: 28 },
    { asset_id: 'AST-STAFF-01', finding_type: 'configuration', cve: '', cvss: 6.5, epss: 0.17, cisa_kev: false, exploit_available: false, severity: 'medium', status: 'open', patch_age_days: 33 },
  ],
  controls: [
    { control_id: 'CTRL-PATCH-01', name: 'Critical patching SLA: 48 hours', status: 'partial', owner: 'Infrastructure', cost_inr: 700000, risk_reduction_pct: 34, description: 'Automated remediation workflow for KEV and critical findings.', compliance_frameworks: ['CIS Controls', 'NIST CSF', 'RBI'] },
    { control_id: 'CTRL-MFA-01', name: 'Phishing-resistant MFA', status: 'partial', owner: 'Identity', cost_inr: 480000, risk_reduction_pct: 28, description: 'Hardware-backed MFA for privileged and internet-facing access.', compliance_frameworks: ['RBI', 'ISO 27001'] },
    { control_id: 'CTRL-EDR-01', name: 'Endpoint detection and response', status: 'implemented', owner: 'SOC', cost_inr: 620000, risk_reduction_pct: 22, description: 'Endpoint telemetry and response playbooks for suspicious execution.', compliance_frameworks: ['CIS Controls', 'SEBI'] },
    { control_id: 'CTRL-SEG-01', name: 'Payment zone microsegmentation', status: 'not_implemented', owner: 'Network', cost_inr: 900000, risk_reduction_pct: 19, description: 'Limit lateral movement from identity and staff networks.', compliance_frameworks: ['NIST CSF', 'ISO 27001'] },
  ],
  risks: [
    { asset_id: 'AST-CORE-01', score: 92, level: 'critical', eal_inr: 32000000, var_inr: 44000000, drivers: [{ factor: 'KEV + exploitability', contribution: 0.34, explanation: 'Actively exploited vulnerability increases likelihood.' }, { factor: 'Internet exposure', contribution: 0.21, explanation: 'Payment API is reachable from the public internet.' }, { factor: 'Asset criticality', contribution: 0.25, explanation: 'Core payment function has high business impact.' }] },
    { asset_id: 'AST-IDENT-01', score: 86, level: 'high', eal_inr: 21000000, var_inr: 29000000, drivers: [{ factor: 'KEV + patch age', contribution: 0.31, explanation: 'Critical finding has remained open for 41 days.' }, { factor: 'Internet exposure', contribution: 0.22, explanation: 'Identity gateway is externally reachable.' }] },
    { asset_id: 'AST-DATA-01', score: 74, level: 'high', eal_inr: 14000000, var_inr: 19000000, drivers: [{ factor: 'Records at risk', contribution: 0.29, explanation: 'Large customer record volume increases impact.' }] },
    { asset_id: 'AST-STAFF-01', score: 58, level: 'medium', eal_inr: 7000000, var_inr: 10000000, drivers: [{ factor: 'Control gap', contribution: 0.18, explanation: 'Endpoint control evidence is incomplete.' }] },
    { asset_id: 'AST-DR-01', score: 63, level: 'medium', eal_inr: 8000000, var_inr: 11000000, drivers: [{ factor: 'Dependency concentration', contribution: 0.17, explanation: 'Recovery services depend on identity availability.' }] },
  ],
  events: [
    { _id: 'EV-001', type: 'wazuh', source: 'Wazuh', event_type: 'multiple_failed_logins', severity: 'critical', asset_id: 'AST-IDENT-01', source_ip: '185.22.14.8', endpoint: '/auth/login', failed_attempts: 320, observed_at: ago(2) },
    { _id: 'EV-002', type: 'burp', source: 'Burp Suite', event_type: 'SQL Injection', severity: 'high', asset_id: 'AST-CORE-01', source_ip: '103.44.19.7', endpoint: '/api/payments', observed_at: ago(8) },
    { _id: 'EV-003', type: 'openvas', source: 'OpenVAS', event_type: 'CVE-2024-3094 detected', severity: 'critical', asset_id: 'AST-CORE-01', endpoint: '443/tcp', observed_at: ago(16) },
    { _id: 'EV-004', type: 'edr', source: 'EDR', event_type: 'suspicious_process', severity: 'medium', asset_id: 'AST-STAFF-01', endpoint: 'laptop-042', observed_at: ago(31) },
    { _id: 'EV-005', type: 'nmap', source: 'Nmap', event_type: 'port_scan', severity: 'medium', asset_id: 'AST-DR-01', source_ip: '172.16.10.8', endpoint: '22,443/tcp', observed_at: ago(47) },
  ],
  incidents: [{ incident_id: 'INC-DEMO-001', asset_id: 'AST-IDENT-01', attack_type: 'Credential stuffing', compromise_status: 'suspected', affected_records: 0, service_downtime_minutes: 0, evidence_confidence: 0.72 }],
  trend: [
    { timestamp: ago(180), total_expected_annual_loss_inr: 101000000, value_at_risk_inr: 128000000 },
    { timestamp: ago(150), total_expected_annual_loss_inr: 97000000, value_at_risk_inr: 124000000 },
    { timestamp: ago(120), total_expected_annual_loss_inr: 94000000, value_at_risk_inr: 121000000 },
    { timestamp: ago(90), total_expected_annual_loss_inr: 91000000, value_at_risk_inr: 119000000 },
    { timestamp: ago(60), total_expected_annual_loss_inr: 87000000, value_at_risk_inr: 114000000 },
    { timestamp: ago(30), total_expected_annual_loss_inr: 85000000, value_at_risk_inr: 112000000 },
    { timestamp: ago(0), total_expected_annual_loss_inr: 82000000, value_at_risk_inr: 110000000 },
  ],
  audit: {
    report_generated_at: new Date().toISOString(),
    organization: 'Suryoday NeoBank Ltd (Demo)',
    summary: { total_assets_monitored: 5, open_vulnerabilities_count: 5, critical_unpatched_cves: 2 },
    regulatory_compliance_breakdown: { RBI: { coverage_pct: 68 }, 'ISO 27001': { coverage_pct: 74 }, 'NIST CSF': { coverage_pct: 71 }, 'CIS Controls': { coverage_pct: 63 }, SEBI: { coverage_pct: 76 } },
  },
};

export function cloneDemoData() {
  return JSON.parse(JSON.stringify(demoData));
}

export function loadDemoData() {
  try {
    const stored = localStorage.getItem('aop.demo.data');
    return stored ? JSON.parse(stored) : cloneDemoData();
  } catch {
    return cloneDemoData();
  }
}

export function saveDemoData(data) {
  localStorage.setItem('aop.demo.data', JSON.stringify(data));
  return data;
}
