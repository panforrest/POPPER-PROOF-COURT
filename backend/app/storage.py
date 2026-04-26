"""Ephemeral in-memory store for cases, trials, and plans.

For the 24-hour hackathon we keep everything in process-local dicts. State
lives only while the backend is up. When persistence matters later, swap
this module for aiosqlite/chromadb without changing callers.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from .schemas import (
    AgentTurn,
    BenchMemorandum,
    Case,
    CaseCreate,
    ExperimentPlan,
    StareDecisisResult,
    Verdict,
)


# ---------- Case storage ----------

_CASES: dict[str, Case] = {}


def _new_id() -> str:
    """10-character hex id — short for pretty URLs, long enough to avoid collisions."""
    return uuid.uuid4().hex[:10]


def create_case(payload: CaseCreate) -> Case:
    case_id = _new_id()
    case = Case(
        id=case_id,
        hypothesis=payload.hypothesis,
        organization_type=payload.organization_type,
        created_at=datetime.now(timezone.utc),
    )
    _CASES[case_id] = case
    return case


def get_case(case_id: str) -> Optional[Case]:
    return _CASES.get(case_id)


def list_cases() -> list[Case]:
    """Most recently filed first."""
    return sorted(_CASES.values(), key=lambda c: c.created_at, reverse=True)


# ---------- Trial result snapshots ----------
#
# We keep the last completed trial per case so the planner can re-use the
# transcript+verdict without forcing the user to re-stream. Each entry is a
# small dict (kept generic so the SSE runner doesn't have to import storage).


_TRIAL_RESULTS: dict[str, dict] = {}


def set_trial_result(
    case_id: str,
    *,
    turns: list[AgentTurn],
    verdict: Verdict | dict,
) -> None:
    """Store the completed trial. ``verdict`` may be a Verdict model OR the
    minimal dict the SSE runner emits ({outcome, confidence, rationale}).
    Both are acceptable inputs to the planner.

    A new trial supersedes any prior bench memoranda for this case —
    memoranda are tied to a specific verdict, so retaining them across
    re-runs would let the chain reference rulings that no longer exist."""
    if isinstance(verdict, Verdict):
        verdict_payload = verdict.model_dump(mode="json")
    else:
        verdict_payload = dict(verdict)
    _TRIAL_RESULTS[case_id] = {
        "turns": [t.model_dump(mode="json") for t in turns],
        "verdict": verdict_payload,
        "stored_at": datetime.now(timezone.utc).isoformat(),
    }
    _MEMORANDA.pop(case_id, None)


def get_trial_result(case_id: str) -> Optional[dict]:
    return _TRIAL_RESULTS.get(case_id)


def replace_verdict(case_id: str, verdict: dict) -> None:
    """Overwrite the cached verdict on an existing trial result.

    Used by the Bench Memorandum re-deliberation so the planner and the
    Court Reporter both see the *latest* verdict on subsequent reads.
    No-op if the trial hasn't been cached yet — the memorandum endpoint
    refuses to act in that case anyway.
    """
    if case_id in _TRIAL_RESULTS:
        _TRIAL_RESULTS[case_id]["verdict"] = dict(verdict)


# ---------- Bench Memoranda ----------
#
# Append-only chain per case. Each entry preserves the verdict snapshot
# *before* it was applied, so the UI can render a "REVISED" badge with a
# proper before/after comparison if it wants to.

_MEMORANDA: dict[str, list[BenchMemorandum]] = {}


def append_memorandum(case_id: str, memo: BenchMemorandum) -> None:
    _MEMORANDA.setdefault(case_id, []).append(memo)


def get_memoranda(case_id: str) -> list[BenchMemorandum]:
    """Return memoranda in filing order (oldest first)."""
    return list(_MEMORANDA.get(case_id, []))


# ---------- Plan cache ----------

_PLANS: dict[str, ExperimentPlan] = {}


def set_plan(case_id: str, plan: ExperimentPlan) -> None:
    _PLANS[case_id] = plan


def get_plan(case_id: str) -> Optional[ExperimentPlan]:
    return _PLANS.get(case_id)


# ---------- Pretrial Discovery cache ----------

_DISCOVERY: dict[str, StareDecisisResult] = {}


def set_discovery(case_id: str, result: StareDecisisResult) -> None:
    _DISCOVERY[case_id] = result


def get_discovery(case_id: str) -> Optional[StareDecisisResult]:
    return _DISCOVERY.get(case_id)


# ---------- Test helpers ----------


def clear() -> None:
    """Test helper — wipe all case/trial/plan/discovery/memoranda state."""
    _CASES.clear()
    _TRIAL_RESULTS.clear()
    _PLANS.clear()
    _DISCOVERY.clear()
    _MEMORANDA.clear()
