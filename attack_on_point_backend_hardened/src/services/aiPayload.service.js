const Settings = require('../models/Settings');
const Asset = require('../models/Asset');
const Vulnerability = require('../models/Vulnerability');
const Control = require('../models/Control');
const SecurityEvent = require('../models/SecurityEvent');
const Incident = require('../models/Incident'); // Fix #12
const Risk = require('../models/Risk');
const RiskHistory = require('../models/RiskHistory'); // Fix #5
const RiskAudit = require('../models/RiskAudit');
const { recordRiskToBlockchain, generateHash } = require('./blockchain.service');
const { calculateRiskForAsset } = require('./riskCalculation.service');

const tierMap = {
  critical: 1,
  high: 2,
  medium: 3,
  low: 4
};

const getTierNumber = (criticalityStr) => {
  const normalized = String(criticalityStr || '').toLowerCase();
  return tierMap[normalized] || 3;
};

// GET Payload Logic for Python FastAPI AI Engine
const getAiPayloadService = async () => {
  const settings = await Settings.getSettings();
  const assets = await Asset.find().lean();
  const vulnerabilities = await Vulnerability.find().lean();
  const controls = await Control.find().lean();
  const securityEvents = await SecurityEvent.find().lean();
  const incidents = await Incident.find().lean(); // Fix #12

  const formattedAssets = assets.map((asset) => {
    // Asset-specific findings filter
    const assetVulns = vulnerabilities.filter((v) => v.asset_id === asset.asset_id && v.status !== 'fixed');
    const assetEvents = securityEvents.filter((e) => e.asset_id === asset.asset_id);
    const assetIncidents = incidents.filter((i) => i.asset_id === asset.asset_id);

    const failedAuthCount = assetEvents.reduce((sum, evt) => sum + (Number(evt.failed_attempts) || 0), 0);
    const incidentCount = assetIncidents.length;

    // Fix #15: Single CVE ki jagah asset ki SAARI vulnerabilities bhej rahe hain
    const formattedVulnerabilities = assetVulns.map((v) => ({
      cve_id: v.cve,
      cvss: Number(v.cvss) || 0,
      epss: Number(v.epss) || 0,
      cisa_kev: Boolean(v.cisa_kev),
      patch_age_days: Number(v.patch_age_days) || 0,
      status: v.status || 'open',
      source_timestamp: v.updatedAt || v.createdAt || null,
      remediation_options: v.remediation_options || []
    }));

    return {
      asset_id: asset.asset_id,
      hostname: asset.hostname || '',
      business_unit: asset.business_unit || 'Core Operations',
      criticality: asset.criticality || 'medium',
      active_controls: asset.active_controls || [],
      applicable_frameworks: asset.applicable_frameworks || [],
      hourly_downtime_cost_inr: asset.hourly_downtime_cost_inr || 0,
      total_records: asset.total_records || 0,
      cost_per_record_inr: asset.cost_per_record_inr || 0,
      regulatory_penalty_inr: asset.regulatory_penalty_inr || 0, // Fix #18
      reputation_loss_inr: asset.reputation_loss_inr || 0, // Fix #18
      dependencies: asset.dependencies || [], // Fix #19
      // Keep the canonical contract flat as well as in features for older consumers.
      internet_exposed: Boolean(asset.internet_exposed),
      is_internet_facing: Boolean(asset.internet_exposed),
      source_timestamp: asset.updatedAt || asset.createdAt || null,
      vulnerabilities: formattedVulnerabilities, // Fix #15
      features: {
        internet_exposed: asset.internet_exposed ? 1 : 0,
        tier: getTierNumber(asset.criticality),
        failed_auth_count: failedAuthCount,
        incident_count: incidentCount // Fix #12
      }
    };
  });

  const formattedControls = controls.map((ctrl) => ({
    control_id: ctrl.control_id,
    name: ctrl.name,
    status: ctrl.status,
    owner: ctrl.owner || '',
    description: ctrl.description || '',
    cost_inr: ctrl.cost_inr || 0,
    target_asset_id: ctrl.target_asset_id ? ctrl.target_asset_id : 'GLOBAL', // Fix #14
    risk_reduction_pct: ctrl.risk_reduction_pct || 0,
    compliance_frameworks: ctrl.compliance_frameworks?.length > 0 ? ctrl.compliance_frameworks : ['ISO 27001']
  }));

  return {
    enterprise_budget_inr: settings?.enterprise_budget_inr || 2000000,
    dataset: {
      name: settings?.dataset_name || '',
      version: settings?.dataset_version || '',
      source: settings?.dataset_source || ''
    },
    assets: formattedAssets,
    candidate_controls: formattedControls
  };
};

