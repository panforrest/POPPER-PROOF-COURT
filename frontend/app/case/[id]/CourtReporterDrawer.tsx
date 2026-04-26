"use client";

import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ApiError, streamReporter } from "@/lib/api";
import {
  type ChatMessage,
  ChatRole,
  type Citation,
  type ReporterState,
} from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  caseId: string;
  /** The discovery citation pool, used to wire `[N]` markers in replies. */
  discoveryPool?: Citation[];
  /** True once the trial has produced at least one turn — unlocks more
   * suggested prompts that reference what was actually argued. */
  trialStarted: boolean;
  /** True once the verdict is in (richer suggested prompts). */
  verdictReady: boolean;
};

const DEFAULT_SUGGESTIONS = [
  "What does the pretrial discovery suggest about novelty?",
  "Which citation is the strongest precedent, and why?",
  "What is the single most falsifiable version of this hypothesis?",
];

const TRIAL_SUGGESTIONS = [
  "Why did the Prosecutor lean on that citation?",
  "Summarise the Defender's strongest concession.",
  "Was the Judge's belief move driven by mechanism or by controls?",
];

const VERDICT_SUGGESTIONS = [
  "Was the verdict more about budget, mechanism, or controls?",
  "Which citation contradicted the Defender's position most?",
  "If we had a $5K cap, what would change in the plan?",
];

