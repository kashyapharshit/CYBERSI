const normalizeSettings = (rawData = {}) => {
  return {
    enterprise_budget_inr: rawData.enterprise_budget_inr !== undefined
      ? (isNaN(Number(rawData.enterprise_budget_inr)) ? 0 : Number(rawData.enterprise_budget_inr))
      : 0
  };
};

module.exports = { normalizeSettings };