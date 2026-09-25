import hashlib
import json
import math
import random
from typing import Any

from .config import settings

MODEL_VERSION = "monte-carlo-v2.1-telemetry"
ATTACK_PRESSURE_WEIGHT = 0.10
FAILED_AUTH_COUNT_CAP = 100.0


def clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return min(maximum, max(minimum, float(value or 0)))


def number(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _criticality_weight(asset: dict[str, Any]) -> float:
    values = {"critical": 1.0, "high": 0.8, "medium": 0.55, "low": 0.3}
    criticality = str(asset.get("criticality", "medium")).lower()
    return values.get(criticality, values.get(str(asset.get("tier", "medium")).lower(), 0.3))


def _snapshot_hash(asset: dict[str, Any], vulnerabilities: list[dict[str, Any]]) -> str:
    source = json.dumps({"asset": asset, "vulnerabilities": vulnerabilities}, sort_keys=True, default=str)
    return hashlib.sha256(source.encode("utf-8")).hexdigest()


def _source_timestamp(asset: dict[str, Any], item: dict[str, Any] | None = None) -> str | None:
    item = item or {}
    return item.get("source_timestamp") or item.get("updated_at") or item.get("updatedAt") or item.get("created_at") or item.get("createdAt") or asset.get("source_timestamp")


def _observed_attack_pressure(asset: dict[str, Any]) -> tuple[float, str]:
    features = asset.get("features") if isinstance(asset.get("features"), dict) else {}
    pressure = clamp(number(asset.get("attack_pressure"))) if asset.get("attack_pressure") is not None else 0.0
    failed_auth_count = clamp(number(features.get("failed_auth_count")) / FAILED_AUTH_COUNT_CAP) if features.get("failed_auth_count") is not None else 0.0
    sources = []
    if asset.get("attack_pressure") is not None:
        sources.append("asset.attack_pressure")
    if features.get("failed_auth_count") is not None:
        sources.append("asset.features.failed_auth_count")
    return max(pressure, failed_auth_count), " + ".join(sources) or "asset.attack_pressure / asset.features.failed_auth_count"


def _signals(asset: dict[str, Any], vulnerabilities: list[dict[str, Any]]) -> list[dict[str, Any]]:
    open_vulnerabilities = [item for item in vulnerabilities if item.get("status") != "fixed"]
    max_cvss_item = max(open_vulnerabilities, key=lambda item: number(item.get("cvss")), default={})
    max_epss_item = max(open_vulnerabilities, key=lambda item: number(item.get("epss")), default={})
    max_patch_item = max(open_vulnerabilities, key=lambda item: number(item.get("patch_age_days")), default={})
    max_cvss = number(max_cvss_item.get("cvss")) / 10.0
    max_epss = number(max_epss_item.get("epss"))
    kev_ratio = (
        sum(1 for item in open_vulnerabilities if item.get("cisa_kev")) / len(open_vulnerabilities)
        if open_vulnerabilities else 0.0
    )
    patch_age = clamp(number(max_patch_item.get("patch_age_days")) / 180.0)
    internet_exposure = 1.0 if asset.get("internet_exposed") or asset.get("is_internet_facing") or asset.get("features", {}).get("internet_exposed") else 0.0
    criticality = _criticality_weight(asset)
    attack_pressure, attack_pressure_source = _observed_attack_pressure(asset)
    return [
        {"factor": "CVSS exploitability", "value": max_cvss, "weight": 0.30, "source": "vulnerability.cvss", "source_timestamp": _source_timestamp(asset, max_cvss_item), "explanation": "Highest open CVSS score across the asset findings."},
        {"factor": "EPSS likelihood", "value": max_epss, "weight": 0.25, "source": "vulnerability.epss", "source_timestamp": _source_timestamp(asset, max_epss_item), "explanation": "Highest EPSS score across the asset findings."},
        {"factor": "CISA KEV exposure", "value": kev_ratio, "weight": 0.20, "source": "vulnerability.cisa_kev", "source_timestamp": _source_timestamp(asset), "explanation": "Share of open findings listed in CISA KEV."},
        {"factor": "Patch age", "value": patch_age, "weight": 0.10, "source": "vulnerability.patch_age_days", "source_timestamp": _source_timestamp(asset, max_patch_item), "explanation": "Oldest open finding age normalized to 180 days."},
        {"factor": "Internet exposure", "value": internet_exposure, "weight": 0.10, "source": "asset.internet_exposed", "source_timestamp": _source_timestamp(asset), "explanation": "Whether the asset is reachable from the internet."},
        {"factor": "Business criticality", "value": criticality, "weight": 0.05, "source": "asset.criticality", "source_timestamp": _source_timestamp(asset), "explanation": "Business criticality multiplier for impact."},
        {"factor": "Observed attack pressure (telemetry)", "value": attack_pressure, "weight": ATTACK_PRESSURE_WEIGHT, "source": attack_pressure_source, "source_timestamp": _source_timestamp(asset), "telemetry": True, "explanation": "Capped observed authentication pressure; not an inferred threat estimate."},
    ]


def _loss_inputs(asset: dict[str, Any], vulnerabilities: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], float, float, float]:
    signals = _signals(asset, vulnerabilities)
    weighted_likelihood = sum(item["value"] * item["weight"] for item in signals)
    likelihood = clamp(weighted_likelihood)
    exposure = 1.0 if asset.get("internet_exposed") or asset.get("is_internet_facing") or asset.get("features", {}).get("internet_exposed") else 0.0
    impact = max(
        1.0,
        number(asset.get("total_records", asset.get("stored_records_count"))) * number(asset.get("cost_per_record_inr", asset.get("cost_per_breached_record_inr")))
        + number(asset.get("hourly_downtime_cost_inr")) * 24
        + number(asset.get("regulatory_penalty_inr"))
        + number(asset.get("reputation_loss_inr")),
    )
    probability = clamp(0.05 + likelihood * 0.75, 0.05, 0.8)
    impact_multiplier = clamp(0.55 + _criticality_weight(asset) * 0.25 + exposure * 0.2, 0.1, 1.0)
    return signals, impact, probability, impact_multiplier


