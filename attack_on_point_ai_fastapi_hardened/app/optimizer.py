from typing import Any

from .config import settings
from .math_engine import analyze_payload


def _reduction(value: Any) -> float:
    try:
        number = float(value or 0)
    except (TypeError, ValueError):
        number = 0.0
    if number > 1:
        number /= 100
    return min(1.0, max(0.0, number))


def _measured_effectiveness(control: dict[str, Any]) -> float:
    if control.get("measured_effectiveness") is not None:
        return _reduction(control.get("measured_effectiveness"))
    claimed = _reduction(control.get("claimed_effectiveness", control.get("risk_reduction_pct", control.get("effectiveness", 0))))
    status_coverage = {"implemented": 1.0, "partial": 0.5, "not_implemented": 0.0}.get(str(control.get("status")), 1.0 if not control.get("status") else 0.0)
    configuration = _reduction(control["configuration_coverage"]) if control.get("configuration_coverage") is not None else status_coverage
    compliance = _reduction(control["compliance_coverage"]) if control.get("compliance_coverage") is not None else 1.0
    history = control.get("incident_history")
    history_count = len(history) if isinstance(history, list) else float(history or control.get("incident_history_count", 0) or 0)
    incident_factor = max(0.5, 1.0 - min(5.0, history_count) * 0.1)
    return min(1.0, max(0.0, claimed * configuration * compliance * incident_factor))


def _target_eal(control: dict[str, Any], asset_eal: dict[str, float], total_eal: float) -> float:
    target = str(control.get("target_asset_id") or "GLOBAL")
    return asset_eal.get(target, total_eal) if target != "GLOBAL" else total_eal


def _items(payload: dict[str, Any], asset_eal_override: dict[str, float] | None = None) -> list[dict[str, Any]]:
    asset_eal = asset_eal_override or {str(item.get("asset_id")): float(item.get("eal_inr", 0) or 0) for item in payload.get("assets", [])}
    total_eal = sum(asset_eal.values())
    result = []
    for control in payload.get("candidate_controls", payload.get("controls", [])):
        cost = max(0, int(float(control.get("cost_inr", 0) or 0)))
        reduction = _measured_effectiveness(control)
        target_eal = _target_eal(control, asset_eal, total_eal)
        value = target_eal * reduction * settings.control_overlap_factor
        result.append({"control": {**control, "measured_effectiveness": round(reduction * 100, 2)}, "cost": cost, "reduction": reduction, "target_eal": target_eal, "value": value})
    return result


def _solve_with_pulp(items: list[dict[str, Any]], budget: int) -> tuple[list[int], str] | None:
    try:
        import pulp
    except ImportError:
        return None
    problem = pulp.LpProblem("cyber_control_portfolio", pulp.LpMaximize)
    variables = [pulp.LpVariable(f"control_{index}", cat="Binary") for index in range(len(items))]
    problem += pulp.lpSum(item["value"] * variables[index] for index, item in enumerate(items))
    problem += pulp.lpSum(item["cost"] * variables[index] for index, item in enumerate(items)) <= budget
    problem.solve(pulp.PULP_CBC_CMD(msg=False))
    if pulp.LpStatus[problem.status] not in {"Optimal", "Feasible"}:
        return None
    return [index for index, variable in enumerate(variables) if variable.value() and variable.value() > 0.5], "PuLP-CBC"


