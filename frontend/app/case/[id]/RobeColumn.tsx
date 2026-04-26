"use client";

import type { AgentTurn } from "@/lib/types";

export type Robe = "prosecutor" | "defender" | "judge";

const ROBE_STYLE: Record<
  Robe,
  {
    border: string;
    text: string;
    bgSoft: string;
    motto: string;
    role: string;
  }
> = {
  prosecutor: {
    border: "border-prosecutor/40",
    text: "text-prosecutor",
    bgSoft: "bg-prosecutor/5",
    motto: "Falsify it.",
    role: "Prosecutor",
  },
  defender: {
    border: "border-defender/40",
    text: "text-defender",
    bgSoft: "bg-defender/5",
    motto: "Defend it.",
    role: "Defender",
  },
  judge: {
    border: "border-judge/40",
    text: "text-judge",
    bgSoft: "bg-judge/5",
    motto: "Weigh both sides.",
    role: "Judge",
  },
};

export default function RobeColumn({
  robe,
  turns,
  thinking,
  confidence,
  elevated,
}: {
  robe: Robe;
  turns: AgentTurn[];
  /** Show the typing indicator (agent is actively producing a turn). */
  thinking?: boolean;
  /** Judge-only: 0..100 current belief confidence. Null hides the gauge. */
  confidence?: number | null;
  /** Raises the column slightly (used for the Judge's bench). */
  elevated?: boolean;
}) {
  const style = ROBE_STYLE[robe];

  return (
    <section
      className={`flex flex-col rounded-xl border ${style.border} ${style.bgSoft} ${
        elevated ? "lg:-mt-6" : ""
      } backdrop-blur-sm overflow-hidden`}
      aria-label={`${style.role} column`}
    >
      {/* ---------- Robe header ---------- */}
      <header
        className={`px-5 py-4 border-b ${style.border} flex items-center justify-between`}
      >
        <div>
          <div
            className={`font-display text-lg leading-none ${style.text}`}
          >
            {style.role}
          </div>
          <div className="text-court-muted text-[10px] uppercase tracking-[0.22em] mt-1.5">
            {style.motto}
          </div>
        </div>
        {robe === "judge" && typeof confidence === "number" && (
          <ConfidenceGauge value={confidence} />
        )}
      </header>

      {/* ---------- Turn feed ---------- */}
      <div className="flex-1 min-h-[280px] p-4 space-y-3 overflow-y-auto">
        {turns.length === 0 && !thinking && (
          <EmptyState robe={robe} />
        )}
        {turns.map((t, i) => (
          <TurnCard key={i} turn={t} robe={robe} />
        ))}
        {thinking && <ThinkingIndicator robe={robe} />}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                     */
/* ------------------------------------------------------------------ */

function EmptyState({ robe }: { robe: Robe }) {
  const style = ROBE_STYLE[robe];
  return (
    <div className="h-full flex items-center justify-center text-center py-10">
      <p className={`text-xs uppercase tracking-[0.22em] ${style.text}/60`}>
        Awaiting the gavel
      </p>
    </div>
  );
}

function ThinkingIndicator({ robe }: { robe: Robe }) {
  const style = ROBE_STYLE[robe];
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-md border ${style.border} ${style.bgSoft}`}
    >
      <span className={`inline-flex gap-1 ${style.text}`}>
        <Dot delay={0} />
        <Dot delay={150} />
        <Dot delay={300} />
      </span>
      <span className="text-xs text-court-muted uppercase tracking-[0.18em]">
        Drafting argument…
      </span>
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-pulse"
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}

function TurnCard({ turn, robe }: { turn: AgentTurn; robe: Robe }) {
  const style = ROBE_STYLE[robe];
  return (
    <article
      className={`rounded-md border ${style.border} bg-court-surface/80 p-3`}
    >
      <header className="flex items-center justify-between mb-2">
        <span
          className={`text-[10px] uppercase tracking-[0.2em] ${style.text}`}
        >
          {turn.phase.replace(/_/g, " ")}
        </span>
        {typeof turn.confidence === "number" && (
          <span className="text-[10px] text-court-muted">
            conf {turn.confidence}%
          </span>
        )}
      </header>
      <p className="text-sm text-court-fg leading-relaxed whitespace-pre-wrap">
        {turn.text}
      </p>
      {turn.citations.length > 0 && (
        <footer className="mt-2 flex flex-wrap gap-1">
          {turn.citations.map((c, i) => (
            <span
              key={i}
              className="text-[10px] px-2 py-0.5 rounded-full border border-court-border text-court-muted"
              title={c.title}
            >
              [{i + 1}] {c.source}
            </span>
          ))}
        </footer>
      )}
    </article>
  );
}

function ConfidenceGauge({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="flex flex-col items-end gap-1" aria-label="Judge's confidence">
      <span className="text-[10px] text-court-muted uppercase tracking-[0.18em]">
        Belief
      </span>
      <div className="w-24 h-1.5 bg-court-border rounded-full overflow-hidden">
        <div
          className="h-full bg-judge transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-judge font-medium">{pct}%</span>
    </div>
  );
}
