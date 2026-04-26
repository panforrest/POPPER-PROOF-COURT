"""Bench Memorandum — Judge re-deliberation triggered by user instruction.

The trial transcript is *settled* — once the closings are delivered we don't
re-litigate the turns. Instead, the parties may file a Bench Memorandum to
have the court reconsider its ruling in light of new constraints, retracted
citations, additional facts, or stipulations.

Mechanic:
    Judge ⤴ (one JSON call) takes (transcript + prior verdict + memoranda
    chain + new instruction) → returns a revised verdict in the same shape
    as the trial verdict ({outcome, confidence, rationale, narrative}).

We deliberately keep this to one LLM call:
    - it makes the demo reliable (single failure surface)
    - it stays under ~10s wall time
    - the courtroom narrative is preserved (Judge speaks, not the parties)
"""
from __future__ import annotations

import json
import logging

from ..schemas import BenchMemorandum, Case, Citation
from . import clients as c
from .prompts import JUDGE_SYSTEM, render_record, render_transcript

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------

_RECONSIDERATION_INSTRUCTION = """RECONSIDERATION. The parties have moved
for the court to reconsider in light of a Bench Memorandum. Your duty:
weigh the memorandum against the settled record and issue a REVISED
verdict that explicitly addresses the memorandum.

Return STRICT JSON, no prose outside the JSON, with these keys:
  "outcome":     one of "proceed" | "revise" | "dismiss",
  "confidence":  integer 0–100 in the OUTCOME (not in the hypothesis),
  "rationale":   2–4 sentences. Begin with "Upon reconsideration," and
                 explicitly reference how the memorandum changed your view
                 (or, if it did not, why it did not move the court),
  "narrative":   80–180 words of the spoken revised verdict as the Judge
                 would deliver it from the bench.

You may reach the same outcome as before, OR change it — whichever the
memorandum justifies. Never claim the memorandum was raised earlier in
the trial. When the prior verdict was PROCEED and the memorandum imposes
a meaningful new constraint (lower budget, stricter timeline, a missing
control, or a retracted citation [N]), you SHOULD seriously consider
moving to REVISE or DISMISS rather than rubber-stamping. Conversely,
do not flip a settled ruling on a vague or non-substantive memorandum."""


def _build_memorandum_user_prompt(
    *,
    hypothesis: str,
    transcript_entries: list[dict],
    citations: list[Citation],
    prior_verdict: dict,
    prior_memoranda: list[BenchMemorandum],
    new_instruction: str,
) -> str:
    transcript = render_transcript(transcript_entries)
    record = render_record(citations)
    record_block = f"{record}\n\n" if record else ""

    pv_outcome = str(prior_verdict.get("outcome", "?")).upper()
    pv_conf = prior_verdict.get("confidence", "?")
    pv_rationale = (str(prior_verdict.get("rationale") or "")).strip()
    prior_block = (
        "PRIOR VERDICT (the standing ruling before this memorandum):\n"
        f"  Outcome: {pv_outcome}    Confidence: {pv_conf}\n"
        f"  Rationale: {pv_rationale}\n"
    )

    if prior_memoranda:
        prior_lines = ["EARLIER MEMORANDA (already considered, oldest first):"]
        for i, m in enumerate(prior_memoranda, start=1):
            prior_lines.append(f'  [Memo {i}] "{m.instruction.strip()}"')
        prior_memo_block = "\n".join(prior_lines) + "\n\n"
    else:
        prior_memo_block = ""

    new_memo_block = (
        "NEW BENCH MEMORANDUM (the parties' filing for reconsideration):\n"
        f'  "{new_instruction.strip()}"\n'
    )

    return (
        f"DOCKETED HYPOTHESIS:\n{hypothesis.strip()}\n\n"
        f"{record_block}"
        f"TRIAL TRANSCRIPT (settled — do not re-litigate the turns):\n"
        f"{transcript}\n\n"
        f"{prior_block}\n"
        f"{prior_memo_block}"
        f"{new_memo_block}\n"
        f"YOUR TASK:\n{_RECONSIDERATION_INSTRUCTION}"
    )


# ---------------------------------------------------------------------------
# Coercion (kept tolerant — the demo must always reach a verdict)
# ---------------------------------------------------------------------------

_VALID_OUTCOMES = {"proceed", "revise", "dismiss"}


def _coerce_outcome(s: str) -> str:
    s = (s or "").strip().lower()
    if s in _VALID_OUTCOMES:
        return s
    if "proceed" in s or "approve" in s or "grant" in s:
        return "proceed"
    if "revise" in s or "amend" in s:
        return "revise"
    if "dismiss" in s or "deny" in s or "reject" in s:
        return "dismiss"
    return "revise"


def _coerce_confidence(v: object, fallback: float = 65.0) -> float:
    try:
        n = float(v)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return fallback
    if n <= 1.0:
        n *= 100.0
    return max(0.0, min(100.0, n))


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


async def re_deliberate(
    *,
    case: Case,
    transcript_entries: list[dict],
    citations: list[Citation],
    prior_verdict: dict,
    prior_memoranda: list[BenchMemorandum],
    new_instruction: str,
) -> dict:
    """Issue a revised verdict in light of a Bench Memorandum.

    Returns a dict in the same shape the trial runner emits:
        {"outcome", "confidence", "rationale", "narrative"}

    Raises only on JSON-parse failure with no recoverable content; otherwise
    returns coerced sane defaults so the courtroom always rises.
    """
    user = _build_memorandum_user_prompt(
        hypothesis=case.hypothesis,
        transcript_entries=transcript_entries,
        citations=citations,
        prior_verdict=prior_verdict,
        prior_memoranda=prior_memoranda,
        new_instruction=new_instruction,
    )
    raw = await c.call_judge_verdict(system=JUDGE_SYSTEM, user=user)
    data = json.loads(raw)

    outcome = _coerce_outcome(str(data.get("outcome", "")))
    confidence = _coerce_confidence(data.get("confidence"))
    rationale = (str(data.get("rationale") or "")).strip() or (
        "Upon reconsideration, the court finds the memorandum does not "
        "materially alter the standing ruling."
    )
    narrative = (str(data.get("narrative") or "")).strip() or rationale

    return {
        "outcome": outcome,
        "confidence": confidence,
        "rationale": rationale,
        "narrative": narrative,
    }
