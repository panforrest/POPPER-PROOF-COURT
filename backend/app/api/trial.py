"""Mock trial stream over Server-Sent Events (Step 8)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sse_starlette.sse import EventSourceResponse

from .. import storage
from ..trial_stream import mock_trial_event_stream

router = APIRouter(prefix="/api/cases", tags=["trial"])


@router.get("/{case_id}/trial/stream")
async def stream_trial(case_id: str) -> EventSourceResponse:
    """Stream a canned 9-turn trial. No LLM — the hypothesis text is woven in.

    Event types: ``thinking``, ``turn``, ``belief`` (judge), ``verdict``, ``complete``, ``trial_error``.
    """
    case = storage.get_case(case_id)
    if case is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case {case_id} not found",
        )

    return EventSourceResponse(mock_trial_event_stream(case.hypothesis))
