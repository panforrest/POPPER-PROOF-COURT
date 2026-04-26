/**
 * TypeScript mirror of backend/app/schemas.py enums + core value objects.
 *
 * Keep in sync manually for the hackathon. (Post-hackathon: generate from
 * the FastAPI OpenAPI spec via openapi-typescript.)
 */

// --- Enums (exact string values from the backend) ---------------------------

export const AgentRole = {
  PROSECUTOR: "prosecutor",
  DEFENDER: "defender",
  JUDGE: "judge",
  COUNSEL: "counsel",
} as const;
export type AgentRole = (typeof AgentRole)[keyof typeof AgentRole];

export const TurnPhase = {
  PROSECUTOR_OPENING: "prosecutor_opening",
  DEFENDER_OPENING: "defender_opening",
  JUDGE_BELIEF_1: "judge_belief_1",
  PROSECUTOR_REBUTTAL: "prosecutor_rebuttal",
  DEFENDER_REBUTTAL: "defender_rebuttal",
  JUDGE_BELIEF_2: "judge_belief_2",
  PROSECUTOR_CLOSING: "prosecutor_closing",
  DEFENDER_CLOSING: "defender_closing",
  JUDGE_VERDICT: "judge_verdict",
} as const;
export type TurnPhase = (typeof TurnPhase)[keyof typeof TurnPhase];

export const VerdictOutcome = {
  PROCEED: "proceed",
  REVISE: "revise",
  DISMISS: "dismiss",
} as const;
export type VerdictOutcome = (typeof VerdictOutcome)[keyof typeof VerdictOutcome];

export const NoveltySignal = {
  NOT_FOUND: "not_found",
  SIMILAR: "similar",
  EXACT_MATCH: "exact_match",
} as const;
export type NoveltySignal = (typeof NoveltySignal)[keyof typeof NoveltySignal];

// --- Primitive value objects ------------------------------------------------

export type Citation = {
  title: string;
  authors: string[];
  year: number | null;
  url: string | null;
  source: string;
  similarity: number | null;
};

export type AgentTurn = {
  phase: TurnPhase;
  role: AgentRole;
  text: string;
  citations: Citation[];
  confidence: number | null;
  timestamp: string; // ISO 8601
};

/** End-of-trial payload from the SSE `verdict` event (Step 8 mock, Step N real). */
export type StreamVerdict = {
  outcome: VerdictOutcome;
  rationale: string;
  confidence: number; // 0..100, judge’s confidence in the outcome
};

export type TrialStreamState = "idle" | "streaming" | "complete" | "error";

// --- ExperimentPlan (mirrors backend schemas.py § 7-8) ---------------------

export type RiskFactor = {
  description: string;
  severity: number; // 1..5
  likelihood: number; // 1..5
  mitigation: string;
};

export type ProtocolStep = {
  n: number;
  title: string;
  description: string;
  duration_minutes: number;
  equipment: string[];
  notes: string | null;
  source_url: string | null;
};

export type MaterialLine = {
  name: string;
  catalog_number: string | null;
  supplier: string | null;
  quantity: number;
  unit: string;
  unit_price_usd: number | null;
  total_usd: number | null;
  url: string | null;
};

export type BudgetLine = {
  category: string;
  description: string;
  amount_usd: number;
};

export type TimelinePhase = {
  name: string;
  week_start: number;
  week_end: number;
  depends_on: string[];
};

export type ValidationMetric = {
  metric: string;
  threshold: string;
  method: string;
  standard: string | null;
};

export type Personnel = {
  role: string;
  fte: number; // 0..1
  weeks: number;
  hourly_rate_usd: number | null;
  total_cost_usd: number | null;
  required_skills: string[];
};

export type EquipmentItem = {
  name: string;
  purpose: string;
  estimated_cost_usd: number | null;
  rental_available: boolean;
  supplier: string | null;
};

export type CRORecommendation = {
  name: string;
  specialty: string;
  estimated_cost_usd: number | null;
  typical_turnaround_weeks: number | null;
  url: string | null;
};

