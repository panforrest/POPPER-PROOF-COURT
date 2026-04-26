import Link from "next/link";
import { listCases, type Case } from "@/lib/api";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Docket — POPPER-PROOF COURT",
  description:
    "Every case filed on the POPPER-PROOF COURT docket, newest first.",
};

export default async function CasesPage() {
  let cases: Case[] = [];
  let error: string | null = null;
  try {
    cases = await listCases();
  } catch {
    error = "The clerk is away. Is the backend running on :8000?";
  }

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
          href="/draft"
          className="text-[11px] text-court-muted uppercase tracking-[0.25em] hover:text-judge transition-colors"
        >
          File a case →
        </Link>
      </header>

      {/* ---------------- Main ---------------- */}
      <main className="flex-1 flex justify-center px-6 py-14 sm:py-20">
        <div className="w-full max-w-4xl">
          <p className="text-judge uppercase tracking-[0.35em] text-[11px] mb-4 font-medium">
            Public Docket
          </p>
          <h1 className="font-display text-4xl sm:text-5xl tracking-tight leading-tight mb-10">
            Cases on <span className="italic text-judge">Trial</span>
          </h1>

          {error && (
            <div className="bg-prosecutor/10 border border-prosecutor/30 text-prosecutor rounded-lg p-4 text-sm">
              {error}
            </div>
          )}

          {!error && cases.length === 0 && (
            <div className="bg-court-surface border border-court-border rounded-xl p-8 text-center">
              <p className="text-court-muted mb-4">
                The docket is empty. No hypothesis has been filed yet.
              </p>
              <Link
                href="/draft"
                className="inline-block px-6 py-3 bg-judge text-court-bg font-semibold uppercase tracking-[0.18em] text-sm rounded-md hover:bg-judge/90 transition-colors"
              >
                File the first case →
              </Link>
            </div>
          )}

          {!error && cases.length > 0 && (
            <ul className="space-y-3">
              {cases.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/case/${c.id}`}
                    className="block p-5 bg-court-surface border border-court-border rounded-lg hover:border-judge transition-colors group"
                  >
                    <div className="flex justify-between items-start gap-4 mb-2">
                      <div className="text-[10px] text-judge uppercase tracking-[0.25em] font-medium">
                        Case No. {c.id}
                      </div>
                      <div className="text-[10px] text-court-muted uppercase tracking-[0.2em] shrink-0">
                        {new Date(c.created_at).toLocaleString()}
                      </div>
                    </div>
                    <p className="text-sm text-court-fg group-hover:text-judge transition-colors line-clamp-3">
                      {c.hypothesis}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      {/* ---------------- Footer ---------------- */}
      <footer className="border-t border-court-border px-8 py-5 text-[11px] text-court-muted text-center">
        <p className="italic">Docket refreshes on every load.</p>
      </footer>
    </div>
  );
}
