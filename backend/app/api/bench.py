"""Bench Memorandum endpoint — file a reconsideration, stream the revised
verdict back as SSE.

Event contract (mirrors the trial stream's verdict envelope so the
frontend can re-use the verdict-card update path):

    thinking            → {"role": "judge"}                immediate
    verdict             → {outcome, confidence, rationale, narrative}
    memorandum_applied  → BenchMemorandum.model_dump()     persisted
    complete            → {}                               terminal

On any failure mid-deliberation, an ``error`` event is emitted and the
prior verdict is left untouched in storage.
"""
from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from sse_starlette.event import ServerSentEvent
from sse_starlette.sse import EventSourceResponse

from .. import storage
from ..agents import re_deliberate
from ..agents.clients import real_agents_available
from ..schemas import BenchMemorandum, MemorandumRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/cases", tags=["bench"])

# How many discovery citations to surface to the Judge for re-deliberation.
# Mirrors the trial runner so [N] markers stay coherent across the chain.
_MAX_CITATIONS = 4


@router.get("/bench/engine")
async def bench_engine_status() -> dict[str, object]:
    """Tiny readiness probe — is reconsideration wired to a real LLM?"""
    return {"ready": real_agents_available()}


@router.get("/{case_id}/memoranda")
async def list_memoranda(case_id: str) -> dict[str, object]:
    """Read the chain of filed memoranda for a case (oldest first)."""
    case = storage.get_case(case_id)
    if case is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case {case_id} not found",
        )
    memos = storage.get_memoranda(case_id)
    return {
        "memoranda": [m.model_dump(mode="json") for m in memos],
    }


@router.post("/{case_id}/memorandum")
async def file_memorandum(
    case_id: str,
    body: MemorandumRequest,
) -> EventSourceResponse:
    """File a Bench Memorandum and stream the revised verdict back."""
    case = storage.get_case(case_id)
    if case is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case {case_id} not found",
        )

    trial = storage.get_trial_result(case_id)
    if trial is None or "verdict" not in trial:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "No verdict on the docket — the trial must conclude before "
                "the parties can move for reconsideration."
            ),
        )

    if not real_agents_available():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Bench memoranda require OPENAI_API_KEY (and ideally "
                "ANTHROPIC_API_KEY for the rest of the trial). Add it to "
                ".env and restart the backend."
            ),
        )

    discovery = storage.get_discovery(case_id)
    citations = list(discovery.citations[:_MAX_CITATIONS]) if discovery else []
    transcript_entries = list(trial.get("turns", []))
    prior_verdict = dict(trial["verdict"])  # snapshot before mutation
    prior_memoranda = storage.get_memoranda(case_id)
    instruction = body.instruction.strip()

    async def gen() -> AsyncIterator[ServerSentEvent]:
        try:
            yield ServerSentEvent(
                data=json.dumps({"role": "judge"}),
                event="thinking",
            )

            revised = await re_deliberate(
                case=case,
                transcript_entries=transcript_entries,
                citations=citations,
                prior_verdict=prior_verdict,
                prior_memoranda=prior_memoranda,
                new_instruction=instruction,
            )

            memo = BenchMemorandum(
                instruction=instruction,
                prior_verdict=prior_verdict,
                revised_verdict=revised,
                applied_at=datetime.now(timezone.utc),
            )
            try:
                storage.append_memorandum(case_id, memo)
                # Replace the cached verdict so the planner & Reporter see
                # the latest ruling on subsequent reads. Strip "narrative"
                # to match the trial's verdict shape (planner expects 3 keys).
                trial_verdict = {
                    "outcome": revised["outcome"],
                    "confidence": revised["confidence"],
                    "rationale": revised["rationale"],
                }
                storage.replace_verdict(case_id, trial_verdict)
            except Exception:  # noqa: BLE001 — storage write must never crash the stream
                logger.exception("memorandum: failed to persist for %s", case_id)

            yield ServerSentEvent(
                data=json.dumps(revised),
                event="verdict",
            )
            yield ServerSentEvent(
                data=memo.model_dump_json(),
                event="memorandum_applied",
            )
            yield ServerSentEvent(data="{}", event="complete")
        except Exception as e:  # noqa: BLE001
            logger.exception(
                "memorandum re-deliberation failed for case %s", case_id
            )
            yield ServerSentEvent(
                data=json.dumps(
                    {"message": str(e) or "memorandum re-deliberation failed"}
                ),
                event="error",
            )

    return EventSourceResponse(gen())
