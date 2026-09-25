const { ingestNmapService } = require('../services/nmap.service');
const { ingestWazuhService } = require('../services/wazuh.service');
const { ingestBurpService } = require('../services/burp.service');
const { ingestOpenVasService } = require('../services/openvas.service');
const { ingestTelemetryService, getRecentTelemetryService } = require('../services/telemetry.service');
const { triggerAiAnalysis } = require('../services/aiTrigger.service');

// Helper function to check for Critical or High severity in array/object payloads
const hasHighOrCriticalSeverity = (body) => {
  const payload = Array.isArray(body) ? body : [body];
  return payload.some((item) => {
    const sev = String(item.severity || '').toLowerCase();
    return sev === 'critical' || sev === 'high';
  });
};

const ingestNmap = async (req, res, next) => {
  try {
    const result = await ingestNmapService(req.body);
    res.status(201).json({
      success: true,
      message: 'Nmap scan telemetry ingested successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const ingestWazuh = async (req, res, next) => {
  try {
    const result = await ingestWazuhService(req.body);

    // --- EVENT-DRIVEN CHECK FOR CRITICAL / HIGH ALERTS ---
    if (hasHighOrCriticalSeverity(req.body)) {
      triggerAiAnalysis('Event-Driven: Critical/High Wazuh Alert Ingested');
    }

    res.status(201).json({
      success: true,
      message: 'Wazuh alert telemetry ingested successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const ingestBurp = async (req, res, next) => {
  try {
    const result = await ingestBurpService(req.body);

    // --- EVENT-DRIVEN CHECK FOR CRITICAL / HIGH VULNERABILITIES ---
    if (hasHighOrCriticalSeverity(req.body)) {
      triggerAiAnalysis('Event-Driven: Critical/High Burp Vuln Ingested');
    }

    res.status(201).json({
      success: true,
      message: 'Burp Suite scan telemetry ingested successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const ingestOpenVas = async (req, res, next) => {
  try {
    const result = await ingestOpenVasService(req.body);

    // --- EVENT-DRIVEN CHECK FOR CRITICAL / HIGH OPENVAS VULNERABILITIES ---
    if (hasHighOrCriticalSeverity(req.body)) {
      triggerAiAnalysis('Event-Driven: Critical/High OpenVAS Vuln Ingested');
    }

    res.status(201).json({
      success: true,
      message: 'OpenVAS vulnerability scan telemetry ingested successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const ingestGenericTelemetry = (type) => async (req, res, next) => {
  try {
    const result = await ingestTelemetryService(type, req.body);
    if (hasHighOrCriticalSeverity(req.body)) {
      triggerAiAnalysis(`Event-Driven: Critical/High ${type} telemetry ingested`);
    }
    res.status(201).json({
      success: true,
      message: `${type} telemetry ingested successfully`,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const listRecentTelemetry = async (req, res, next) => {
  try {
    const events = await getRecentTelemetryService(req.query.limit);
    res.status(200).json({ success: true, count: events.length, data: events });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  ingestNmap,
  ingestWazuh,
  ingestBurp,
  ingestOpenVas,
  ingestGenericTelemetry,
  listRecentTelemetry
};
