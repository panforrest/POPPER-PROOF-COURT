"""Thin async Tavily client (httpx, no SDK).

We intentionally do not add the ``tavily-python`` package — the Search
endpoint is a single POST and pinning the SDK adds an upgrade vector.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

TAVILY_SEARCH_URL = "https://api.tavily.com/search"
DEFAULT_TIMEOUT_S = 12.0


def tavily_available() -> bool:
    """True when ``TAVILY_API_KEY`` is set to something other than the placeholder."""
    key = os.getenv("TAVILY_API_KEY", "")
    return bool(key) and not key.startswith("tvly-xxxx")


async def search(
    query: str,
    *,
    max_results: int = 6,
    search_depth: str = "advanced",
    include_answer: bool = True,
    timeout_s: float = DEFAULT_TIMEOUT_S,
) -> Optional[dict[str, Any]]:
    """Run a Tavily search. Returns the raw response dict, or ``None`` on failure.

    Failure modes (auth, network, rate-limit) are logged and swallowed so the
    discovery pipeline can degrade to whichever providers *did* respond.
    """
    api_key = os.getenv("TAVILY_API_KEY", "")
    if not api_key or api_key.startswith("tvly-xxxx"):
        return None

    payload = {
        "api_key": api_key,
        "query": query,
        "search_depth": search_depth,
        "max_results": max_results,
        "include_answer": include_answer,
        "include_raw_content": False,
        "include_images": False,
    }

    try:
        async with httpx.AsyncClient(timeout=timeout_s) as client:
            r = await client.post(TAVILY_SEARCH_URL, json=payload)
            if r.status_code != 200:
                logger.warning(
                    "tavily: %d %s — body=%s",
                    r.status_code,
                    r.reason_phrase,
                    r.text[:300],
                )
                return None
            return r.json()
    except httpx.HTTPError as e:
        logger.warning("tavily HTTP error: %s", e)
        return None
    except Exception as e:  # noqa: BLE001 — never crash discovery
        logger.exception("tavily: unexpected error: %s", e)
        return None
