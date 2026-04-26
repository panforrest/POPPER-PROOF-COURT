"use client";

import type {
  CRORecommendation,
  EquipmentItem,
  ExperimentPlan,
  MaterialLine,
  Personnel,
  ProtocolStep,
  RiskFactor,
  TimelinePhase,
  ValidationMetric,
  VerdictOutcome,
} from "@/lib/types";
import { VerdictOutcome as VO } from "@/lib/types";

type Props = {
  plan: ExperimentPlan;
  verdictOutcome?: VerdictOutcome | null;
  onRegenerate?: () => void;
};

const fmtUsd = (n: number | null | undefined): string =>
  n == null
    ? "—"
    : n.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: n < 100 ? 2 : 0,
      });

function outcomeChrome(o: VerdictOutcome | null | undefined) {
  if (o === VO.PROCEED)
    return { label: "Proceed", className: "text-defender border-defender/40 bg-defender/10" };
  if (o === VO.DISMISS)
    return { label: "Dismiss", className: "text-prosecutor border-prosecutor/40 bg-prosecutor/10" };
  if (o === VO.REVISE)
    return { label: "Revise", className: "text-judge border-judge/40 bg-judge/10" };
  return { label: "Verdict", className: "text-court-muted border-court-border" };
}

// --- Section wrapper -------------------------------------------------------

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-court-surface/60 border border-court-border rounded-xl p-5">
      <div className="mb-4">
        <h3 className="font-display text-lg text-court-fg leading-tight">
          {title}
        </h3>
        {subtitle && (
          <p className="text-[11px] text-court-muted uppercase tracking-[0.2em] mt-1">
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

// --- Protocol step ---------------------------------------------------------

function ProtocolStepCard({ step }: { step: ProtocolStep }) {
  const hours = step.duration_minutes / 60;
  const dur =
    step.duration_minutes >= 60
      ? `${hours.toFixed(hours < 2 ? 1 : 0)}h`
      : `${step.duration_minutes}m`;
  return (
    <li className="border border-court-border/60 rounded-lg p-4 bg-court-bg/30 flex gap-4">
      <div
        className="shrink-0 w-9 h-9 rounded-full border border-judge/40 text-judge text-sm flex items-center justify-center font-display"
        aria-hidden
      >
        {step.n}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1">
          <h4 className="font-display text-base text-court-fg leading-tight">
            {step.title}
          </h4>
          <span className="text-[11px] uppercase tracking-[0.2em] text-court-muted">
            {dur}
          </span>
        </div>
        <p className="text-sm text-court-fg/90 leading-relaxed">
          {step.description}
        </p>
        {step.equipment.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {step.equipment.map((e) => (
              <span
                key={e}
                className="text-[10px] uppercase tracking-[0.18em] text-court-muted px-2 py-0.5 rounded border border-court-border"
              >
                {e}
              </span>
            ))}
          </div>
        )}
        {step.notes && (
          <p className="mt-2 text-[12px] italic text-court-muted leading-relaxed">
            Note · {step.notes}
          </p>
        )}
        {step.source_url && (
          <a
            href={step.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-[11px] text-judge hover:underline uppercase tracking-[0.2em]"
          >
            Reference protocol →
          </a>
        )}
      </div>
    </li>
  );
}

// --- Materials -------------------------------------------------------------

function MaterialsTable({ materials }: { materials: MaterialLine[] }) {
  if (materials.length === 0)
    return <p className="text-sm text-court-muted">No materials specified.</p>;
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-[0.2em] text-court-muted">
            <th className="text-left font-medium py-2 px-2">Item</th>
            <th className="text-left font-medium py-2 px-2">Supplier</th>
            <th className="text-left font-medium py-2 px-2">Cat#</th>
            <th className="text-right font-medium py-2 px-2">Qty</th>
            <th className="text-right font-medium py-2 px-2">Unit $</th>
            <th className="text-right font-medium py-2 px-2">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-court-border/60">
          {materials.map((m, i) => (
            <tr key={`${m.name}-${i}`} className="text-court-fg/90">
              <td className="py-2 px-2">
                {m.url ? (
                  <a
                    href={m.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-judge hover:underline"
                  >
                    {m.name}
                  </a>
                ) : (
                  m.name
                )}
              </td>
              <td className="py-2 px-2 text-court-muted">{m.supplier ?? "—"}</td>
              <td className="py-2 px-2 text-court-muted font-mono text-[12px]">
                {m.catalog_number ?? "—"}
              </td>
              <td className="py-2 px-2 text-right text-court-muted">
                {m.quantity} <span className="text-[10px]">{m.unit}</span>
              </td>
              <td className="py-2 px-2 text-right text-court-muted">
                {fmtUsd(m.unit_price_usd)}
              </td>
              <td className="py-2 px-2 text-right text-court-fg">
                {fmtUsd(m.total_usd)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Budget bars ----------------------------------------------------------

function BudgetBars({
  budget,
  total,
}: {
  budget: ExperimentPlan["budget"];
  total: number;
}) {
  if (budget.length === 0)
    return <p className="text-sm text-court-muted">No budget lines.</p>;
  const max = Math.max(...budget.map((b) => b.amount_usd), 1);
  return (
    <div className="space-y-2.5">
      {budget.map((b, i) => {
        const pct = (b.amount_usd / max) * 100;
        const totalPct = total > 0 ? (b.amount_usd / total) * 100 : 0;
        return (
          <div key={`${b.category}-${i}`}>
            <div className="flex items-baseline justify-between mb-1 text-[12px]">
              <span className="text-court-fg">
                <span className="text-[10px] uppercase tracking-[0.18em] text-court-muted mr-2">
                  {b.category}
                </span>
                {b.description}
              </span>
              <span className="text-court-muted font-mono">
                {fmtUsd(b.amount_usd)}{" "}
                <span className="text-[10px]">({totalPct.toFixed(0)}%)</span>
              </span>
            </div>
            <div className="h-1.5 bg-court-bg rounded-full overflow-hidden">
              <div
                className="h-full bg-judge/60"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
      <div className="flex justify-between pt-2 border-t border-court-border text-sm">
        <span className="text-court-fg uppercase tracking-[0.2em] text-[11px]">
          Total
        </span>
        <span className="text-judge font-display text-lg">{fmtUsd(total)}</span>
      </div>
    </div>
  );
}

// --- Timeline (mini Gantt) ------------------------------------------------

function TimelineGantt({
  timeline,
  totalWeeks,
}: {
  timeline: TimelinePhase[];
  totalWeeks: number;
}) {
  if (timeline.length === 0 || totalWeeks <= 0)
    return <p className="text-sm text-court-muted">No timeline phases.</p>;
  const span = totalWeeks;
  return (
    <div>
      <div className="space-y-2">
        {timeline.map((p, i) => {
          const left = ((p.week_start - 1) / span) * 100;
          const width = Math.max(
            ((p.week_end - p.week_start + 1) / span) * 100,
            4,
          );
          return (
            <div key={`${p.name}-${i}`} className="text-[12px]">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-court-fg">{p.name}</span>
                <span className="text-court-muted font-mono">
                  W{p.week_start}–W{p.week_end}
                </span>
              </div>
              <div className="relative h-2 bg-court-bg rounded-full overflow-hidden">
                <div
                  className="absolute h-full bg-judge/70 rounded-full"
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              </div>
              {p.depends_on.length > 0 && (
                <div className="mt-1 text-[10px] text-court-muted">
                  depends on: {p.depends_on.join(" · ")}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-3 text-[10px] text-court-muted uppercase tracking-[0.2em] border-t border-court-border pt-2">
        <span>W1</span>
        <span>W{Math.ceil(totalWeeks / 2)}</span>
        <span>W{totalWeeks}</span>
      </div>
    </div>
  );
}

// --- Validation chips ------------------------------------------------------

function ValidationList({ items }: { items: ValidationMetric[] }) {
  if (items.length === 0)
    return <p className="text-sm text-court-muted">No validation metrics.</p>;
  return (
    <ul className="space-y-3">
      {items.map((v, i) => (
        <li key={`${v.metric}-${i}`} className="border-l-2 border-defender/50 pl-3">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-display text-sm text-court-fg">
              {v.metric}
            </span>
            {v.standard && (
              <span className="text-[10px] uppercase tracking-[0.2em] px-2 py-0.5 rounded-full border border-defender/40 text-defender">
                {v.standard}
              </span>
            )}
          </div>
          <div className="text-[12px] text-court-muted mt-1">
            <span className="text-court-fg">Threshold:</span> {v.threshold}
          </div>
          <div className="text-[12px] text-court-muted">
            <span className="text-court-fg">Method:</span> {v.method}
          </div>
        </li>
      ))}
    </ul>
  );
}

// --- Personnel + Equipment cards ------------------------------------------

function PersonnelCard({ p }: { p: Personnel }) {
  return (
    <div className="border border-court-border/60 rounded-lg p-3 bg-court-bg/30">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="font-display text-sm text-court-fg">{p.role}</span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-court-muted font-mono">
          {(p.fte * 100).toFixed(0)}% × {p.weeks}w
        </span>
      </div>
      {p.required_skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 my-1">
          {p.required_skills.map((s) => (
            <span
              key={s}
              className="text-[10px] uppercase tracking-[0.18em] text-court-muted px-2 py-0.5 rounded border border-court-border"
            >
              {s}
            </span>
          ))}
        </div>
      )}
      {p.total_cost_usd != null && (
        <div className="text-[11px] text-judge font-mono mt-1">
          {fmtUsd(p.total_cost_usd)}
        </div>
      )}
    </div>
  );
}

function EquipmentCard({ e }: { e: EquipmentItem }) {
  return (
    <div className="border border-court-border/60 rounded-lg p-3 bg-court-bg/30">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-display text-sm text-court-fg">{e.name}</span>
        {e.rental_available && (
          <span className="text-[10px] uppercase tracking-[0.2em] text-defender">
            Rental OK
          </span>
        )}
      </div>
      <p className="text-[12px] text-court-muted mt-1 leading-relaxed">
        {e.purpose}
      </p>
      <div className="flex justify-between text-[11px] mt-2">
        <span className="text-court-muted">{e.supplier ?? ""}</span>
        {e.estimated_cost_usd != null && (
          <span className="text-judge font-mono">
            {fmtUsd(e.estimated_cost_usd)}
          </span>
        )}
      </div>
    </div>
  );
}

// --- Risk heatmap chip -----------------------------------------------------

function riskScoreClass(score: number): string {
  if (score >= 16) return "bg-prosecutor/30 text-prosecutor border-prosecutor/50";
  if (score >= 9) return "bg-judge/20 text-judge border-judge/50";
  return "bg-defender/15 text-defender border-defender/40";
}

function RiskCard({ r }: { r: RiskFactor }) {
  const score = r.severity * r.likelihood;
  return (
    <div className="border border-court-border/60 rounded-lg p-3 bg-court-bg/30">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <p className="text-sm text-court-fg leading-snug">{r.description}</p>
        <span
          className={`shrink-0 text-[10px] font-mono px-2 py-0.5 rounded-full border ${riskScoreClass(score)}`}
          title={`Severity ${r.severity} × Likelihood ${r.likelihood}`}
        >
          S{r.severity}·L{r.likelihood}
        </span>
      </div>
      <p className="text-[12px] text-court-muted leading-relaxed">
        <span className="text-court-fg uppercase tracking-[0.18em] text-[10px] mr-1">
          Mitigation
        </span>
        {r.mitigation}
      </p>
    </div>
  );
}

// --- CRO card --------------------------------------------------------------

function CROCard({ c }: { c: CRORecommendation }) {
  return (
    <div className="border border-court-border/60 rounded-lg p-3 bg-court-bg/30">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-display text-sm text-court-fg">
          {c.url ? (
            <a
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-judge hover:underline"
            >
              {c.name}
            </a>
          ) : (
            c.name
          )}
        </span>
        {c.typical_turnaround_weeks != null && (
          <span className="text-[10px] uppercase tracking-[0.2em] text-court-muted font-mono">
            ~{c.typical_turnaround_weeks}w
          </span>
        )}
      </div>
      <p className="text-[12px] text-court-muted mt-1">{c.specialty}</p>
      {c.estimated_cost_usd != null && (
        <div className="text-[11px] text-judge font-mono mt-1">
          {fmtUsd(c.estimated_cost_usd)}
        </div>
      )}
    </div>
  );
}

// --- Top-level card --------------------------------------------------------

export default function ExperimentPlanCard({
  plan,
  verdictOutcome,
  onRegenerate,
}: Props) {
  const chrome = outcomeChrome(verdictOutcome);

  return (
    <article className="rounded-xl border border-judge/30 bg-gradient-to-b from-court-surface to-court-surface/60 shadow-2xl shadow-judge/5 overflow-hidden">
      {/* ---------- Order header ---------- */}
      <header className="px-5 py-4 sm:px-6 sm:py-5 border-b border-court-border bg-court-bg/30">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-judge mb-1">
              Order of the Court
            </p>
            <h2 className="font-display text-2xl sm:text-3xl text-court-fg leading-tight">
              Runnable Experiment Plan
            </h2>
            <p className="text-[11px] text-court-muted mt-1 font-mono">
              Case No. {plan.case_id} · Issued{" "}
              {new Date(plan.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] uppercase tracking-[0.22em] px-3 py-1 rounded-full border ${chrome.className}`}
            >
              {chrome.label}
            </span>
            {onRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                className="text-[10px] uppercase tracking-[0.22em] px-3 py-1 rounded-full border border-court-border text-court-muted hover:text-court-fg hover:border-court-muted transition-colors"
                title="Regenerate the plan with a fresh LLM call"
              >
                Re-issue
              </button>
            )}
          </div>
        </div>

        {/* Hero metrics */}
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <div className="border border-court-border/60 rounded-md px-3 py-2 bg-court-bg/40">
            <dt className="text-[10px] uppercase tracking-[0.2em] text-court-muted">
              Total Budget
            </dt>
            <dd className="font-display text-lg text-judge mt-0.5">
              {fmtUsd(plan.total_budget_usd)}
            </dd>
          </div>
          <div className="border border-court-border/60 rounded-md px-3 py-2 bg-court-bg/40">
            <dt className="text-[10px] uppercase tracking-[0.2em] text-court-muted">
              Duration
            </dt>
            <dd className="font-display text-lg text-court-fg mt-0.5">
              {plan.total_weeks} wk
            </dd>
          </div>
          <div className="border border-court-border/60 rounded-md px-3 py-2 bg-court-bg/40">
            <dt className="text-[10px] uppercase tracking-[0.2em] text-court-muted">
              Safety
            </dt>
            <dd className="font-display text-lg text-defender mt-0.5">
              {plan.safety_classification ?? "n/a"}
            </dd>
          </div>
          <div className="border border-court-border/60 rounded-md px-3 py-2 bg-court-bg/40">
            <dt className="text-[10px] uppercase tracking-[0.2em] text-court-muted">
              Protocol
            </dt>
            <dd className="font-display text-lg text-court-fg mt-0.5">
              {plan.protocol.length} steps
            </dd>
          </div>
        </dl>

        {/* Summary */}
        <p className="mt-5 text-sm sm:text-base text-court-fg/95 leading-relaxed">
          {plan.summary}
        </p>

        {plan.regulatory_considerations.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {plan.regulatory_considerations.map((r) => (
              <span
                key={r}
                className="text-[10px] uppercase tracking-[0.2em] text-prosecutor border border-prosecutor/40 px-2 py-0.5 rounded"
              >
                {r}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* ---------- Body sections ---------- */}
      <div className="p-5 sm:p-6 space-y-5">
        {/* Protocol */}
        <Section title="Protocol" subtitle={`${plan.protocol.length} steps`}>
          <ol className="space-y-3">
            {plan.protocol.map((s) => (
              <ProtocolStepCard key={s.n} step={s} />
            ))}
          </ol>
        </Section>

        {/* Materials + Budget side-by-side on wide screens */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Section
            title="Materials & Procurement"
            subtitle={`${plan.materials.length} line items`}
          >
            <MaterialsTable materials={plan.materials} />
          </Section>

          <Section title="Budget" subtitle={fmtUsd(plan.total_budget_usd)}>
            <BudgetBars
              budget={plan.budget}
              total={plan.total_budget_usd}
            />
          </Section>
        </div>

        {/* Timeline + Validation */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Section
            title="Timeline"
            subtitle={`${plan.total_weeks} weeks · ${plan.timeline.length} phases`}
          >
            <TimelineGantt
              timeline={plan.timeline}
              totalWeeks={plan.total_weeks}
            />
          </Section>
          <Section
            title="Validation"
            subtitle={`${plan.validation.length} metrics`}
          >
            <ValidationList items={plan.validation} />
          </Section>
        </div>

        {/* Personnel + Equipment */}
        {(plan.personnel.length > 0 || plan.equipment.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {plan.personnel.length > 0 && (
              <Section
                title="Personnel"
                subtitle={`${plan.personnel.length} role${plan.personnel.length === 1 ? "" : "s"}`}
              >
                <div className="space-y-2.5">
                  {plan.personnel.map((p, i) => (
                    <PersonnelCard key={`${p.role}-${i}`} p={p} />
                  ))}
                </div>
              </Section>
            )}
            {plan.equipment.length > 0 && (
              <Section
                title="Equipment"
                subtitle={`${plan.equipment.length} item${plan.equipment.length === 1 ? "" : "s"}`}
              >
                <div className="space-y-2.5">
                  {plan.equipment.map((e, i) => (
                    <EquipmentCard key={`${e.name}-${i}`} e={e} />
                  ))}
                </div>
              </Section>
            )}
          </div>
        )}

        {/* Risks */}
        {plan.risks_and_mitigations.length > 0 && (
          <Section
            title="Risks & Mitigations"
            subtitle="severity × likelihood — red ≥16, gold ≥9, blue <9"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {plan.risks_and_mitigations.map((r, i) => (
                <RiskCard key={`${r.description}-${i}`} r={r} />
              ))}
            </div>
          </Section>
        )}

        {/* Decision aids — success / stop / deliverables / prereqs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {plan.success_criteria_summary && (
            <Section title="Success Criteria" subtitle="What counts as a YES">
              <p className="text-sm text-court-fg/95 leading-relaxed">
                {plan.success_criteria_summary}
              </p>
              {plan.deliverables.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-court-muted mb-1">
                    Deliverables
                  </p>
                  <ul className="text-sm text-court-fg/90 space-y-1 list-disc pl-5">
                    {plan.deliverables.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Section>
          )}
          {(plan.failure_stop_criteria.length > 0 ||
            plan.prereq_skills.length > 0) && (
            <Section title="Stop Rules & Prereqs" subtitle="When to pull the plug">
              {plan.failure_stop_criteria.length > 0 && (
                <ul className="text-sm text-court-fg/90 space-y-1 list-disc pl-5 mb-3">
                  {plan.failure_stop_criteria.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              )}
              {plan.prereq_skills.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-court-muted mb-1">
                    Required Skills (Day 1)
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {plan.prereq_skills.map((s) => (
                      <span
                        key={s}
                        className="text-[10px] uppercase tracking-[0.18em] text-court-muted px-2 py-0.5 rounded border border-court-border"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Section>
          )}
        </div>

        {/* Suggested CROs */}
        {plan.suggested_cros.length > 0 && (
          <Section
            title="Suggested CROs"
            subtitle="If you'd rather outsource"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {plan.suggested_cros.map((c, i) => (
                <CROCard key={`${c.name}-${i}`} c={c} />
              ))}
            </div>
          </Section>
        )}

        {/* Citations footer */}
        {plan.citations.length > 0 && (
          <Section
            title="Citations"
            subtitle={`${plan.citations.length} reference${plan.citations.length === 1 ? "" : "s"}`}
          >
            <ul className="space-y-1.5 text-[12px] text-court-muted">
              {plan.citations.map((c, i) => (
                <li key={`${c.title}-${i}`} className="leading-relaxed">
                  {c.url ? (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-court-fg hover:text-judge hover:underline"
                    >
                      {c.title}
                    </a>
                  ) : (
                    <span className="text-court-fg">{c.title}</span>
                  )}
                  {c.year != null && <span> · {c.year}</span>}
                  <span className="ml-1 text-[10px] uppercase tracking-[0.18em]">
                    [{c.source}]
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </article>
  );
}
