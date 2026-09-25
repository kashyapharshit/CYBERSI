require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const Settings = require('./src/models/Settings');
const Asset = require('./src/models/Asset');
const Vulnerability = require('./src/models/Vulnerability');
const Control = require('./src/models/Control');
const Risk = require('./src/models/Risk');
const RiskHistory = require('./src/models/RiskHistory');
const RiskAudit = require('./src/models/RiskAudit');
const { calculateRiskForAsset } = require('./src/services/riskCalculation.service');

const tierToCriticality = { 1: 'critical', 2: 'high', 3: 'medium', 4: 'low' };
const replaceMode = process.argv.includes('--replace');

const upsert = (model, filter, document) => model.findOneAndUpdate(
  filter,
  { $set: document },
  { upsert: true, new: true, setDefaultsOnInsert: true }
);

const runSeed = async () => {
  try {
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not configured');

    const jsonPath = path.join(__dirname, 'synthetic_enterprise_telemetry.json');
    if (!fs.existsSync(jsonPath)) throw new Error(`File not found: ${jsonPath}`);
    const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const datasetName = rawData.metadata?.organization || 'synthetic-enterprise-telemetry';
    const datasetVersion = process.env.DATASET_VERSION || rawData.metadata?.generated_at || 'synthetic-v1';
    const datasetSource = path.basename(jsonPath);

    console.log('[Seed] Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);

    if (replaceMode) {
      // Replace only dataset-derived collections. Users and live telemetry remain intact.
      await Promise.all([
        Asset.deleteMany({}),
        Vulnerability.deleteMany({}),
        Control.deleteMany({}),
        Risk.deleteMany({}),
        RiskHistory.deleteMany({}),
        RiskAudit.deleteMany({})
      ]);
      console.log('[Seed] Dataset-derived collections cleared (--replace).');
    }

    const settings = await Settings.getSettings();
    settings.enterprise_budget_inr = Number(rawData.enterprise_budget_constraint_inr) || 0;
    settings.dataset_name = datasetName;
    settings.dataset_version = datasetVersion;
    settings.dataset_source = datasetSource;
    await settings.save();

    const controlDocs = (rawData.available_remediations_catalog || []).map((ctrl) => ({
      control_id: ctrl.id,
      name: ctrl.title,
      category: ctrl.framework || '',
      status: 'not_implemented',
      cost_inr: Number(ctrl.cost_inr) || 0,
      target_asset_id: '',
      risk_reduction_pct: (Number(ctrl.effectiveness) || 0) * 100,
      compliance_frameworks: ctrl.framework ? ctrl.framework.split('/').map((item) => item.trim()) : [],
      data_source: datasetSource,
      dataset_version: datasetVersion
    }));
    for (const control of controlDocs) await upsert(Control, { control_id: control.control_id }, control);

    let totalVulnerabilities = 0;
    let totalEal = 0;
    let totalVar = 0;
    const assetSnapshots = [];

    for (const sourceAsset of rawData.assets || []) {
      const assetDoc = {
        asset_id: sourceAsset.asset_id,
        hostname: sourceAsset.hostname || '',
        asset_type: sourceAsset.asset_type || '',
        business_function: sourceAsset.business_function || sourceAsset.asset_type || '',
        business_unit: sourceAsset.business_unit || (sourceAsset.asset_type?.includes('Banking') ? 'Core Banking' : 'Enterprise IT'),
        criticality: tierToCriticality[sourceAsset.tier] || sourceAsset.criticality || 'medium',
        internet_exposed: Boolean(sourceAsset.is_internet_facing ?? sourceAsset.internet_exposed),
        hourly_downtime_cost_inr: Number(sourceAsset.hourly_downtime_cost_inr) || 0,
        total_records: Number(sourceAsset.stored_records_count ?? sourceAsset.total_records) || 0,
        cost_per_record_inr: Number(sourceAsset.cost_per_breached_record ?? sourceAsset.cost_per_record_inr) || 0,
        active_controls: sourceAsset.active_controls || [],
        applicable_frameworks: sourceAsset.applicable_frameworks || [],
        dependencies: sourceAsset.dependencies || [],
        data_source: datasetSource,
        dataset_version: datasetVersion
      };
      const asset = await upsert(Asset, { asset_id: assetDoc.asset_id }, assetDoc);

      for (const sourceVulnerability of sourceAsset.vulnerabilities || []) {
        const cvss = Number(sourceVulnerability.cvss_score ?? sourceVulnerability.cvss) || 0;
        const vulnDoc = {
          asset_id: sourceAsset.asset_id,
          finding_type: sourceVulnerability.finding_type || 'cve',
          cve: sourceVulnerability.cve_id || sourceVulnerability.cve || '',
          cvss,
          severity: cvss >= 9 ? 'critical' : cvss >= 7 ? 'high' : cvss >= 4 ? 'medium' : 'low',
          exploit_available: Boolean(sourceVulnerability.exploit_available || sourceVulnerability.cisa_kev),
          epss: Number(sourceVulnerability.epss_score ?? sourceVulnerability.epss) || 0,
          cisa_kev: Boolean(sourceVulnerability.cisa_kev),
          patch_age_days: Number(sourceVulnerability.patch_age_days) || 0,
          patch_available_date: sourceVulnerability.patch_available_date || null,
          status: sourceVulnerability.status || 'open',
          owner: sourceVulnerability.owner || 'Unassigned',
          remediation_options: sourceVulnerability.remediation_options || [],
          data_source: datasetSource,
          dataset_version: datasetVersion
        };
        await upsert(Vulnerability, { asset_id: vulnDoc.asset_id, cve: vulnDoc.cve }, vulnDoc);
        totalVulnerabilities += 1;
      }

      const vulnerabilities = await Vulnerability.find({ asset_id: asset.asset_id }).lean();
      const risk = calculateRiskForAsset(asset.toObject(), vulnerabilities);
      await upsert(Risk, { asset_id: risk.asset_id }, risk);
      await Asset.updateOne({ asset_id: asset.asset_id }, {
        $set: {
          asset_eal_inr: risk.eal_inr,
          asset_var_inr: risk.var_inr,
          risk_score: risk.score,
          risk_level: risk.level,
          data_source: datasetSource,
          dataset_version: datasetVersion
        }
      });
      totalEal += risk.eal_inr;
      totalVar += risk.var_inr;
      assetSnapshots.push({
        asset_id: risk.asset_id,
        score: risk.score,
        level: risk.level,
        eal_inr: risk.eal_inr,
        var_inr: risk.var_inr
      });
    }

    const assetCount = (rawData.assets || []).length;
    settings.total_expected_annual_loss_inr = totalEal;
    settings.value_at_risk_inr = totalVar;
    settings.recommended_control_ids = [];
    settings.executive_summary = `Seeded ${assetCount} assets and ${totalVulnerabilities} vulnerabilities from ${datasetSource}; deterministic baseline risk is ${Math.round(totalEal)} INR EAL.`;
    await settings.save();

    await RiskHistory.create({
      total_expected_annual_loss_inr: totalEal,
      value_at_risk_inr: totalVar,
      asset_snapshots: assetSnapshots
    });

    console.log(`[Seed] ${replaceMode ? 'Replaced' : 'Synchronized'} ${assetCount} assets, ${totalVulnerabilities} vulnerabilities, and ${controlDocs.length} controls.`);
    console.log(`[Seed] Baseline EAL: ₹${totalEal}; VaR: ₹${totalVar}; dataset: ${datasetName} (${datasetVersion}).`);
  } catch (error) {
    console.error(`[Seed Error] ${error.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

runSeed();
