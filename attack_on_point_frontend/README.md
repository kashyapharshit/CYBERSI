# Attack On Point Frontend

React/Vite dashboard for the patched SIH26105 backend.

## Setup

1. Copy `.env.example` to `.env`.
2. Set `VITE_API_BASE_URL` to the backend URL. Use the backend PC LAN IP when the browser is on another machine.
3. Install and start:

```bash
npm install
npm run dev -- --host 0.0.0.0
```

Build for deployment:

```bash
npm run build
npm run preview -- --host 0.0.0.0
```

## Backend contract

The UI uses JWT for all dashboard reads and writes. It never puts the scanner machine API key into browser code.

The live attack monitor polls this endpoint every 5 seconds:

```text
GET /telemetry/events?limit=40
Authorization: Bearer <dashboard JWT>
```

This endpoint is included in the paired hardened backend package. Scanner and AI machine writes continue to use `x-api-key` server-side.

The live feed displays the event source, inferred attack label, severity, asset, endpoint/IP, and event time. It recognises common Wazuh, Burp, OpenVAS, Nmap, EDR, IAM, CSPM, and threat-intel signals without claiming that a generic event is a confirmed breach.

## Internal Login and Demo Access

There is intentionally no public registration screen. Production users must be provisioned by the company in MongoDB and sign in through `/auth/login`.

For a GitHub clone demo, the login page includes local-only demo access:

```text
Demo CISO     admin@demo.attackonpoint.local      admin1234
Demo Analyst  analyst@demo.attackonpoint.local    analyst1234
Demo Viewer   viewer@demo.attackonpoint.local     viewer1234
```

Demo accounts never call the backend. They use a deterministic local fixture stored in browser localStorage, so a cloned repository can be opened and demonstrated without MongoDB or FastAPI.

The Demo CISO and Demo Analyst workspaces include a `Simulate demo attack` button. It creates a Wazuh, Burp, or EDR signal, changes the visible risk posture, and updates the Live Attack Monitor. It is deliberately unavailable to the Demo Viewer.

## Role separation

- Admin/CISO: board summary, financial charts, investment lab, controls, audit evidence, attacks, and analyst copilot
- Analyst: technical command view, attacks, asset risk, findings, incidents, and analyst copilot
- Viewer/board: read-only board summary, asset risk, attack watch, and audit evidence

## Main screens

- Overview: EAL, VaR, budget, priority findings, top assets, audit state, and live attack monitor
- Assets: business context, exposure, financial impact, dependencies, and risk-driver drilldown
- Vulnerabilities: CVSS, EPSS, CISA KEV, exploit signals, patch age, and status
- Controls: cost, effectiveness, owner, status, and framework mapping
- Incidents: incident evidence logging
- Analytics: what-if simulation and investment curve
- Audit trail: blockchain anchor verification
- Analyst copilot: FastAPI/Ollama analyst query integration
- Board viewer briefing: plain-language exposure, urgency, and recent evidence summary
- Investment lab: optimizer versus severity-only baseline comparison
- Audit ledger: chain metadata, verification, and visible tamper test

## Compatibility note

The frontend is compatible with the patched backend routes supplied with this project. The backend must have JWT auth, the `/ai/verify-data` route, and the `/telemetry/events` route enabled. CORS must allow the frontend origin when frontend and backend run on different machines.
