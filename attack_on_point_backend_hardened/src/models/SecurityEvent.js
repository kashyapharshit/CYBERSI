const mongoose = require('mongoose');

const securityEventSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['nmap', 'wazuh', 'burp', 'openvas', 'edr', 'iam', 'cspm', 'threat-intel'], default: 'wazuh' },
    ingestion_mode: { type: String, enum: ['batch', 'stream'], default: 'batch' },
    asset_id: { type: String, required: true, trim: true },
    source: { type: String, default: '' },
    source_event_id: { type: String, default: '' },
    event_type: { type: String, default: '' },
    severity: { type: String, default: '' },
    source_ip: { type: String, default: '' },
    failed_attempts: { type: Number, default: 0 },
    successful_login: { type: Boolean, default: false },
    open_ports: [{ type: Number }],
    services: [{ type: String }],
    exposure: { type: String, default: '' },
    endpoint: { type: String, default: '' },
    affected_role: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
    observed_at: { type: Date, default: Date.now },
    confidence: { type: Number, default: 0.5, min: 0, max: 1 },
    ingestion_job_id: { type: String, default: '' },
    linked_finding_ids: [{ type: String }],
    raw_hash: { type: String, default: '' },
    raw_payload: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model('SecurityEvent', securityEventSchema);
