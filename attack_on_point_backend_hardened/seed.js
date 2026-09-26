require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');

const Settings = require('./src/models/Settings');
const Asset = require('./src/models/Asset');
const Vulnerability = require('./src/models/Vulnerability');
const Control = require('./src/models/Control');
const Risk = require('./src/models/Risk');
const RiskHistory = require('./src/models/RiskHistory');
const RiskAudit = require('./src/models/RiskAudit');
const { calculateRiskForAsset } = require('./src/services/riskCalculation.service');
const { canonicalizeFrameworks } = require('./src/services/framework.service');
const { applyLocalEnrichment } = require('./src/services/enrichment.service');
const { calculateControlEffectiveness } = require('./src/services/controlEffectiveness.service');

const tierToCriticality = { 1: 'critical', 2: 'high', 3: 'medium', 4: 'low' };
const replaceMode = process.argv.includes('--replace');
const defaultDependencies = {
  'Net Banking / Customer Portal': ['AST-10101', 'AST-10001'],
  'Core Banking / Payment Gateway': ['AST-10001'],
  'ATM Network Switch': ['AST-10101'],
  'Enterprise ERP & HR Payroll': ['AST-10001'],
  'Corporate Email / Webmail Server': [],
  'Employee Endpoint / Workstation': ['AST-30201']
};

const upsert = (model, filter, document) => model.findOneAndUpdate(
  filter,
  { $set: document },
  { upsert: true, new: true, setDefaultsOnInsert: true }
);