def _simulate_losses(asset: dict[str, Any], vulnerabilities: list[dict[str, Any]], trials: int, seed: int) -> list[float]:
    _, impact, probability, impact_multiplier = _loss_inputs(asset, vulnerabilities)
    asset_seed = int(hashlib.sha256(str(asset.get("asset_id", "")).encode("utf-8")).hexdigest()[:8], 16)
    rng = random.Random(seed + asset_seed)
    return [
        impact * impact_multiplier * rng.lognormvariate(-0.08, 0.42) if rng.random() < probability else 0.0
        for _ in range(trials)
    ]


def _percentile(values: list[float], percentile: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(len(ordered) - 1, math.ceil(len(ordered) * percentile) - 1)
    return ordered[index]


def calculate_asset_risk(
    asset: dict[str, Any],
    vulnerabilities: list[dict[str, Any]],
    trials: int | None = None,
    seed: int | None = None,
    _losses: list[float] | None = None,
) -> dict[str, Any]:
    signals, impact, probability, _ = _loss_inputs(asset, vulnerabilities)
    likelihood = clamp(sum(item["value"] * item["weight"] for item in signals))
    exposure = 1.0 if asset.get("internet_exposed") or asset.get("is_internet_facing") or asset.get("features", {}).get("internet_exposed") else 0.0
    trial_count = max(100, int(trials or settings.monte_carlo_trials))
    losses = _losses if _losses is not None else _simulate_losses(asset, vulnerabilities, trial_count, int(seed or settings.monte_carlo_seed))
    score = round(clamp(likelihood * 0.65 + _criticality_weight(asset) * 0.35) * 99)
    total_contribution = sum(item["value"] * item["weight"] for item in signals) or 1.0
    drivers = sorted([
        {
            "factor": item["factor"],
            "contribution": round((item["value"] * item["weight"]) / total_contribution, 4),
            "value": round(item["value"], 4),
            "weight": item["weight"],
            "source": item["source"],
            "source_timestamp": item.get("source_timestamp"),
            "telemetry": item.get("telemetry", False),
            "explanation": item["explanation"],
        }
        for item in signals
    ], key=lambda item: item["contribution"], reverse=True)
    level = "critical" if score >= 80 else "high" if score >= 60 else "medium" if score >= 35 else "low"
    return {
        "asset_id": asset.get("asset_id", ""),
        "criticality": asset.get("criticality", "medium"),
        "internet_exposed": bool(exposure),
        "severity": level,
        "exploit_available": any(item.get("exploit_available") or item.get("cisa_kev") for item in vulnerabilities),
        "evidence_confidence": 0.8,
        "score": score,
        "level": level,
        "eal_inr": round(sum(losses) / len(losses)) if losses else 0,
        "var_inr": round(_percentile(losses, 0.95)),
        "likelihood": round(probability, 4),
        "impact_inr": round(impact),
        "attack_pressure": round(next((item["value"] for item in signals if item.get("telemetry")), 0.0), 4),
        "drivers": drivers,
        "formula": "EAL=mean(simulated_loss); VaR=P95(simulated_loss); p=clamp(0.05+weighted_likelihood*0.75); observed telemetry is capped before weighting",
        "model_version": MODEL_VERSION,
        "input_snapshot_hash": _snapshot_hash(asset, vulnerabilities),
    }


def analyze_payload(payload: dict[str, Any]) -> dict[str, Any]:
    asset_risks = []
    trial_count = max(100, int(settings.monte_carlo_trials))
    portfolio_losses = [0.0] * trial_count
    for index, asset in enumerate(payload.get("assets", [])):
        vulnerabilities = asset.get("vulnerabilities", [])
        losses = _simulate_losses(asset, vulnerabilities, trial_count, settings.monte_carlo_seed + index)
        asset_risks.append(calculate_asset_risk(asset, vulnerabilities, trials=trial_count, seed=settings.monte_carlo_seed + index, _losses=losses))
        portfolio_losses = [total + loss for total, loss in zip(portfolio_losses, losses)]
    total_eal = sum(item["eal_inr"] for item in asset_risks)
    portfolio_var = _percentile(portfolio_losses, 0.95)
    return {
        "total_expected_annual_loss_inr": round(total_eal),
        "value_at_risk_inr": round(portfolio_var),
        "asset_risks": asset_risks,
        "model_version": MODEL_VERSION,
        "simulation": {
            "trials_per_asset": trial_count,
            "seed": settings.monte_carlo_seed,
            "portfolio_var_method": "aggregate_loss_distribution_p95",
        },
    }