export default function CourtReporterDrawer({
  open,
  onClose,
  caseId,
  discoveryPool,
  trialStarted,
  verdictReady,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [state, setState] = useState<ReporterState>("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const suggestions = useMemo(() => {
    if (verdictReady) return VERDICT_SUGGESTIONS;
    if (trialStarted) return TRIAL_SUGGESTIONS;
    return DEFAULT_SUGGESTIONS;
  }, [trialStarted, verdictReady]);

  // Reset chat state when the case changes — different docket, fresh
  // conversation. We deliberately keep messages across open/close so the
  // user can review prior answers without retyping.
  useEffect(() => {
    setMessages([]);
    setDraft("");
    setState("idle");
    setError(null);
    abortRef.current?.abort();
  }, [caseId]);

  // Cancel any inflight stream when drawer unmounts (back nav etc.)
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Esc to close + autofocus the input when the drawer opens.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open, onClose]);

  // Autoscroll to bottom whenever messages or state change.
  useEffect(() => {
    if (!scrollerRef.current) return;
    scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [messages, state]);

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || state === "streaming") return;

      setError(null);

      const next: ChatMessage[] = [
        ...messages,
        { role: ChatRole.USER, content: trimmed },
        { role: ChatRole.ASSISTANT, content: "" },
      ];
      setMessages(next);
      setDraft("");
      setState("streaming");

      const ctrl = new AbortController();
      abortRef.current?.abort();
      abortRef.current = ctrl;

      // The history we *send* must end with the user message — strip the
      // empty assistant placeholder we just appended for UI purposes.
      const historyForServer = next.slice(0, -1);

      await streamReporter(caseId, historyForServer, {
        signal: ctrl.signal,
        onToken: (chunk) => {
          setMessages((cur) => {
            if (cur.length === 0) return cur;
            const last = cur[cur.length - 1];
            if (!last || last.role !== ChatRole.ASSISTANT) return cur;
            const updated: ChatMessage = {
              ...last,
              content: last.content + chunk,
            };
            return [...cur.slice(0, -1), updated];
          });
        },
        onDone: () => {
          setState("ready");
        },
        onError: (e) => {
          const msg =
            e instanceof ApiError
              ? `Reporter unavailable (${e.status}): ${e.detail}`
              : e.message || "The Reporter is unreachable.";
          setError(msg);
          setState("error");
          // Drop the empty assistant placeholder if no content arrived.
          setMessages((cur) => {
            const last = cur[cur.length - 1];
            if (last && last.role === ChatRole.ASSISTANT && last.content === "")
              return cur.slice(0, -1);
            return cur;
          });
        },
      });
    },
    [caseId, messages, state],
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void sendMessage(draft);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(draft);
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setState("ready");
  };

  return (
    <>
      {/* ---------- Backdrop ---------- */}
      <div
        aria-hidden={!open}
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* ---------- Drawer ---------- */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Court Reporter chat"
        aria-hidden={!open}
        className={`fixed top-0 right-0 z-50 h-dvh w-full sm:w-[460px] bg-court-surface border-l border-court-border shadow-2xl flex flex-col transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <header className="flex items-start justify-between px-5 py-4 border-b border-court-border">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.28em] text-court-muted mb-1">
              Court Reporter
            </p>
            <h2 className="font-display text-lg text-court-fg leading-tight">
              Ask the clerk anything
            </h2>
            <p className="text-[11px] text-court-muted mt-1">
              The Reporter has read the docket, the trial, the verdict, and the
              plan. Cite as you go — answers reference{" "}
              <span className="font-mono text-court-fg/80">[N]</span> from the
              Pretrial Discovery panel.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Court Reporter"
            className="text-court-muted hover:text-court-fg transition-colors text-2xl leading-none -mt-1 -mr-1 px-2"
          >
            ×
          </button>
        </header>

        {/* Messages */}
        <div
          ref={scrollerRef}
          className="flex-1 overflow-y-auto px-5 py-4 space-y-4"
        >
          {messages.length === 0 && (
            <EmptyState
              suggestions={suggestions}
              disabled={state === "streaming"}
              onPick={(s) => void sendMessage(s)}
            />
          )}

          {messages.map((m, i) => (
            <MessageBubble
              key={i}
              message={m}
              streaming={
                state === "streaming" &&
                i === messages.length - 1 &&
                m.role === ChatRole.ASSISTANT
              }
              discoveryPool={discoveryPool}
            />
          ))}

          {error && (
            <div className="text-[11px] uppercase tracking-[0.22em] px-3 py-2 rounded-md border border-prosecutor/40 bg-prosecutor/10 text-prosecutor">
              {error}
            </div>
          )}
        </div>

        {/* Composer */}
        <form
          onSubmit={handleSubmit}
          className="border-t border-court-border px-4 py-3 flex flex-col gap-2"
        >
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the Reporter… (Enter to send, Shift+Enter for newline)"
            rows={2}
            maxLength={2000}
            className="w-full resize-none rounded-md bg-court-bg/60 border border-court-border px-3 py-2 text-sm text-court-fg placeholder:text-court-muted/60 focus:outline-none focus:border-judge/60 transition-colors"
            disabled={state === "streaming"}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-court-muted">
              {state === "streaming"
                ? "The Reporter is dictating…"
                : `${draft.length}/2000`}
            </span>
            <div className="flex items-center gap-2">
              {state === "streaming" ? (
                <button
                  type="button"
                  onClick={handleStop}
                  className="text-[10px] uppercase tracking-[0.22em] px-3 py-1.5 rounded-md border border-court-border text-court-muted hover:text-court-fg hover:border-court-muted transition-colors"
                >
                  Stop
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  className="text-[10px] uppercase tracking-[0.22em] px-3 py-1.5 rounded-md bg-judge text-court-bg font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                >
                  Send →
                </button>
              )}
            </div>
          </div>
        </form>
      </aside>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                     */
/* ------------------------------------------------------------------ */

function EmptyState({
  suggestions,
  disabled,
  onPick,
}: {
  suggestions: string[];
  disabled: boolean;
  onPick: (s: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-court-border bg-court-bg/40 p-4">
        <p className="text-sm text-court-fg leading-relaxed">
          The Court Reporter is on the bench. They&rsquo;ve memorised the entire
          docket — the hypothesis, the trial transcript, the verdict, the
          discovery, and the experiment plan.
        </p>
        <p className="text-[12px] text-court-muted mt-2 leading-relaxed">
          Ask why an agent took a position, what the verdict really turned on,
          or which citation contradicts which claim.
        </p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-[0.22em] text-court-muted mb-2">
          Try asking
        </p>
        <div className="flex flex-col gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onPick(s)}
              disabled={disabled}
              className="text-left text-[12px] text-court-fg/90 px-3 py-2 rounded-md border border-court-border bg-court-bg/40 hover:border-judge/60 hover:bg-court-bg/70 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  streaming,
  discoveryPool,
}: {
  message: ChatMessage;
  streaming: boolean;
  discoveryPool?: Citation[];
}) {
  const isUser = message.role === ChatRole.USER;

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] rounded-lg bg-judge/15 border border-judge/30 px-3 py-2 text-sm text-court-fg whitespace-pre-wrap leading-relaxed">
          {message.content}
        </div>
      </div>
    );
  }

  const citedNumbers = extractCitationNumbers(message.content);
  const showCited =
    citedNumbers.length > 0 && discoveryPool && discoveryPool.length > 0;

  return (
    <div className="flex flex-col items-start gap-1.5">
      <span className="text-[10px] uppercase tracking-[0.22em] text-court-muted">
        Court Reporter
      </span>
      <div className="max-w-full rounded-lg border border-court-border bg-court-bg/50 px-3 py-2 text-sm text-court-fg leading-relaxed">
        {message.content ? (
          <ReporterMarkdown content={message.content} streaming={streaming} />
        ) : (
          <span className="text-court-muted italic">…dictating…</span>
        )}
      </div>
      {showCited && (
        <div className="flex flex-wrap gap-1.5">
          {citedNumbers.map((n) => {
            const c = discoveryPool![n - 1];
            if (!c) return null;
            return (
              <CitationRefChip key={n} n={n} c={c} />
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reporter prose — markdown rendered with courtroom styling          */
/* ------------------------------------------------------------------ */

function ReporterMarkdown({
  content,
  streaming,
}: {
  content: string;
  streaming: boolean;
}) {
  return (
    <div className="reporter-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="my-2 first:mt-0 last:mb-0">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-court-fg">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-court-fg/90">{children}</em>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-outside pl-5 my-2 space-y-1 marker:text-court-muted">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside pl-5 my-2 space-y-1 marker:text-court-muted">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          code: ({ children }) => (
            <code className="font-mono text-[0.82em] px-1 py-0.5 rounded bg-court-bg/70 border border-court-border text-court-fg/90">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="my-2 p-2 rounded-md bg-court-bg/70 border border-court-border overflow-x-auto text-[0.82em] font-mono">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-court-border pl-3 text-court-fg/80 italic">
              {children}
            </blockquote>
          ),
          h1: ({ children }) => (
            <h3 className="font-display text-base text-court-fg mt-3 mb-1">
              {children}
            </h3>
          ),
          h2: ({ children }) => (
            <h3 className="font-display text-base text-court-fg mt-3 mb-1">
              {children}
            </h3>
          ),
          h3: ({ children }) => (
            <h4 className="font-display text-sm text-court-fg mt-3 mb-1">
              {children}
            </h4>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-judge hover:underline underline-offset-2"
            >
              {children}
            </a>
          ),
          hr: () => <hr className="my-3 border-court-border" />,
        }}
      >
        {content}
      </ReactMarkdown>
      {streaming && (
        <span className="inline-block w-1.5 h-4 -mb-0.5 ml-0.5 bg-judge animate-pulse align-middle" />
      )}
    </div>
  );
}

function CitationRefChip({ n, c }: { n: number; c: Citation }) {
  const author =
    c.authors[0]?.split(",")[0]?.trim() ||
    c.authors[0]?.split(" ").pop() ||
    null;
  const year = c.year ? ` ${c.year}` : "";
  const tail = author ? `${author}${year}` : c.source;
  const title = c.year ? `${c.title} (${c.year})` : c.title;

  const inner = (
    <>
      <span className="font-medium">[{n}]</span> {tail}
    </>
  );
  const base =
    "inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-court-border text-court-muted";

  if (c.url) {
    return (
      <a
        href={c.url}
        target="_blank"
        rel="noopener noreferrer"
        title={title}
        className={`${base} hover:text-court-fg hover:border-court-muted transition-colors`}
      >
        {inner}
      </a>
    );
  }
  return (
    <span className={base} title={title}>
      {inner}
    </span>
  );
}

const CITATION_RE = /\[(\d{1,2})\]/g;

function extractCitationNumbers(text: string): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const m of text.matchAll(CITATION_RE)) {
    const n = Number(m[1]);
    if (!Number.isFinite(n) || n < 1 || n > 99) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}
