# Hardened AI package

- Fixed the exposure contract so top-level and legacy nested exposure fields are both accepted.
- Added aggregate portfolio VaR from the simulated loss distribution.
- Added source timestamps, weights, formulas, and `monte-carlo-v2` evidence metadata.
- Added the labelled severity-only baseline and `/optimizer-comparison` endpoint.
- Added an in-flight job lock so repeated triggers do not overlap analysis jobs.
- API-key protection now defaults to enabled.
