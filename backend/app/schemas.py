"""Shared Pydantic schemas for POPPER-PROOF COURT.

Typed contracts between FastAPI routes, the LangGraph state machine,
and the Next.js frontend (mirrored as TypeScript types in /frontend/lib).
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class NoveltySignal(str, Enum):
    """Stare-decisis verdict from the Pretrial Discovery step."""

    NOT_FOUND = "not_found"
    SIMILAR = "similar"
    EXACT_MATCH = "exact_match"


class AgentRole(str, Enum):
    PROSECUTOR = "prosecutor"
    DEFENDER = "defender"
    JUDGE = "judge"
    COUNSEL = "counsel"  # for Counsel Chambers (drafting)


class TurnPhase(str, Enum):
    """7-turn AgenticSimLaw protocol phases."""

    PROSECUTOR_OPENING = "prosecutor_opening"
    DEFENDER_OPENING = "defender_opening"
    JUDGE_BELIEF_1 = "judge_belief_1"
    PROSECUTOR_REBUTTAL = "prosecutor_rebuttal"
    DEFENDER_REBUTTAL = "defender_rebuttal"
    JUDGE_BELIEF_2 = "judge_belief_2"
    PROSECUTOR_CLOSING = "prosecutor_closing"
    DEFENDER_CLOSING = "defender_closing"
    JUDGE_VERDICT = "judge_verdict"


class VerdictOutcome(str, Enum):
    PROCEED = "proceed"
    REVISE = "revise"
    DISMISS = "dismiss"


class Citation(BaseModel):
    title: str
    authors: list[str] = Field(default_factory=list)
    year: Optional[int] = None
    url: Optional[str] = None
    source: str  # e.g. "semantic_scholar", "tavily", "arxiv", "pubmed"
    similarity: Optional[float] = None  # 0..1 for stare-decisis ranking


class CaseCreate(BaseModel):
    hypothesis: str = Field(..., min_length=20)
    organization_type: Optional[str] = None  # "pharma" | "university" | "funder"


class Case(BaseModel):
    id: str
    hypothesis: str
    organization_type: Optional[str] = None
    created_at: datetime


class StareDecisisResult(BaseModel):
    signal: NoveltySignal
    rationale: str
    citations: list[Citation] = Field(default_factory=list)


class AgentTurn(BaseModel):
    phase: TurnPhase
    role: AgentRole
    text: str
    citations: list[Citation] = Field(default_factory=list)
    confidence: Optional[float] = None  # 0..100, for Judge belief updates
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class Verdict(BaseModel):
    outcome: VerdictOutcome
    confidence: float  # 0..100
    rationale: str
    what_would_change_my_mind: list[str] = Field(default_factory=list)


class ProtocolStep(BaseModel):
    n: int
    title: str
    description: str
    duration_minutes: int
    equipment: list[str] = Field(default_factory=list)
    notes: Optional[str] = None
    source_url: Optional[str] = None  # protocols.io link


class MaterialLine(BaseModel):
    name: str
    catalog_number: Optional[str] = None
    supplier: Optional[str] = None  # "Sigma" | "Thermo" | "Promega" | ...
    quantity: float
    unit: str
    unit_price_usd: Optional[float] = None
    total_usd: Optional[float] = None
    url: Optional[str] = None


class BudgetLine(BaseModel):
    category: str  # "Reagents" | "Equipment" | "Personnel" | "Overhead" | "Contingency"
    description: str
    amount_usd: float


class TimelinePhase(BaseModel):
    name: str
    week_start: int
    week_end: int
    depends_on: list[str] = Field(default_factory=list)


class ValidationMetric(BaseModel):
    metric: str
    threshold: str
    method: str
    standard: Optional[str] = None  # "MIQE" | "ARRIVE" | "CONSORT" | ...


class ExperimentPlan(BaseModel):
    case_id: str
    summary: str
    protocol: list[ProtocolStep]
    materials: list[MaterialLine]
    budget: list[BudgetLine]
    total_budget_usd: float
    timeline: list[TimelinePhase]
    total_weeks: int
    validation: list[ValidationMetric]
    citations: list[Citation] = Field(default_factory=list)
