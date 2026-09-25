const SecurityEvent = require('../models/SecurityEvent');
const { parseWazuh } = require('../parsers/wazuh.parser');
const { normalizeTelemetry } = require('./telemetry.service');

const ingestWazuhService = async (rawData, context = {}) => {
  if (Array.isArray(rawData)) {
    const parsedArray = rawData.map((item) => normalizeTelemetry('wazuh', item, context.job_id, parseWazuh(item)));
    return await SecurityEvent.insertMany(parsedArray);
  }
  const parsed = normalizeTelemetry('wazuh', rawData, context.job_id, parseWazuh(rawData));
  return await SecurityEvent.create(parsed);
};

module.exports = { ingestWazuhService };
