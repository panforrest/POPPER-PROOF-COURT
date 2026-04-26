"""Court Reporter chat endpoint.

POST /api/cases/{id}/reporter/chat
    body: {"messages": [{"role": "user", "content": "…"}, …]}
    -> SSE stream of token deltas, terminated by an explicit ``done`` event.

The Reporter is stateless — clients ship the full chat history each call,
so the backend can hot-reload without dropping a conversation.
"""
from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator

from fastapi import APIRouter, HTTPException, status
from sse_starlette.event import ServerSentEvent
from sse_starlette.sse import EventSourceResponse

from .. import storage
from ..agents import stream_reporter_reply
from ..agents.clients import real_agents_available
from ..schemas import ReporterChatRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/cases", tags=["reporter"])


@router.get("/reporter/engine")
async def reporter_engine_status() -> dict[str, object]:
    """Tiny introspection — is the Reporter wired up to a real LLM?"""
    return {
        "ready": real_agents_available(),
    }


@router.post("/{case_id}/reporter/chat")
async def reporter_chat(
    case_id: str,
    body: ReporterChatRequest,
) -> EventSourceResponse:
    """Stream the next Reporter reply for a case.

    Event shapes (mirrors the trial stream's ``token``/``done`` contract):
        event: token   data: {"text": "…delta…"}
        event: done    data: {}
        event: error   data: {"message": "…"} (only on hard failure)
    """
    case = storage.get_case(case_id)
    if case is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case {case_id} not found",
        )

    if not real_agents_available():
        # We could fall back to a scripted reply, but the demo's value is
        # that the Reporter actually answers — so we surface the misconfig.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "The Court Reporter requires OPENAI_API_KEY (and ideally "
                "ANTHROPIC_API_KEY for the trial). Add it to .env and "
                "restart the backend."
            ),
        )

    # User message must be the last item — guard against off-by-one bugs
    # on the client side that would otherwise produce confusing replies.
    last = body.messages[-1]
    if last.role.value != "user":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Last message in 'messages' must be a user turn.",
        )

    async def gen() -> AsyncIterator[ServerSentEvent]:
        try:
            async for delta in stream_reporter_reply(
                case=case, messages=body.messages
            ):
                if delta:
                    yield ServerSentEvent(
                        data=json.dumps({"text": delta}),
                        event="token",
                    )
            yield ServerSentEvent(data="{}", event="done")
        except Exception as e:  # noqa: BLE001 — surface to UI, don't crash
            logger.exception("reporter chat crashed for case %s", case_id)
            yield ServerSentEvent(
                data=json.dumps({"message": str(e) or "reporter error"}),
                event="error",
            )

    return EventSourceResponse(gen())
