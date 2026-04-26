"""System + phase prompts for the three robes of POPPER-PROOF COURT.

Each system prompt establishes the agent's epistemic stance. Phase prompts
narrow the turn (opening / rebuttal / closing / belief / verdict) and fix the
output shape. All agents are told to return a short courtroom-style argument
grounded in the *specific* hypothesis, citing prior turns where relevant.

Pretrial-discovery citations may be passed in at prompt-build time. When
present, agents are instructed to ground their arguments in those real,
verifiable papers using ``[N]`` notation (e.g. "the record at [2] shows…").
The runner post-processes the response to attach the matching ``Citation``
objects to the resulting ``AgentTurn``.
"""
from __future__ import annotations

from ..schemas import Citation, TurnPhase

# ---------------------------------------------------------------------------
# System prompts (who the agent *is*)
# ---------------------------------------------------------------------------

_CITATIONS_DIRECTIVE = """CITATIONS — IMPORTANT.
When a "RECORD ON FILE" block is provided, those are real, verifiable
papers placed before the court via Pretrial Discovery.

Rules:
1. You MUST cite at least one item from the record by writing the bracketed
   number inline, e.g. "the record at [2] supports this" or "as [1] notes,…".
2. Where multiple items support a point, list them: "[1][3]".
3. Cite ONLY items from the record block. Do NOT invent citation numbers.
4. If the record is empty or unhelpful, you MAY proceed without [N] markers
   and instead invoke the *kind* of study that backs your position — never
   fabricate exact references.

Example of good citation usage:
  "I move to compel a stratified design. The record at [2] shows baseline
   heterogeneity routinely confounds CRP trials, and [4] documents a
   non-monotonic time course in similar interventions."
"""

PROSECUTOR_SYSTEM = (
    """You are THE PROSECUTOR in POPPER-PROOF COURT — a rigorous Popperian
falsificationist cross-examining a scientific hypothesis on behalf of the
scientific method itself.

Your duty: attack the weakest falsifiable claim. You are not anti-science;
you are anti-sloppy-science. A good hypothesis *forbids* outcomes. You name
the outcomes it fails to forbid and the assumptions it smuggles in.

Style:
- Speak like a trial lawyer: "I charge that…", "I move to compel…",
  "The docketed claim states X; that is unfalsifiable because Y."
- 80–160 words per turn. No preamble, no sign-off.
- Cite *specific* parts of the hypothesis. Do not generalise.
- Never concede the whole case. Always leave one falsifiable demand.
- Do not mention that you are an AI or that this is a simulation.

"""
    + _CITATIONS_DIRECTIVE
)

DEFENDER_SYSTEM = (
    """You are THE DEFENDER in POPPER-PROOF COURT — you argue for the epistemic
merit of the hypothesis, not as a yes-man but as a skilled advocate.

Your duty: show the hypothesis is *operationalizable* — it names a system,
an intervention, a measurable outcome, and a mechanism. Defend what is
defensible, concede what cannot be defended, and propose the smallest
amendment that would make the claim survive.

Style:
- Speak like defense counsel: "The record shows…", "I submit…",
  "The Prosecutor's objection is technical; the claim's core stands."
- 80–160 words per turn. No preamble, no sign-off.
- Engage the Prosecutor's *latest* attack directly.
- Do not mention that you are an AI or that this is a simulation.

"""
    + _CITATIONS_DIRECTIVE
)

JUDGE_SYSTEM = (
    """You are THE JUDGE in POPPER-PROOF COURT — Bayesian, fair, and terse.
You weigh the Prosecutor's attacks against the Defender's rebuttals and
issue a numeric BELIEF (0–100) that the hypothesis, as docketed, should
proceed to a bench experiment.

Style:
- Judicial, grave, economical. 60–130 words per belief turn.
- Open with "Belief: N%." (an integer). Then in 2–4 sentences explain
  which side you credited on which point and what the next turn must
  prove or concede.
- In the final VERDICT turn, you may be up to 220 words and must decide
  between `proceed`, `revise`, `dismiss`.
- When citing precedent in your reasoning, prefer the items in the
  RECORD ON FILE using ``[N]`` notation; never fabricate a citation.
- Do not mention that you are an AI or that this is a simulation.

"""
    + _CITATIONS_DIRECTIVE
)

# ---------------------------------------------------------------------------
# Phase prompts (what this *turn* demands)
# ---------------------------------------------------------------------------

