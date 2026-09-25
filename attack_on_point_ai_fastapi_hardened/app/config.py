import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


def _float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


@dataclass(frozen=True)
class Settings:
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = _int("PORT", 8000)
    ai_api_key: str = os.getenv("AI_API_KEY", os.getenv("API_KEY", ""))
    require_api_key: bool = os.getenv("REQUIRE_API_KEY", "true").lower() == "true"
    backend_payload_url: str = os.getenv("BACKEND_AI_PAYLOAD_URL", "http://127.0.0.1:4000/ai/payload")
    backend_results_url: str = os.getenv("BACKEND_AI_RESULTS_URL", "http://127.0.0.1:4000/ai/results")
    backend_timeout_seconds: float = _float("BACKEND_TIMEOUT_SECONDS", 30.0)
    ollama_url: str = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
    ollama_model: str = os.getenv("OLLAMA_MODEL", "llama3.2:3b")
    ollama_timeout_seconds: float = _float("OLLAMA_TIMEOUT_SECONDS", 90.0)
    monte_carlo_trials: int = _int("MONTE_CARLO_TRIALS", 4000)
    monte_carlo_seed: int = _int("MONTE_CARLO_SEED", 20260925)
    control_overlap_factor: float = _float("CONTROL_OVERLAP_FACTOR", 0.65)
    maximum_reduction: float = _float("MAX_COMBINED_REDUCTION", 0.85)
    optimizer_budget_unit_inr: int = _int("OPTIMIZER_BUDGET_UNIT_INR", 1000)


settings = Settings()
