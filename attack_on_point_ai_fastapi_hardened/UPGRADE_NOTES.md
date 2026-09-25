# Hardened AI package

- Fixed the exposure contract so top-level and legacy nested exposure fields are both accepted.
- Added aggregate portfolio VaR from the simulated loss distribution.
- Added source timestamps, weights, formulas, observed attack-pressure telemetry, and `monte-carlo-v2.1-telemetry` evidence metadata.
- Added the labelled severity-only baseline and `/optimizer-comparison` endpoint.
- Added an in-flight job lock so repeated triggers do not overlap analysis jobs.
- Concurrent `/run-analysis` requests now return HTTP 409 instead of being silently accepted and dropped.
- API-key protection now defaults to enabled.
- Risk output includes asset and portfolio financial-impact breakdowns for breach, downtime, regulatory, and reputation loss; optional incident records refine observed values.
- Optimizer candidates calculate or consume measured control effectiveness and return `rosi_inr` and `rosi_pct`.
- AI risk output preserves CMDB/inventory provenance supplied by the backend.
