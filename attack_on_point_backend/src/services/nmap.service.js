const SecurityEvent = require('../models/SecurityEvent');
const { parseNmap } = require('../parsers/nmap.parser');
const { normalizeTelemetry } = require('./telemetry.service');

const ingestNmapService = async (rawData, context = {}) => {
  if (Array.isArray(rawData)) {
    const parsedArray = rawData.map((item) => normalizeTelemetry('nmap', item, context.job_id, parseNmap(item)));
    return await SecurityEvent.insertMany(parsedArray);
  }
  const parsed = normalizeTelemetry('nmap', rawData, context.job_id, parseNmap(rawData));
  return await SecurityEvent.create(parsed);
};

module.exports = { ingestNmapService };
