const mongoose = require('mongoose');

const ingestionJobSchema = new mongoose.Schema({
  job_id: { type: String, required: true, unique: true, index: true },
  source: { type: String, required: true },
  ingestion_mode: { type: String, enum: ['batch', 'stream'], default: 'batch' },
  status: { type: String, enum: ['queued', 'processing', 'completed', 'failed'], default: 'queued' },
  received_at: { type: Date, default: Date.now },
  started_at: { type: Date, default: null },
  completed_at: { type: Date, default: null },
  record_count: { type: Number, default: 0 },
  created_count: { type: Number, default: 0 },
  updated_count: { type: Number, default: 0 },
  failed_count: { type: Number, default: 0 },
  error_summary: { type: String, default: '' },
  dataset_version: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('IngestionJob', ingestionJobSchema);