const stableNumber = (value, modulo) => Number.parseInt(crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 8), 16) % modulo;

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
    settings.sector =rawData.metadata?.sector || 'Banking & Financial Services';
    settings.profile =rawData.metadata?.organization || 'Enterprise NeoBank';
    settings.enterprise_budget_inr = Number(rawData.enterprise_budget_constraint_inr) || 0;
    settings.dataset_name = datasetName;
    settings.dataset_version = datasetVersion;
    settings.dataset_source = datasetSource;
    await settings.save();

    const controlDocs = (rawData.available_remediations_catalog || []).map((ctrl, index) => {
      const control = {
      control_id: ctrl.id,
      name: ctrl.title,
      category: ctrl.framework || '',
      status: 'not_implemented',
      cost_inr: Number(ctrl.cost_inr) || 0,
      target_asset_id: '',
      risk_reduction_pct: (Number(ctrl.effectiveness) || 0) * 100,
      claimed_effectiveness: (Number(ctrl.effectiveness) || 0) * 100,
      configuration_coverage: 78 + ((index * 7) % 18),
      compliance_coverage: 82 + ((index * 5) % 15),
      incident_history: [],
      incident_history_count: 0,
      compliance_frameworks: canonicalizeFrameworks(ctrl.framework ? ctrl.framework.split('/').map((item) => item.trim()) : []),
      data_source: datasetSource,
      dataset_version: datasetVersion,
      evidence_source: `synthetic-control-evidence:${datasetSource}`,
      evidence_id: `CTRL-EVID-${ctrl.id}`,
      evidence_confidence: 0.9,
      evidence_timestamp: rawData.metadata?.generated_at || new Date()
      };
      return { ...control, ...calculateControlEffectiveness(control) };
    });
    for (const control of controlDocs) await upsert(Control, { control_id: control.control_id }, control);

    let totalVulnerabilities = 0;
    let totalEal = 0;
    let totalVar = 0;
    const assetSnapshots = [];

    for (const sourceAsset of rawData.assets || []) {
      const assetDoc = {
        asset_id: sourceAsset.asset_id,
        hostname: sourceAsset.hostname || '',
        ip_address: sourceAsset.ip_address || '',
        asset_type: sourceAsset.asset_type || '',
        business_function: sourceAsset.business_function || sourceAsset.asset_type || '',
        business_unit: sourceAsset.business_unit || (sourceAsset.asset_type?.includes('Banking') ? 'Core Banking' : 'Enterprise IT'),
        criticality: tierToCriticality[sourceAsset.tier] || sourceAsset.criticality || 'medium',
        internet_exposed: Boolean(sourceAsset.is_internet_facing ?? sourceAsset.internet_exposed),
        hourly_downtime_cost_inr: Number(sourceAsset.hourly_downtime_cost_inr) || 0,
        total_records: Number(sourceAsset.stored_records_count ?? sourceAsset.total_records) || 0,
        cost_per_record_inr: Number(sourceAsset.cost_per_breached_record ?? sourceAsset.cost_per_record_inr) || 0,
        regulatory_penalty_inr: sourceAsset.regulatory_penalty_inr ?? ((tierToCriticality[sourceAsset.tier] === 'critical' ? 400000 : tierToCriticality[sourceAsset.tier] === 'high' ? 300000 : 150000) + stableNumber(`${sourceAsset.asset_id}:regulatory`, 5) * 25000),
        reputation_loss_inr: sourceAsset.reputation_loss_inr ?? ((tierToCriticality[sourceAsset.tier] === 'critical' ? 300000 : tierToCriticality[sourceAsset.tier] === 'high' ? 225000 : 100000) + stableNumber(`${sourceAsset.asset_id}:reputation`, 5) * 15000),
        active_controls: sourceAsset.active_controls || [],
        applicable_frameworks: sourceAsset.applicable_frameworks || [],
        dependencies: sourceAsset.dependencies?.length ? sourceAsset.dependencies : (defaultDependencies[sourceAsset.asset_type] || []),
        data_classification: sourceAsset.data_classification || '',
        cmdb_source: sourceAsset.cmdb_source || 'synthetic-cmdb',
        cmdb_record_id: sourceAsset.cmdb_record_id || `CMDB-${sourceAsset.asset_id}`,
        inventory_source: sourceAsset.inventory_source || 'synthetic-inventory',
        inventory_record_id: sourceAsset.inventory_record_id || `INV-${sourceAsset.asset_id}`,
        last_inventory_sync_at: sourceAsset.last_inventory_sync_at || rawData.metadata?.generated_at || new Date(),
        provenance: {
          source: datasetSource,
          dataset_version: datasetVersion,
          cmdb: { source: sourceAsset.cmdb_source || 'synthetic-cmdb', record_id: sourceAsset.cmdb_record_id || `CMDB-${sourceAsset.asset_id}` },
          inventory: { source: sourceAsset.inventory_source || 'synthetic-inventory', record_id: sourceAsset.inventory_record_id || `INV-${sourceAsset.asset_id}` }
        },
        data_source: datasetSource,
        dataset_version: datasetVersion
      };
      const asset = await upsert(Asset, { asset_id: assetDoc.asset_id }, assetDoc);

      for (const sourceVulnerability of sourceAsset.vulnerabilities || []) {
        const cvss = Number(sourceVulnerability.cvss_score ?? sourceVulnerability.cvss) || 0;
      const vulnDoc = {
        finding_id: `FND-${sourceAsset.asset_id}-${sourceVulnerability.vuln_id || sourceVulnerability.cve_id || sourceVulnerability.cve || sourceVulnerability.finding_type || 'finding'}`,
        asset_id: sourceAsset.asset_id,
        source: sourceVulnerability.source || datasetSource,
        source_finding_id: sourceVulnerability.id || sourceVulnerability.vuln_id || sourceVulnerability.cve_id || sourceVulnerability.cve || '',
        title: sourceVulnerability.title || sourceVulnerability.name || sourceVulnerability.finding_type || 'Vulnerability finding',
        description: sourceVulnerability.description || '',
        attack_vector: sourceVulnerability.attack_vector || '',
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
        observed_at: sourceVulnerability.observed_at || rawData.metadata?.generated_at || new Date(),
        first_seen_at: sourceVulnerability.first_seen_at || rawData.metadata?.generated_at || new Date(),
        last_seen_at: sourceVulnerability.last_seen_at || rawData.metadata?.generated_at || new Date(),
        regulatory_refs: canonicalizeFrameworks(Array.isArray(sourceVulnerability.regulatory_refs) && sourceVulnerability.regulatory_refs.length ? sourceVulnerability.regulatory_refs : (sourceVulnerability.remediation_options || []).map((option) => option.framework)),
        enrichment_status: 'local',
        enrichment_version: 'local-v1',
        data_source: datasetSource,
          dataset_version: datasetVersion
        };
        await upsert(Vulnerability, { finding_id: vulnDoc.finding_id }, applyLocalEnrichment(vulnDoc));
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
      scenario_id: `SEED-${datasetVersion}`,
      scenario_type: 'actual',
      scenario_name: 'Seeded deterministic baseline',
      trigger_reason: 'Dataset seed',
      input_snapshot_hash: require('crypto').createHash('sha256').update(JSON.stringify(rawData)).digest('hex'),
      finding_snapshot_hash: require('crypto').createHash('sha256').update(JSON.stringify(rawData.assets?.map((asset) => asset.vulnerabilities || []) || [])).digest('hex'),
      assumptions: { dataset_name: datasetName, dataset_version: datasetVersion, source: datasetSource },
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
