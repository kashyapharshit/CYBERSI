# Frontend and Backend Alignment

The existing live screens support the backend's settings, asset, vulnerability, risk, audit, and driver fields. The alignment changes in this source package:

- Demo what-if and investment-curve calculations now use the same bounded-overlap reduction model as the backend.
- Added API helpers for the Python optimizer, blockchain status, and tamper-test endpoints.
- Added an Evidence Pipeline view for ingestion jobs, attack pressure, regulatory coverage, and scenario history.
- Added dependency/blast-radius profiles to asset drilldowns and source/enrichment columns to findings.
- Restricted sensitive backend reads by role and made the frontend avoid requests the current role cannot access.
- Preserved the mixed response contracts for audit, what-if, and verification while retaining server error details for tamper detection.

## Build

```bash
npm install
npm run build
```

Set `VITE_API_BASE_URL` to the backend origin before starting the live frontend. Demo login remains local-only and does not call the backend.
