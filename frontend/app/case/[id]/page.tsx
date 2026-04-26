import Link from "next/link";
import { notFound } from "next/navigation";
import { getCase, ApiError } from "@/lib/api";
import CourtroomClient from "./CourtroomClient";

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
      <main className="flex-1 px-4 sm:px-8 py-8 sm:py-10">
        <div className="max-w-7xl mx-auto">
          <CourtroomClient filed={filed} />
        </div>
      </main>

      {/* ---------------- Footer ---------------- */}
      <footer className="border-t border-court-border px-8 py-5 text-[11px] text-court-muted text-center">
        <p className="italic">POPPER-PROOF COURT · 3-pane trial view</p>
      </footer>
    </div>
  );
}
