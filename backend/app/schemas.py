"""Shared Pydantic schemas for POPPER-PROOF COURT.

Typed contracts between FastAPI routes, the LangGraph state machine,
and the Next.js frontend (mirrored as TypeScript types in /frontend/lib).

Layout (top → bottom = dependency order):
    1. Enums
    2. Primitive value objects (Citation, RiskFactor)
    3. Case lifecycle (CaseCreate, Case)
    4. Pretrial Discovery (StareDecisisResult)
    5. Trial (AgentTurn)
    6. Verdict (depends on RiskFactor, Citation)
    7. Plan building blocks (ProtocolStep, MaterialLine, BudgetLine,
       TimelinePhase, ValidationMetric, Personnel, EquipmentItem,
       CRORecommendation)
    8. ExperimentPlan (depends on all of the above)
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# 1. Enums
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# 2. Primitive value objects
# ---------------------------------------------------------------------------


class Citation(BaseModel):
    title: str
    authors: list[str] = Field(default_factory=list)
    year: Optional[int] = None
    url: Optional[str] = None
    source: str  # e.g. "semantic_scholar", "tavily", "arxiv", "pubmed"
    similarity: Optional[float] = None  # 0..1 for stare-decisis ranking


class RiskFactor(BaseModel):
    """Used by both Verdict (scientific risks) and ExperimentPlan
    (operational risks). Severity × Likelihood gives a heatmap score."""

    description: str
    severity: int = Field(..., ge=1, le=5)  # 1 = trivial, 5 = catastrophic
    likelihood: int = Field(..., ge=1, le=5)  # 1 = rare, 5 = near-certain
    mitigation: str


# ---------------------------------------------------------------------------
# 3. Case lifecycle
# ---------------------------------------------------------------------------


class CaseCreate(BaseModel):
    hypothesis: str = Field(..., min_length=20)
    organization_type: Optional[str] = None  # "pharma" | "university" | "funder"


class Case(BaseModel):
    id: str
    hypothesis: str
    organization_type: Optional[str] = None
    created_at: datetime


# ---------------------------------------------------------------------------
# 4. Pretrial Discovery (Stare Decisis Search)
# ---------------------------------------------------------------------------


class StareDecisisResult(BaseModel):
    signal: NoveltySignal
    rationale: str
    citations: list[Citation] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# 5. Trial — agent turns
# ---------------------------------------------------------------------------


class AgentTurn(BaseModel):
    phase: TurnPhase
    role: AgentRole
    text: str
    citations: list[Citation] = Field(default_factory=list)
    confidence: Optional[float] = None  # 0..100, for Judge belief updates
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# ---------------------------------------------------------------------------
# 6. Verdict
# ---------------------------------------------------------------------------


class Verdict(BaseModel):
    outcome: VerdictOutcome
    confidence: float = Field(..., ge=0, le=100)  # judge's confidence in the ruling
    rationale: str

    # Quantified scoring of both sides
    prosecutor_score: float = Field(..., ge=0, le=100)
    defender_score: float = Field(..., ge=0, le=100)

    # The losing side's strongest unaddressed objection — courtroom realism
    dissenting_opinion: str

    # Separate from confidence: how likely the experiment is to actually succeed
    success_probability: float = Field(..., ge=0, le=1)

    # Scientific risks the judge weighed (operational risks live on ExperimentPlan)
    risk_factors: list[RiskFactor] = Field(default_factory=list)

    # "Cost-of-Reversal" — what you lose if you run it and it fails
    cost_of_failure_usd: float = 0.0

    # The 3 citations the judge weighted most heavily — provenance on the verdict
    decision_basis: list[Citation] = Field(default_factory=list)

    # For REVISE outcomes: what would flip this to PROCEED
    revision_required_if: list[str] = Field(default_factory=list)

    # Brief's literal request: "what evidence would change the verdict"
    what_would_change_my_mind: list[str] = Field(default_factory=list)

    issued_at: datetime = Field(default_factory=datetime.utcnow)


# ---------------------------------------------------------------------------
# 7. Plan building blocks
# ---------------------------------------------------------------------------


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


class Personnel(BaseModel):
    """Brief explicitly calls out 'staffing the team' — first-class field."""

    role: str  # "Principal Investigator" | "Postdoc" | "Lab Tech" | ...
    fte: float = Field(..., ge=0.0, le=1.0)
    weeks: int = Field(..., ge=0)
    hourly_rate_usd: Optional[float] = None
    total_cost_usd: Optional[float] = None
    required_skills: list[str] = Field(default_factory=list)


class EquipmentItem(BaseModel):
    """Capital equipment — distinct from `MaterialLine` (consumables)."""

    name: str
    purpose: str
    estimated_cost_usd: Optional[float] = None
    rental_available: bool = False
    supplier: Optional[str] = None


class CRORecommendation(BaseModel):
    """If the lab doesn't want to run it in-house — closes the brief's loop
    (the brief is literally about replacing the CRO scoping process)."""

    name: str  # "Charles River" | "Eurofins" | "WuXi AppTec" | ...
    specialty: str
    estimated_cost_usd: Optional[float] = None
    typical_turnaround_weeks: Optional[int] = None
    url: Optional[str] = None


# ---------------------------------------------------------------------------
# 8. ExperimentPlan
# ---------------------------------------------------------------------------


class ExperimentPlan(BaseModel):
    case_id: str
    hypothesis: str  # self-contained — PDF export shouldn't need to join Case
    summary: str

    # The five core sections required by the brief
    protocol: list[ProtocolStep]
    materials: list[MaterialLine]
    budget: list[BudgetLine]
    total_budget_usd: float
    timeline: list[TimelinePhase]
    total_weeks: int
    validation: list[ValidationMetric]

    # Operational completeness — what makes a plan "executable Monday"
    personnel: list[Personnel] = Field(default_factory=list)
    equipment: list[EquipmentItem] = Field(default_factory=list)
    regulatory_considerations: list[str] = Field(default_factory=list)
    safety_classification: Optional[str] = None  # e.g. "BSL-2", "COSHH-Class-3"
    risks_and_mitigations: list[RiskFactor] = Field(default_factory=list)

    # If they'd rather outsource — recommended Contract Research Orgs
    suggested_cros: list[CRORecommendation] = Field(default_factory=list)

    # Decision aids
    success_criteria_summary: str = ""
    failure_stop_criteria: list[str] = Field(default_factory=list)
    deliverables: list[str] = Field(default_factory=list)
    prereq_skills: list[str] = Field(default_factory=list)

    # Provenance
    citations: list[Citation] = Field(default_factory=list)

    created_at: datetime = Field(default_factory=datetime.utcnow)
