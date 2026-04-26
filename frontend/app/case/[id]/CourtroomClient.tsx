"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Case } from "@/lib/api";
import {
  API_BASE,
  ApiError,
  fetchMemoranda,
  generatePlan,
  runDiscovery,
} from "@/lib/api";
import {
  AgentTurn,
  type BenchMemorandum,
  DiscoveryState,
  ExperimentPlan,
  PHASE_BAR,
  PHASE_LABEL,
  PlanState,
  type RevisedVerdict,
  StareDecisisResult,
  StreamVerdict,
  TrialStreamState,
  TurnPhase,
  VerdictOutcome,
  phaseToChipKey,
} from "@/lib/types";
import BenchMemorandumCard from "./BenchMemorandumCard";
import CourtReporterDrawer from "./CourtReporterDrawer";
import ExperimentPlanCard from "./ExperimentPlanCard";
import PretrialDiscoveryPanel from "./PretrialDiscoveryPanel";
import RobeColumn from "./RobeColumn";

function outcomeLabel(o: VerdictOutcome): string {
  if (o === VerdictOutcome.PROCEED) return "Proceed";
  if (o === VerdictOutcome.REVISE) return "Revise";
  return "Dismiss";
}

function outcomeClass(o: VerdictOutcome): string {
  if (o === VerdictOutcome.PROCEED) return "text-defender border-defender/40";
  if (o === VerdictOutcome.REVISE) return "text-judge border-judge/40";
  return "text-prosecutor border-prosecutor/40";
}

