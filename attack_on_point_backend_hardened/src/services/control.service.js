const Control = require('../models/Control');
const { normalizeControl, normalizeControlsBulk } = require('../normalizers/control.normalizer');

const upsertControlService = async (rawData) => {
  if (Array.isArray(rawData)) {
    const normalizedArray = normalizeControlsBulk(rawData);
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
    return await Control.findOneAndUpdate(
      { control_id: normalized.control_id },
      { $set: normalized },
      { new: true, upsert: true, runValidators: true }
    );
  }
};

const getAllControlsService = async () => {
  return await Control.find().sort({ createdAt: -1 });
};

const getControlByIdService = async (control_id) => {
  return await Control.findOne({ control_id });
};

module.exports = {
  upsertControlService,
  getAllControlsService,
  getControlByIdService
};