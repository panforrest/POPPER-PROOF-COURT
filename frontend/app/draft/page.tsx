import { Suspense } from "react";
import type { Metadata } from "next";
import DraftClient from "./DraftClient";

export const metadata: Metadata = {
  title: "Counsel Chambers — POPPER-PROOF COURT",
  description:
    "Draft your scientific hypothesis before it goes on trial. Sharpen it with counsel, then file the case.",
};

export default function DraftPage() {
  return (
    <Suspense fallback={<DraftFallback />}>
      <DraftClient />
    </Suspense>
  );
}

function DraftFallback() {
  return (
    <div className="flex-1 flex items-center justify-center text-court-muted">
      <p className="font-display text-xl">Preparing the chambers…</p>
    </div>
  );
}
