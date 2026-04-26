import Link from "next/link";
import { notFound } from "next/navigation";
import { getCase, ApiError } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function CasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let filed;
  try {
    filed = await getCase(id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const filedAt = new Date(filed.created_at);

  return (
    <div className="flex flex-col flex-1 court-vignette">
      {/* ---------------- Top bar ---------------- */}
      <header className="flex justify-between items-center px-8 py-6 border-b border-court-border">
        <Link href="/" className="flex items-center gap-3 group">
          <span className="text-judge text-2xl leading-none group-hover:opacity-80 transition-opacity">
            ⚖
          </span>
          <span className="font-display text-lg tracking-wide group-hover:text-judge transition-colors">
            POPPER-PROOF COURT
          </span>
        </Link>
        <Link
          href="/cases"
          className="text-[11px] text-court-muted uppercase tracking-[0.25em] hover:text-judge transition-colors"
        >
          Docket →
        </Link>
      </header>

      {/* ---------------- Main ---------------- */}
      <main className="flex-1 flex justify-center px-6 py-14 sm:py-20">
        <div className="w-full max-w-4xl">
          <p className="text-judge uppercase tracking-[0.35em] text-[11px] mb-4 font-medium">
            Case No. {filed.id}
          </p>
          <h1 className="font-display text-4xl sm:text-5xl tracking-tight leading-tight mb-8">
            The People v. <span className="italic text-judge">The Hypothesis</span>
          </h1>

          {/* Brief on the docket */}
          <div className="bg-court-surface border border-court-border rounded-xl p-6 mb-6 shadow-2xl shadow-black/40">
            <div className="text-[10px] text-court-muted uppercase tracking-[0.25em] mb-3">
              Brief on the docket
            </div>
            <p className="text-court-fg leading-relaxed whitespace-pre-wrap">
              {filed.hypothesis}
            </p>
          </div>

          {/* Three-robe preview */}
          <div className="grid grid-cols-3 gap-3 mb-8">
            <RobePreview
              color="prosecutor"
              label="Prosecutor"
              status="Awaiting gavel"
            />
            <RobePreview
              color="judge"
              label="Judge"
              status="Docketing case"
            />
            <RobePreview
              color="defender"
              label="Defender"
              status="Awaiting gavel"
            />
          </div>

          {/* Step-7 promise */}
          <div className="bg-judge/10 border border-judge/30 rounded-lg p-5 text-sm text-court-muted">
            <span className="text-judge font-medium">
              The courtroom opens in Step 7.
            </span>{" "}
            This page becomes the live 3-pane trial view — Prosecutor, Judge,
            and Defender arguing in real time with cited evidence and a final
            procurement-ready experiment plan.
          </div>
        </div>
      </main>

      {/* ---------------- Footer ---------------- */}
      <footer className="border-t border-court-border px-8 py-5 text-[11px] text-court-muted text-center">
        <p className="italic">
          Case filed {filedAt.toLocaleString()} · POPPER-PROOF COURT
        </p>
      </footer>
    </div>
  );
}

/* -------------------------------------------------------------------- */
/* RobePreview — one of three agent placeholders shown pre-trial.       */
/* -------------------------------------------------------------------- */

function RobePreview({
  color,
  label,
  status,
}: {
  color: "prosecutor" | "defender" | "judge";
  label: string;
  status: string;
}) {
  const ring = {
    prosecutor: "border-prosecutor/40 text-prosecutor",
    defender: "border-defender/40 text-defender",
    judge: "border-judge/40 text-judge",
  }[color];

  return (
    <div
      className={`bg-court-surface/60 border ${ring} rounded-lg p-4 text-center`}
    >
      <div className="font-display text-base mb-1">{label}</div>
      <div className="text-court-muted text-[10px] uppercase tracking-[0.2em]">
        {status}
      </div>
    </div>
  );
}
