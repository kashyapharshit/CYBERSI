from typing import Any

import httpx

from .config import settings


def _headers() -> dict[str, str]:
    return {"x-api-key": settings.ai_api_key, "Content-Type": "application/json"}


async def fetch_ai_payload() -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=settings.backend_timeout_seconds) as client:
        response = await client.get(settings.backend_payload_url, headers=_headers())
        response.raise_for_status()
        data = response.json()
        return data.get("data", data) if isinstance(data, dict) else {}


async def submit_ai_results(results: dict[str, Any]) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=settings.backend_timeout_seconds) as client:
        response = await client.post(settings.backend_results_url, headers=_headers(), json=results)
        response.raise_for_status()
        return response.json()
