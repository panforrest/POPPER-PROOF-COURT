"""ExperimentPlan generator — the Court Clerk drafting the operational order.

After the trial concludes with a verdict, this module asks GPT-4o to render
the rich :class:`ExperimentPlan` schema that turns the courtroom outcome into
something a lab could actually run on Monday morning: protocol steps,
materials with catalog numbers, budget lines, timeline, validation metrics,
risks, personnel, equipment, optional CRO recommendations.

Architecture:

* One OpenAI call in JSON mode (``call_planner`` in :mod:`.clients`).
* Pydantic-validate the response against :class:`ExperimentPlan`.
* On validation failure, *one* retry that includes the error message so the
  model can self-correct. We do not retry forever — demo time matters.
* Verdict-aware: a ``DISMISS`` produces a small precondition-finding pilot,
  ``REVISE`` honours ``revision_required_if`` and ``what_would_change_my_mind``,
  ``PROCEED`` produces a full study.
* Mock fallback path so the planner still works without API keys.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Optional

from pydantic import ValidationError

from ..schemas import ExperimentPlan
from . import clients as c

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------


PLANNER_SYSTEM = """You are the Court Clerk of the POPPER-PROOF COURT — a
gamified scientific peer-review courtroom. The bench has rendered its
verdict on a hypothesis. Your job is to translate that ruling into a
*runnable laboratory experiment plan* that a competent PI could execute
Monday morning, or hand to a CRO without further scoping calls.

The plan must be:

1. **Verdict-aware**.
   - PROCEED → a full study sized to detect the claimed effect with
     adequate statistical power.
   - REVISE → honour the bench's `revision_required_if` and
     `what_would_change_my_mind` lists. The protocol should make those
     gating conditions explicitly testable.
   - DISMISS → a *minimal precondition-finding pilot* (not the original
     ambitious study) to surface the missing facts that caused dismissal.

