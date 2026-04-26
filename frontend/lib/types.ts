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
