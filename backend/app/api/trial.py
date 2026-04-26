"""Trial stream — real LLM agents when keys are set, canned mock otherwise.

Both code paths yield the *same* SSE event shapes, so the frontend is
agnostic to which is running.

Env knobs:
  USE_MOCK_TRIAL=1   Force the scripted 9-turn trial even when keys exist.
                     Useful on stage if the providers are flaky.
"""
from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException, status
from sse_starlette.sse import EventSourceResponse

from .. import storage
from ..agents import real_agents_available, real_trial_event_stream
from ..agents.clients import describe_models
from ..trial_stream import mock_trial_event_stream

router = APIRouter(prefix="/api/cases", tags=["trial"])


def _use_real_agents() -> bool:
    if os.getenv("USE_MOCK_TRIAL") == "1":
        return False
    return real_agents_available()


@router.get("/{case_id}/trial/stream")
async def stream_trial(case_id: str) -> EventSourceResponse:
    """Stream the 9-turn trial. Event types: ``thinking``, ``turn``, ``belief``,
    ``verdict``, ``complete``, ``trial_error``.

    Uses real agents (Prosecutor=Claude, Defender+Judge=OpenAI) when both
    ``OPENAI_API_KEY`` and ``ANTHROPIC_API_KEY`` are present. Falls back to
    the deterministic scripted stream otherwise, so the demo always works.
    """
    case = storage.get_case(case_id)
    if case is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case {case_id} not found",
        )

    stream = (
        real_trial_event_stream(case.hypothesis)
        if _use_real_agents()
        else mock_trial_event_stream(case.hypothesis)
    )
    return EventSourceResponse(stream)


@router.get("/trial/engine")
async def trial_engine_status() -> dict[str, object]:
    """Tiny introspection endpoint — 'are we on real agents right now?'."""
    real = _use_real_agents()
    return {
        "engine": "real_agents" if real else "mock",
        "real_agents_ready": real_agents_available(),
        "forced_mock": os.getenv("USE_MOCK_TRIAL") == "1",
        "models": describe_models() if real else None,
    }