export default function CourtroomClient({ filed }: { filed: Case }) {
  const [turns, setTurns] = useState<AgentTurn[]>([]);
  const [currentPhase, setCurrentPhase] = useState<TurnPhase | null>(null);
  const [judgeConfidence, setJudgeConfidence] = useState<number | null>(null);
  const [thinkingRole, setThinkingRole] = useState<
    "prosecutor" | "defender" | "judge" | null
  >(null);
  const [briefExpanded, setBriefExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamVerdict, setStreamVerdict] = useState<StreamVerdict | null>(null);
  const [trialState, setTrialState] = useState<TrialStreamState>("idle");
  const [plan, setPlan] = useState<ExperimentPlan | null>(null);
  const [planState, setPlanState] = useState<PlanState>("idle");
  const [planError, setPlanError] = useState<string | null>(null);

  const [discovery, setDiscovery] = useState<StareDecisisResult | null>(null);
  const [discoveryState, setDiscoveryState] = useState<DiscoveryState>("idle");
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  const [memoranda, setMemoranda] = useState<BenchMemorandum[]>([]);

  const [reporterOpen, setReporterOpen] = useState(false);

  const esRef = useRef<EventSource | null>(null);
  const streamDoneRef = useRef(false);
  const planRunIdRef = useRef(0); // guards stale plan responses
  const discoveryRunIdRef = useRef(0); // guards stale discovery responses
  const memoHydratedRef = useRef(false); // hydrate-once guard for the memos list

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

  useEffect(() => {
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, []);

  const fireDiscovery = useCallback(
    async (opts?: { force?: boolean }) => {
      const runId = ++discoveryRunIdRef.current;
      setDiscoveryState("running");
      setDiscoveryError(null);
      try {
        const res = await runDiscovery(filed.id, opts);
        if (discoveryRunIdRef.current !== runId) return;
        setDiscovery(res);
        setDiscoveryState("ready");
      } catch (e) {
        if (discoveryRunIdRef.current !== runId) return;
        const msg =
          e instanceof ApiError
            ? `Discovery failed (${e.status}): ${e.detail}`
            : e instanceof Error
              ? e.message
              : "Discovery failed.";
        setDiscoveryError(msg);
        setDiscoveryState("error");
      }
    },
    [filed.id],
  );

  // Auto-run pretrial discovery on case mount. The backend caches, so a
  // page refresh just re-displays the same precedent at zero cost.
  useEffect(() => {
    void fireDiscovery();
  }, [fireDiscovery]);

  // Hydrate any memoranda already on file for this case. Best-effort —
  // a fetch failure is silently swallowed (the chain just renders empty).
  useEffect(() => {
    if (memoHydratedRef.current) return;
    memoHydratedRef.current = true;
    void fetchMemoranda(filed.id)
      .then((list) => setMemoranda(list))
      .catch(() => {
        /* ignore — empty chain is the safe default */
      });
  }, [filed.id]);

  const runPlanGeneration = useCallback(
    async (opts?: { force?: boolean }) => {
      const runId = ++planRunIdRef.current;
      setPlanState("generating");
      setPlanError(null);
      try {
        const next = await generatePlan(filed.id, opts);
        if (planRunIdRef.current !== runId) return; // stale
        setPlan(next);
        setPlanState("ready");
      } catch (e) {
        if (planRunIdRef.current !== runId) return;
        const msg =
          e instanceof ApiError
            ? `Plan generation failed (${e.status}): ${e.detail}`
            : e instanceof Error
              ? e.message
              : "Plan generation failed.";
        setPlanError(msg);
        setPlanState("error");
      }
    },
    [filed.id],
  );

  const handleRegeneratePlan = useCallback(() => {
    runPlanGeneration({ force: true });
  }, [runPlanGeneration]);

  const handleVerdictRevised = useCallback((revised: RevisedVerdict) => {
    // Mirror StreamVerdict shape (3 keys) — the verdict strip does not
    // know about the courtroom narrative; that's surfaced inside the
    // memo entry below. The shape match keeps existing UI code untouched.
    setStreamVerdict({
      outcome: revised.outcome,
      rationale: revised.rationale,
      confidence: revised.confidence,
    });
  }, []);

  const handleMemorandumFiled = useCallback(
    (memo: BenchMemorandum) => {
      setMemoranda((prev) => [...prev, memo]);
      // The standing ruling has changed — the plan must be redrawn under
      // the new constraints. force=true bypasses the backend cache so we
      // get a fresh order from the bench, not the pre-memorandum draft.
      void runPlanGeneration({ force: true });
    },
    [runPlanGeneration],
  );

  const handleBeginTrial = useCallback(() => {
    // Tear down any prior run
    streamDoneRef.current = false;
    esRef.current?.close();
    esRef.current = null;

    setError(null);
    setStreamVerdict(null);
    setTurns([]);
    setCurrentPhase(null);
    setJudgeConfidence(null);
    setThinkingRole(null);
    setTrialState("streaming");

    // Reset prior plan — a new trial means a new order from the bench.
    planRunIdRef.current++;
    setPlan(null);
    setPlanState("idle");
    setPlanError(null);

    // A fresh trial supersedes any prior memoranda chain — the backend
    // already drops them via storage.set_trial_result on a new run, but
    // the frontend must wipe its mirror so the chain log doesn't lie.
    setMemoranda([]);

    const url = `${API_BASE}/api/cases/${encodeURIComponent(filed.id)}/trial/stream`;
    const es = new EventSource(url);
    esRef.current = es;

    const onThinking = (e: MessageEvent) => {
      const p = JSON.parse(e.data) as { role: string };
      if (p.role === "prosecutor" || p.role === "defender" || p.role === "judge")
        setThinkingRole(p.role);
    };

    const onTurn = (e: MessageEvent) => {
      const t = JSON.parse(e.data) as AgentTurn;
      setThinkingRole(null);
      setTurns((prev) => [...prev, t]);
      setCurrentPhase(t.phase);
      if (t.role === "judge" && t.confidence != null)
        setJudgeConfidence(t.confidence);
    };

    const onBelief = (e: MessageEvent) => {
      const p = JSON.parse(e.data) as { value: number };
      setJudgeConfidence(p.value);
    };

    const onVerdict = (e: MessageEvent) => {
      const v = JSON.parse(e.data) as StreamVerdict;
      setStreamVerdict(v);
    };

    const onComplete = () => {
      if (esRef.current !== es) return;
      streamDoneRef.current = true;
      setTrialState("complete");
      setThinkingRole(null);
      es.close();
      if (esRef.current === es) esRef.current = null;
      // Auto-issue the runnable order. Backend caches, so this is cheap on reruns.
      void runPlanGeneration();
    };

    const onTrialError = (e: MessageEvent) => {
      if (esRef.current !== es) return;
      const p = JSON.parse(e.data) as { message: string };
      setError(p.message);
      setTrialState("error");
      setThinkingRole(null);
      es.close();
      if (esRef.current === es) esRef.current = null;
    };

    es.addEventListener("thinking", onThinking);
    es.addEventListener("turn", onTurn);
    es.addEventListener("belief", onBelief);
    es.addEventListener("verdict", onVerdict);
    es.addEventListener("complete", onComplete);
    es.addEventListener("trial_error", onTrialError);

    es.onerror = () => {
      if (esRef.current !== es) return;
      if (streamDoneRef.current) return;
      if (es.readyState === EventSource.CLOSED) {
        setError(
          (prev) =>
            prev ??
            "The bailiff could not open the stream. Is the backend on :8000, and the case still on the docket?",
        );
        setTrialState("error");
        setThinkingRole(null);
      }
    };
  }, [filed.id, runPlanGeneration]);

  const ctaLabel =
    trialState === "streaming"
      ? "Trial in session…"
      : trialState === "complete" || trialState === "error"
        ? "Run trial again"
        : "⚖ Begin Trial";
  const ctaDisabled = trialState === "streaming";

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
            disabled={ctaDisabled}
            className="px-6 py-3 bg-judge text-court-bg font-semibold uppercase tracking-[0.18em] text-xs rounded-md transition-colors enabled:hover:bg-judge/90 shadow-lg shadow-judge/20 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {ctaLabel}
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

        {error && (
          <p className="mt-4 text-sm text-prosecutor bg-prosecutor/10 border border-prosecutor/30 rounded-md px-4 py-3">
            {error}
          </p>
        )}

        {currentPhase && (
          <p className="mt-3 text-[11px] text-court-muted uppercase tracking-[0.22em]">
            Now: {PHASE_LABEL[currentPhase]}
          </p>
        )}

        {trialState === "complete" && !error && (
          <p className="mt-4 text-sm text-defender bg-defender/10 border border-defender/30 rounded-md px-4 py-3">
            The bench has rendered its verdict. The Court Clerk is drafting
            the runnable order below — scroll down to review.
          </p>
        )}
      </section>

      {/* ---------- Pretrial Discovery ---------- */}
      {discoveryState === "running" && !discovery && (
        <section className="rounded-xl border border-court-border bg-court-surface/60 px-5 py-5">
          <p className="text-[10px] uppercase tracking-[0.28em] text-court-muted mb-1">
            Pretrial Discovery
          </p>
          <p className="font-display text-base text-court-fg">
            The clerk is searching the published record…
          </p>
          <p className="mt-1 text-[12px] text-court-muted">
            Querying open literature for precedent on the docketed hypothesis.
          </p>
          <div className="mt-3 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-judge animate-pulse" />
            <span
              className="w-2 h-2 rounded-full bg-judge animate-pulse"
              style={{ animationDelay: "0.15s" }}
            />
            <span
              className="w-2 h-2 rounded-full bg-judge animate-pulse"
              style={{ animationDelay: "0.3s" }}
            />
          </div>
        </section>
      )}
      {discoveryState === "error" && discoveryError && !discovery && (
        <section className="rounded-xl border border-prosecutor/40 bg-prosecutor/10 px-5 py-3">
          <p className="text-[11px] uppercase tracking-[0.22em] text-prosecutor mb-1">
            Pretrial Discovery failed
          </p>
          <p className="text-sm text-court-fg">{discoveryError}</p>
          <button
            type="button"
            onClick={() => void fireDiscovery({ force: true })}
            className="mt-2 text-[10px] uppercase tracking-[0.22em] px-3 py-1 rounded-full border border-prosecutor/40 text-prosecutor hover:bg-prosecutor/20 transition-colors"
          >
            Try again
          </button>
        </section>
      )}
      {discovery && (
        <PretrialDiscoveryPanel
          result={discovery}
          onRefresh={() => void fireDiscovery({ force: true })}
          refreshing={discoveryState === "running"}
        />
      )}

      {/* ---------- 3-pane courtroom ---------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <RobeColumn
          robe="prosecutor"
          turns={prosecutorTurns}
          thinking={thinkingRole === "prosecutor"}
          discoveryPool={discovery?.citations}
        />
        <RobeColumn
          robe="judge"
          turns={judgeTurns}
          thinking={thinkingRole === "judge"}
          confidence={judgeConfidence}
          elevated
          discoveryPool={discovery?.citations}
        />
        <RobeColumn
          robe="defender"
          turns={defenderTurns}
          thinking={thinkingRole === "defender"}
          discoveryPool={discovery?.citations}
        />
      </div>

      {/* ---------- Verdict strip ---------- */}
      <section className="rounded-xl border border-court-border bg-court-surface/60 p-5">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-judge text-xl leading-none">⚖</span>
          <h2 className="font-display text-xl text-court-fg">Verdict</h2>
          {memoranda.length > 0 && (
            <span
              className="text-[10px] uppercase tracking-[0.22em] px-2.5 py-1 rounded-full border border-judge/50 text-judge bg-judge/10"
              title={`The ruling has been revised ${memoranda.length} time${memoranda.length === 1 ? "" : "s"} via Bench Memorandum.`}
            >
              Revised ×{memoranda.length}
            </span>
          )}
          <span
            className={`ml-auto text-[10px] uppercase tracking-[0.22em] px-3 py-1 rounded-full border ${
              streamVerdict
                ? outcomeClass(streamVerdict.outcome)
                : "text-court-muted border-court-border"
            }`}
          >
            {streamVerdict
              ? outcomeLabel(streamVerdict.outcome)
              : "Pending"}
          </span>
        </div>
        {streamVerdict ? (
          <>
            <p className="text-sm text-court-fg leading-relaxed mb-2">
              {streamVerdict.rationale}
            </p>
            <p className="text-[11px] text-court-muted uppercase tracking-[0.2em]">
              Judge’s confidence in this outcome: {Math.round(streamVerdict.confidence)}%
            </p>
          </>
        ) : (
          <p className="text-sm text-court-muted leading-relaxed">
            The court has not yet rendered its verdict. Click{" "}
            <span className="text-court-fg">Begin Trial</span> to convene the
            bench. When the trial ends, the Judge will decide{" "}
            <span className="text-judge">proceed</span>,{" "}
            <span className="text-judge">revise</span>, or{" "}
            <span className="text-judge">dismiss</span>, and the clerk will
            publish a procurement-ready plan.
          </p>
        )}
      </section>

      {/* ---------- Bench Memorandum (post-verdict reconsideration) ---------- */}
      {(streamVerdict || memoranda.length > 0) && (
        <BenchMemorandumCard
          caseId={filed.id}
          available={streamVerdict !== null}
          memoranda={memoranda}
          onVerdictRevised={handleVerdictRevised}
          onMemorandumFiled={handleMemorandumFiled}
        />
      )}

      {/* ---------- ExperimentPlan / Order of the Court ---------- */}
      {(planState !== "idle" || plan) && (
        <>
          {planState === "generating" && (
            <section className="rounded-xl border border-judge/30 bg-court-surface/60 px-5 py-6 text-center">
              <p className="text-[11px] uppercase tracking-[0.28em] text-judge mb-2">
                Order of the Court
              </p>
              <p className="font-display text-lg text-court-fg">
                The Clerk is drafting the runnable order…
              </p>
              <p className="mt-2 text-[12px] text-court-muted">
                Compiling protocol, materials, budget, timeline, and risk
                register from the bench's reasoning. Typically 15–60s.
              </p>
              <div className="mt-4 flex items-center justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-judge animate-pulse" />
                <span
                  className="w-2 h-2 rounded-full bg-judge animate-pulse"
                  style={{ animationDelay: "0.15s" }}
                />
                <span
                  className="w-2 h-2 rounded-full bg-judge animate-pulse"
                  style={{ animationDelay: "0.3s" }}
                />
              </div>
            </section>
          )}

          {planState === "error" && (
            <section className="rounded-xl border border-prosecutor/40 bg-prosecutor/10 px-5 py-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-prosecutor mb-1">
                The Clerk could not draft the order
              </p>
              <p className="text-sm text-court-fg">{planError}</p>
              <button
                type="button"
                onClick={() => runPlanGeneration({ force: true })}
                className="mt-3 text-[10px] uppercase tracking-[0.22em] px-3 py-1 rounded-full border border-prosecutor/40 text-prosecutor hover:bg-prosecutor/20 transition-colors"
              >
                Try again
              </button>
            </section>
          )}

          {plan && planState === "ready" && (
            <ExperimentPlanCard
              plan={plan}
              verdictOutcome={streamVerdict?.outcome ?? null}
              onRegenerate={handleRegeneratePlan}
            />
          )}
        </>
      )}

      {/* ---------- Court Reporter (floating launcher + slide-over drawer) ---------- */}
      <button
        type="button"
        onClick={() => setReporterOpen(true)}
        aria-label="Open Court Reporter chat"
        className="fixed bottom-5 right-5 z-30 group flex items-center gap-2 px-4 py-3 rounded-full bg-judge text-court-bg font-semibold shadow-2xl shadow-judge/30 hover:bg-judge/90 transition-all hover:scale-105"
      >
        <span className="text-lg leading-none" aria-hidden>
          ⚖
        </span>
        <span className="hidden sm:inline text-[10px] uppercase tracking-[0.22em]">
          Ask the Court Reporter
        </span>
        <span className="sm:hidden text-[10px] uppercase tracking-[0.22em]">
          Reporter
        </span>
      </button>

      <CourtReporterDrawer
        open={reporterOpen}
        onClose={() => setReporterOpen(false)}
        caseId={filed.id}
        discoveryPool={discovery?.citations}
        trialStarted={turns.length > 0}
        verdictReady={streamVerdict !== null}
      />
    </div>
  );
}
