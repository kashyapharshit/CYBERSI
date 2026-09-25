import asyncio
from typing import Any

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException

from .backend_client import fetch_ai_payload, submit_ai_results
from .config import settings
from .llm import answer_analyst_query, generate_executive_summary
from .math_engine import analyze_payload
from .optimizer import optimize_payload, severity_only_baseline
from .security import require_api_key

app = FastAPI(title="Attack On Point AI Engine", version="1.0.0")
analysis_lock = asyncio.Lock()


def _with_analysis_eal(payload: dict[str, Any], analysis: dict[str, Any]) -> dict[str, Any]:
    risk_map = {item.get("asset_id"): item for item in analysis.get("asset_risks", [])}
    return {
        **payload,
        "assets": [{**asset, "eal_inr": risk_map.get(asset.get("asset_id"), {}).get("eal_inr", 0)} for asset in payload.get("assets", [])],
    }


async def _run_analysis_job(trigger_reason: str) -> None:
    if analysis_lock.locked():
        print("[AI] Analysis skipped because another analysis is already running.")
        return
    async with analysis_lock:
        try:
            payload = await fetch_ai_payload()
            analysis = await asyncio.to_thread(analyze_payload, payload)
            optimizer = await asyncio.to_thread(optimize_payload, _with_analysis_eal(payload, analysis), {"objective": "maximize_risk_reduction"})
            executive_summary, llm_used = await generate_executive_summary(payload, analysis, optimizer)
            result = {
                **analysis,
                "recommended_control_ids": optimizer.get("recommended_control_ids", []),
                "recommended_controls": optimizer.get("recommended_controls", []),
                "executive_summary": executive_summary,
                "llm_provider": settings.ollama_model if llm_used else "deterministic-fallback",
                "optimizer": optimizer,
                "trigger_reason": trigger_reason,
            }
            await submit_ai_results(result)
            print(f"[AI] Analysis submitted: assets={len(analysis.get('asset_risks', []))} eal={analysis.get('total_expected_annual_loss_inr')}")
        except Exception as error:  # Background jobs must not terminate the API process.
            print(f"[AI] Analysis job failed: {error}")


@app.get("/")
async def root() -> dict[str, Any]:
    return {"service": "attack-on-point-ai", "version": app.version, "ollama_model": settings.ollama_model}


@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "status": "UP",
        "service": "attack-on-point-ai",
        "ollama_url": settings.ollama_url,
        "ollama_model": settings.ollama_model,
        "backend_payload_url": settings.backend_payload_url,
        "monte_carlo_trials": settings.monte_carlo_trials,
    }


@app.post("/run-analysis", status_code=202, dependencies=[Depends(require_api_key)])
async def run_analysis(request: dict[str, Any], background_tasks: BackgroundTasks) -> dict[str, Any]:
    trigger_reason = str(request.get("trigger_reason", "Backend analysis trigger"))
    background_tasks.add_task(_run_analysis_job, trigger_reason)
    return {"status": "accepted", "message": "Analysis started in the background.", "trigger_reason": trigger_reason}


@app.post("/monte-carlo", dependencies=[Depends(require_api_key)])
async def monte_carlo(payload: dict[str, Any]) -> dict[str, Any]:
    return await asyncio.to_thread(analyze_payload, payload)


@app.post("/optimize", dependencies=[Depends(require_api_key)])
async def optimize(payload: dict[str, Any]) -> dict[str, Any]:
    return await asyncio.to_thread(optimize_payload, payload, payload.get("optimizer_options"))


@app.post("/optimizer-comparison", dependencies=[Depends(require_api_key)])
async def optimizer_comparison(payload: dict[str, Any]) -> dict[str, Any]:
    options = payload.get("optimizer_options") or {}
    optimized = await asyncio.to_thread(optimize_payload, payload, options)
    baseline = await asyncio.to_thread(severity_only_baseline, payload, options)
    return {
        "comparison_version": "optimizer-comparison-v1",
        "budget_inr": optimized.get("budget_inr", 0),
        "optimizer": optimized,
        "severity_only_baseline": baseline,
        "note": "Severity-only is an intentionally limited greedy baseline; it is not a production risk model.",
    }


@app.post("/analyst-query", dependencies=[Depends(require_api_key)])
async def analyst_query(request: dict[str, Any]) -> dict[str, Any]:
    query = str(request.get("query", "")).strip()
    if not query:
        raise HTTPException(status_code=400, detail="query is required")
    try:
        payload = await fetch_ai_payload()
    except Exception as error:
        raise HTTPException(status_code=502, detail=f"Backend evidence payload unavailable: {error}") from error
    return await answer_analyst_query(payload, query, str(request.get("user_role", "analyst")))
