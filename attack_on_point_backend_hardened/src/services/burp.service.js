const SecurityEvent = require('../models/SecurityEvent');
const { parseBurp } = require('../parsers/burp.parser');
const { ingestVulnerabilitiesService } = require('./vulnerability.service');

const ingestBurpService = async (rawData) => {
  if (Array.isArray(rawData)) {
    const parsedArray = rawData.map((item) => parseBurp(item));
    const events = await SecurityEvent.insertMany(parsedArray);
    await ingestVulnerabilitiesService(rawData);
    return events;
  }

  const parsed = parseBurp(rawData);
  const event = await SecurityEvent.create(parsed);
  await ingestVulnerabilitiesService(rawData);
  return event;
};

module.exports = { ingestBurpService };
