"use client";

import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ApiError, submitBenchMemorandum } from "@/lib/api";
import {
  type BenchMemorandum,
  type MemorandumState,
  type RevisedVerdict,
  VerdictOutcome,
} from "@/lib/types";

type Props = {
  caseId: string;
  /** Only show the composer once a verdict exists. The chain log shows
   * regardless so users can scroll back through prior reconsiderations. */
  available: boolean;
  /** Memoranda already on file (oldest first) — owned by the parent. */
  memoranda: BenchMemorandum[];
  /** Called the moment the revised verdict frame arrives, before the
   * memorandum_applied frame. Lets the parent flip the verdict card
   * instantly without waiting for the persist round-trip. */
  onVerdictRevised: (revised: RevisedVerdict) => void;
  /** Called after the BenchMemorandum record is persisted. Parent
   * appends to its chain and (typically) regenerates the plan. */
  onMemorandumFiled: (memo: BenchMemorandum) => void;
};

const SUGGESTIONS = [
  "Budget cap is now $3,000 — reconsider with this hard constraint.",
  "Tighten the timeline to 8 weeks. The grant ends sooner than docketed.",
  "Counsel stipulates citation [1] has been retracted in 2025.",
];

const MAX_INSTRUCTION_LEN = 500;

function outcomeLabel(o: VerdictOutcome | string): string {
  if (o === VerdictOutcome.PROCEED) return "Proceed";
  if (o === VerdictOutcome.REVISE) return "Revise";
  return "Dismiss";
}

function outcomeColorClass(o: VerdictOutcome | string): string {
  if (o === VerdictOutcome.PROCEED) return "text-defender";
  if (o === VerdictOutcome.REVISE) return "text-judge";
  return "text-prosecutor";
}

