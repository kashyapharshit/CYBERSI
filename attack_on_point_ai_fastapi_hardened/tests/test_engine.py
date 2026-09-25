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
        self.assertEqual(result["asset_risks"][0]["model_version"], "monte-carlo-v2")

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


if __name__ == "__main__":
    unittest.main()
