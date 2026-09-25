require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const initCronJobs = require('./config/cron');
const logger = require('./utils/logger');


const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

connectDB().then(() => {
  initCronJobs();
  app.listen(PORT, HOST, () => {
    logger.info(`Server running on http://${HOST}:${PORT}`);
  });
});