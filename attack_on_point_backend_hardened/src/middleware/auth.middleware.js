const logger = require('../utils/logger');
const crypto = require('crypto');

const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const validApiKey = process.env.API_KEY;

  const supplied = Buffer.from(String(apiKey || ''));
  const expected = Buffer.from(String(validApiKey || ''));
  const valid = supplied.length > 0 && expected.length > 0 && supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
  if (!valid) {
    logger.warn(`Unauthorized request blocked on: ${req.method} ${req.originalUrl}`);
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Invalid or missing x-api-key header'
    });
  }

  next();
};

module.exports = { authenticateApiKey };
