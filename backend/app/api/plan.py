"""ExperimentPlan API — render the post-verdict 'runnable order' for a case.

Routes:
    POST /api/cases/{case_id}/plan
        Generate a fresh ExperimentPlan from the cached trial result.
        Caches the plan so repeat calls don't re-bill the LLM.
        ``?force=true`` forces regeneration.

    GET  /api/cases/{case_id}/plan
        Return the cached plan (404 if not generated yet).
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query, status

from .. import storage
from ..agents import generate_plan
from ..schemas import ExperimentPlan

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/cases", tags=["plan"])


@router.post(
    "/{case_id}/plan",
    response_model=ExperimentPlan,
    status_code=status.HTTP_200_OK,
)
async def create_plan(
    case_id: str,
    force: bool = Query(
        False, description="If true, regenerate even if a cached plan exists."
    ),
) -> ExperimentPlan:
    """Generate (or return cached) ExperimentPlan for a finished trial."""
    case = storage.get_case(case_id)
    if case is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case {case_id} not found",
        )

    if not force:
        cached = storage.get_plan(case_id)
        if cached is not None:
            return cached

    trial = storage.get_trial_result(case_id)
    if trial is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "No trial result on file for this case. Run the trial to "
                "completion before requesting a plan."
            ),
        )

    plan = await generate_plan(
        case_id=case.id,
        hypothesis=case.hypothesis,
        transcript_turns=trial["turns"],
        verdict=trial["verdict"],
    )
    storage.set_plan(case_id, plan)
    return plan


@router.get(
    "/{case_id}/plan",
    response_model=ExperimentPlan,
)
async def get_plan(case_id: str) -> ExperimentPlan:
    """Fetch the cached plan for a case (404 if none yet)."""
    case = storage.get_case(case_id)
    if case is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case {case_id} not found",
        )

    plan = storage.get_plan(case_id)
    if plan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No plan generated yet for this case.",
        )
    return plan
