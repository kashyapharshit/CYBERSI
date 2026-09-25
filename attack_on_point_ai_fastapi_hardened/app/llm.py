import json
from typing import Any

import httpx

from .config import settings
from .math_engine import analyze_payload


def _context(payload: dict[str, Any], analysis: dict[str, Any] | None = None) -> str:
    assets = payload.get("assets", [])
    compact_assets = []
    for asset in assets[:12]:
        compact_assets.append({
            "asset_id": asset.get("asset_id"),
            "hostname": asset.get("hostname"),
            "criticality": asset.get("criticality"),
            "internet_exposed": asset.get("features", {}).get("internet_exposed", asset.get("internet_exposed", 0)),
            "vulnerabilities": len(asset.get("vulnerabilities", [])),
        })
    context = {"assets": compact_assets, "controls": payload.get("candidate_controls", [])[:10], "budget_inr": payload.get("enterprise_budget_inr", 0)}
    if analysis:
        context["analysis"] = {
            "total_eal_inr": analysis.get("total_expected_annual_loss_inr"),
            "total_var_inr": analysis.get("value_at_risk_inr"),
            "top_risks": sorted(analysis.get("asset_risks", []), key=lambda item: item.get("eal_inr", 0), reverse=True)[:5],
        }
    return json.dumps(context, default=str)


async def ollama_generate(prompt: str) -> str | None:
    try:
        timeout = httpx.Timeout(
            connect=10.0,
            read=180.0,
            write=30.0,
            pool=10.0
        )

        async with httpx.AsyncClient(
            timeout=timeout,
            trust_env=False
        ) as client:
            response = await client.post(
                f"{settings.ollama_url.rstrip('/')}/api/generate",
                json={
                    "model": settings.ollama_model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
    "temperature": 0.1,
    "num_predict": 250
}
                }
            )

            response.raise_for_status()
            body = response.json()
            return str(body.get("response", "")).strip() or None

    except Exception as error:
        print(f"[OLLAMA ERROR] {type(error).__name__}: {error}")
        return None


async def generate_executive_summary(payload: dict[str, Any], analysis: dict[str, Any], optimizer: dict[str, Any]) -> tuple[str, bool]:
    prompt = (
        "You are a cyber risk quantification assistant. Write a concise executive summary in plain English. "
        "Mention the top risk concentration, annual loss, selected controls, and one next action. Do not invent facts. "
        f"Evidence JSON: {_context(payload, analysis)}\nOptimizer JSON: {json.dumps(optimizer, default=str)}"
    )
    answer = await ollama_generate(prompt)
    if answer:
        return answer, True
    top = sorted(analysis.get("asset_risks", []), key=lambda item: item.get("eal_inr", 0), reverse=True)[:1]
    top_asset = top[0].get("asset_id", "the highest-risk asset") if top else "the current portfolio"
    return (
        f"Monte Carlo analysis estimates annual exposure of INR {analysis.get('total_expected_annual_loss_inr', 0):,.0f}. "
        f"Risk is concentrated in {top_asset}. The recommended portfolio spends INR {optimizer.get('spent_inr', 0):,.0f}; "
        "prioritize the selected controls and validate the highest-risk asset's open findings.",
        False,
    )


async def answer_analyst_query(payload: dict[str, Any], query: str, role: str) -> dict[str, Any]:
    analysis = analyze_payload(payload)

    prompt = (
        "Answer using only the supplied cyber-risk evidence. "
        "EAL means Expected Annual Loss in INR. "
        "Use the Monte Carlo analysis top_risks values for EAL. "
        "Do not expand EAL as Effective Attack Landscape. "
        "Do not guess an asset if the EAL value is not present. "
        "Mention the asset ID and exact EAL when available. "
        f"Role: {role}\n"
        f"Question: {query}\n"
        f"Evidence JSON: {_context(payload, analysis)}"
    )

    answer = await ollama_generate(prompt)

    if answer:
        return {
            "answer": answer,
            "confidence_score": 0.82,
            "recommended_actions": [],
            "processed_by_role": role,
            "llm_provider": "ollama",
            "model": settings.ollama_model
        }

    top = max(
        analysis.get("asset_risks", []),
        key=lambda item: item.get("eal_inr", 0),
        default={}
    )

    asset_id = top.get("asset_id", "the current portfolio")
    eal = top.get("eal_inr", 0)

    return {
        "answer": (
            f"Monte Carlo evidence indicates {asset_id} has the highest "
            f"estimated EAL at INR {eal:,.0f}."
        ),
        "confidence_score": 0.55,
        "recommended_actions": [
            "Patch KEV-listed findings",
            "Run the portfolio optimizer",
            "Re-run Monte Carlo analysis after remediation"
        ],
        "processed_by_role": role,
        "llm_provider": "deterministic-fallback",
        "asset_id": asset_id,
        "estimated_eal_inr": eal
    }