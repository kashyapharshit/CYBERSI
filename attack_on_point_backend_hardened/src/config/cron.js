const cron = require('node-cron');
const { triggerAiAnalysis } = require('../services/aiTrigger.service');
const logger = require('../utils/logger');

const initCronJobs = () => {
  // Cron syntax '0 */12 * * *' = Har 12 ghante me run hoga (e.g., 12:00 AM aur 12:00 PM)
  cron.schedule('0 */12 * * *', async () => {
    logger.info('[CRON SCHEDULER] Running 12-Hour Periodic AI Analysis Job...');
    await triggerAiAnalysis('12-Hour Scheduled Periodic Sync');
  });

  logger.info('[CRON SCHEDULER] 12-Hour Periodic Job Initialized Successfully');
};

module.exports = initCronJobs;