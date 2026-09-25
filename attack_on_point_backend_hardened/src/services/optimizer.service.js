const axios = require('axios');
const { getAiPayloadService } = require('./aiPayload.service');

const runExternalOptimizer = async (options = {}) => {
  const optimizerUrl = process.env.PYTHON_OPTIMIZER_URL || process.env.AI_OPTIMIZER_URL;
  if (!optimizerUrl) {
    const error = new Error('PYTHON_OPTIMIZER_URL is not configured');
    error.statusCode = 503;
    throw error;
  }

  const payload = await getAiPayloadService();
  const timeout = Number(process.env.AI_REQUEST_TIMEOUT_MS) || 15000;
  const response = await axios.post(optimizerUrl, {
      ...payload,
      optimizer_options: options,
      contract_version: 'optimizer-v1'
    }, {
      timeout,
      headers: {
        'x-api-key': process.env.API_KEY,
        'Content-Type': 'application/json'
      }
    });

  return response.data;
};

const runOptimizerComparison = async (options = {}) => {
  const configuredUrl = process.env.PYTHON_OPTIMIZER_COMPARISON_URL;
  const optimizerUrl = configuredUrl || (process.env.PYTHON_OPTIMIZER_URL || process.env.AI_OPTIMIZER_URL || '').replace(/\/optimize\/?$/, '/optimizer-comparison');
  if (!optimizerUrl) {
    const error = new Error('PYTHON_OPTIMIZER_COMPARISON_URL is not configured');
    error.statusCode = 503;
    throw error;
  }

  const payload = await getAiPayloadService();
  const timeout = Number(process.env.AI_REQUEST_TIMEOUT_MS) || 15000;
  const response = await axios.post(optimizerUrl, {
    ...payload,
    optimizer_options: options,
    contract_version: 'optimizer-comparison-v1'
  }, {
    timeout,
    headers: {
      'x-api-key': process.env.API_KEY,
      'Content-Type': 'application/json'
    }
  });

  return response.data;
};

module.exports = { runExternalOptimizer, runOptimizerComparison };
