"""Mock 9-turn trial stream for Step 8 — no LLM calls, canned dialogue.

Yields Server-Sent Events: thinking, turn, verdict, complete, trial_error.
Real agents replace this in a later step.
"""
from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncIterator

from sse_starlette.event import ServerSentEvent

from . import storage
from .schemas import (
    AgentRole,
    AgentTurn,
    Citation,
    TurnPhase,
    VerdictOutcome,
)

logger = logging.getLogger(__name__)

# --- Pacing (seconds) — tweak for demo feel --------------------------------
THINKING_PAUSE = 0.35
AFTER_TURN_PAUSE = 0.12


def _snippet(hyp: str, max_len: int = 140) -> str:
    h = hyp.strip()
    if len(h) <= max_len:
        return h
    return h[: max_len - 1].rstrip() + "…"


def _citation(
    title: str,
    source: str,
    *,
    year: int | None = 2020,
    similarity: float = 0.78,
) -> Citation:
    return Citation(
        title=title,
        authors=["Demo et al."],
        year=year,
        url="https://example.org/citation",
        source=source,
        similarity=similarity,
    )


def build_mock_turns(hyp: str) -> list[AgentTurn]:
    """Construct exactly nine AgentTurn objects matching TurnPhase order."""
    s = _snippet(hyp, 200)

    return [
        AgentTurn(
            phase=TurnPhase.PROSECUTOR_OPENING,
            role=AgentRole.PROSECUTOR,
            text=(
                f"Your Honor, the docketed claim begins: «{s}» — "
                "I charge that the mechanism clause is conflated with the "
                "effect claim. I move to compel: separate a falsifiable main "
                "outcome from auxiliary mechanism predictions so each can fail loud."
            ),
            citations=[_citation("Null Hypothesis in Biosensors", "semantic_scholar", year=2016)],
        ),
        AgentTurn(
            phase=TurnPhase.DEFENDER_OPENING,
            role=AgentRole.DEFENDER,
            text=(
                "The record shows a number attached to a predicted effect and a testable system. "
                f"The core docketed sentence — «{_snippet(hyp, 60)}» — is the claim a "
                "bench experiment would run against, not a rhetorical wish list."
            ),
            citations=[_citation("Falsification and the Modern Lab", "arxiv", year=2014)],
        ),
        AgentTurn(
            phase=TurnPhase.JUDGE_BELIEF_1,
            role=AgentRole.JUDGE,
            text=(
                "Belief: 40%. I credit the Prosecutor: several clauses are doing double duty. "
                "I credit the Defender: the docketed statement is not vacuous. "
                "A pilot must pin down a single preregistered primary endpoint."
            ),
            citations=[],
            confidence=40.0,
        ),
        AgentTurn(
            phase=TurnPhase.PROSECUTOR_REBUTTAL,
            role=AgentRole.PROSECUTOR,
            text=(
                "I introduce a matched comparison from the open literature: similar effect sizes "
                "emerged with an alternate reagent lot; without a pre-registered control arm, the "
                "docketed comparison may confound batch and biology. That is a Popperian fault line."
            ),
            citations=[_citation("Heterogeneity in pre-registered primary endpoints", "tavily", year=2019, similarity=0.81)],
        ),
        AgentTurn(
            phase=TurnPhase.DEFENDER_REBUTTAL,
            role=AgentRole.DEFENDER,
            text=(
                "The docketed hypothesis already implies a within-system baseline; "
                "stating a fold-change against an internal reference is a fair amendment on "
                "the first pilot writ — and does not make the current claim unscientific."
            ),
            citations=[_citation("Reproducibility in molecular assay reporting", "pubmed", year=2018, similarity=0.74)],
        ),
        AgentTurn(
            phase=TurnPhase.JUDGE_BELIEF_2,
            role=AgentRole.JUDGE,
            text=(
                "Belief: 58%. I side with the Defender: the docketed claim is operationalizable. "
                "I side with the Prosecutor: you will need an explicit pre-registered negative control."
            ),
            citations=[],
            confidence=58.0,
        ),
        AgentTurn(
            phase=TurnPhase.PROSECUTOR_CLOSING,
            role=AgentRole.PROSECUTOR,
            text=(
                "If a single pre-specified primary endpoint is not met at the 90th day, "
                "I ask the court to strike the mechanistic addendum from the grant. "
                "Falsify loudly or revise."
            ),
            citations=[],
        ),
        AgentTurn(
            phase=TurnPhase.DEFENDER_CLOSING,
            role=AgentRole.DEFENDER,
            text=(
                "A bounded pilot, one primary endpoint, two prespecified readouts, "
                "and a registered negative control — the hypothesis survives Popper, "
                "if the lab is willing to eat its words when the data say no."
            ),
            citations=[],
        ),
        AgentTurn(
            phase=TurnPhase.JUDGE_VERDICT,
            role=AgentRole.JUDGE,
            text=(
                "The court holds the docketed hypothesis is eligible for a bounded, "
                "time-boxed experiment with stop rules. "
                "I order: proceed, with a mandatory preregistration gate before reagents are purchased."
            ),
            citations=[],
            confidence=72.0,
        ),
    ]


def _verdict_payload() -> dict:
    return {
        "outcome": VerdictOutcome.PROCEED.value,
        "rationale": (
            "Falsifiable core with measurable outcome. Pilot approved under "
            "prosecutor conditions: one primary endpoint, one negative control, and "
            "written stop rules. Mechanism is secondary to the preregistered effect."
        ),
        "confidence": 72.0,
    }


async def mock_trial_event_stream(
    hyp: str, *, case_id: str | None = None
) -> AsyncIterator[ServerSentEvent]:
    """Async generator of SSE events: thinking → turn (×9) → verdict → complete.

    When ``case_id`` is supplied, the completed transcript + verdict are
    cached in storage so the planner can render an ExperimentPlan without
    re-streaming.
    """
    turns = build_mock_turns(hyp)
    verdict_payload = _verdict_payload()
    try:
        for turn in turns:
            # Who is "writing" the next line?
            role = turn.role.value
            yield ServerSentEvent(
                data=json.dumps({"role": role}),
                event="thinking",
            )
            await asyncio.sleep(THINKING_PAUSE)

            payload = turn.model_dump(mode="json")
            yield ServerSentEvent(
                data=json.dumps(payload),
                event="turn",
            )
            if turn.role == AgentRole.JUDGE and turn.confidence is not None:
                yield ServerSentEvent(
                    data=json.dumps({"value": turn.confidence}),
                    event="belief",
                )
            await asyncio.sleep(AFTER_TURN_PAUSE)

        yield ServerSentEvent(
            data=json.dumps(verdict_payload),
            event="verdict",
        )

        # Persist the trial so the planner can reuse the transcript.
        if case_id is not None:
            try:
                storage.set_trial_result(
                    case_id, turns=turns, verdict=verdict_payload
                )
            except Exception:  # noqa: BLE001 — never break the stream over a cache write
                logger.exception("mock trial: failed to cache trial result")

        await asyncio.sleep(0.08)
        yield ServerSentEvent(data="{}", event="complete")
    except asyncio.CancelledError:  # pragma: no cover — client hung up
        logger.debug("trial stream cancelled")
        raise
    except Exception as e:  # noqa: BLE001
        logger.exception("trial stream failed")
        yield ServerSentEvent(
            data=json.dumps({"message": str(e)}),
            event="trial_error",
        )
