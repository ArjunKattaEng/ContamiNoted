"""RecallGuard API: FastAPI app served by Vercel at /api/* (vercel.json rewrites to this file).

Local: `npm run dev` runs this with uvicorn on :8000 behind Vite's /api proxy.
"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.config import settings
from api.errors import register_error_handlers
from api.routers import cron, meta, recalls, scan, watchlist

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

app = FastAPI(title="RecallGuard API", version="0.1.0", docs_url="/api/docs", redoc_url=None, openapi_url="/api/openapi.json")

# Web uses same-origin /api; the iOS app calls the deployed URL from capacitor://localhost
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
register_error_handlers(app)
app.include_router(recalls.router)
app.include_router(meta.router)
app.include_router(scan.router)
app.include_router(watchlist.router)
app.include_router(cron.router)


@app.get("/api/health")
async def health() -> dict[str, object]:
    return {"status": "ok", "summaries": settings.gemini_api_key is not None}
