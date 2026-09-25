const {
  upsertIncidentService,
  getAllIncidentsService,
  getIncidentsByAssetService
} = require('../services/incident.service');

const upsertIncident = async (req, res, next) => {
  try {
    const result = await upsertIncidentService(req.body);
    res.status(201).json({
      success: true,
      message: 'Incident data ingested successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getAllIncidents = async (req, res, next) => {
  try {
    const incidents = await getAllIncidentsService();
    res.status(200).json({
      success: true,
      count: incidents.length,
      data: incidents
    });
  } catch (error) {
    next(error);
  }
};

const getIncidentsByAsset = async (req, res, next) => {
  try {
    const incidents = await getIncidentsByAssetService(req.params.asset_id);
    res.status(200).json({
      success: true,
      count: incidents.length,
      data: incidents
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  upsertIncident,
  getAllIncidents,
  getIncidentsByAsset
};