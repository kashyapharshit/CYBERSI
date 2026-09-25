const Asset = require('../models/Asset');

const getDependencyProfile = async (assetId) => {
  const assets = await Asset.find().select('asset_id hostname dependencies criticality risk_score asset_eal_inr').lean();
  const byId = Object.fromEntries(assets.map((asset) => [asset.asset_id, asset]));
  const root = byId[assetId];
  if (!root) return null;

  const direct = [...new Set(root.dependencies || [])].filter((id) => byId[id]);
  const impacted = new Set();
  const depths = {};
  const queue = direct.map((id) => ({ id, depth: 1 }));
  while (queue.length) {
    const { id: current, depth } = queue.shift();
    if (impacted.has(current)) continue;
    impacted.add(current);
    depths[current] = depth;
    for (const dependency of byId[current]?.dependencies || []) queue.push({ id: dependency, depth: depth + 1 });
  }

  const reverse = assets.filter((asset) => (asset.dependencies || []).includes(assetId)).map((asset) => asset.asset_id);
  return {
    asset_id: assetId,
    direct_dependencies: direct,
    reverse_dependencies: reverse,
    impacted_asset_ids: [...impacted],
    dependency_depth: impacted.size ? Math.max(...[...impacted].map((id) => depths[id] || 0)) : 0,
    blast_radius_score: Math.min(100, direct.length * 15 + reverse.length * 20 + impacted.size * 10),
    cycle_detected: impacted.has(assetId),
    assets: [...new Set([...direct, ...reverse, ...impacted])].map((id) => byId[id]).filter(Boolean)
  };
};

module.exports = { getDependencyProfile };