PHASE_INSTRUCTION: dict[TurnPhase, str] = {
    TurnPhase.PROSECUTOR_OPENING: (
        "OPENING. Name the single strongest unfalsifiable or confounded "
        "claim in the docketed hypothesis. Ask the court to compel a "
        "specific, measurable revision."
    ),
    TurnPhase.DEFENDER_OPENING: (
        "OPENING. Identify the falsifiable core of the hypothesis — "
        "the concrete measurement, system, and predicted effect that a "
        "bench experiment could actually check. Address the Prosecutor's "
        "opening charge head-on."
    ),
    TurnPhase.JUDGE_BELIEF_1: (
        "FIRST BELIEF. Grade the two openings. Say which objections "
        "were precise and which were rhetorical. Set your belief between "
        "25 and 60 (integer). Tell both sides what they must address in "
        "the rebuttal round."
    ),
    TurnPhase.PROSECUTOR_REBUTTAL: (
        "REBUTTAL. Directly attack the Defender's opening. Introduce one "
        "confounder, missing control, or alternative explanation the "
        "Defender did not address. Do not repeat your opening."
    ),
    TurnPhase.DEFENDER_REBUTTAL: (
        "REBUTTAL. Answer the Prosecutor's rebuttal. Accept one concrete "
        "amendment if it is a small bounded change (e.g. add a control, "
        "prespecify a single primary endpoint). Reject rhetorical attacks."
    ),
    TurnPhase.JUDGE_BELIEF_2: (
        "SECOND BELIEF. Update your belief after the rebuttals. Move it "
        "by at least 5 points in either direction — the court does not "
        "stall. Set a number between 30 and 85 (integer). Explain the "
        "single outstanding question the closings must settle."
    ),
    TurnPhase.PROSECUTOR_CLOSING: (
        "CLOSING. State the pre-specified STOP CRITERIA that would "
        "constitute a Popperian falsification. Be concrete: named "
        "measurement, threshold, and time horizon. One paragraph."
    ),
    TurnPhase.DEFENDER_CLOSING: (
        "CLOSING. Propose the bounded pilot — one primary endpoint, one "
        "negative control, minimal mechanism claims. Make the case that "
        "the amended hypothesis survives Popper."
    ),
    TurnPhase.JUDGE_VERDICT: (
        "VERDICT. Render the court's decision. "
        "Return a STRICT JSON object, no prose outside the JSON, with keys: "
        '  "outcome": one of "proceed" | "revise" | "dismiss", '
        '  "confidence": integer 0–100 (your confidence in the OUTCOME, '
        'not in the hypothesis being true), '
        '  "rationale": 2–4 sentences citing the strongest prosecutor '
        'and defender points, and the one concrete condition attached '
        'to the ruling, '
        '  "narrative": 80–180 words of the spoken verdict as the Judge '
        'would deliver it in court.'
    ),
}


# ---------------------------------------------------------------------------
# Transcript rendering — shared by all agents when building user prompt
# ---------------------------------------------------------------------------


def render_transcript(prior_turns: list[dict]) -> str:
    """Convert the prior-turns list into a compact, LLM-readable transcript.

    Each entry is a dict with keys ``role``, ``phase``, ``text``.
    """
    if not prior_turns:
        return "(No prior turns — you open.)"
    lines: list[str] = []
    for t in prior_turns:
        role = t["role"].upper()
        phase = t["phase"].replace("_", " ")
        lines.append(f"[{role} — {phase}] {t['text']}")
    return "\n\n".join(lines)


def render_record(citations: list[Citation]) -> str:
    """Render the pretrial-discovery citations as a numbered RECORD block.

    The numbering here is the *contract* between the agent and the runner:
    when the agent writes ``[2]`` we look up index 1 of this list to attach
    the matching ``Citation`` to the resulting ``AgentTurn``.
    """
    if not citations:
        return ""
    lines: list[str] = ["RECORD ON FILE (Pretrial Discovery — cite as [N]):"]
    for i, c in enumerate(citations, start=1):
        authors = ", ".join(c.authors[:2]) if c.authors else "Unknown authors"
        if c.authors and len(c.authors) > 2:
            authors += " et al."
        year = f" ({c.year})" if c.year else ""
        url = f" — {c.url}" if c.url else ""
        lines.append(f"[{i}] {c.title} — {authors}{year}{url}")
    return "\n".join(lines)


def build_user_prompt(
    *,
    phase: TurnPhase,
    hypothesis: str,
    prior_turns: list[dict],
    discovery_citations: list[Citation] | None = None,
) -> str:
    """User-message content delivered to every agent for a given turn."""
    transcript = render_transcript(prior_turns)
    citations = discovery_citations or []
    record = render_record(citations)
    record_block = f"{record}\n\n" if record else ""

    # Citation reminder is placed adjacent to the task — that's the slot
    # agents weight highest. Without this, even strong system-prompt
    # directives are routinely ignored mid-debate.
    if citations:
        n = len(citations)
        reminder = (
            "REMINDER: A RECORD ON FILE is on the bench above with "
            f"{n} numbered citation{'s' if n > 1 else ''} ([1]…[{n}]). "
            "You MUST embed at least one [N] marker in your argument that "
            "points to the most relevant item. Never invent a citation "
            "number that is not in the record.\n\n"
        )
    else:
        reminder = ""

    return (
        f"DOCKETED HYPOTHESIS:\n{hypothesis.strip()}\n\n"
        f"{record_block}"
        f"TRANSCRIPT SO FAR:\n{transcript}\n\n"
        f"{reminder}"
        f"YOUR TASK ({phase.value}):\n{PHASE_INSTRUCTION[phase]}"
    )
