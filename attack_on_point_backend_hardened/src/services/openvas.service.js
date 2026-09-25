const SecurityEvent = require('../models/SecurityEvent');
const { parseOpenVas } = require('../parsers/openvas.parser');
const { ingestVulnerabilitiesService } = require('./vulnerability.service');

const ingestOpenVasService = async (rawData) => {
  if (Array.isArray(rawData)) {
    const parsedArray = rawData.map((item) => parseOpenVas(item));
    const events = await SecurityEvent.insertMany(parsedArray);
    await ingestVulnerabilitiesService(rawData);
    return events;
  }
  const parsed = parseOpenVas(rawData);
  const event = await SecurityEvent.create(parsed);
  await ingestVulnerabilitiesService(rawData);
  return event;
};

module.exports = { ingestOpenVasService };