export default function BenchMemorandumCard({
  caseId,
  available,
  memoranda,
  onVerdictRevised,
  onMemorandumFiled,
}: Props) {
  const [instruction, setInstruction] = useState("");
  const [state, setState] = useState<MemorandumState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pendingInstruction, setPendingInstruction] = useState<string | null>(
    null,
  );
  const [flash, setFlash] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cancel any in-flight request when this card unmounts (back nav etc).
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  // If the case changes (the parent passes a different caseId), wipe local
  // composer state. Memoranda chain is owned by the parent so it switches
  // automatically.
  useEffect(() => {
    setInstruction("");
    setState("idle");
    setError(null);
    setPendingInstruction(null);
    setFlash(null);
    abortRef.current?.abort();
  }, [caseId]);

  const file = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed || state === "thinking") return;
      if (trimmed.length < 4) {
        setError("Memorandum is too short — please give the bench more to consider.");
        setState("error");
        return;
      }

      setError(null);
      setFlash(null);
      setPendingInstruction(trimmed);
      setState("thinking");

      const ctrl = new AbortController();
      abortRef.current?.abort();
      abortRef.current = ctrl;

      let revisedSeen = false;

      await submitBenchMemorandum(caseId, trimmed, {
        signal: ctrl.signal,
        onThinking: () => {
          // Already in 'thinking' state; this is just confirmation.
        },
        onVerdict: (revised) => {
          revisedSeen = true;
          onVerdictRevised(revised);
        },
        onMemorandum: (memo) => {
          onMemorandumFiled(memo);
        },
        onDone: () => {
          if (revisedSeen) {
            setState("applied");
            setInstruction("");
            setPendingInstruction(null);
            setFlash("Order entered. The bench has revised its ruling.");
            if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
            flashTimerRef.current = setTimeout(() => setFlash(null), 4500);
          } else {
            setState("error");
            setError(
              "The Court reviewed the memorandum but no revised verdict was issued.",
            );
          }
        },
        onError: (e) => {
          const msg =
            e instanceof ApiError
              ? `The motion was not entered (${e.status}): ${e.detail}`
              : e.message || "The motion was not entered.";
          setError(msg);
          setState("error");
          setPendingInstruction(null);
        },
      });
    },
    [caseId, onMemorandumFiled, onVerdictRevised, state],
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void file(instruction);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void file(instruction);
    }
  };

  const isThinking = state === "thinking";
  const composerDisabled = isThinking || !available;

  return (
    <section
      className="rounded-xl border border-court-border bg-court-surface/60 p-5"
      aria-labelledby="bench-memo-heading"
    >
      {/* ---------- Header ---------- */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.28em] text-judge mb-1">
            Bench Memorandum
          </p>
          <h2
            id="bench-memo-heading"
            className="font-display text-xl text-court-fg leading-tight"
          >
            Issue an Order from the Bench
          </h2>
          <p className="text-[12px] text-court-muted mt-1 leading-relaxed">
            File a motion for reconsideration. The Judge will re-deliberate the
            settled record in light of your memorandum and issue a revised
            verdict. The plan re-renders to match.
          </p>
        </div>
        {memoranda.length > 0 && (
          <span className="shrink-0 text-[10px] uppercase tracking-[0.22em] px-2.5 py-1 rounded-full border border-judge/40 text-judge bg-judge/5">
            {memoranda.length} on file
          </span>
        )}
      </div>

      {/* ---------- Suggestion chips ---------- */}
      {available && !isThinking && (
        <div className="mb-3">
          <p className="text-[10px] uppercase tracking-[0.22em] text-court-muted mb-2">
            Common motions
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setInstruction(s)}
                disabled={composerDisabled}
                className="text-left text-[11px] text-court-fg/90 px-3 py-1.5 rounded-full border border-court-border bg-court-bg/40 hover:border-judge/60 hover:bg-court-bg/70 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ---------- Composer ---------- */}
      {available && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value.slice(0, MAX_INSTRUCTION_LEN))}
            onKeyDown={handleKeyDown}
            placeholder="Move the court to reconsider in light of… (Enter to file, Shift+Enter for newline)"
            rows={2}
            maxLength={MAX_INSTRUCTION_LEN}
            disabled={composerDisabled}
            className="w-full resize-none rounded-md bg-court-bg/60 border border-court-border px-3 py-2 text-sm text-court-fg placeholder:text-court-muted/60 focus:outline-none focus:border-judge/60 transition-colors disabled:opacity-50"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-court-muted">
              {isThinking
                ? "The Court is reconsidering…"
                : `${instruction.length}/${MAX_INSTRUCTION_LEN}`}
            </span>
            <button
              type="submit"
              disabled={composerDisabled || !instruction.trim()}
              className="text-[10px] uppercase tracking-[0.22em] px-4 py-1.5 rounded-md bg-judge text-court-bg font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              File the motion →
            </button>
          </div>
        </form>
      )}

      {/* ---------- States: pre-verdict / thinking / flash / error ---------- */}
      {!available && memoranda.length === 0 && (
        <p className="text-[12px] text-court-muted leading-relaxed mt-1">
          The bench has not yet rendered its verdict. Once the trial concludes,
          you may file a memorandum to move the court for reconsideration.
        </p>
      )}

      {isThinking && (
        <div className="mt-3 rounded-md border border-judge/30 bg-judge/5 px-4 py-3">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="w-2 h-2 rounded-full bg-judge animate-pulse" />
            <span
              className="w-2 h-2 rounded-full bg-judge animate-pulse"
              style={{ animationDelay: "0.15s" }}
            />
            <span
              className="w-2 h-2 rounded-full bg-judge animate-pulse"
              style={{ animationDelay: "0.3s" }}
            />
            <p className="text-[11px] uppercase tracking-[0.22em] text-judge">
              The Court is reconsidering
            </p>
          </div>
          {pendingInstruction && (
            <p className="text-[12px] text-court-fg/80 italic leading-relaxed">
              “{pendingInstruction}”
            </p>
          )}
        </div>
      )}

      {flash && !isThinking && (
        <p className="mt-3 text-[11px] uppercase tracking-[0.22em] text-defender bg-defender/10 border border-defender/30 rounded-md px-3 py-2">
          {flash}
        </p>
      )}

      {error && state === "error" && (
        <div className="mt-3 rounded-md border border-prosecutor/40 bg-prosecutor/10 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.22em] text-prosecutor">
            {error}
          </p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setState("idle");
            }}
            className="mt-1 text-[10px] uppercase tracking-[0.2em] text-court-muted hover:text-court-fg transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ---------- Filed memoranda chain ---------- */}
      {memoranda.length > 0 && (
        <div className="mt-5 pt-5 border-t border-court-border">
          <p className="text-[10px] uppercase tracking-[0.22em] text-court-muted mb-3">
            Memoranda on file (oldest first)
          </p>
          <ol className="space-y-3">
            {memoranda.map((m, i) => (
              <MemoEntry key={m.applied_at + i} index={i + 1} memo={m} />
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                     */
/* ------------------------------------------------------------------ */

function MemoEntry({ index, memo }: { index: number; memo: BenchMemorandum }) {
  const prior = memo.prior_verdict;
  const revised = memo.revised_verdict;
  const flipped = prior.outcome !== revised.outcome;
  const filedAt = new Date(memo.applied_at);

  return (
    <li className="rounded-md border border-court-border bg-court-bg/40 px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="text-[10px] uppercase tracking-[0.22em] text-court-muted">
          Memo {index} · {filedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
        <span
          className={`text-[10px] uppercase tracking-[0.22em] ${
            flipped ? "text-judge" : "text-court-muted"
          }`}
        >
          {flipped ? "Ruling changed" : "Ruling held"}
        </span>
      </div>
      <p className="text-[12.5px] text-court-fg leading-relaxed mb-2 italic">
        “{memo.instruction}”
      </p>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
        <span className={`${outcomeColorClass(prior.outcome)} font-medium`}>
          {outcomeLabel(prior.outcome)}
        </span>
        <span className="text-court-muted">
          ({Math.round(prior.confidence)}%)
        </span>
        <span className="text-court-muted" aria-hidden>
          →
        </span>
        <span className={`${outcomeColorClass(revised.outcome)} font-medium`}>
          {outcomeLabel(revised.outcome)}
        </span>
        <span className="text-court-muted">
          ({Math.round(revised.confidence)}%)
        </span>
      </div>
      {revised.rationale && (
        <p className="mt-2 text-[12px] text-court-fg/80 leading-relaxed">
          {revised.rationale}
        </p>
      )}
    </li>
  );
}
