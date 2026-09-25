const axios = require('axios');
const logger = require('../utils/logger');

const triggerAiAnalysis = async (reason = 'Manual Trigger') => {
  const pythonAiUrl = process.env.AI_ENGINE_URL || process.env.PYTHON_AI_URL;
  const apiKey = process.env.API_KEY;

  if (!pythonAiUrl || !apiKey) {
    logger.error('[AI TRIGGER] AI_ENGINE_URL or API_KEY is not configured');
    return { accepted: false, reason: 'not_configured' };
  }

  try {
    logger.info(`[AI TRIGGER] Initiating AI Engine Analysis. Reason: ${reason}`);

    // Python FastAPI ko async background call bhej rahe hain
    const response = await axios.post(
      pythonAiUrl,
      { trigger_reason: reason },
      {
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 sec timeout
      }
    );

    logger.info(`[AI TRIGGER SUCCESS] Python Engine Response: ${JSON.stringify(response.data)}`);
    return { accepted: true, response: response.data };
  } catch (error) {
    logger.error(`[AI TRIGGER FAILED] Reason: ${reason} | Error: ${error.message}`);
    if (error.response?.status === 409) return { accepted: false, conflict: true, message: error.response.data?.detail || 'AI analysis is already running.' };
    return { accepted: false, reason: error.message };
  }
};

module.exports = { triggerAiAnalysis };
