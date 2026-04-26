"""Semantic Scholar client — free 200M-paper API, no key needed at low rate.

If ``SEMANTIC_SCHOLAR_API_KEY`` is set we send it as ``x-api-key`` to lift
the rate ceiling, but it's optional.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

S2_SEARCH_URL = "https://api.semanticscholar.org/graph/v1/paper/search"
S2_FIELDS = "title,authors,year,url,externalIds,abstract,venue"
DEFAULT_TIMEOUT_S = 12.0


async def search(
    query: str,
    *,
    limit: int = 5,
    timeout_s: float = DEFAULT_TIMEOUT_S,
) -> Optional[list[dict[str, Any]]]:
    """Search Semantic Scholar. Returns the ``data`` list, or ``None`` on failure."""
    headers: dict[str, str] = {}
    api_key = os.getenv("SEMANTIC_SCHOLAR_API_KEY", "")
    if api_key:
        headers["x-api-key"] = api_key

    params = {
        "query": query,
        "limit": str(limit),
        "fields": S2_FIELDS,
    }

    try:
        async with httpx.AsyncClient(timeout=timeout_s) as client:
            r = await client.get(S2_SEARCH_URL, params=params, headers=headers)
            if r.status_code != 200:
                logger.warning(
                    "semantic_scholar: %d %s — body=%s",
                    r.status_code,
                    r.reason_phrase,
                    r.text[:300],
                )
                return None
            data = r.json()
            return list(data.get("data") or [])
    except httpx.HTTPError as e:
        logger.warning("semantic_scholar HTTP error: %s", e)
        return None
    except Exception as e:  # noqa: BLE001 — never crash discovery
        logger.exception("semantic_scholar: unexpected error: %s", e)
        return None
