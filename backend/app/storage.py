"""Ephemeral in-memory store for cases.

For the 24-hour hackathon we keep cases in a process-local dict. Cases live
only while the backend process is up. If persistence matters later, swap this
module out for aiosqlite / chromadb without changing callers.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from .schemas import Case, CaseCreate


_CASES: dict[str, Case] = {}


def _new_id() -> str:
    """10-character hex id — short enough for pretty URLs, long enough to avoid collisions."""
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


def clear() -> None:
    """Test helper — wipe all cases."""
    _CASES.clear()
