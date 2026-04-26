"use client";

import { useMemo, useState } from "react";
import type { Case } from "@/lib/api";
import {
  AgentTurn,
  PHASE_BAR,
  PHASE_LABEL,
  TurnPhase,
  phaseToChipKey,
} from "@/lib/types";
import RobeColumn from "./RobeColumn";

export default function CourtroomClient({ filed }: { filed: Case }) {
  // Local trial state. In Step 8 these are fed by the SSE stream;
  // for Step 7 they remain empty until "Begin Trial" is wired.
  const [turns] = useState<AgentTurn[]>([]);
  const [currentPhase] = useState<TurnPhase | null>(null);
  const [judgeConfidence] = useState<number | null>(null);
  const [thinkingRole, setThinkingRole] = useState<
    "prosecutor" | "defender" | "judge" | null
  >(null);
  const [briefExpanded, setBriefExpanded] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const prosecutorTurns = useMemo(
    () => turns.filter((t) => t.role === "prosecutor"),
    [turns],
  );
  const defenderTurns = useMemo(
    () => turns.filter((t) => t.role === "defender"),
    [turns],
  );
  const judgeTurns = useMemo(
    () => turns.filter((t) => t.role === "judge"),
    [turns],
  );

  const activeChip = phaseToChipKey(currentPhase);
  const filedAt = new Date(filed.created_at);
  const briefShort =
    filed.hypothesis.length > 160 && !briefExpanded
      ? filed.hypothesis.slice(0, 160).trimEnd() + "…"
      : filed.hypothesis;

  const handleBeginTrial = () => {
    // Step 8 wires this to POST /api/cases/{id}/trial/start + SSE stream.
    // For now, flash a notice and briefly simulate "thinking" on the
    // Prosecutor so the UI can be demoed without a real trial engine.
    setNotice(
      "The bailiff is preparing the chamber. Live agents arrive in Step 8 — the three robes are wired and ready.",
    );
    setThinkingRole("prosecutor");
    window.setTimeout(() => setThinkingRole(null), 1800);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ---------- Docket header ---------- */}
      <section className="bg-court-surface border border-court-border rounded-xl p-5 shadow-2xl shadow-black/40">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <div className="text-[10px] text-judge uppercase tracking-[0.25em] font-medium mb-1">
              Case No. {filed.id}
            </div>
            <h1 className="font-display text-3xl sm:text-4xl tracking-tight leading-tight">
              The People v.{" "}
              <span className="italic text-judge">The Hypothesis</span>
            </h1>
            <div className="text-[11px] text-court-muted mt-2">
              Filed {filedAt.toLocaleString()}
            </div>
          </div>
          <button
            type="button"
            onClick={handleBeginTrial}
            className="px-6 py-3 bg-judge text-court-bg font-semibold uppercase tracking-[0.18em] text-xs rounded-md transition-colors hover:bg-judge/90 shadow-lg shadow-judge/20 shrink-0"
          >
            ⚖ Begin Trial
          </button>
        </div>

        {/* Brief */}
        <div className="mb-4">
          <div className="text-[10px] text-court-muted uppercase tracking-[0.25em] mb-2">
            Brief on the docket
          </div>
          <p className="text-sm sm:text-base text-court-fg leading-relaxed whitespace-pre-wrap">
            {briefShort}
          </p>
          {filed.hypothesis.length > 160 && (
            <button
              type="button"
              onClick={() => setBriefExpanded((v) => !v)}
              className="mt-2 text-[11px] text-judge uppercase tracking-[0.2em] hover:underline"
            >
              {briefExpanded ? "Collapse" : "Expand"} brief
            </button>
          )}
        </div>

        {/* Phase bar */}
        <div
          className="flex items-center gap-1 overflow-x-auto"
          role="progressbar"
          aria-label="Trial phase"
        >
          {PHASE_BAR.map((chip, i) => {
            const active = chip.key === activeChip;
            return (
              <div key={chip.key} className="flex items-center gap-1 shrink-0">
                <span
                  className={`px-3 py-1 rounded-full border text-[10px] uppercase tracking-[0.2em] transition-colors ${
                    active
                      ? "border-judge text-judge bg-judge/10"
                      : "border-court-border text-court-muted"
                  }`}
                >
                  {chip.label}
                </span>
                {i < PHASE_BAR.length - 1 && (
                  <span className="text-court-border" aria-hidden>
                    —
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {notice && (
          <p className="mt-4 text-sm text-defender bg-defender/10 border border-defender/30 rounded-md px-4 py-3">
            {notice}
          </p>
        )}

        {currentPhase && (
          <p className="mt-3 text-[11px] text-court-muted uppercase tracking-[0.22em]">
            Now: {PHASE_LABEL[currentPhase]}
          </p>
        )}
      </section>

      {/* ---------- 3-pane courtroom ---------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <RobeColumn
          robe="prosecutor"
          turns={prosecutorTurns}
          thinking={thinkingRole === "prosecutor"}
        />
        <RobeColumn
          robe="judge"
          turns={judgeTurns}
          thinking={thinkingRole === "judge"}
          confidence={judgeConfidence}
          elevated
        />
        <RobeColumn
          robe="defender"
          turns={defenderTurns}
          thinking={thinkingRole === "defender"}
        />
      </div>

      {/* ---------- Verdict strip ---------- */}
      <section className="rounded-xl border border-court-border bg-court-surface/60 p-5">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-judge text-xl leading-none">⚖</span>
          <h2 className="font-display text-xl text-court-fg">Verdict</h2>
          <span className="ml-auto text-[10px] text-court-muted uppercase tracking-[0.22em]">
            Pending
          </span>
        </div>
        <p className="text-sm text-court-muted leading-relaxed">
          The court has not yet rendered its verdict. Once the trial concludes,
          the Judge will decide{" "}
          <span className="text-judge">proceed</span>,{" "}
          <span className="text-judge">revise</span>, or{" "}
          <span className="text-judge">dismiss</span>, and the clerk will
          produce a procurement-ready experiment plan.
        </p>
      </section>
    </div>
  );
}
