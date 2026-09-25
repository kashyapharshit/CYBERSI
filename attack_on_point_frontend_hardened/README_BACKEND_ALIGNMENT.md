# Frontend and Backend Alignment

The existing live screens already support the backend's settings, asset, vulnerability, risk, audit, and driver fields. The alignment changes in this source package:

- Demo what-if and investment-curve calculations now use the same bounded-overlap reduction model as the backend.
- Added API helpers for the Python optimizer, blockchain status, and tamper-test endpoints.
- Kept the existing response-envelope handling, role navigation, and asset/risk rendering unchanged.

## Build

```bash
npm install
npm run build
```

Set `VITE_API_BASE_URL` to the backend origin before starting the live frontend. Demo login remains local-only and does not call the backend.
