const crypto = require('crypto');
const IngestionJob = require('../models/IngestionJob');

const runIngestionJob = async ({ source, rawData, handler, mode = 'batch' }) => {
  const records = Array.isArray(rawData) ? rawData : [rawData];
  const job = await IngestionJob.create({
    job_id: `JOB-${crypto.randomUUID()}`,
    source,
    ingestion_mode: mode,
    status: 'processing',
    started_at: new Date(),
    record_count: records.length
  });

  try {
    const result = await handler(rawData, job);
    const resultData = result?.data || result;
    const createdCount = Number(result?.insertedCount || result?.upsertedCount || (Array.isArray(resultData) ? resultData.length : resultData ? records.length : 0));
    const updatedCount = Number(result?.modifiedCount || result?.matchedCount || 0);
    await IngestionJob.updateOne({ _id: job._id }, {
      $set: {
        status: 'completed',
        completed_at: new Date(),
        created_count: createdCount,
        updated_count: updatedCount
      }
    });
    return { result, job_id: job.job_id };
  } catch (error) {
    await IngestionJob.updateOne({ _id: job._id }, {
      $set: { status: 'failed', completed_at: new Date(), failed_count: records.length, error_summary: error.message }
    });
    throw error;
  }
};

const getIngestionJobs = async (limit = 30) => IngestionJob.find().sort({ createdAt: -1 }).limit(Math.min(Math.max(Number(limit) || 30, 1), 100)).lean();
const getIngestionJob = async (jobId) => IngestionJob.findOne({ job_id: jobId }).lean();

module.exports = { runIngestionJob, getIngestionJobs, getIngestionJob };
