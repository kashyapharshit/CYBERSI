import secrets

from fastapi import Header, HTTPException

from .config import settings


def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    if not settings.require_api_key:
        return
    if not settings.ai_api_key or not x_api_key or not secrets.compare_digest(x_api_key, settings.ai_api_key):
        raise HTTPException(status_code=401, detail="Invalid or missing x-api-key")
