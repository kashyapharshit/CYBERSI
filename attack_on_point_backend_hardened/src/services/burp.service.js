const SecurityEvent = require('../models/SecurityEvent');
const { parseBurp } = require('../parsers/burp.parser');
const { ingestVulnerabilitiesService } = require('./vulnerability.service');
const { normalizeTelemetry } = require('./telemetry.service');
const { normalizeFinding } = require('../normalizers/finding.normalizer');
const Vulnerability = require('../models/Vulnerability');

const ingestBurpService = async (rawData, context = {}) => {
  if (Array.isArray(rawData)) {
    const parsedArray = rawData.map((item) => normalizeTelemetry('burp', item, context.job_id, parseBurp(item)));
    const events = await SecurityEvent.insertMany(parsedArray);
    await ingestVulnerabilitiesService(rawData, context);
    await linkFindingsToEvents(rawData, events);
    return events;
  }

  const parsed = normalizeTelemetry('burp', rawData, context.job_id, parseBurp(rawData));
  const event = await SecurityEvent.create(parsed);
  await ingestVulnerabilitiesService(rawData, context);
  await linkFindingsToEvents([rawData], [event]);
  return event;
};

const linkFindingsToEvents = async (rawData, events) => {
  await Promise.all(rawData.map(async (item, index) => {
    const findingId = normalizeFinding(item).finding_id;
    const eventId = events[index]?._id;
    if (!eventId) return;
    await Promise.all([
      SecurityEvent.updateOne({ _id: eventId }, { $addToSet: { linked_finding_ids: findingId } }),
      Vulnerability.updateOne({ finding_id: findingId }, { $addToSet: { linked_event_ids: eventId } })
    ]);
  }));
};

module.exports = { ingestBurpService };
