"""Pretrial Discovery API — fetch real citations for a docketed hypothesis.

Routes:
    POST /api/cases/{case_id}/discover
        Run pretrial discovery (Tavily + Semantic Scholar in parallel).
        Caches the result; ?force=true regenerates.

    GET  /api/cases/{case_id}/discover
        Return the cached discovery (404 if none yet).

    GET  /api/cases/discover/engine
        Tiny introspection — which providers will run.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query, status

from .. import storage
from ..discovery import run_discovery, tavily_available
from ..schemas import StareDecisisResult

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/cases", tags=["discovery"])


@router.get("/discover/engine")
async def discovery_engine_status() -> dict[str, object]:
    """Which discovery providers will run for the next call?"""
    return {
        "tavily": tavily_available(),
        # Semantic Scholar is keyless at low rate, so it's always 'available'.
        "semantic_scholar": True,
    }


@router.post(
    "/{case_id}/discover",
    response_model=StareDecisisResult,
    status_code=status.HTTP_200_OK,
)
async def create_discovery(
    case_id: str,
    force: bool = Query(
        False, description="If true, regenerate even if cached."
    ),
) -> StareDecisisResult:
    """Run (or return cached) pretrial discovery for the case."""
    case = storage.get_case(case_id)
    if case is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case {case_id} not found",
        )

    if not force:
        cached = storage.get_discovery(case_id)
        if cached is not None:
            return cached

    result = await run_discovery(case.hypothesis)
    storage.set_discovery(case_id, result)
    return result


@router.get(
    "/{case_id}/discover",
    response_model=StareDecisisResult,
)
async def get_discovery(case_id: str) -> StareDecisisResult:
    """Fetch the cached discovery for a case (404 if not run yet)."""
    case = storage.get_case(case_id)
    if case is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case {case_id} not found",
        )
    cached = storage.get_discovery(case_id)
    if cached is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No discovery run yet for this case.",
        )
    return cached
