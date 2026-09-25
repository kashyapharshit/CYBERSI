const { getIngestionJobs, getIngestionJob } = require('../services/ingestion.service');

const listIngestionJobs = async (req, res, next) => {
  try {
    const jobs = await getIngestionJobs(req.query.limit);
    res.status(200).json({ success: true, count: jobs.length, data: jobs });
  } catch (error) {
    next(error);
  }
};

const getIngestionJobById = async (req, res, next) => {
  try {
    const job = await getIngestionJob(req.params.job_id);
    if (!job) return res.status(404).json({ success: false, message: 'Ingestion job not found' });
    res.status(200).json({ success: true, data: job });
  } catch (error) {
    next(error);
  }
};

module.exports = { listIngestionJobs, getIngestionJobById };
