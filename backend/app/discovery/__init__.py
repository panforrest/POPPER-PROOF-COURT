"""Pretrial Discovery — real-citation retrieval for the docketed hypothesis.

Two providers, called in parallel:

* **Tavily** — fresh, AI-friendly web/news search. Requires ``TAVILY_API_KEY``.
* **Semantic Scholar** — 200M-paper graph. Free, no key required at low rate.

Both contribute to a single :class:`StareDecisisResult` with a novelty
signal and a deduplicated list of :class:`Citation` objects.
"""

from .search import run_discovery, tavily_available

__all__ = ["run_discovery", "tavily_available"]
