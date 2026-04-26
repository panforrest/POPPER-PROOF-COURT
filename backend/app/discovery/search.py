"""Discovery orchestrator — fan out to providers, merge to a StareDecisisResult.

Pipeline:
1. Run **Tavily** and **Semantic Scholar** in parallel (asyncio.gather).
2. Normalise each provider's hits into a uniform internal shape.
3. Dedupe by best-effort URL/DOI key.
4. Rank by similarity (Tavily score, S2 has none — we synthesise from
   abstract token overlap with the query).
5. Compute a :class:`NoveltySignal`:
   * ``EXACT_MATCH`` if any hit's similarity ≥ 0.85
   * ``SIMILAR``     if any hit's similarity ≥ 0.55
   * ``NOT_FOUND``   otherwise
6. Cap at 6 citations, render a short rationale.

Every provider call already swallows its own failures, so this function
never raises on a network problem — it just returns a smaller result.
"""
from __future__ import annotations

import asyncio
import logging
import re
from typing import Any, Optional

from ..schemas import Citation, NoveltySignal, StareDecisisResult
from .scholar_client import search as scholar_search
from .tavily_client import search as tavily_search
from .tavily_client import tavily_available

logger = logging.getLogger(__name__)

_MAX_CITATIONS = 6
_NEAR_MATCH = 0.80
_SIMILAR = 0.45

# Tavily's `score` is a *relevance to query* signal that pegs near 1.0 for
# any well-formed query — it is NOT a "this paper duplicates the hypothesis"
# signal. Down-weight it so a Tavily-only hit can suggest SIMILAR but never
# alone trigger EXACT_MATCH. Semantic Scholar's jaccard score (computed on
# title+abstract token overlap) is closer to true novelty signal and is
# left unscaled.
_TAVILY_SCORE_SCALE = 0.65

# Words to ignore when computing token overlap (no NLTK in deps; keep tiny).
_STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
    "has", "have", "in", "into", "is", "of", "on", "or", "than", "that",
    "the", "this", "to", "was", "were", "will", "with", "we", "our",
    "their", "they", "it", "its", "compared", "study", "studies", "effect",
    "effects", "vs", "between", "among", "after", "before", "more", "less",
    "non", "not", "no",
}


# ---------- helpers --------------------------------------------------------


def _tokens(text: str) -> set[str]:
    """Crude tokenizer — lowercases, drops stopwords, keeps tokens ≥ 4 chars."""
    text = text.lower()
    raw = re.findall(r"[a-z][a-z0-9\-]+", text)
    return {t for t in raw if len(t) >= 4 and t not in _STOPWORDS}


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    return inter / union if union else 0.0


def _doi_from_external_ids(ext: dict[str, Any] | None) -> Optional[str]:
    if not ext:
        return None
    doi = ext.get("DOI") or ext.get("doi")
    if not doi:
        return None
    return f"https://doi.org/{doi}"


def _key(url: str | None, title: str) -> str:
    """Dedup key — DOI/url if available, else canonicalised title."""
    if url:
        return url.split("?")[0].lower().rstrip("/")
    return re.sub(r"\s+", " ", title.lower()).strip()


# ---------- provider → Citation normalisers --------------------------------


def _normalise_tavily(
    raw: dict[str, Any] | None, *, query_tokens: set[str]
) -> list[Citation]:
    if not raw:
        return []
    out: list[Citation] = []
    for r in raw.get("results") or []:
        title = (r.get("title") or "").strip()
        url = r.get("url")
        if not title or not url:
            continue
        # Tavily's score is relevance-to-query (≈1.0 for any clean query),
        # not duplication-of-hypothesis. Down-weight it; if missing, fall
        # back to token overlap which IS closer to true similarity.
        raw = float(r.get("score") or 0.0)
        if raw > 0.0:
            sim = raw * _TAVILY_SCORE_SCALE
        else:
            sim = _jaccard(query_tokens, _tokens(title + " " + (r.get("content") or "")))
        out.append(
            Citation(
                title=title,
                authors=[],
                year=None,  # Tavily doesn't expose year
                url=url,
                source="tavily",
                similarity=round(min(max(sim, 0.0), 1.0), 3),
            )
        )
    return out