2. **Operationally honest**. Every material should look like a real lab
   line item: real supplier (Sigma-Aldrich, Thermo Fisher, Promega,
   Qiagen, IDT, ATCC, Addgene, Charles River, Eurofins, NEB, BioLegend),
   plausible catalog number format, plausible quantity & unit, plausible
   USD price. Round prices sensibly. If you do not know an exact catalog
   number, use a realistic format (e.g. "Sigma 12345-100G", "IDT
   custom oligo"). Never fabricate a paper or DOI.

3. **Standards-aware**. Where applicable, validation metrics MUST cite
   the relevant reporting standard: MIQE for qPCR, ARRIVE for animal
   work, CONSORT for clinical trials, MIAME for microarrays, MIRIBEL
   for biospecimens.

4. **Self-contained**. Returned JSON should be importable on its own —
   include the hypothesis, summary, and all required sections. The
   server will fill in `case_id`, `hypothesis`, and `created_at`, so
   you may omit those (any value you provide will be overwritten).

Return ONLY valid JSON matching the schema below. Do not include any
prose, no markdown, no fences. The JSON must parse on the first try.

REQUIRED TOP-LEVEL JSON SHAPE (omit case_id / hypothesis / created_at —
the server overwrites them):

{
  "summary": "<2-3 sentence executive summary tying the plan to the verdict>",

  "protocol": [
    {
      "n": 1,
      "title": "<short step title>",
      "description": "<1-3 sentences of actionable instruction>",
      "duration_minutes": <int>,
      "equipment": ["<piece>", ...],
      "notes": "<optional caveat>",
      "source_url": "<optional protocols.io URL or null>"
    }
  ],

  "materials": [
    {
      "name": "<reagent or consumable>",
      "catalog_number": "<vendor-style catalog number or null>",
      "supplier": "Sigma-Aldrich | Thermo Fisher | Promega | Qiagen | IDT | NEB | ATCC | Addgene | BioLegend | ...",
      "quantity": <float>,
      "unit": "g | mL | uL | rxn | tube | kit | each | ...",
      "unit_price_usd": <float or null>,
      "total_usd": <float or null>,
      "url": "<optional vendor URL or null>"
    }
  ],

  "budget": [
    {"category": "Reagents | Equipment | Personnel | Overhead | Contingency",
     "description": "<what this line covers>",
     "amount_usd": <float>}
  ],
  "total_budget_usd": <float>,

  "timeline": [
    {"name": "<phase name>", "week_start": <int>, "week_end": <int>,
     "depends_on": ["<other phase name>", ...]}
  ],
  "total_weeks": <int>,

  "validation": [
    {"metric": "<what you measure>", "threshold": "<pass/fail criterion>",
     "method": "<how you measure it>",
     "standard": "MIQE | ARRIVE | CONSORT | MIAME | null"}
  ],

  "personnel": [
    {"role": "<job title>", "fte": <0.0..1.0>, "weeks": <int>,
     "hourly_rate_usd": <float or null>, "total_cost_usd": <float or null>,
     "required_skills": ["<skill>", ...]}
  ],

  "equipment": [
    {"name": "<instrument>", "purpose": "<why we need it>",
     "estimated_cost_usd": <float or null>, "rental_available": <bool>,
     "supplier": "<vendor or null>"}
  ],

  "regulatory_considerations": ["<IRB | IACUC | IBC | FDA IND | ...>"],
  "safety_classification": "BSL-1 | BSL-2 | BSL-3 | COSHH-Class-3 | null",

  "risks_and_mitigations": [
    {"description": "<what could go wrong>",
     "severity": <1..5>, "likelihood": <1..5>,
     "mitigation": "<how we de-risk it>"}
  ],

  "suggested_cros": [
    {"name": "Charles River | Eurofins | WuXi AppTec | Covance | ...",
     "specialty": "<what they do well>",
     "estimated_cost_usd": <float or null>,
     "typical_turnaround_weeks": <int or null>,
     "url": "<optional or null>"}
  ],

  "success_criteria_summary": "<one sentence: what counts as a YES>",
  "failure_stop_criteria": ["<condition that should halt the study>", ...],
  "deliverables": ["<artifact you will hand back>", ...],
  "prereq_skills": ["<skill needed before day 1>", ...],

  "citations": [
    {"title": "<paper title>", "authors": ["<lastname>", ...],
     "year": <int or null>, "url": "<doi/url or null>",
     "source": "semantic_scholar | pubmed | arxiv | biorxiv | tavily | manual",
     "similarity": <0..1 or null>}
  ]
}

Reasonable scale: 6-12 protocol steps, 8-20 materials, 4-7 budget lines,
3-6 timeline phases, 3-5 validation metrics, 2-4 personnel, 1-4
equipment items, 3-5 risks, 0-3 CROs, 2-5 citations. Keep prose terse.
"""


def _compress_transcript(turns: list[dict[str, Any]]) -> str:
    """Render the trial transcript compactly so it fits in the prompt budget."""
    lines: list[str] = []
    for t in turns:
        role = (t.get("role") or "?").upper()
        text = (t.get("text") or "").strip().replace("\n", " ")
        # Cap each turn to keep the prompt bounded.
        if len(text) > 600:
            text = text[:600].rstrip() + "…"
        lines.append(f"[{role}] {text}")
    return "\n".join(lines)


def _build_user_prompt(
    *,
    hypothesis: str,
    transcript_turns: list[dict[str, Any]],
    verdict: dict[str, Any],
) -> str:
    transcript = _compress_transcript(transcript_turns)
    outcome = (verdict.get("outcome") or "revise").upper()
    confidence = verdict.get("confidence")
    rationale = verdict.get("rationale") or ""
    revisions = verdict.get("revision_required_if") or []
    flips = verdict.get("what_would_change_my_mind") or []

    revisions_block = (
        "\n".join(f"  - {r}" for r in revisions) if revisions else "  (none)"
    )
    flips_block = (
        "\n".join(f"  - {r}" for r in flips) if flips else "  (none)"
    )

    return f"""HYPOTHESIS ON THE DOCKET:
{hypothesis}

VERDICT: {outcome} (confidence: {confidence})
JUDGE'S RATIONALE:
{rationale}

REVISIONS REQUIRED IF (must be operationalised in the plan):
{revisions_block}

WHAT WOULD CHANGE THE COURT'S MIND (steer the validation criteria here):
{flips_block}

TRIAL TRANSCRIPT (compact):
{transcript}

Now draft the plan as strict JSON per the schema in your system prompt.
Be operationally realistic. Sized appropriately to the verdict outcome.
"""


def _retry_user_prompt(original_user: str, prev_json: str, error: str) -> str:
    return f"""Your previous response failed Pydantic validation against the
ExperimentPlan schema with this error:

----- VALIDATION ERROR -----
{error}
----- /VALIDATION ERROR -----

Your previous JSON was:

----- PREV RESPONSE -----
{prev_json[:6000]}
----- /PREV RESPONSE -----

Re-emit the FULL plan as valid JSON. Fix the validation error. Do not
include any prose, markdown, or commentary — JSON only. Pay attention
to: required fields present, correct types, severity/likelihood in 1..5,
fte in 0..1, durations and weeks as ints.

Original request follows:

{original_user}
"""


# ---------------------------------------------------------------------------
# Mock fallback (so the demo keeps working without API keys)
# ---------------------------------------------------------------------------


def _mock_plan(case_id: str, hypothesis: str) -> ExperimentPlan:
    """Plausible canned plan used when no OpenAI key is present."""
    return ExperimentPlan(
        case_id=case_id,
        hypothesis=hypothesis,
        summary=(
            "Pilot study to test the docketed hypothesis under controlled "
            "conditions. Sized to detect a 10% effect at α=0.05, β=0.20. "
            "(Mock plan — set OPENAI_API_KEY for a model-generated plan.)"
        ),
        protocol=[
            {  # type: ignore[arg-type]
                "n": 1,
                "title": "Subject screening & consent",
                "description": (
                    "Recruit 40 eligible subjects via IRB-approved screening "
                    "protocol. Obtain informed consent and randomise to arms."
                ),
                "duration_minutes": 60,
                "equipment": ["Screening checklist", "Consent forms"],
                "notes": "Power analysis assumes σ=12% on the primary outcome.",
            },
            {
                "n": 2,
                "title": "Baseline measurement",
                "description": (
                    "Collect baseline samples and primary-outcome readings "
                    "for all subjects under standardised conditions."
                ),
                "duration_minutes": 90,
                "equipment": ["Glucometer (Accu-Chek)", "Centrifuge", "Tubes"],
            },
            {
                "n": 3,
                "title": "Intervention period",
                "description": "Run the assigned arm for the full prescribed window with adherence checks.",
                "duration_minutes": 120,
                "equipment": ["Adherence app", "Daily logs"],
            },
            {
                "n": 4,
                "title": "Endpoint measurement",
                "description": "Re-measure primary and secondary endpoints with the same instrumentation.",
                "duration_minutes": 90,
                "equipment": ["Glucometer (Accu-Chek)", "HbA1c assay kit"],
            },
            {
                "n": 5,
                "title": "Statistical analysis",
                "description": "Run pre-registered intention-to-treat analysis. Sensitivity check with per-protocol.",
                "duration_minutes": 240,
                "equipment": ["R 4.x", "lme4 package"],
            },
        ],
        materials=[
            {  # type: ignore[arg-type]
                "name": "HbA1c assay kit",
                "catalog_number": "10741668001",
                "supplier": "Roche",
                "quantity": 2,
                "unit": "kit",
                "unit_price_usd": 480.0,
                "total_usd": 960.0,
            },
            {
                "name": "Glucose test strips",
                "catalog_number": "AC-04534881001",
                "supplier": "Roche",
                "quantity": 500,
                "unit": "strip",
                "unit_price_usd": 0.6,
                "total_usd": 300.0,
            },
            {
                "name": "Vacutainer tubes (EDTA)",
                "catalog_number": "BD 367861",
                "supplier": "Becton Dickinson",
                "quantity": 200,
                "unit": "tube",
                "unit_price_usd": 0.45,
                "total_usd": 90.0,
            },
        ],
        budget=[
            {"category": "Reagents", "description": "Assay kits + consumables", "amount_usd": 1350.0},
            {"category": "Personnel", "description": "1× lab tech (0.5 FTE × 8 wk)", "amount_usd": 9600.0},
            {"category": "Overhead", "description": "Institutional 35%", "amount_usd": 3833.0},
            {"category": "Contingency", "description": "10% contingency", "amount_usd": 1478.0},
        ],
        total_budget_usd=16261.0,
        timeline=[
            {"name": "Setup & IRB", "week_start": 1, "week_end": 2, "depends_on": []},
            {"name": "Recruitment", "week_start": 2, "week_end": 4, "depends_on": ["Setup & IRB"]},
            {"name": "Intervention", "week_start": 4, "week_end": 12, "depends_on": ["Recruitment"]},
            {"name": "Analysis & Report", "week_start": 12, "week_end": 14, "depends_on": ["Intervention"]},
        ],
        total_weeks=14,
        validation=[
            {
                "metric": "Mean fasting blood glucose change",
                "threshold": "≥10% reduction vs control, p<0.05",
                "method": "Pre/post repeated-measures linear mixed model",
                "standard": "CONSORT",
            },
            {
                "metric": "Adherence rate",
                "threshold": "≥80% logged days per subject",
                "method": "Self-report + tertile randomised audit",
                "standard": None,
            },
        ],
        personnel=[
            {
                "role": "Principal Investigator",
                "fte": 0.1,
                "weeks": 14,
                "hourly_rate_usd": 95.0,
                "total_cost_usd": 5320.0,
                "required_skills": ["Clinical study design", "Biostatistics"],
            },
            {
                "role": "Lab Technician",
                "fte": 0.5,
                "weeks": 12,
                "hourly_rate_usd": 40.0,
                "total_cost_usd": 9600.0,
                "required_skills": ["Phlebotomy", "GLP documentation"],
            },
        ],
        equipment=[
            {
                "name": "Accu-Chek glucometer (×4)",
                "purpose": "Point-of-care fasting blood glucose",
                "estimated_cost_usd": 320.0,
                "rental_available": False,
                "supplier": "Roche",
            },
            {
                "name": "HbA1c analyzer",
                "purpose": "Confirmatory secondary endpoint",
                "estimated_cost_usd": 0.0,
                "rental_available": True,
                "supplier": "Bio-Rad",
            },
        ],
        regulatory_considerations=[
            "IRB approval required before screening",
            "HIPAA-compliant data handling",
        ],
        safety_classification="BSL-1",
        risks_and_mitigations=[
            {
                "description": "Subject dropout below 75% retention",
                "severity": 4,
                "likelihood": 3,
                "mitigation": "Over-recruit by 25%; weekly check-ins via study app.",
            },
            {
                "description": "Adherence falsification (recall bias)",
                "severity": 3,
                "likelihood": 3,
                "mitigation": "Randomised wearable audit on 1/3 of subjects.",
            },
            {
                "description": "Instrument drift across the 14-week window",
                "severity": 2,
                "likelihood": 2,
                "mitigation": "Daily QC samples; recalibrate weekly.",
            },
        ],
        suggested_cros=[
            {
                "name": "Charles River",
                "specialty": "Clinical sample analytics + biorepository",
                "estimated_cost_usd": 6200.0,
                "typical_turnaround_weeks": 4,
                "url": "https://www.criver.com/",
            },
        ],
        success_criteria_summary=(
            "Pre-registered analysis shows ≥10% mean fasting glucose reduction "
            "in the intervention arm vs control with p<0.05."
        ),
        failure_stop_criteria=[
            "≥3 SAEs in either arm within first 2 weeks",
            "Adherence drops below 60% across all subjects by week 4",
        ],
        deliverables=[
            "Pre-registered analysis plan (OSF link)",
            "Final manuscript draft (CONSORT-formatted)",
            "Anonymised dataset + analysis code (GitHub)",
        ],
        prereq_skills=[
            "IRB submission",
            "Clinical phlebotomy",
            "Mixed-models statistics in R",
        ],
        citations=[],
        created_at=datetime.now(timezone.utc),
    )


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


async def generate_plan(
    *,
    case_id: str,
    hypothesis: str,
    transcript_turns: list[dict[str, Any]],
    verdict: dict[str, Any],
) -> ExperimentPlan:
    """Produce an ExperimentPlan for the given case + verdict.

    Falls back to a hand-crafted mock plan if no OpenAI key is configured.
    Retries the LLM call once on Pydantic validation failure.
    """
    if not __openai_ready():
        logger.info("planner: no OPENAI_API_KEY — returning mock plan")
        return _mock_plan(case_id, hypothesis)

    user_prompt = _build_user_prompt(
        hypothesis=hypothesis,
        transcript_turns=transcript_turns,
        verdict=verdict,
    )

    raw = ""
    last_error: Optional[str] = None
    for attempt in (1, 2):
        try:
            if attempt == 1:
                raw = await c.call_planner(system=PLANNER_SYSTEM, user=user_prompt)
            else:
                logger.warning("planner: retry attempt 2 after validation error")
                raw = await c.call_planner(
                    system=PLANNER_SYSTEM,
                    user=_retry_user_prompt(user_prompt, raw, last_error or ""),
                )

            payload = json.loads(raw)
            payload["case_id"] = case_id
            payload["hypothesis"] = hypothesis
            return ExperimentPlan(**payload)

        except (json.JSONDecodeError, ValidationError) as exc:
            last_error = str(exc)
            logger.warning("planner attempt %d failed: %s", attempt, last_error[:300])
            continue
        except Exception as exc:  # noqa: BLE001 — provider error → mock
            logger.exception("planner provider error on attempt %d: %s", attempt, exc)
            break  # don't retry on provider errors; fall to mock

    logger.warning("planner: all attempts failed, returning mock plan")
    return _mock_plan(case_id, hypothesis)


def __openai_ready() -> bool:
    """Planner requires only OpenAI (Anthropic is for the Prosecutor)."""
    import os

    return bool(os.getenv("OPENAI_API_KEY"))