export type ExperimentPlan = {
  case_id: string;
  hypothesis: string;
  summary: string;

  protocol: ProtocolStep[];
  materials: MaterialLine[];
  budget: BudgetLine[];
  total_budget_usd: number;
  timeline: TimelinePhase[];
  total_weeks: number;
  validation: ValidationMetric[];

  personnel: Personnel[];
  equipment: EquipmentItem[];
  regulatory_considerations: string[];
  safety_classification: string | null;
  risks_and_mitigations: RiskFactor[];

  suggested_cros: CRORecommendation[];

  success_criteria_summary: string;
  failure_stop_criteria: string[];
  deliverables: string[];
  prereq_skills: string[];

  citations: Citation[];

  created_at: string; // ISO 8601
};

export type PlanState = "idle" | "generating" | "ready" | "error";

// --- Pretrial Discovery (mirrors backend StareDecisisResult) ---------------

export type StareDecisisResult = {
  signal: NoveltySignal;
  rationale: string;
  citations: Citation[];
};

export type DiscoveryState = "idle" | "running" | "ready" | "error";

// --- Court Reporter chat (mirrors backend ChatMessage) --------------------

export const ChatRole = {
  USER: "user",
  ASSISTANT: "assistant",
} as const;
export type ChatRole = (typeof ChatRole)[keyof typeof ChatRole];

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

/** Lifecycle of the Reporter chat panel. */
export type ReporterState = "idle" | "streaming" | "ready" | "error";

/** Human label + tone for the novelty badge. */
export const NOVELTY_LABEL: Record<NoveltySignal, string> = {
  [NoveltySignal.NOT_FOUND]: "Novel",
  [NoveltySignal.SIMILAR]: "Adjacent precedent",
  [NoveltySignal.EXACT_MATCH]: "Near-exact match",
};

/** Tailwind class set for the novelty badge — green/gold/red mapping. */
export const NOVELTY_CLASS: Record<NoveltySignal, string> = {
  [NoveltySignal.NOT_FOUND]: "text-defender border-defender/40 bg-defender/10",
  [NoveltySignal.SIMILAR]: "text-judge border-judge/40 bg-judge/10",
  [NoveltySignal.EXACT_MATCH]:
    "text-prosecutor border-prosecutor/40 bg-prosecutor/10",
};

// --- Trial-state derivations used by the UI --------------------------------

/** Human-readable phase label shown in the phase bar. */
export const PHASE_LABEL: Record<TurnPhase, string> = {
  [TurnPhase.PROSECUTOR_OPENING]: "Opening — Prosecution",
  [TurnPhase.DEFENDER_OPENING]: "Opening — Defense",
  [TurnPhase.JUDGE_BELIEF_1]: "Judge's First Belief",
  [TurnPhase.PROSECUTOR_REBUTTAL]: "Rebuttal — Prosecution",
  [TurnPhase.DEFENDER_REBUTTAL]: "Rebuttal — Defense",
  [TurnPhase.JUDGE_BELIEF_2]: "Judge's Second Belief",
  [TurnPhase.PROSECUTOR_CLOSING]: "Closing — Prosecution",
  [TurnPhase.DEFENDER_CLOSING]: "Closing — Defense",
  [TurnPhase.JUDGE_VERDICT]: "Verdict",
};

/** Compact top-bar chips, in chronological order. */
export const PHASE_BAR: Array<{ key: string; label: string }> = [
  { key: "pretrial", label: "Pre-trial" },
  { key: "opening", label: "Opening" },
  { key: "belief-1", label: "Belief" },
  { key: "rebuttal", label: "Cross" },
  { key: "belief-2", label: "Belief" },
  { key: "closing", label: "Closing" },
  { key: "verdict", label: "Verdict" },
];

/** Map a TurnPhase to its chip in the phase bar. */
export function phaseToChipKey(phase: TurnPhase | null): string {
  if (!phase) return "pretrial";
  if (phase === TurnPhase.PROSECUTOR_OPENING || phase === TurnPhase.DEFENDER_OPENING)
    return "opening";
  if (phase === TurnPhase.JUDGE_BELIEF_1) return "belief-1";
  if (phase === TurnPhase.PROSECUTOR_REBUTTAL || phase === TurnPhase.DEFENDER_REBUTTAL)
    return "rebuttal";
  if (phase === TurnPhase.JUDGE_BELIEF_2) return "belief-2";
  if (phase === TurnPhase.PROSECUTOR_CLOSING || phase === TurnPhase.DEFENDER_CLOSING)
    return "closing";
  return "verdict";
}
