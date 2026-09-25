# Attack On Point: Complete Project Architecture

## 1. System Shape

```text
Security sources
  Wazuh | Burp Suite | OpenVAS | Nmap | EDR | IAM | CSPM | Threat Intel
       |
       v
Node.js ingestion adapters
  auth + request id + parser + normalizer + local enrichment
       |
       +--> IngestionJob { source, status, counts, error, job_id }
       +--> SecurityEvent { normalized telemetry, raw hash, job link }
       +--> Vulnerability { unified finding, enrichment, regulatory refs, job link }
       |
       v
MongoDB evidence store
  assets | findings | telemetry | controls | incidents | risk | audit | scenarios
       |
       +--> attack pressure analytics
       +--> dependency and blast-radius analytics
       +--> regulatory coverage analytics
       +--> risk payload builder
                    |
                    v
              FastAPI AI service
        Monte Carlo EAL/VaR + optimizer + Ollama copilot
                    |
                    v
       Node.js risk persistence and audit service
          MongoDB report + blockchain anchor + ledger
                    |
                    v
             React role-based command center
```

## 2. Diagram #2: Risk Intelligence Workflow

```text
Ingest -> Normalize -> Enrich -> Correlate -> Quantify -> Explain -> Decide -> Verify
  |         |           |          |           |          |          |          |
  |         |           |          |           |          |          |          +-- hash + blockchain
  |         |           |          |           |          |          +------------- controls, what-if, optimizer
  |         |           |          |           +------------------------ EAL, VaR, asset score, drivers
  |         |           |          +------------------------------------- attack pressure, dependencies, coverage
  |         |           +----------------------------------------------- exploitability, regulatory refs
  |         +----------------------------------------------------------- canonical finding/event contract
  +--------------------------------------------------------------------- Wazuh, scanners, telemetry, incidents
```

The main product decision is to preserve evidence provenance at every step. Findings and telemetry carry `source`, source IDs, timestamps, raw hashes, and `ingestion_job_id`. Risk drivers expose whether a signal came from a vulnerability, asset metadata, or observed telemetry.

## 3. Diagram #4: Unified Evidence and Correlation Model

```text
Asset
  | 1:N                         | 1:N
  v                             v
Vulnerability <-----------> SecurityEvent
  | regulatory_refs             | linked_finding_ids
  v                             v
Control ------------------> RiskHistory
  | framework map                | scenario_type
  v                             | assumptions
RegulatoryCoverage <-----------+

Asset.dependencies -> dependencyCorrelation -> direct, reverse, impacted, depth, blast radius
SecurityEvent      -> attackPressure        -> signals, failed attempts, source IPs, score, confidence
Vulnerability      -> enrichment            -> exploitability, regulatory references, local enrichment version
```

MongoDB is the source of truth for the current implementation. Ingestion jobs are persisted in MongoDB first; Redis or Kafka can be added later if throughput requires queueing beyond the current synchronous adapter boundary. The seed preserves source IPs and data classification, creates deterministic service dependencies when the synthetic fixture omits them, and canonicalizes framework labels across assets, controls, and findings.

## 4. Diagram #6: Control and Verification Loop

```text
Current portfolio
      |
      +--> What-if simulation --------+
      |                               |
      +--> Python optimizer ----------+--> scenario record -> compare -> choose control plan
      |                               |
      +--> Severity-only baseline ----+
                                      |
                                      v
                              AI risk analysis
                                      |
                                      v
                           Risk report + report hash
                                      |
                                      v
                           Blockchain audit anchor
                                      |
                                      v
                      Verify current report and audit chain
```

## 5. Backend Surface

### Ingestion

- `POST /telemetry/nmap`
- `POST /telemetry/wazuh`
- `POST /telemetry/burp`
- `POST /telemetry/openvas`
- `POST /telemetry/:type`
- `POST /vulnerabilities`
- `GET /ingestion/jobs`
- `GET /ingestion/jobs/:job_id`

### Intelligence

- `GET /analytics/attack-pressure`
- `GET /analytics/dependencies/:asset_id`
- `GET /analytics/regulatory-coverage`
- `GET /analytics/scenarios`
- `GET /analytics/risk-trend`
- `POST /analytics/what-if`
- `POST /analytics/optimize`
- `POST /analytics/optimizer-comparison`
- `GET /analytics/audit-report`

Sensitive read routes are protected by role: findings, controls, ingestion jobs, attack pressure, dependency profiles, and scenario history require an admin or analyst JWT; board users receive the executive and audit surfaces only.

### Existing trust controls retained

- JWT and role authorization.
- Machine API-key protection for source ingestion.
- Request IDs, Helmet, configurable CORS, and body limits.
- Chained risk audit records.
- Blockchain anchor verification and tamper testing.

## 6. Frontend Surfaces

- Executive workspace: exposure, EAL, VaR, budget, priority findings, framework coverage.
- Technical workspace: active signals, KEV findings, patch age, asset ranking, live feed.
- Viewer workspace: plain-language board summary, top risks, attack watch, evidence integrity.
- Asset Risk: business context, risk score, EAL, drivers, dependency blast radius.
- Findings: source, finding ID, CVSS, EPSS, exploit signals, age, status, enrichment.
- Evidence Pipeline: ingestion jobs, attack-pressure hotspots, regulatory coverage, scenario history.
- Investment Lab: what-if modelling, investment curve, optimizer versus severity-only comparison.
- Analyst Copilot: evidence-grounded FastAPI/Ollama investigation surface.
- Audit Evidence: report verification, ledger, blockchain status, and tamper test.

## 7. Validation Status

- Backend JavaScript syntax checks pass for the expanded route, controller, service, and application surface.
- AI Python bytecode compilation passes.
- AI regression tests are `unittest`-based and can run with `python -m unittest discover`; the worker image does not include `pytest`, which is not required for this suite.
- User-local end-to-end runtime was previously verified for Wazuh ingestion, AI analysis, blockchain anchoring, secure verification, and tamper detection.

## 8. Deliberate Boundaries

- Observed attack pressure is a bounded telemetry signal, not a threat-intelligence prediction.
- Regulatory coverage is an evidence-derived dashboard metric, not legal or audit certification.
- The optimizer remains optional and falls back to the labelled severity-only comparison when unavailable.
- MongoDB jobs are synchronous in this release; distributed queue infrastructure is intentionally deferred until measured load justifies it.