// SAVE Results Logic from AI Engine
const saveAiResultsService = async (resultsData = {}) => {
  const total_expected_annual_loss_inr = resultsData.total_expected_annual_loss_inr ?? resultsData.totalExpectedAnnualLossInr ?? 0;
  const value_at_risk_inr = resultsData.value_at_risk_inr ?? resultsData.valueAtRiskInr ?? 0;
  
  // Fix #17: Extract control recommendations
  const recommended_controls = resultsData.recommended_controls || resultsData.recommended_control_ids || [];
  const recommended_control_ids = recommended_controls.map(c => typeof c === 'string' ? c : c.control_id);

  const executive_summary = resultsData.executive_summary || resultsData.executiveSummary || '';
  const rawAssetRisks = resultsData.asset_risks || resultsData.assetRisks || resultsData.assets || [];
  const receivedAssetRisks = Array.isArray(rawAssetRisks) ? rawAssetRisks : [];
  const sourceAssets = await Asset.find().lean();
  const sourceVulnerabilities = await Vulnerability.find({ status: { $ne: 'fixed' } }).lean();
  const vulnerabilitiesByAsset = sourceVulnerabilities.reduce((result, vulnerability) => {
    (result[vulnerability.asset_id] ||= []).push(vulnerability);
    return result;
  }, {});
  const receivedByAsset = new Map(receivedAssetRisks.filter((item) => item?.asset_id).map((item) => [String(item.asset_id), item]));
  const unknownAssetIds = receivedAssetRisks
    .map((item) => item?.asset_id)
    .filter((assetId) => assetId && !sourceAssets.some((asset) => asset.asset_id === assetId));
  const fallbackAssetIds = [];
  const asset_risks = sourceAssets.map((asset) => {
    const aiRisk = receivedByAsset.get(asset.asset_id);
    const aiHasUsableRisk = aiRisk && (
      Number(aiRisk.score) > 0
      || Number(aiRisk.eal_inr ?? aiRisk.asset_eal_inr) > 0
      || (Array.isArray(aiRisk.drivers) && aiRisk.drivers.length > 0)
    );
    if (aiHasUsableRisk) {
      const fallback = calculateRiskForAsset(asset, vulnerabilitiesByAsset[asset.asset_id] || []);
      return {
        ...fallback,
        ...aiRisk,
        asset_id: asset.asset_id,
        score: Number(aiRisk.score ?? fallback.score),
        eal_inr: Number(aiRisk.eal_inr ?? aiRisk.asset_eal_inr ?? fallback.eal_inr),
        var_inr: Number(aiRisk.var_inr ?? aiRisk.asset_var_inr ?? fallback.var_inr),
        drivers: Array.isArray(aiRisk.drivers) && aiRisk.drivers.length ? aiRisk.drivers : fallback.drivers,
        model_version: aiRisk.model_version || resultsData.model_version || 'python-ai'
      };
    }
    fallbackAssetIds.push(asset.asset_id);
    return calculateRiskForAsset(asset, vulnerabilitiesByAsset[asset.asset_id] || []);
  });
  const calculatedEal = asset_risks.reduce((sum, item) => sum + (Number(item.eal_inr) || 0), 0);
  const calculatedVar = asset_risks.reduce((sum, item) => sum + (Number(item.var_inr) || 0), 0);
  const effectiveEal = Number(total_expected_annual_loss_inr) > 0
    ? Number(total_expected_annual_loss_inr)
    : calculatedEal;
  const effectiveVar = Number(value_at_risk_inr) > 0
    ? Number(value_at_risk_inr)
    : calculatedVar;

  // 1. Save Org-level Financials & Settings
  await Settings.findOneAndUpdate(
    {},
    {
      total_expected_annual_loss_inr: effectiveEal,
      value_at_risk_inr: effectiveVar,
      recommended_control_ids,
      executive_summary
    },
    { upsert: true, new: true }
  );

  let processedCount = 0;
  if (Array.isArray(asset_risks) && asset_risks.length > 0) {
    // 2. Bulk Write Risk Score & Asset-Level Financials (Fix #16)
    const riskBulkOps = asset_risks.map((item) => ({
      updateOne: {
        filter: { asset_id: item.asset_id },
        update: {
          $set: {
            criticality: item.criticality || '',
            severity: item.severity || '',
             score: Number(item.score ?? 0),
            level: item.level || 'Medium',
             eal_inr: Number(item.eal_inr ?? item.asset_eal_inr ?? 0),
             var_inr: Number(item.var_inr ?? item.asset_var_inr ?? 0),
             likelihood: Number(item.likelihood ?? item.probability ?? 0),
             impact_inr: Number(item.impact_inr ?? 0),
             formula: item.formula || resultsData.formula || '',
             drivers: Array.isArray(item.drivers) ? item.drivers : [],
             model_version: item.model_version || resultsData.model_version || 'prototype',
            input_snapshot_hash: item.input_snapshot_hash || resultsData.input_snapshot_hash || '',
            assessed_at: new Date()
          }
        },
        upsert: true
      }
    }));

    const assetBulkOps = asset_risks.map((item) => ({
      updateOne: {
        filter: { asset_id: item.asset_id },
        update: {
          $set: {
             risk_score: Number(item.score ?? 0),
            risk_level: item.level || 'Medium',
             asset_eal_inr: Number(item.eal_inr ?? item.asset_eal_inr ?? 0), // Fix #16: Asset Level EAL
             asset_var_inr: Number(item.var_inr ?? item.asset_var_inr ?? 0),   // Fix #16: Asset Level VaR
            last_assessed: new Date()
          }
        }
      }
    }));

    await Promise.all([
      Risk.bulkWrite(riskBulkOps),
      Asset.bulkWrite(assetBulkOps)
    ]);
    processedCount = asset_risks.length;
  }

  // 3. Fix #5: History Snapshot Log for Trend Analysis Graph
  try {
    await RiskHistory.create({
       total_expected_annual_loss_inr: effectiveEal,
       value_at_risk_inr: effectiveVar,
      asset_snapshots: asset_risks.map(a => ({
        asset_id: a.asset_id,
        score: a.score || 0,
        level: a.level || 'Medium',
        eal_inr: a.eal_inr || 0,
        var_inr: a.var_inr || 0
      }))
    });
  } catch (histError) {
    console.error("[RISK HISTORY LOG ERROR]", histError.message);
  }

  // 4. Record the effective report, including backend fallbacks, to the audit layer.
  const previousAudit = await RiskAudit.findOne().sort({ chain_index: -1, createdAt: -1 }).lean();
  const chainIndex = Number(previousAudit?.chain_index || 0) + 1;
  const previousReportHash = previousAudit?.report_hash || null;
  const auditPayload = {
    ...resultsData,
    total_expected_annual_loss_inr: effectiveEal,
    value_at_risk_inr: effectiveVar,
    asset_risks,
    audit_metadata: {
      received_asset_count: receivedAssetRisks.length,
      processed_asset_count: asset_risks.length,
      fallback_asset_ids: fallbackAssetIds,
      unknown_asset_ids: unknownAssetIds,
      model_version: resultsData.model_version || 'python-ai-with-backend-fallback',
      chain_index: chainIndex,
      previous_report_hash: previousReportHash,
      payload_version: 'risk-report-v2'
    }
  };
  let txHash = null;
  const reportHash = generateHash(auditPayload);
  let blockchainError = null;
  let blockchainAnchor = null;
  try {
    blockchainAnchor = await recordRiskToBlockchain(auditPayload);
    txHash = blockchainAnchor?.tx_hash || null;
    if (txHash) {
      await Settings.findOneAndUpdate({}, { last_blockchain_tx: txHash });
    }
  } catch (bcError) {
    blockchainError = bcError.message;
    console.error('[BLOCKCHAIN LOG ERROR]', bcError.message);
  }

  await RiskAudit.create({
    report_hash: reportHash,
    tx_hash: txHash,
    payload: auditPayload,
    verification_status: txHash ? 'anchored' : 'unanchored',
    chain_index: chainIndex,
    previous_report_hash: previousReportHash,
    block_number: blockchainAnchor?.block_number ?? null,
    network: blockchainAnchor?.network || null,
    signer: blockchainAnchor?.signer || null,
    anchored_at: blockchainAnchor?.anchored_at || null,
    payload_version: 'risk-report-v2'
  });

  return {
    processed_assets: processedCount,
    received_assets: receivedAssetRisks.length,
    fallback_assets: fallbackAssetIds,
    unknown_asset_ids: unknownAssetIds,
    total_expected_annual_loss_inr: effectiveEal,
    value_at_risk_inr: effectiveVar,
    blockchain_tx: txHash,
    blockchain_anchor: blockchainAnchor,
    blockchain_error: blockchainError,
    report_hash: reportHash
  };
};

module.exports = {
  getAiPayloadService,
  saveAiResultsService
};
