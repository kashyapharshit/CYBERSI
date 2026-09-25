# Attack On Point: Local Run Guide

Use `attack_on_point_hardened_bundle.zip`. Extract it into one folder. It contains:

- `attack_on_point_backend_hardened`
- `attack_on_point_ai_fastapi_hardened`
- `attack_on_point_frontend_hardened`

## Quick UI Demo

The frontend has local demo access and can run without MongoDB or FastAPI:

```text
Admin:   admin@demo.attackonpoint.local   / admin1234
Analyst: analyst@demo.attackonpoint.local / analyst1234
Viewer:  viewer@demo.attackonpoint.local  / viewer1234
```

Run the frontend:

```bash
cd attack_on_point_frontend_hardened
npm install
cp .env.example .env
npm run dev -- --host 0.0.0.0
```

Windows PowerShell copy command:

```powershell
Copy-Item .env.example .env
```

Open `http://localhost:5173`.

## Full Live Setup

Install Node.js 20+, Python 3.11+, MongoDB, and Postman. Ollama is optional, but required for live chatbot answers.

Start MongoDB using the normal service/app method for your operating system.

### 1. Backend

```bash
cd attack_on_point_backend_hardened
npm install
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Edit `.env` and set fresh values for `API_KEY`, `JWT_SECRET`, and all six `BOOTSTRAP_*` values. Keep the default local MongoDB and service URLs unless you use another host:

```text
MONGO_URI=mongodb://127.0.0.1:27017/CYBER_DB
API_KEY=<long-random-machine-key>
JWT_SECRET=<long-random-jwt-secret>
CORS_ORIGINS=http://localhost:5173
AI_ENGINE_URL=http://127.0.0.1:8000/run-analysis
FASTAPI_LLM_URL=http://127.0.0.1:8000/analyst-query
PYTHON_OPTIMIZER_URL=http://127.0.0.1:8000/optimize
PYTHON_OPTIMIZER_COMPARISON_URL=http://127.0.0.1:8000/optimizer-comparison
```

Create the synthetic dataset and users:

```bash
npm run seed:replace
npm run seed:users
npm run check:syntax
npm start
```

Backend URL: `http://localhost:4000`

After login, the admin dashboard also reads these evidence endpoints:

```text
GET http://localhost:4000/analytics/portfolio
GET http://localhost:4000/analytics/control-effectiveness
GET http://localhost:4000/analytics/risk-forecast?horizon_days=30
GET http://localhost:4000/analytics/investment-curve
```

Machine stream batches use the API key and the new explicit stream route:

```text
POST http://localhost:4000/telemetry/stream/edr
POST http://localhost:4000/telemetry/stream/iam
POST http://localhost:4000/telemetry/stream/cspm
POST http://localhost:4000/telemetry/stream/threat-intel
```

### 2. AI Service

Open a second terminal:

```bash
cd attack_on_point_ai_fastapi_hardened
python -m venv .venv
```

macOS/Linux:

```bash
source .venv/bin/activate
```

Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

Install and configure:

```bash
pip install -r requirements.txt
cp .env.example .env
python run.py
```

Set `AI_API_KEY` in the AI `.env` to exactly the same value as backend `API_KEY`.

AI URL: `http://localhost:8000`

For live Ollama answers, use another terminal:

```bash
ollama serve
ollama pull llama3.2:3b
```

Monte Carlo and optimization still work if Ollama is unavailable; chatbot answers use a labelled fallback.

### 3. Frontend

Open a third terminal:

```bash
cd attack_on_point_frontend_hardened
npm install
cp .env.example .env
npm run dev -- --host 0.0.0.0
```

Set this in frontend `.env`:

```text
VITE_API_BASE_URL=http://localhost:4000
```

Open `http://localhost:5173` and log in with the admin, analyst, or viewer credentials created by `seed:users`.

## Postman Live Attack Test

For scanner writes, add these headers:

```text
x-api-key: <backend API_KEY>
Content-Type: application/json
```

Send:

```text
POST http://localhost:4000/telemetry/wazuh
```

Example body:

```json
{
  "asset_id": "AST-20001",
  "source": "Wazuh",
  "event_type": "credential_stuffing_detected",
  "severity": "critical",
  "source_ip": "185.22.14.8",
  "endpoint": "/auth/login",
  "failed_attempts": 540,
  "timestamp": "2026-09-25T12:00:00Z"
}
```

High and critical telemetry triggers the AI analysis flow. Refresh the dashboard to see the event and updated risk posture.

The response includes a `job_id`. Use it to inspect ingestion status:

```text
GET http://localhost:4000/ingestion/jobs
Authorization: Bearer <admin-or-analyst-jwt>
```

Other ingestion routes:

```text
POST /telemetry/nmap
POST /telemetry/burp
POST /telemetry/openvas
POST /telemetry/edr
POST /telemetry/iam
POST /telemetry/cspm
POST /telemetry/threat-intel
```

## Health Checks

```bash
curl http://localhost:4000/health
curl http://localhost:8000/health
```

Both services should return an `UP` status.

## Architecture Analytics

After seeding and sending telemetry, the admin or analyst Evidence Pipeline view reads:

```text
GET /analytics/attack-pressure
GET /analytics/dependencies/:asset_id
GET /analytics/scenarios
```

The regulatory coverage route is available to every authenticated dashboard role:

```text
GET /analytics/regulatory-coverage
Authorization: Bearer <dashboard-jwt>
```

Coverage is an evidence-derived metric from stored control status and framework mappings. It is not legal or audit certification.

## Blockchain Audit

Smart contract deploy karna zaroori nahi hai. The backend sends a zero-value self-transaction and stores `RISK_HASH:<sha256>` in the transaction data.

Recommended local demo chain: open a new terminal after installing Node.js and run:

```bash
npx ganache --server.host 127.0.0.1 --server.port 8545
```

Ganache output mein printed first account ka private key copy karo. Ganache terminal open rehna chahiye because it is the local blockchain node.

Then set these backend `.env` values:

```text
BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
BLOCKCHAIN_PRIVATE_KEY=<funded-local-demo-wallet-key>
```

Use only a disposable local wallet. Never use a real wallet key.

Restart the backend after changing `.env`.

Check the connection with the admin JWT:

```text
GET http://localhost:4000/ai/blockchain-status
Authorization: Bearer <admin-jwt>
```

Expected fields include `configured: true`, `reachable: true`, a wallet address, a chain ID, and a funded balance.

Create a real audit anchor by sending a `critical` or `high` Postman telemetry event. Wait for the AI result to be saved. Then use the Admin audit screen or these routes:

```text
GET  http://localhost:4000/ai/audit-ledger
     Authorization: Bearer <admin-or-analyst-jwt>

GET  http://localhost:4000/ai/verify-data
     Authorization: Bearer <admin-or-analyst-jwt>

POST http://localhost:4000/ai/verify-data/tamper-test
     Authorization: Bearer <admin-jwt>
```

Expected result:

- Audit ledger: `verification_status: anchored`, `tx_hash`, `block_number`, `network`, and `signer`.
- Verify: `status: SECURE`.
- Tamper test: `status: TAMPERED`.

The demo-only frontend login shows a simulated `demo-local` anchor. Use the live backend login and a real telemetry event to see the Ganache transaction.

## Frontend Build Check

```bash
npm run build
```

The packages intentionally do not include `.env`, private keys, or installed dependencies. Rotate any credentials from the original uploaded archives before deployment.
