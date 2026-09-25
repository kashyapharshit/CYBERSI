const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema(
  {
    incident_id: { type: String, required: true, unique: true, trim: true },
    asset_id: { type: String, required: true, trim: true },
    attack_type: { type: String, default: '' },
    compromise_status: { type: String, default: '' },
    affected_records: { type: Number, default: 0 },
    total_records: { type: Number, default: 0 },
    service_downtime_minutes: { type: Number, default: 0 },
    data_modified: { type: Boolean, default: false },
    data_deleted: { type: Boolean, default: false },
    evidence_confidence: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Incident', incidentSchema);