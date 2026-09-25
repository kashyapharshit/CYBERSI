# Backend Fixes

This package keeps the existing Express API and synthetic enterprise dataset. It does not add a second optimizer.

## Dataset synchronization

Place `synthetic_enterprise_telemetry.json` at the project root and configure `MONGO_URI`.

```bash
npm install
npm run seed:replace
```

Use `npm run seed` for an additive synchronization. Use `npm run seed:replace` when the database must match the canonical synthetic dataset exactly. The replace mode clears dataset-derived assets, vulnerabilities, controls, risks, risk history, and risk audits. It does not delete users or live security events.

The seed stores dataset name, version, source, IP address, data classification, deterministic dependencies, canonical framework mappings, deterministic baseline risk, EAL, VaR, asset-level driver snapshots, regulatory/reputation values, CMDB/inventory provenance, and control evidence.

## Risk calculation

When an AI result omits an asset or returns an unusable zero-valued record, the backend calculates a deterministic fallback for that asset. The fallback is labeled `backend-deterministic-v2` and includes ranked vulnerability, exposure, business-criticality, observed attack-pressure drivers, a four-part `financial_impact_breakdown`, and an input snapshot hash. Optional incident records refine observed records and downtime without changing existing callers.

What-if reductions use bounded overlap instead of multiplying independent control percentages. Configure:

```text
CONTROL_OVERLAP_FACTOR=0.65
MAX_COMBINED_REDUCTION=0.85
```

## Python optimizer adapter

The Node API remains a thin adapter to the existing Python/FastAPI optimizer. Configure one of:

```text
PYTHON_OPTIMIZER_URL=http://localhost:8000/optimize
# or
AI_OPTIMIZER_URL=http://localhost:8000/optimize
AI_REQUEST_TIMEOUT_MS=15000
```

The adapter posts the same `/ai/payload` data plus `optimizer_options` and `contract_version: optimizer-v1` to `POST /analytics/optimize`. If no optimizer URL is configured, the route returns a clear 503 instead of silently inventing an optimization result.
The payload exposes measured control effectiveness derived from claimed effectiveness, configuration coverage, compliance coverage, and incident history.

## Blockchain routes

Configure `BLOCKCHAIN_RPC_URL` and `BLOCKCHAIN_PRIVATE_KEY` to enable anchoring. The service waits for the transaction receipt before storing the transaction hash.

- `GET /ai/blockchain-status` - admin JWT required; reports wallet, network, block, balance, and reachability.
- `GET /ai/audit-ledger` - dashboard JWT required; returns the append-only chain metadata.
- `GET /ai/verify-data` - dashboard JWT required; verifies the latest stored report, chain link, and blockchain transaction.
- `POST /ai/verify-data/tamper-test` - admin JWT required; changes only an in-memory copy of the latest anchored payload and confirms that the hash no longer matches.

## Focused test flow

```text
GET  /health
POST /auth/login
GET  /ai/payload                  x-api-key: <AI_API_KEY>
POST /ai/results                  x-api-key: <AI_API_KEY>
GET  /risks                       Authorization: Bearer <admin-jwt>
POST /analytics/what-if           Authorization: Bearer <admin-jwt>
POST /analytics/optimize          Authorization: Bearer <admin-jwt>
POST /analytics/optimizer-comparison Authorization: Bearer <admin-jwt>
GET  /ai/blockchain-status        Authorization: Bearer <admin-jwt>
GET  /ai/audit-ledger             Authorization: Bearer <dashboard-jwt>
GET  /ai/verify-data              Authorization: Bearer <dashboard-jwt>
POST /ai/verify-data/tamper-test  Authorization: Bearer <admin-jwt>
```

## Evidence architecture routes

```text
GET /ingestion/jobs                  admin or analyst JWT
GET /analytics/attack-pressure       admin or analyst JWT
GET /analytics/dependencies/:asset_id admin or analyst JWT
GET /analytics/regulatory-coverage   dashboard JWT
GET /analytics/scenarios              admin or analyst JWT
GET /analytics/aggregation            admin or analyst JWT
GET /analytics/portfolio              admin or analyst JWT
GET /analytics/control-effectiveness  admin or analyst JWT
GET /analytics/risk-forecast           admin or analyst JWT
POST /telemetry/stream/:type           x-api-key; edr, iam, cspm, or threat-intel
```

Every machine ingestion response includes a `job_id`. The job ID is stored on the resulting telemetry and finding records, while raw payload hashes and source observation timestamps are retained for traceability.
Stream records and jobs carry `ingestion_mode: "stream"`. Investment-curve entries return `rosi_inr`/`rosi_pct` and preserve the existing `estimated_rosi_*` aliases.

Run `npm run check:syntax` before starting the service. Do not include `.env`, `.DS_Store`, or `node_modules` in an upload.
