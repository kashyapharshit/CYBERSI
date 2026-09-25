# Hardened backend package

- Sends a canonical flat exposure field to FastAPI and includes source timestamps.
- Aligns deterministic fallback impact inputs with the AI model.
- Adds request IDs, body-size limits, configurable CORS, and timing-safe machine-key checks.
- Adds optimizer comparison routing for the severity-only baseline.
- Adds chained audit metadata, anchor metadata, ledger listing, chain verification, and visible tamper-test support.
- Removes public access from the report verification endpoint; dashboard JWT is required.
- Adds MongoDB-backed ingestion jobs with job IDs propagated into findings and telemetry.
- Adds local finding enrichment, attack-pressure analytics, dependency/blast-radius profiles, regulatory coverage, and scenario history APIs.
- Adds four-part INR impact breakdowns, incident-based observed-record refinement, measured control effectiveness, aggregation, directional forecasting, stream ingestion, and CMDB/inventory provenance.
- Seed values now include deterministic regulatory, reputation, CMDB/inventory, and control-evidence fields.
