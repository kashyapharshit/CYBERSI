const {
  upsertControlService,
  getAllControlsService,
  getControlByIdService
} = require('../services/control.service');

const upsertControl = async (req, res, next) => {
  try {
    const result = await upsertControlService(req.body);
    res.status(201).json({
      success: true,
      message: 'Security control data ingested/updated successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getAllControls = async (req, res, next) => {
  try {
    const controls = await getAllControlsService();
    res.status(200).json({
      success: true,
      count: controls.length,
      data: controls
    });
  } catch (error) {
    next(error);
  }
};

const getControlById = async (req, res, next) => {
  try {
    const control = await getControlByIdService(req.params.control_id);
    if (!control) {
      return res.status(404).json({
        success: false,
        message: `Control not found with control_id: ${req.params.control_id}`
      });
    }
    res.status(200).json({
      success: true,
      data: control
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  upsertControl,
  getAllControls,
  getControlById
};