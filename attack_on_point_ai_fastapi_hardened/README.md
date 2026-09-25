# Attack On Point AI Engine

This FastAPI service is compatible with the patched Node backend. It provides:

- Monte Carlo asset-level risk quantification with EAL, VaR, risk scores, and ranked drivers.
- Four-part financial impact breakdowns for breach, downtime, regulatory, and reputation loss at asset and portfolio level.
- Binary knapsack/ILP portfolio optimization using PuLP CBC when installed.
- A deterministic dynamic-programming fallback if PuLP is unavailable.
- A severity-only greedy baseline and an optimizer comparison response for judge-facing evidence.
- Ollama-backed analyst answers and executive summaries.
- Background analysis submission back to the Node backend.

## Local Setup

1. Create a virtual environment and install dependencies.

```bash
python -m venv .venv
# macOS/Linux: source .venv/bin/activate
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

2. Copy `.env.example` to `.env` and set `AI_API_KEY` to exactly the same value as the Node backend `API_KEY`.

3. Start Ollama and pull a model once.

```bash
ollama serve
ollama pull llama3.2:3b
```

4. Start the AI service.

```bash
python run.py
```

The service listens on `http://127.0.0.1:8000` by default.

## Node Backend Configuration

In the Node backend `.env`:

```text
API_KEY=the-same-secret-used-by-AI_API_KEY
AI_ENGINE_URL=http://127.0.0.1:8000/run-analysis
FASTAPI_LLM_URL=http://127.0.0.1:8000/analyst-query
PYTHON_OPTIMIZER_URL=http://127.0.0.1:8000/optimize
```

The backend's `POST /ai/run-analysis` calls the AI service. The AI service then fetches `/ai/payload`, runs analysis, and posts the completed report to `/ai/results` using `x-api-key`.

## Endpoints

- `GET /health` - service and configuration health; no key required.
- `POST /run-analysis` - accepts `{ "trigger_reason": "..." }`, starts a background analysis, and returns `202`.
- `POST /monte-carlo` - accepts the backend AI payload and returns asset risks, EAL, and VaR.
- `POST /optimize` - accepts the backend AI payload and returns the selected control portfolio.
- `POST /optimizer-comparison` - returns the full optimizer beside a labelled severity-only baseline.
- `POST /analyst-query` - accepts `{ "query": "...", "user_id": "...", "user_role": "analyst" }` and uses Ollama.

Protected endpoints expect:

```text
x-api-key: the-same-secret-used-by-AI_API_KEY
```

## Model Behavior

Monte Carlo combines CVSS, EPSS, CISA KEV, patch age, internet exposure, business criticality, and capped observed attack-pressure telemetry. It simulates annual loss per asset and returns both asset VaR and an aggregate portfolio 95th-percentile VaR. `MONTE_CARLO_SEED` makes the result repeatable for the same input. The canonical contract accepts both top-level `internet_exposed` and the legacy nested feature field. The telemetry model version is `monte-carlo-v2.1-telemetry`; absent telemetry contributes zero.

The optimizer uses the supplied budget and control costs. It maximizes expected INR risk reduction using measured control effectiveness (claimed effectiveness x configuration coverage x compliance coverage x incident-history adjustment), applies the same overlap factor and 85% maximum combined reduction used by the Node what-if endpoint, and returns `rosi_inr` and `rosi_pct`. It does not silently return a fake result when there are no controls or no budget.

If Ollama is unavailable, Monte Carlo and optimization still complete. Analyst answers and executive summaries use an explicitly labeled deterministic fallback.

## Tests

```bash
python -m unittest discover -s tests -v
python -m py_compile app/*.py run.py tests/*.py
```

No API keys, private keys, `.env` files, or downloaded model files belong in this package.
