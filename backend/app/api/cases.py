"""HTTP routes for the Case resource.

File a case, read one back, list the docket. The courtroom-simulation routes
(SSE turns, verdict, plan) mount under /api/cases/{id}/... in later steps.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from .. import storage
from ..schemas import Case, CaseCreate


router = APIRouter(prefix="/api/cases", tags=["cases"])


@router.post("", response_model=Case, status_code=status.HTTP_201_CREATED)
async def create_case(payload: CaseCreate) -> Case:
    """File a new case. The hypothesis goes on the docket."""
    return storage.create_case(payload)


@router.get("", response_model=list[Case])
async def list_cases() -> list[Case]:
    """Public docket — every case filed this session, newest first."""
    return storage.list_cases()


@router.get("/{case_id}", response_model=Case)
async def get_case(case_id: str) -> Case:
    case = storage.get_case(case_id)
    if case is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case {case_id} not found",
        )
    return case
