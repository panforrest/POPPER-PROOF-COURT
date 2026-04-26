"""POPPER-PROOF COURT — FastAPI entrypoint.

The courthouse doors. All HTTP routes mount here.
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import AsyncIterator

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.cases import router as cases_router
from .api.trial import router as trial_router

# Load .env from the repo root (one level above /backend) so a single
# .env serves both frontend and backend.
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", "..", ".env"))


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    # Future: warm up vector store, ping LLM providers, etc.
    yield


app = FastAPI(
    title="POPPER-PROOF COURT",
    description=(
        "Multi-agent Science Research Court. "
        "Where every scientific hypothesis goes on trial — "
        "and only the bulletproof get funded."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow the Next.js dev server (and configurable extras via env)
_cors_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors_origins if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "name": "POPPER-PROOF COURT",
        "tagline": "Where every scientific hypothesis goes on trial.",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health")
async def health() -> dict[str, str]:
    """Liveness probe — used by Step 3 smoke test and Railway/Render."""
    return {"status": "ok"}


# ---------- Routers (more specific paths first) ----------
app.include_router(trial_router)
app.include_router(cases_router)
