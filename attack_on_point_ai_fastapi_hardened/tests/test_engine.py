import unittest

from app.math_engine import analyze_payload
from app.optimizer import optimize_payload, severity_only_baseline


class EngineTests(unittest.TestCase):
    def setUp(self):
        self.payload = {
            "enterprise_budget_inr": 100000,
            "assets": [
                {
                    "asset_id": "AST-1",
                    "criticality": "critical",
                    "internet_exposed": True,
                    "total_records": 1000,
                    "cost_per_record_inr": 100,
                    "hourly_downtime_cost_inr": 1000,
                    "vulnerabilities": [{"cvss": 10, "epss": 0.9, "cisa_kev": True, "patch_age_days": 200}],
                }
            ],
            "candidate_controls": [
                {"control_id": "CTRL-A", "name": "MFA", "cost_inr": 40000, "risk_reduction_pct": 85},
                {"control_id": "CTRL-B", "name": "EDR", "cost_inr": 70000, "risk_reduction_pct": 70},
            ],
        }

    def test_monte_carlo_returns_positive_explainable_risk(self):
        result = analyze_payload(self.payload)
        self.assertGreater(result["total_expected_annual_loss_inr"], 0)
        self.assertEqual(len(result["asset_risks"]), 1)
        self.assertTrue(result["asset_risks"][0]["drivers"])
        self.assertEqual(result["asset_risks"][0]["model_version"], "monte-carlo-v2.1-telemetry")
        self.assertEqual(result["model_version"], "monte-carlo-v2.1-telemetry")

    def test_optimizer_respects_budget_and_cap(self):
        analysis = analyze_payload(self.payload)
        enriched = {**self.payload, "assets": [{**self.payload["assets"][0], "eal_inr": analysis["asset_risks"][0]["eal_inr"]}]}
        result = optimize_payload(enriched)
        self.assertLessEqual(result["spent_inr"], self.payload["enterprise_budget_inr"])
        self.assertLessEqual(result["combined_reduction_pct"], 85)
        self.assertTrue(result["recommended_control_ids"])

    def test_exposure_contract_supports_nested_and_top_level_fields(self):
        nested = analyze_payload(self.payload)
        top_level_payload = {**self.payload, "assets": [{**self.payload["assets"][0], "internet_exposed": True}]}
        top_level = analyze_payload(top_level_payload)
        self.assertTrue(nested["asset_risks"][0]["internet_exposed"])
        self.assertTrue(top_level["asset_risks"][0]["internet_exposed"])
        self.assertGreaterEqual(top_level["value_at_risk_inr"], 0)

    def test_severity_only_baseline_is_budget_bounded(self):
        result = severity_only_baseline(self.payload)
        self.assertLessEqual(result["spent_inr"], self.payload["enterprise_budget_inr"])
        self.assertIn("baseline_version", result)

    def test_attack_pressure_telemetry_is_capped_and_increases_eal(self):
        baseline = analyze_payload(self.payload)
        telemetry_payload = {
            **self.payload,
            "assets": [{
                **self.payload["assets"][0],
                "attack_pressure": 0.4,
                "features": {"failed_auth_count": 1000},
            }],
        }
        capped_payload = {
            **telemetry_payload,
            "assets": [{**telemetry_payload["assets"][0], "features": {"failed_auth_count": 100}},],
        }
        result = analyze_payload(telemetry_payload)
        capped = analyze_payload(capped_payload)
        risk = result["asset_risks"][0]
        pressure_driver = next(driver for driver in risk["drivers"] if driver["telemetry"])
        self.assertEqual(pressure_driver["factor"], "Observed attack pressure (telemetry)")
        self.assertEqual(pressure_driver["value"], 1.0)
        self.assertIn("failed_auth_count", pressure_driver["source"])
        self.assertGreater(risk["eal_inr"], baseline["asset_risks"][0]["eal_inr"])
        self.assertEqual(result["total_expected_annual_loss_inr"], capped["total_expected_annual_loss_inr"])

    def test_zero_attack_pressure_preserves_no_event_eal(self):
        baseline = analyze_payload(self.payload)
        no_event_payload = {
            **self.payload,
            "assets": [{
                **self.payload["assets"][0],
                "attack_pressure": 0,
                "features": {"failed_auth_count": 0},
            }],
        }
        no_event = analyze_payload(no_event_payload)
        self.assertEqual(no_event["total_expected_annual_loss_inr"], baseline["total_expected_annual_loss_inr"])
        self.assertEqual(no_event["asset_risks"][0]["likelihood"], baseline["asset_risks"][0]["likelihood"])
        self.assertEqual(no_event["asset_risks"][0]["score"], baseline["asset_risks"][0]["score"])

    def test_severity_only_baseline_reports_monte_carlo_residual_fields(self):
        analysis = analyze_payload(self.payload)
        result = severity_only_baseline(self.payload)
        reduction = result["combined_reduction_pct"] / 100
        expected_reduction = round(analysis["total_expected_annual_loss_inr"] * reduction)
        expected_residual = round(max(0, analysis["total_expected_annual_loss_inr"] - expected_reduction))
        self.assertEqual(result["estimated_risk_reduction_inr"], expected_reduction)
        self.assertEqual(result["estimated_residual_eal_inr"], expected_residual)
        self.assertGreaterEqual(result["combined_reduction_pct"], 0)
        self.assertLessEqual(result["combined_reduction_pct"], 85)

    def test_financial_impact_breakdown_uses_observed_incident_records(self):
        payload = {
            "assets": [{
                "asset_id": "AST-INCIDENT",
                "criticality": "high",
                "total_records": 1000,
                "cost_per_record_inr": 100,
                "hourly_downtime_cost_inr": 500,
                "regulatory_penalty_inr": 25000,
                "reputation_loss_inr": 15000,
                "incidents": [{"affected_records": 25, "service_downtime_minutes": 120}],
                "vulnerabilities": [],
            }]
        }
        result = analyze_payload(payload)
        breakdown = result["asset_risks"][0]["financial_impact_breakdown"]
        self.assertEqual(breakdown["breach_inr"], 2500)
        self.assertEqual(breakdown["downtime_inr"], 1000)
        self.assertEqual(breakdown["regulatory_inr"], 25000)
        self.assertEqual(breakdown["reputation_inr"], 15000)
        self.assertEqual(breakdown["total_inr"], 43500)
        self.assertEqual(result["financial_impact_breakdown"]["total_inr"], 43500)

    def test_optimizer_calculates_measured_effectiveness_from_evidence(self):
        payload = {
            "enterprise_budget_inr": 2000,
            "assets": [{"asset_id": "AST-1", "eal_inr": 10000}],
            "candidate_controls": [{
                "control_id": "CTRL-EVIDENCE",
                "cost_inr": 1000,
                "claimed_effectiveness": 80,
                "configuration_coverage": 75,
                "compliance_coverage": 50,
                "incident_history_count": 0,
            }],
        }
        result = optimize_payload(payload)
        self.assertEqual(result["recommended_controls"][0]["measured_effectiveness"], 30)
        self.assertIn("rosi_inr", result)
        self.assertIn("rosi_pct", result)


if __name__ == "__main__":
    unittest.main()
