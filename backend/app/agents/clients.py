"""Lazy LLM client factories.

- Keys are read from environment on first use (not at import time), so the
  backend can still boot and serve the mock trial when no keys exist.
- Clients are cached to avoid repeated TLS handshakes across the 9 turns.
- All calls go through thin wrappers that return plain strings, so the
  runner does not have to care about provider-specific response shapes.
"""
from __future__ import annotations

import logging
import os
from collections.abc import AsyncIterator
from typing import Optional

logger = logging.getLogger(__name__)

# --- Model defaults (overridable via .env) ----------------------------------
DEFAULT_PROSECUTOR_MODEL = "claude-sonnet-4-5-20250929"
DEFAULT_DEFENDER_MODEL = "gpt-4o"
DEFAULT_JUDGE_MODEL = "gpt-4o"

# Response caps — keep turns short so the demo pace is brisk.
MAX_ARGUMENT_TOKENS = 450
MAX_VERDICT_TOKENS = 700
# Plan generation produces a much larger structured object.
MAX_PLAN_TOKENS = 4000
# Reporter answers are conversational — keep them tight and on-screen.
MAX_REPORTER_TOKENS = 600

# Per-call timeout (seconds). Individual turn will fall back to the mock
# text for that phase if exceeded. The planner gets a generous timeout
# because it produces a much bigger payload.
CALL_TIMEOUT_S = 25.0
PLAN_TIMEOUT_S = 90.0
REPORTER_TIMEOUT_S = 60.0


def real_agents_available() -> bool:
    """True only when *both* keys are present (both sides of the bench needed)."""
    return bool(os.getenv("OPENAI_API_KEY")) and bool(os.getenv("ANTHROPIC_API_KEY"))


# ---------------------------------------------------------------------------
# Clients (lazy singletons)
# ---------------------------------------------------------------------------

_openai_client = None  # type: ignore[var-annotated]
_anthropic_client = None  # type: ignore[var-annotated]


def _get_openai():
    global _openai_client
    if _openai_client is None:
        from openai import AsyncOpenAI  # local import: skip if keys missing

        _openai_client = AsyncOpenAI(
            api_key=os.getenv("OPENAI_API_KEY"),
            timeout=CALL_TIMEOUT_S,
        )
    return _openai_client


def _get_anthropic():
    global _anthropic_client
    if _anthropic_client is None:
        from anthropic import AsyncAnthropic

        _anthropic_client = AsyncAnthropic(
            api_key=os.getenv("ANTHROPIC_API_KEY"),
            timeout=CALL_TIMEOUT_S,
        )
    return _anthropic_client


# ---------------------------------------------------------------------------
# Thin call wrappers
# ---------------------------------------------------------------------------


async def call_prosecutor(*, system: str, user: str) -> str:
    """Claude Sonnet 4.5 — returns the assistant text, stripped."""
    client = _get_anthropic()
    model = os.getenv("ANTHROPIC_PROSECUTOR_MODEL", DEFAULT_PROSECUTOR_MODEL)
    msg = await client.messages.create(
        model=model,
        max_tokens=MAX_ARGUMENT_TOKENS,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    # Anthropic returns a list of content blocks; join any text blocks.
    parts: list[str] = []
    for block in msg.content:
        text = getattr(block, "text", None)
        if text:
            parts.append(text)
    return "\n".join(parts).strip()


async def call_defender(*, system: str, user: str) -> str:
    """GPT-4o playing defense counsel."""
    client = _get_openai()
    model = os.getenv("OPENAI_DEFENDER_MODEL", DEFAULT_DEFENDER_MODEL)
    resp = await client.chat.completions.create(
        model=model,
        max_tokens=MAX_ARGUMENT_TOKENS,
        temperature=0.7,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )
    return (resp.choices[0].message.content or "").strip()


async def call_judge_argument(*, system: str, user: str) -> str:
    """Judge *belief* turns — plain text, starts with 'Belief: N%.'."""
    client = _get_openai()
    model = os.getenv("OPENAI_JUDGE_MODEL", DEFAULT_JUDGE_MODEL)
    resp = await client.chat.completions.create(
        model=model,
        max_tokens=MAX_ARGUMENT_TOKENS,
        temperature=0.3,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )
    return (resp.choices[0].message.content or "").strip()


async def call_judge_verdict(*, system: str, user: str) -> str:
    """Judge *final* turn — STRICT JSON per the verdict prompt.

    Returns the raw JSON string; the runner parses it.
    """
    client = _get_openai()
    model = os.getenv("OPENAI_JUDGE_MODEL", DEFAULT_JUDGE_MODEL)
    resp = await client.chat.completions.create(
        model=model,
        max_tokens=MAX_VERDICT_TOKENS,
        temperature=0.2,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )
    return (resp.choices[0].message.content or "").strip()


async def stream_reporter(
    *,
    system: str,
    history: list[dict[str, str]],
) -> AsyncIterator[str]:
    """Stream the Court Reporter's reply token-by-token.

    ``history`` is the chat history in OpenAI shape:
    ``[{"role": "user"|"assistant", "content": str}, ...]`` (most recent last).
    The system prompt is prepended; the function yields delta strings as
    they arrive. Empty deltas are skipped. On error, yields an inline
    apology so the UI still shows something.
    """
    client = _get_openai()
    model = os.getenv("OPENAI_REPORTER_MODEL", DEFAULT_JUDGE_MODEL)
    try:
        stream = await client.chat.completions.create(
            model=model,
            max_tokens=MAX_REPORTER_TOKENS,
            temperature=0.4,
            timeout=REPORTER_TIMEOUT_S,
            stream=True,
            messages=[{"role": "system", "content": system}, *history],
        )
        async for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta
    except Exception as e:  # noqa: BLE001 — convert to inline message
        logger.exception("reporter stream failed")
        yield (
            "\n\n_(The Court Reporter has lost the line. "
            f"Reason: {type(e).__name__}.)_"
        )


async def call_planner(*, system: str, user: str) -> str:
    """Plan generation — STRICT JSON, big token cap, longer timeout.

    Returns the raw JSON string; the planner module parses + Pydantic-validates.
    """
    client = _get_openai()
    model = os.getenv("OPENAI_PLANNER_MODEL", DEFAULT_JUDGE_MODEL)
    resp = await client.chat.completions.create(
        model=model,
        max_tokens=MAX_PLAN_TOKENS,
        temperature=0.4,
        response_format={"type": "json_object"},
        timeout=PLAN_TIMEOUT_S,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )
    return (resp.choices[0].message.content or "").strip()


# ---------------------------------------------------------------------------
# Debug helper
# ---------------------------------------------------------------------------


def describe_models() -> dict[str, Optional[str]]:
    """Return which models are configured (or defaults will be used)."""
    return {
        "prosecutor": os.getenv("ANTHROPIC_PROSECUTOR_MODEL", DEFAULT_PROSECUTOR_MODEL),
        "defender": os.getenv("OPENAI_DEFENDER_MODEL", DEFAULT_DEFENDER_MODEL),
        "judge": os.getenv("OPENAI_JUDGE_MODEL", DEFAULT_JUDGE_MODEL),
        "planner": os.getenv("OPENAI_PLANNER_MODEL", DEFAULT_JUDGE_MODEL),
        "reporter": os.getenv("OPENAI_REPORTER_MODEL", DEFAULT_JUDGE_MODEL),
    }
