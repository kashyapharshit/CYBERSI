const { getAiPayloadService, saveAiResultsService } = require('../services/aiPayload.service');

const getAiPayload = async (req, res, next) => {
  try {
    const payload = await getAiPayloadService();
    res.status(200).json(payload);
  } catch (error) {
    next(error);
  }
};

const saveAiResults = async (req, res, next) => {
  try {
    // Valid object fallback handling
    const payloadData = (req.body.data && typeof req.body.data === 'object' && Object.keys(req.body.data).length > 0)
      ? req.body.data
      : req.body;

    const result = await saveAiResultsService(payloadData);
    res.status(200).json({
      success: true,
      message: 'AI analysis results processed and stored successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAiPayload, saveAiResults };
