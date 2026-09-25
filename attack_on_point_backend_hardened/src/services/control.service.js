const Control = require('../models/Control');
const Incident = require('../models/Incident');
const { normalizeControl, normalizeControlsBulk } = require('../normalizers/control.normalizer');
const { calculateControlEffectiveness } = require('./controlEffectiveness.service');

const upsertControlService = async (rawData) => {
  const incidents = await Incident.find().lean();
  if (Array.isArray(rawData)) {
    const normalizedArray = normalizeControlsBulk(rawData).map((item) => ({ ...item, ...calculateControlEffectiveness(item, incidents) }));
    const operations = normalizedArray.map((item) => ({
      updateOne: {
        filter: { control_id: item.control_id },
        update: { $set: item },
        upsert: true
      }
    }));
    return await Control.bulkWrite(operations);
  } else {
    const normalized = normalizeControl(rawData);
    Object.assign(normalized, calculateControlEffectiveness(normalized, incidents));
    return await Control.findOneAndUpdate(
      { control_id: normalized.control_id },
      { $set: normalized },
      { new: true, upsert: true, runValidators: true }
    );
  }
};

const getAllControlsService = async () => {
  const [controls, incidents] = await Promise.all([Control.find().sort({ createdAt: -1 }).lean(), Incident.find().lean()]);
  return controls.map((control) => ({ ...control, ...calculateControlEffectiveness(control, incidents) }));
};

const getControlByIdService = async (control_id) => {
  const [control, incidents] = await Promise.all([Control.findOne({ control_id }).lean(), Incident.find().lean()]);
  return control ? { ...control, ...calculateControlEffectiveness(control, incidents) } : null;
};

module.exports = {
  upsertControlService,
  getAllControlsService,
  getControlByIdService
};