def _solve_with_dp(items: list[dict[str, Any]], budget: int) -> tuple[list[int], str]:
    unit = max(1, settings.optimizer_budget_unit_inr)
    capacity = max(0, budget // unit)
    states: dict[int, tuple[float, tuple[int, ...]]] = {0: (0.0, ())}
    for index, item in enumerate(items):
        cost_units = (item["cost"] + unit - 1) // unit
        if cost_units > capacity:
            continue
        next_states = dict(states)
        for used, (value, chosen) in states.items():
            next_used = used + cost_units
            if next_used > capacity:
                continue
            next_value = value + item["value"]
            if next_used not in next_states or next_value > next_states[next_used][0]:
                next_states[next_used] = (next_value, chosen + (index,))
        states = next_states
    _, best = max(states.values(), key=lambda item: item[0], default=(0.0, ()))
    return list(best), "Fallback-DP"


def _bounded_reduction(selected: list[dict[str, Any]]) -> float:
    combined = 0.0
    overlap = min(1.0, max(0.0, settings.control_overlap_factor))
    maximum = min(0.95, max(0.1, settings.maximum_reduction))
    for item in selected:
        combined = min(maximum, combined + item["reduction"] * (1 - combined) * overlap)
    return combined


def optimize_payload(payload: dict[str, Any], options: dict[str, Any] | None = None) -> dict[str, Any]:
    options = options or payload.get("optimizer_options") or {}
    budget = int(float(options.get("budget_inr", payload.get("enterprise_budget_inr", 0)) or 0))
    supplied_eal = {str(item.get("asset_id")): float(item.get("eal_inr", 0) or 0) for item in payload.get("assets", [])}
    if not any(supplied_eal.values()):
        baseline = analyze_payload(payload)
        supplied_eal = {str(item.get("asset_id")): float(item.get("eal_inr", 0) or 0) for item in baseline.get("asset_risks", [])}
    items = _items(payload, supplied_eal)
    solved = _solve_with_pulp(items, budget)
    selected_indexes, solver = solved if solved is not None else _solve_with_dp(items, budget)
    selected_items = [items[index] for index in selected_indexes]
    selected_controls = [item["control"] for item in selected_items]
    spent = sum(item["cost"] for item in selected_items)
    total_eal = sum(supplied_eal.values())
    combined_reduction = _bounded_reduction(selected_items)
    reduction_inr = total_eal * combined_reduction
    rosi_inr = reduction_inr - spent
    rosi_pct = (rosi_inr / spent * 100) if spent else 0.0
    return {
        "contract_version": "optimizer-v1",
        "optimizer_status": "optimal" if solver == "PuLP-CBC" else "fallback",
        "solver": solver,
        "budget_inr": budget,
        "spent_inr": spent,
        "remaining_budget_inr": max(0, budget - spent),
        "recommended_control_ids": [control.get("control_id") for control in selected_controls],
        "recommended_controls": selected_controls,
        "combined_reduction_pct": round(combined_reduction * 100, 2),
        "estimated_risk_reduction_inr": round(reduction_inr),
        "estimated_residual_eal_inr": round(max(0, total_eal - reduction_inr)),
        "rosi_inr": round(rosi_inr),
        "rosi_pct": round(rosi_pct, 2),
        "assumptions": {
            "control_overlap_factor": settings.control_overlap_factor,
            "maximum_reduction": settings.maximum_reduction,
            "objective": options.get("objective", "maximize_risk_reduction"),
            "budget_unit_inr": settings.optimizer_budget_unit_inr if solver == "Fallback-DP" else None,
        },
    }


def severity_only_baseline(payload: dict[str, Any], options: dict[str, Any] | None = None) -> dict[str, Any]:
    """Return a transparent greedy baseline that ranks only by CVSS severity."""
    options = options or payload.get("optimizer_options") or {}
    budget = int(float(options.get("budget_inr", payload.get("enterprise_budget_inr", 0)) or 0))
    analysis = analyze_payload(payload)
    actual_total_eal = float(analysis.get("total_expected_annual_loss_inr", 0) or 0)
    asset_severity = {}
    for asset in payload.get("assets", []):
        open_vulnerabilities = [item for item in asset.get("vulnerabilities", []) if item.get("status") != "fixed"]
        asset_severity[str(asset.get("asset_id"))] = max((float(item.get("cvss", 0) or 0) / 10 for item in open_vulnerabilities), default=0.0)
    maximum_severity = max(asset_severity.values(), default=0.0)
    candidates = []
    for control in payload.get("candidate_controls", payload.get("controls", [])):
        cost = max(0, int(float(control.get("cost_inr", 0) or 0)))
        reduction = _measured_effectiveness(control)
        target = str(control.get("target_asset_id") or "GLOBAL")
        severity = asset_severity.get(target, maximum_severity) if target != "GLOBAL" else maximum_severity
        value = severity * reduction
        candidates.append({"control": {**control, "measured_effectiveness": round(reduction * 100, 2)}, "cost": cost, "reduction": reduction, "severity_value": value})
    candidates.sort(key=lambda item: (item["severity_value"] / item["cost"]) if item["cost"] else item["severity_value"], reverse=True)
    selected = []
    spent = 0
    for item in candidates:
        if spent + item["cost"] <= budget:
            selected.append(item)
            spent += item["cost"]
    selected_controls = [item["control"] for item in selected]
    possible_value = sum(item["severity_value"] for item in candidates) or 1.0
    achieved_value = sum(item["severity_value"] for item in selected)
    combined_reduction = _bounded_reduction(selected)
    estimated_risk_reduction = actual_total_eal * combined_reduction
    rosi_inr = estimated_risk_reduction - spent
    rosi_pct = (rosi_inr / spent * 100) if spent else 0.0
    return {
        "baseline_version": "severity-only-greedy-v2",
        "baseline_status": "illustrative",
        "budget_inr": budget,
        "spent_inr": spent,
        "remaining_budget_inr": max(0, budget - spent),
        "recommended_control_ids": [control.get("control_id") for control in selected_controls],
        "recommended_controls": selected_controls,
        "severity_coverage_pct": round((achieved_value / possible_value) * 100, 2),
        "combined_reduction_pct": round(combined_reduction * 100, 2),
        "estimated_risk_reduction_inr": round(estimated_risk_reduction),
        "estimated_residual_eal_inr": round(max(0, actual_total_eal - estimated_risk_reduction)),
        "rosi_inr": round(rosi_inr),
        "rosi_pct": round(rosi_pct, 2),
        "assumptions": {
            "ranking": "highest CVSS per target asset; EPSS, KEV, patch age, exposure, and business impact ignored",
            "control_selection": "greedy severity value per rupee",
        },
    }
