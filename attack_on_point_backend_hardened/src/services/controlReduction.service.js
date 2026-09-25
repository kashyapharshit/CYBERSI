const normalizeReduction = (value) => {
  const raw = Number(value) || 0;
  return Math.min(1, Math.max(0, raw > 1 ? raw / 100 : raw));
};

const getReductionSettings = () => ({
  overlapFactor: Math.min(1, Math.max(0, Number(process.env.CONTROL_OVERLAP_FACTOR) || 0.65)),
  maximumReduction: Math.min(0.95, Math.max(0.1, Number(process.env.MAX_COMBINED_REDUCTION) || 0.85))
});

const applyMarginalReduction = (currentReduction, reduction) => {
  const { overlapFactor, maximumReduction } = getReductionSettings();
  const marginalReduction = normalizeReduction(reduction) * (1 - currentReduction) * overlapFactor;
  return Math.min(maximumReduction, currentReduction + marginalReduction);
};

const combineReductions = (controls = []) => {
  const { overlapFactor, maximumReduction } = getReductionSettings();
  let combinedReduction = 0;

  for (const control of controls) {
    combinedReduction = applyMarginalReduction(combinedReduction, control.risk_reduction_pct ?? control.effectiveness);
  }

  return {
    combinedReduction,
    overlapFactor,
    maximumReduction
  };
};

module.exports = { normalizeReduction, combineReductions, applyMarginalReduction, getReductionSettings };
