"use client";

import type { Citation, StareDecisisResult } from "@/lib/types";
import {
  NOVELTY_CLASS,
  NOVELTY_LABEL,
  NoveltySignal,
} from "@/lib/types";

type Props = {
  result: StareDecisisResult;
  onRefresh?: () => void;
  refreshing?: boolean;
};

function sourceLabel(s: string): string {
  switch (s) {
    case "tavily":
      return "Tavily";
    case "semantic_scholar":
      return "Semantic Scholar";
    case "arxiv":
      return "arXiv";
    case "pubmed":
      return "PubMed";
    case "biorxiv":
      return "bioRxiv";
    default:
      return s;
  }
}

function CitationChip({ c, n }: { c: Citation; n: number }) {
  const sim = c.similarity ?? 0;
  const simPct = `${Math.round(sim * 100)}%`;
  const simClass =
    sim >= 0.7
      ? "text-prosecutor"
      : sim >= 0.5
        ? "text-judge"
        : "text-court-muted";
  const authors =
    c.authors.length === 0
      ? null
      : c.authors.length <= 2
        ? c.authors.join(" & ")
        : `${c.authors[0]} et al.`;

  const inner = (
    <>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <div className="flex items-baseline gap-2 min-w-0">
          <span
            className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full border border-judge/40 text-judge text-[10px] font-mono"
            aria-hidden
          >
            {n}
          </span>
          <span className="font-display text-[13px] text-court-fg leading-snug truncate">
            {c.title}
          </span>
        </div>
        <span
          className={`shrink-0 text-[10px] font-mono uppercase tracking-[0.18em] ${simClass}`}
          title={`Similarity ${simPct}`}
        >
          {simPct}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 text-[11px] text-court-muted">
        <span className="truncate">
          {authors}
          {authors && c.year ? " · " : null}
          {c.year ?? ""}
        </span>
        <span className="text-[10px] uppercase tracking-[0.2em] shrink-0">
          {sourceLabel(c.source)}
        </span>
      </div>
    </>
  );

  if (c.url) {
    return (
      <a
        href={c.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block border border-court-border/60 rounded-lg p-3 bg-court-bg/30 hover:border-judge/40 hover:bg-judge/5 transition-colors"
      >
        {inner}
      </a>
    );
  }
  return (
    <div className="border border-court-border/60 rounded-lg p-3 bg-court-bg/30">
      {inner}
    </div>
  );
}

export default function PretrialDiscoveryPanel({
  result,
  onRefresh,
  refreshing = false,
}: Props) {
  const novelty = result.signal as NoveltySignal;
  const badgeClass = NOVELTY_CLASS[novelty];
  const badgeLabel = NOVELTY_LABEL[novelty];
  const count = result.citations.length;

  return (
    <section className="rounded-xl border border-court-border bg-court-surface/60 p-5">
      <header className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.28em] text-court-muted mb-1">
            Pretrial Discovery
          </p>
          <h2 className="font-display text-xl text-court-fg leading-tight">
            Stare Decisis — the published record
          </h2>
          <p className="text-[12px] text-court-muted mt-1">
            {count > 0
              ? `${count} precedent${count === 1 ? "" : "s"} retrieved from the open literature`
              : "No precedent surfaced; the docket may be novel."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] uppercase tracking-[0.22em] px-3 py-1 rounded-full border ${badgeClass}`}
          >
            {badgeLabel}
          </span>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="text-[10px] uppercase tracking-[0.22em] px-3 py-1 rounded-full border border-court-border text-court-muted hover:text-court-fg hover:border-court-muted disabled:opacity-50 disabled:cursor-wait transition-colors"
              title="Re-run pretrial discovery"
            >
              {refreshing ? "Refiling…" : "Refile"}
            </button>
          )}
        </div>
      </header>

      <p className="text-sm text-court-fg/95 leading-relaxed mb-4">
        {result.rationale}
      </p>

      {count > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
          {result.citations.map((c, i) => (
            <CitationChip
              key={`${c.url ?? c.title}-${i}`}
              c={c}
              n={i + 1}
            />
          ))}
        </div>
      ) : (
        <div className="text-[12px] text-court-muted italic border border-dashed border-court-border rounded-lg p-4 text-center">
          No citations were retrieved. The trial may proceed without precedent —
          the bench will rely on first-principles reasoning.
        </div>
      )}
    </section>
  );
}
