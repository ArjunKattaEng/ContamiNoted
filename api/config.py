"""Backend settings from environment variables.

Local: api/.env, falling back to the repo root .env.local / .env (all git-ignored; see
api/.env.example). Values already in the environment win. Vercel: project environment variables.
"""

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

_api_dir = Path(__file__).resolve().parent
for _env_file in (_api_dir / ".env", _api_dir.parent / ".env.local", _api_dir.parent / ".env"):
    load_dotenv(_env_file)  # never overrides variables that are already set

DEFAULT_ORIGINS = [
    "http://localhost:5173",  # Vite dev
    "http://localhost:4173",  # Vite preview
    "capacitor://localhost",  # iOS app (Capacitor)
]


def _list(name: str) -> list[str]:
    return [v.strip() for v in os.environ.get(name, "").split(",") if v.strip()]


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str | None = field(default_factory=lambda: os.environ.get("GEMINI_API_KEY") or None)
    # Alias for Google's current Flash model; pin a specific version per environment if needed
    gemini_model: str = field(default_factory=lambda: os.environ.get("GEMINI_MODEL", "gemini-flash-latest"))
    # Used when the main model is overloaded (503) or rate-limited (429). Set empty to disable.
    gemini_fallback_model: str | None = field(
        default_factory=lambda: os.environ.get("GEMINI_FALLBACK_MODEL", "gemini-flash-lite-latest") or None
    )
    # Optional: without a key openFDA allows ~1,000 requests/day per IP, which shared Vercel IPs can exhaust
    openfda_api_key: str | None = field(default_factory=lambda: os.environ.get("OPENFDA_API_KEY") or None)
    allowed_origins: list[str] = field(default_factory=lambda: DEFAULT_ORIGINS + _list("ALLOWED_ORIGINS"))


settings = Settings()
