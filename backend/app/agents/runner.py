"""Real 9-turn trial orchestrator.

Mirrors the SSE event contract of ``trial_stream.mock_trial_event_stream``:
``thinking`` → ``turn`` → optional ``belief`` → ``verdict`` → ``complete``.

Per-turn error handling: if an agent call fails, we fall back to the
corresponding canned turn from ``trial_stream.build_mock_turns`` so the
demo always reaches a verdict.
"""
from __future__ import annotations

import json
import logging
import re
from collections.abc import AsyncIterator

from sse_starlette.event import ServerSentEvent

from .. import storage
from ..schemas import AgentRole, AgentTurn, TurnPhase, VerdictOutcome
from ..trial_stream import build_mock_turns
from . import clients as c
from .prompts import (
    DEFENDER_SYSTEM,
    JUDGE_SYSTEM,
    PROSECUTOR_SYSTEM,
    build_user_prompt,
)

logger = logging.getLogger(__name__)


# The canonical order of phases. Maps 1:1 to PHASE_BAR in the frontend.
PHASE_ORDER: list[tuple[TurnPhase, AgentRole]] = [
    (TurnPhase.PROSECUTOR_OPENING, AgentRole.PROSECUTOR),
    (TurnPhase.DEFENDER_OPENING, AgentRole.DEFENDER),
    (TurnPhase.JUDGE_BELIEF_1, AgentRole.JUDGE),
    (TurnPhase.PROSECUTOR_REBUTTAL, AgentRole.PROSECUTOR),
    (TurnPhase.DEFENDER_REBUTTAL, AgentRole.DEFENDER),
    (TurnPhase.JUDGE_BELIEF_2, AgentRole.JUDGE),
    (TurnPhase.PROSECUTOR_CLOSING, AgentRole.PROSECUTOR),
    (TurnPhase.DEFENDER_CLOSING, AgentRole.DEFENDER),
    (TurnPhase.JUDGE_VERDICT, AgentRole.JUDGE),
]


# --- Small helpers ---------------------------------------------------------

_BELIEF_RE = re.compile(r"belief[^0-9]{0,6}(\d{1,3})", re.IGNORECASE)


def _extract_belief(text: str) -> float | None:
    """Pull the opening 'Belief: N%.' integer from a judge argument."""
    m = _BELIEF_RE.search(text or "")
    if not m:
        return None
    try:
        n = int(m.group(1))
    except ValueError:
        return None
    return float(max(0, min(100, n)))


def _coerce_outcome(s: str) -> VerdictOutcome:
    s = (s or "").strip().lower()
    if s in VerdictOutcome._value2member_map_:
        return VerdictOutcome(s)
    # Generous alias mapping so a stubborn model can't crash the demo.
    if "proceed" in s or "approve" in s or "grant" in s:
        return VerdictOutcome.PROCEED
    if "revise" in s or "amend" in s or "revis" in s:
        return VerdictOutcome.REVISE
    return VerdictOutcome.DISMISS


def _coerce_confidence(v: object, fallback: float = 60.0) -> float:
    try:
        n = float(v)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return fallback
    if n <= 1.0:  # some models return 0..1
        n *= 100.0
    return max(0.0, min(100.0, n))


def _transcript_entries(turns: list[AgentTurn]) -> list[dict]:
    return [
        {
            "role": t.role.value,
            "phase": t.phase.value,
            "text": t.text,
        }
        for t in turns
    ]


# --- SSE payload helpers ---------------------------------------------------


def _turn_event(turn: AgentTurn) -> ServerSentEvent:
    return ServerSentEvent(data=json.dumps(turn.model_dump(mode="json")), event="turn")


def _thinking_event(role: AgentRole) -> ServerSentEvent:
    return ServerSentEvent(data=json.dumps({"role": role.value}), event="thinking")


def _belief_event(value: float) -> ServerSentEvent:
    return ServerSentEvent(data=json.dumps({"value": value}), event="belief")


def _verdict_event(payload: dict) -> ServerSentEvent:
    return ServerSentEvent(data=json.dumps(payload), event="verdict")


# --- Per-role turn producers ----------------------------------------------


