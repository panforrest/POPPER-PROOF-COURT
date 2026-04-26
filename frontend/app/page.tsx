import Link from "next/link";
import { SAMPLE_CASES } from "@/lib/sample-cases";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 court-vignette">
      {/* ---------------- Top bar ---------------- */}
      <header className="flex justify-between items-center px-8 py-6 border-b border-court-border">
        <div className="flex items-center gap-3">
          <span className="text-judge text-2xl leading-none">⚖</span>
          <span className="font-display text-lg tracking-wide">
            POPPER-PROOF COURT
          </span>
        </div>
        <div className="hidden sm:block text-[10px] text-court-muted uppercase tracking-[0.25em]">
          Hack-Nation 5th · Challenge 04 · Fulcrum Science
        </div>
      </header>

      {/* ---------------- Hero ---------------- */}
      <section className="flex-1 flex items-center justify-center px-6 py-16 sm:py-24">
        <div className="max-w-5xl w-full text-center">
          {/* Eyebrow */}
          <p className="text-judge uppercase tracking-[0.35em] text-[11px] mb-8 font-medium">
            A Multi-Agent Science Research Court
          </p>

          {/* Headline */}
          <h1 className="font-display text-6xl sm:text-7xl md:text-8xl tracking-tight leading-[0.95] mb-8">
            POPPER-<span className="text-judge italic">PROOF</span>
            <br />
            COURT
          </h1>

          {/* Lead paragraph */}
          <p className="text-lg sm:text-xl text-court-muted max-w-2xl mx-auto mb-4 leading-relaxed">
            Put your scientific hypothesis on trial. Three AI agents argue,
            evidence is cited, a verdict is rendered.
          </p>
          <p className="text-base text-court-muted max-w-2xl mx-auto mb-12">
            You walk away with a procurement-ready experiment plan a real lab
            could pick up Monday and run by Friday.
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-20">
            <Link
              href="/draft"
              className="px-8 py-4 bg-judge text-court-bg font-semibold uppercase tracking-[0.18em] text-sm rounded-md hover:bg-judge/90 transition-colors shadow-lg shadow-judge/20"
            >
              File a Case →
            </Link>
            <Link
              href="/cases"
              className="px-8 py-4 border border-court-border text-court-fg uppercase tracking-[0.18em] text-sm rounded-md hover:border-judge hover:text-judge transition-colors"
            >
              View Docket
            </Link>
          </div>

          {/* Three agent chips — color story up front */}
          <div className="flex flex-wrap justify-center gap-3 mb-20">
            <AgentChip color="prosecutor" label="Prosecutor" sub="Falsify it" />
            <AgentChip color="judge" label="Judge" sub="Weigh both sides" />
            <AgentChip color="defender" label="Defender" sub="Defend it" />
          </div>

          {/* Sample cases — direct nod to Fulcrum brief */}
          <div className="text-left max-w-3xl mx-auto">
            <h3 className="text-court-muted uppercase tracking-[0.25em] text-[11px] mb-5 text-center sm:text-left">
              Try a sample case from Fulcrum&apos;s brief
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {SAMPLE_CASES.map((c) => (
                <Link
                  key={c.id}
                  href={`/draft?sample=${c.id}`}
                  className="group p-4 bg-court-surface border border-court-border rounded-lg hover:border-judge transition-colors"
                >
                  <div className="text-[10px] text-judge uppercase tracking-[0.2em] mb-2 font-medium">
                    {c.domain}
                  </div>
                  <div className="text-sm text-court-fg group-hover:text-judge transition-colors">
                    {c.plainEnglish}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Footer ---------------- */}
      <footer className="border-t border-court-border px-8 py-5 text-[11px] text-court-muted">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
          <p className="italic">
            Named for Karl Popper — who taught us the strength of a theory lies
            in what it forbids.
          </p>
          <p>
            Built in 24h at the Tavily NYC hub · 1350 Broadway, Floor 24
          </p>
        </div>
      </footer>
    </div>
  );
}

/* -------------------------------------------------------------------- */
/* AgentChip — small colored pill that previews the three court roles. */
/* -------------------------------------------------------------------- */

function AgentChip({
  color,
  label,
  sub,
}: {
  color: "prosecutor" | "defender" | "judge";
  label: string;
  sub: string;
}) {
  const ring = {
    prosecutor: "border-prosecutor/40 text-prosecutor",
    defender: "border-defender/40 text-defender",
    judge: "border-judge/40 text-judge",
  }[color];

  return (
    <div
      className={`flex items-center gap-3 px-5 py-2.5 border rounded-full bg-court-surface/40 ${ring}`}
    >
      <span className="font-display text-base">{label}</span>
      <span className="text-court-muted text-xs">— {sub}</span>
    </div>
  );
}
