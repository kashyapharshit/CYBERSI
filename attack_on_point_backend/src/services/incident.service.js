const Incident = require('../models/Incident');
const { normalizeIncident, normalizeIncidentsBulk } = require('../normalizers/incident.normalizer');

const upsertIncidentService = async (rawData) => {
  if (Array.isArray(rawData)) {
    const normalizedArray = normalizeIncidentsBulk(rawData);
    const operations = normalizedArray.map((item) => ({
      updateOne: {
        filter: { incident_id: item.incident_id },
        update: { $set: item },
        upsert: true
      }
    }));
    return await Incident.bulkWrite(operations);
  } else {
    const normalized = normalizeIncident(rawData);
    return await Incident.findOneAndUpdate(
      { incident_id: normalized.incident_id },
      { $set: normalized },
      { new: true, upsert: true, runValidators: true }
    );
  }
};

const getAllIncidentsService = async () => {
  return await Incident.find().sort({ createdAt: -1 });
};

const getIncidentsByAssetService = async (asset_id) => {
  return await Incident.find({ asset_id }).sort({ createdAt: -1 });
};

module.exports = {
  upsertIncidentService,
  getAllIncidentsService,
  getIncidentsByAssetService
};