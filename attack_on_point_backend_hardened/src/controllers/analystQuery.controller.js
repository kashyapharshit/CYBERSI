const { sendAnalystQueryService } = require('../services/analystQuery.service');

const processAnalystQuery = async (req, res, next) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Query is required and cannot be empty'
      });
    }

    // req.user JWT protect middleware se milta hai
    const result = await sendAnalystQueryService(query.trim(), req.user);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { processAnalystQuery };