async def _produce_turn(
    *,
    phase: TurnPhase,
    role: AgentRole,
    hypothesis: str,
    prior: list[AgentTurn],
    fallback_turn: AgentTurn,
) -> AgentTurn:
    """Call the right LLM for this phase; on any failure, return fallback_turn."""
    user_prompt = build_user_prompt(
        phase=phase,
        hypothesis=hypothesis,
        prior_turns=_transcript_entries(prior),
    )

    try:
        if role == AgentRole.PROSECUTOR:
            text = await c.call_prosecutor(system=PROSECUTOR_SYSTEM, user=user_prompt)
        elif role == AgentRole.DEFENDER:
            text = await c.call_defender(system=DEFENDER_SYSTEM, user=user_prompt)
        else:  # JUDGE — but not the final verdict; that has its own path
            text = await c.call_judge_argument(system=JUDGE_SYSTEM, user=user_prompt)

        if not text:
            raise RuntimeError(f"empty response from {role.value}")

        confidence = _extract_belief(text) if role == AgentRole.JUDGE else None
        return AgentTurn(
            phase=phase,
            role=role,
            text=text,
            citations=[],
            confidence=confidence,
        )
    except Exception:  # noqa: BLE001 — any provider error falls back
        logger.exception("agent call failed for phase %s; using fallback", phase.value)
        return fallback_turn


async def _produce_verdict(
    *, hypothesis: str, prior: list[AgentTurn]
) -> tuple[AgentTurn, dict]:
    """Returns (verdict_turn, verdict_payload) — both derived from one JSON call."""
    user_prompt = build_user_prompt(
        phase=TurnPhase.JUDGE_VERDICT,
        hypothesis=hypothesis,
        prior_turns=_transcript_entries(prior),
    )
    try:
        raw = await c.call_judge_verdict(system=JUDGE_SYSTEM, user=user_prompt)
        data = json.loads(raw)
        outcome = _coerce_outcome(str(data.get("outcome", "")))
        confidence = _coerce_confidence(data.get("confidence"), fallback=70.0)
        rationale = str(data.get("rationale", "")).strip() or "The court has ruled."
        narrative = (
            str(data.get("narrative", "")).strip()
            or rationale
        )

        turn = AgentTurn(
            phase=TurnPhase.JUDGE_VERDICT,
            role=AgentRole.JUDGE,
            text=narrative,
            citations=[],
            confidence=confidence,
        )
        payload = {
            "outcome": outcome.value,
            "rationale": rationale,
            "confidence": confidence,
        }
        return turn, payload
    except Exception:  # noqa: BLE001
        logger.exception("verdict call failed; using mock verdict")
        mock_turns = build_mock_turns(hypothesis)
        mock_verdict_turn = mock_turns[-1]
        payload = {
            "outcome": VerdictOutcome.PROCEED.value,
            "rationale": (
                "Falsifiable core with measurable outcome. Pilot approved under "
                "prosecutor conditions: one primary endpoint, one negative control, "
                "and written stop rules."
            ),
            "confidence": 70.0,
        }
        return mock_verdict_turn, payload


# --- Public: SSE generator -------------------------------------------------


async def real_trial_event_stream(
    hypothesis: str, *, case_id: str | None = None
) -> AsyncIterator[ServerSentEvent]:
    """Yield SSE events identical in shape to the mock stream, but from real LLMs.

    Any per-turn failure falls back to the matching canned turn so the demo
    always completes through ``complete`` — it never dead-ends on a provider
    error.

    When ``case_id`` is supplied, the completed transcript + verdict are
    cached in storage so the planner can render an ExperimentPlan later
    without re-streaming the trial.
    """
    fallback_turns = build_mock_turns(hypothesis)
    fallback_by_phase: dict[TurnPhase, AgentTurn] = {t.phase: t for t in fallback_turns}

    accumulated: list[AgentTurn] = []
    final_verdict_payload: dict | None = None

    try:
        for phase, role in PHASE_ORDER:
            yield _thinking_event(role)

            if phase == TurnPhase.JUDGE_VERDICT:
                turn, verdict_payload = await _produce_verdict(
                    hypothesis=hypothesis, prior=accumulated
                )
                yield _turn_event(turn)
                if turn.confidence is not None:
                    yield _belief_event(turn.confidence)
                accumulated.append(turn)
                final_verdict_payload = verdict_payload
                yield _verdict_event(verdict_payload)
                continue

            turn = await _produce_turn(
                phase=phase,
                role=role,
                hypothesis=hypothesis,
                prior=accumulated,
                fallback_turn=fallback_by_phase[phase],
            )
            accumulated.append(turn)
            yield _turn_event(turn)
            if role == AgentRole.JUDGE and turn.confidence is not None:
                yield _belief_event(turn.confidence)

        # Cache the completed trial so /api/cases/{id}/plan can use it.
        if case_id is not None and final_verdict_payload is not None:
            try:
                storage.set_trial_result(
                    case_id, turns=accumulated, verdict=final_verdict_payload
                )
            except Exception:  # noqa: BLE001 — never break the stream over a cache write
                logger.exception("real trial: failed to cache trial result")

        yield ServerSentEvent(data="{}", event="complete")
    except Exception as e:  # noqa: BLE001 — last-ditch fallback
        logger.exception("real trial stream crashed")
        yield ServerSentEvent(
            data=json.dumps({"message": str(e) or "trial engine error"}),
            event="trial_error",
        )
