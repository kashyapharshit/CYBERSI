# CYBERSI

CYBERSI is a security intelligence and risk-management platform for collecting cybersecurity evidence, correlating threats and vulnerabilities, quantifying organizational risk, and presenting actionable insights to technical, analytical, and executive users.

The project is organized as a full-stack system named **Attack On Point**, combining a React command center, a Node.js backend, and a Python FastAPI intelligence service.

## What it does

- Ingests telemetry and findings from sources such as Wazuh, Burp Suite, OpenVAS, Nmap, EDR, IAM, CSPM, and threat intelligence feeds.
- Normalizes and enriches security data into a unified evidence model.
- Correlates assets, vulnerabilities, security events, dependencies, controls, and incidents.
- Calculates risk indicators such as asset risk, attack pressure, expected annual loss (EAL), and value at risk (VaR).
- Supports what-if analysis and optional investment optimization for security control planning.
- Provides an analyst copilot through a FastAPI service and optional Ollama integration.
- Preserves evidence provenance with source metadata, request IDs, hashes, ingestion jobs, and audit records.
- Anchors risk reports to a local blockchain-compatible network for integrity verification.
- Presents role-based workspaces for executives, analysts, technical users, and viewers.

## Architecture

```text
Security sources
      |
      v
Node.js backend
  ingestion, normalization, auth, analytics, persistence
      |
      v
MongoDB evidence store
  assets, findings, telemetry, controls, incidents, risk, audit
      |
      +----------------------+
      |                      |
      v                      v
Python FastAPI AI service   Node.js audit/risk services
  EAL/VaR, optimizer,       report persistence and blockchain anchoring
  optional Ollama copilot
      |                      |
      +----------+-----------+
                 v
        React role-based command center
```

MongoDB is the source of truth for the current implementation. The system is designed so queue infrastructure such as Redis or Kafka can be introduced later if measured throughput requires it.

## Repository layout

| Directory or file | Purpose |
| --- | --- |
| `attack_on_point_frontend_hardened/` | React/Vite dashboard and role-based command center |
| `attack_on_point_backend_hardened/` | Node.js API, ingestion adapters, analytics, authentication, risk persistence, and audit services |
| `attack_on_point_ai_fastapi_hardened/` | Python FastAPI service for risk analysis, Monte Carlo calculations, optimization, and analyst queries |
| `ATTACK_ON_POINT_ARCHITECTURE.md` | Detailed system architecture and API surface |
| `LOCAL_RUN_GUIDE.md` | Local development, demo, integration, and blockchain setup instructions |
| `AOP_RECOMMENDED_CHANGES_COPY_PASTE.md` | Recommended implementation changes and follow-up notes |

## Main product areas

- **Executive workspace:** exposure summary, EAL, VaR, budget, priority findings, and framework coverage.
- **Technical workspace:** active signals, KEV findings, patch age, asset ranking, and live telemetry.
- **Viewer workspace:** plain-language summaries, top risks, attack watch, and evidence integrity.
- **Asset Risk:** business context, risk scores, risk drivers, and dependency blast radius.
- **Findings:** source details, CVSS/EPSS data, exploit signals, age, status, and enrichment.
- **Evidence Pipeline:** ingestion jobs, attack-pressure hotspots, regulatory coverage, and scenario history.
- **Investment Lab:** what-if simulations, investment curves, and optimizer comparisons.
- **Analyst Copilot:** evidence-grounded investigation through the FastAPI/Ollama integration.
- **Audit Evidence:** report verification, audit ledger, blockchain status, and tamper testing.

## Technology stack

- **Frontend:** JavaScript, React, Vite, CSS
- **Backend:** Node.js, JavaScript, MongoDB
- **AI and analytics:** Python, FastAPI, Monte Carlo analysis, optimization, optional Ollama
- **Audit integrity:** cryptographic report hashes and blockchain-compatible anchoring
- **Testing and validation:** JavaScript syntax checks, Python compilation, and Python `unittest` coverage

## Quick start

For the complete setup, see [`LOCAL_RUN_GUIDE.md`](LOCAL_RUN_GUIDE.md).

### Frontend demo

The frontend can be started independently for a local UI demo:

```bash
cd attack_on_point_frontend_hardened
npm install
cp .env.example .env
npm run dev -- --host 0.0.0.0
```

Open [http://localhost:5173](http://localhost:5173).

### Full local setup

The full system requires Node.js 20+, Python 3.11+, MongoDB, and optionally Ollama for live chatbot responses.

Start the backend:

```bash
cd attack_on_point_backend_hardened
npm install
cp .env.example .env
npm run seed:replace
npm run seed:users
npm run check:syntax
npm start
```

Start the AI service in a separate terminal:

```bash
cd attack_on_point_ai_fastapi_hardened
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python run.py
```

Then start the frontend:

```bash
cd attack_on_point_frontend_hardened
npm install
cp .env.example .env
npm run dev -- --host 0.0.0.0
```

Default local service URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`
- AI service: `http://localhost:8000`

## Security model

The platform includes several application-level security controls:

- JWT-based authentication and role authorization.
- API-key protection for machine telemetry ingestion.
- Request IDs, Helmet security headers, configurable CORS, and body-size limits.
- Evidence provenance through source identifiers, timestamps, raw hashes, and ingestion job links.
- Chained risk audit records and blockchain anchor verification.

Never commit real credentials, private keys, production tokens, or populated `.env` files. Use the provided `.env.example` files and rotate all local demo secrets before deployment.

## API capabilities

The backend exposes APIs for:

- Telemetry ingestion from security tools and machine streams.
- Vulnerability submission and ingestion job tracking.
- Attack-pressure, dependency, regulatory-coverage, and risk-trend analytics.
- What-if simulations and optimizer comparisons.
- Audit report generation, ledger inspection, and integrity verification.

See [`ATTACK_ON_POINT_ARCHITECTURE.md`](ATTACK_ON_POINT_ARCHITECTURE.md) for the documented endpoint groups and data flow.

## Project boundaries

- Attack pressure is an evidence-based telemetry signal, not a threat-intelligence prediction.
- Regulatory coverage is an evidence-derived dashboard metric, not legal or audit certification.
- The optimizer is optional and can fall back to a severity-only comparison.
- MongoDB ingestion jobs are synchronous in the current release; distributed queues are intentionally deferred until required by measured load.

## Development notes

Before opening a pull request:

1. Keep secrets and local runtime files out of version control.
2. Run the backend syntax check and frontend production build.
3. Compile or test the Python AI service with the commands documented in `LOCAL_RUN_GUIDE.md`.
4. Update architecture or setup documentation when changing service boundaries or environment variables.
5. Preserve evidence provenance and role-based access controls when adding new data flows.

## Documentation

- [Architecture](ATTACK_ON_POINT_ARCHITECTURE.md)
- [Local run guide](LOCAL_RUN_GUIDE.md)
- [Recommended changes](AOP_RECOMMENDED_CHANGES_COPY_PASTE.md)

## License

No license has been specified for this repository yet. Add a license before distributing or reusing the project publicly.
