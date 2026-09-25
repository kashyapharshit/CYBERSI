const SecurityEvent = require('../models/SecurityEvent');
const { parseNmap } = require('../parsers/nmap.parser');

const ingestNmapService = async (rawData) => {
  if (Array.isArray(rawData)) {
    const parsedArray = rawData.map((item) => parseNmap(item));
    return await SecurityEvent.insertMany(parsedArray);
  }
  const parsed = parseNmap(rawData);
  return await SecurityEvent.create(parsed);
};

module.exports = { ingestNmapService };