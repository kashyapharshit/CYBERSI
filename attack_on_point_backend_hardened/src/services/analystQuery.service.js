const axios = require('axios');
const logger = require('../utils/logger');

const sendAnalystQueryService = async (queryText, user) => {
  const fastapiLlmUrl = process.env.FASTAPI_LLM_URL;
  const apiKey = process.env.API_KEY;

  if (!fastapiLlmUrl || !apiKey) {
    const configError = new Error('FASTAPI_LLM_URL or API_KEY is not configured');
    configError.statusCode = 503;
    throw configError;
  }

  try {
    logger.info(`[ANALYST QUERY] Forwarding query from user (${user.id}) to FastAPI LLM...`);

    const response = await axios.post(
      fastapiLlmUrl,
      {
        query: queryText,
        user_id: user.id,
        user_role: user.role
      },
      {
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        timeout: Number(process.env.ANALYST_LLM_TIMEOUT_MS) || 120000 // LLM processing ke liye 30 seconds timeout
      }
    );

    return response.data;
  } catch (error) {
    logger.error(`[ANALYST QUERY ERROR] ${error.message}`);
    const customError = new Error(
      error.response?.data?.message || 'FastAPI LLM Service unavailable or timed out'
    );
    customError.statusCode = error.response?.status || 502;
    throw customError;
  }
};

module.exports = { sendAnalystQueryService };
// const sendAnalystQueryService = async (queryText, user) => {
//   logger.info(`[ANALYST QUERY - MOCK TEST] User (${user.id}) queried: "${queryText}"`);

//   // Fake AI processing delay (500ms)
//   await new Promise((resolve) => setTimeout(resolve, 500));

//   // Simulated AI response
//   return {
//     query_received: queryText,
//     answer: `AI Analysis Result: Based on current telemetry, asset AST-10030 has 320 failed authentication attempts and high CVSS (9.8). Immediate patch implementation is recommended.`,
//     confidence_score: 0.94,
//     recommended_actions: [
//       "Deploy MFA Control (CTRL-001)",
//       "Patch CVE-2023-34362 on AST-10030"
//     ],
//     processed_by_role: user.role
//   };
// };

// module.exports = { sendAnalystQueryService };
