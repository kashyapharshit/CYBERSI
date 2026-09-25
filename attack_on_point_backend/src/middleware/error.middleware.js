const logger = require('../utils/logger');

const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route Not Found - ${req.originalUrl}`
  });
};

const globalErrorHandler = (err, req, res, next) => {
  logger.error(`Unhandled Error [${req.method} ${req.originalUrl}]: ${err.message}`);
  
  // Fix: err.statusCode ko status code set karne ke liye check kar rahe hain
  const status = err.statusCode || err.status || 500;

  res.status(status).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
};

module.exports = { notFoundHandler, globalErrorHandler };