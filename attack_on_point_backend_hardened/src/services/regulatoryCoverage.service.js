const Asset = require('../models/Asset');
const Vulnerability = require('../models/Vulnerability');
const Control = require('../models/Control');
const { canonicalizeFramework } = require('./framework.service');

const getRegulatoryCoverage = async () => {
  const [assets, vulnerabilities, controls] = await Promise.all([
    Asset.find().lean(),
    Vulnerability.find({ status: { $ne: 'fixed' } }).lean(),
    Control.find().lean()
  ]);
  const frameworks = {};
  for (const control of controls) {
    for (const framework of control.compliance_frameworks || []) {
      const key = canonicalizeFramework(framework);
      if (!key) continue;
      frameworks[key] ||= { framework: key, total_controls: 0, implemented_controls: 0, partial_controls: 0, mapped_assets: 0, open_findings: 0 };
      frameworks[key].total_controls += 1;
      if (control.status === 'implemented') frameworks[key].implemented_controls += 1;
      if (control.status === 'partial') frameworks[key].partial_controls += 1;
    }
  }
  for (const item of Object.values(frameworks)) {
    item.coverage_pct = item.total_controls ? Number((((item.implemented_controls + item.partial_controls * 0.5) / item.total_controls) * 100).toFixed(2)) : 0;
    item.mapped_assets = assets.filter((asset) => (asset.applicable_frameworks || []).some((framework) => canonicalizeFramework(framework) === item.framework)).length;
    item.open_findings = vulnerabilities.filter((finding) => (finding.regulatory_refs || []).some((framework) => canonicalizeFramework(framework) === item.framework)).length;
  }
  return Object.values(frameworks).sort((a, b) => b.coverage_pct - a.coverage_pct);
};

module.exports = { getRegulatoryCoverage };
