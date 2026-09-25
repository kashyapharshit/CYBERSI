const SecurityEvent = require('../models/SecurityEvent');
const { parseWazuh } = require('../parsers/wazuh.parser');

const ingestWazuhService = async (rawData) => {
  if (Array.isArray(rawData)) {
    const parsedArray = rawData.map((item) => parseWazuh(item));
    return await SecurityEvent.insertMany(parsedArray);
  }
  const parsed = parseWazuh(rawData);
  return await SecurityEvent.create(parsed);
};

module.exports = { ingestWazuhService };