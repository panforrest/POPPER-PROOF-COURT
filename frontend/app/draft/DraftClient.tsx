"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SAMPLE_CASES, findSampleCase } from "@/lib/sample-cases";

const PLACEHOLDER = `Example:
Replacing sucrose with trehalose as a cryoprotectant in the freezing medium will increase post-thaw viability of HeLa cells by at least 15 percentage points compared to the standard DMSO protocol, due to trehalose's superior membrane stabilization at low temperatures.

A strong hypothesis names the system, the intervention, the predicted effect with a number, and the proposed mechanism.`;

export default function DraftClient() {
  const searchParams = useSearchParams();
  const sampleId = searchParams.get("sample");

  const [hypothesis, setHypothesis] = useState("");
  const [filing, setFiling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // If ?sample=<id> is present, pre-fill the textarea once on mount.
  useEffect(() => {
    if (!sampleId) return;
    const sample = findSampleCase(sampleId);
    if (sample) setHypothesis(sample.hypothesis);
  }, [sampleId]);

  const wordCount = useMemo(
    () => (hypothesis.trim() ? hypothesis.trim().split(/\s+/).length : 0),
    [hypothesis],
  );

  const charCount = hypothesis.length;
  const isReady = wordCount >= 8;

  const handleFile = async () => {
    if (!isReady) return;
    setFiling(true);
    setNotice(null);
    // Backend wiring (POST /api/cases → /case/[id]) lands in Step 6.
    // For now we simulate the submission so reviewers can feel the button.
    await new Promise((r) => setTimeout(r, 600));
    setFiling(false);
    setNotice(
      "Brief drafted. Courtroom routing wires up in Step 6 — your hypothesis is held in counsel chambers for now.",
    );
  };

  return (
    <div className="flex flex-col flex-1 court-vignette">
      {/* ---------------- Top bar ---------------- */}
      <header className="flex justify-between items-center px-8 py-6 border-b border-court-border">
        <Link
          href="/"
          className="flex items-center gap-3 group"
          aria-label="Back to court entrance"
        >
          <span className="text-judge text-2xl leading-none group-hover:opacity-80 transition-opacity">
            ⚖
          </span>
          <span className="font-display text-lg tracking-wide group-hover:text-judge transition-colors">
            POPPER-PROOF COURT
          </span>
        </Link>
        <Link
          href="/"
          className="text-[11px] text-court-muted uppercase tracking-[0.25em] hover:text-judge transition-colors"
        >
          ← Back to entrance
        </Link>
      </header>

      {/* ---------------- Main ---------------- */}
      <main className="flex-1 flex justify-center px-6 py-14 sm:py-20">
        <div className="w-full max-w-3xl">
          {/* Eyebrow + heading */}
          <p className="text-judge uppercase tracking-[0.35em] text-[11px] mb-4 font-medium text-center">
            Counsel Chambers
          </p>
          <h1 className="font-display text-4xl sm:text-5xl tracking-tight leading-tight mb-4 text-center">
            Draft Your <span className="text-judge italic">Brief</span>
          </h1>
          <p className="text-court-muted text-base sm:text-lg max-w-xl mx-auto text-center mb-10">
            Sharpen your hypothesis. The court only weighs what is{" "}
            <span className="text-court-fg">specific</span>,{" "}
            <span className="text-court-fg">measurable</span>, and{" "}
            <span className="text-court-fg">falsifiable</span>.
          </p>

          {/* Textarea card */}
          <div className="bg-court-surface border border-court-border rounded-xl p-1 shadow-2xl shadow-black/40 mb-3">
            <textarea
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
              placeholder={PLACEHOLDER}
              rows={10}
              className="w-full bg-transparent text-court-fg placeholder:text-court-muted/60 px-5 py-4 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-judge/40 font-sans text-base leading-relaxed"
              spellCheck
              autoFocus
            />
          </div>

          {/* Counter + readiness */}
          <div className="flex justify-between items-center text-[11px] uppercase tracking-[0.18em] text-court-muted mb-10">
            <span>
              {wordCount} {wordCount === 1 ? "word" : "words"} · {charCount}{" "}
              chars
            </span>
            <span
              className={
                isReady ? "text-defender" : "text-court-muted"
              }
            >
              {isReady
                ? "Ready to file"
                : "Aim for 30+ words for a strong brief"}
            </span>
          </div>

          {/* Sample pills (only when textarea is empty) */}
          {hypothesis.trim().length === 0 && (
            <div className="mb-10">
              <p className="text-court-muted uppercase tracking-[0.25em] text-[11px] mb-3 text-center">
                Need inspiration? Try a sample from Fulcrum&apos;s brief
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {SAMPLE_CASES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setHypothesis(c.hypothesis)}
                    className="px-4 py-2 text-xs uppercase tracking-[0.15em] border border-court-border rounded-full text-court-fg hover:border-judge hover:text-judge transition-colors"
                  >
                    {c.domain}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Hint cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10">
            <HintCard
              title="Specific"
              body="Name the system, intervention, and conditions. Vague theories cannot be tested."
            />
            <HintCard
              title="Measurable"
              body="State the predicted effect with a number and a unit. The court weighs evidence, not vibes."
            />
            <HintCard
              title="Falsifiable"
              body="Describe what result would prove you wrong. A theory's strength lies in what it forbids."
            />
          </div>

          {/* CTA */}
          <div className="flex flex-col items-center gap-4">
            <button
              type="button"
              onClick={handleFile}
              disabled={!isReady || filing}
              className="px-10 py-4 bg-judge text-court-bg font-semibold uppercase tracking-[0.18em] text-sm rounded-md transition-all shadow-lg shadow-judge/20 enabled:hover:bg-judge/90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {filing ? "Filing the case…" : "Send to Court →"}
            </button>
            {notice && (
              <p className="text-defender text-sm max-w-md text-center bg-defender/10 border border-defender/30 rounded-md px-4 py-3">
                {notice}
              </p>
            )}
          </div>
        </div>
      </main>

      {/* ---------------- Footer ---------------- */}
      <footer className="border-t border-court-border px-8 py-5 text-[11px] text-court-muted text-center">
        <p className="italic">
          Counsel Chambers · Pre-trial drafting · POPPER-PROOF COURT
        </p>
      </footer>
    </div>
  );
}

/* -------------------------------------------------------------------- */
/* HintCard — small card describing one quality of a strong hypothesis. */
/* -------------------------------------------------------------------- */

function HintCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-court-surface/60 border border-court-border rounded-lg p-4">
      <div className="text-judge uppercase tracking-[0.2em] text-[10px] font-medium mb-2">
        {title}
      </div>
      <p className="text-court-muted text-xs leading-relaxed">{body}</p>
    </div>
  );
}