def _normalise_scholar(
    rows: list[dict[str, Any]] | None, *, query_tokens: set[str]
) -> list[Citation]:
    if not rows:
        return []
    out: list[Citation] = []
    for r in rows:
        title = (r.get("title") or "").strip()
        if not title:
            continue
        url = r.get("url") or _doi_from_external_ids(r.get("externalIds"))
        authors = [
            (a.get("name") or "").strip()
            for a in (r.get("authors") or [])
            if (a.get("name") or "").strip()
        ][:5]
        abstract = r.get("abstract") or ""
        sim = _jaccard(query_tokens, _tokens(title + " " + abstract))
        out.append(
            Citation(
                title=title,
                authors=authors,
                year=r.get("year"),
                url=url,
                source="semantic_scholar",
                similarity=round(min(max(sim, 0.0), 1.0), 3),
            )
        )
    return out


# ---------- merge / rank ---------------------------------------------------


def _merge_dedup(*lists: list[Citation]) -> list[Citation]:
    """Keep the best (highest similarity) entry per dedup key, across all sources."""
    best: dict[str, Citation] = {}
    for lst in lists:
        for c in lst:
            k = _key(c.url, c.title)
            cur = best.get(k)
            if cur is None or (c.similarity or 0) > (cur.similarity or 0):
                best[k] = c
    # Sort by similarity desc, then prefer S2 (has authors+year) for equal scores.
    return sorted(
        best.values(),
        key=lambda c: (-(c.similarity or 0.0), 0 if c.source == "semantic_scholar" else 1),
    )


def _classify(signals: list[Citation]) -> tuple[NoveltySignal, str]:
    if not signals:
        return (
            NoveltySignal.NOT_FOUND,
            "Pretrial discovery returned no relevant precedent. The hypothesis appears novel — or the query terms are too narrow.",
        )
    top = signals[0].similarity or 0.0
    if top >= _NEAR_MATCH:
        return (
            NoveltySignal.EXACT_MATCH,
            f"Pretrial discovery found a near-exact match (similarity {top:.2f}). The court must distinguish this hypothesis from prior work before proceeding.",
        )
    if top >= _SIMILAR:
        return (
            NoveltySignal.SIMILAR,
            f"Pretrial discovery surfaced {len(signals)} adjacent works (top similarity {top:.2f}). Useful precedent for the bench to weigh.",
        )
    return (
        NoveltySignal.NOT_FOUND,
        f"Pretrial discovery surfaced {len(signals)} loosely related works; none rise to the threshold of precedent. The hypothesis is plausibly novel.",
    )


# ---------- public entry point --------------------------------------------


async def run_discovery(hypothesis: str) -> StareDecisisResult:
    """Run pretrial discovery for a docketed hypothesis.

    Always returns a valid :class:`StareDecisisResult`. If both providers
    fail (or no key is configured), the signal is ``NOT_FOUND`` and the
    citation list is empty — the trial can still proceed, just without
    cited precedent.
    """
    query = (hypothesis or "").strip()
    if not query:
        return StareDecisisResult(
            signal=NoveltySignal.NOT_FOUND,
            rationale="Empty hypothesis — nothing to search.",
            citations=[],
        )

    query_tokens = _tokens(query)

    tavily_task = tavily_search(query, max_results=6, search_depth="advanced")
    scholar_task = scholar_search(query, limit=5)

    tavily_raw, scholar_rows = await asyncio.gather(
        tavily_task, scholar_task, return_exceptions=False
    )

    tavily_cits = _normalise_tavily(tavily_raw, query_tokens=query_tokens)
    scholar_cits = _normalise_scholar(scholar_rows, query_tokens=query_tokens)

    merged = _merge_dedup(scholar_cits, tavily_cits)[:_MAX_CITATIONS]
    signal, rationale = _classify(merged)

    logger.info(
        "discovery: tavily=%d s2=%d merged=%d signal=%s",
        len(tavily_cits),
        len(scholar_cits),
        len(merged),
        signal.value,
    )
    return StareDecisisResult(
        signal=signal,
        rationale=rationale,
        citations=merged,
    )
