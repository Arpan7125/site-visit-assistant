import type { Metadata } from "next";
import Link from "next/link";
import { PostButton } from "@/components/admin/PostButton";
import { Chip, EmptyState } from "@/components/ui";
import { requireStaff } from "@/lib/authz";
import { SOURCE_LABEL, TARGETS } from "@/lib/config";
import { sourceMetrics, type SourceRow } from "@/lib/dashboard/metrics";
import { prisma } from "@/lib/db";
import { DAY, formatDateTime, formatDuration } from "@/lib/time";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const RANGES = [
  { key: "7", label: "Last 7 days" },
  { key: "30", label: "Last 30 days" },
  { key: "90", label: "Last 90 days" },
];

const inr = (n: number | null) => (n == null ? "—" : `₹${Math.round(n).toLocaleString("en-IN")}`);
const pct = (n: number | null) => (n == null ? "—" : `${Math.round(n)}%`);

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await requireStaff("SALES_HEAD");
  const { range = "30" } = await searchParams;
  const days = RANGES.some((r) => r.key === range) ? Number(range) : 30;
  const now = new Date();
  const from = new Date(now.getTime() - days * DAY);
  const [rows, flagged] = await Promise.all([
    sourceMetrics(prisma, { from, to: now, now }),
    prisma.chatSession.findMany({
      where: { flagged: true, reviewedAt: null },
      orderBy: { startedAt: "desc" },
      include: { lead: true, messages: { orderBy: { createdAt: "asc" }, where: { role: { in: ["BUYER", "ASSISTANT"] } } } },
    }),
  ]);
  const all = rows.find((r) => r.source === "ALL")!;
  const bySource = rows.filter((r) => r.source !== "ALL");
  const notReached = all.reachedWithin48hPct == null ? null : 100 - all.reachedWithin48hPct;
  const maxCpv = Math.max(...bySource.map((r) => r.costPerVisit ?? 0), 1);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Dashboard</h1>
          <p className="text-muted">Leads created in the period, counted once per person.</p>
        </div>
        <nav aria-label="Date range" className="flex rounded-md border border-line-strong p-0.5">
          {RANGES.map((r) => (
            <Link key={r.key} href={`?range=${r.key}`} aria-current={String(days) === r.key ? "page" : undefined} className={`rounded px-3 py-1.5 text-sm ${String(days) === r.key ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}>
              {r.label}
            </Link>
          ))}
        </nav>
      </div>

      {all.leads === 0 ? (
        <EmptyState title="No leads in this period">Pick a longer range, or check back once enquiries come in.</EmptyState>
      ) : (
        <>
          <section aria-label="Against the brief's targets" className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
            <Target label="Median first response" value={all.medianFirstResponseMs == null ? "—" : formatDuration(all.medianFirstResponseMs)} target={`Target under ${TARGETS.medianFirstResponseMin} min, was 14 h`} ok={all.medianFirstResponseMs != null && all.medianFirstResponseMs < TARGETS.medianFirstResponseMin * 60_000} />
            <Target label="Not reached within 48 h" value={pct(notReached)} target={`Target under ${TARGETS.notReached48hPct}%, was 35%`} ok={notReached != null && notReached < TARGETS.notReached48hPct} />
            <Target label="Lead to visit" value={pct(all.leadToVisitPct)} target={`Target ${TARGETS.leadToVisitPct}%, was 6%`} ok={all.leadToVisitPct != null && all.leadToVisitPct >= TARGETS.leadToVisitPct} />
          </section>

          <section aria-labelledby="by-source">
            <h2 id="by-source" className="mb-3 font-display text-2xl">By source</h2>
            <div className="overflow-x-auto rounded-lg border border-line bg-surface">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="border-b border-line text-left text-muted">
                  <tr>
                    {["Source", "Leads", "Median first reply", "Reached in 48 h", "Visits booked", "Show-up rate", "Lead → visit", "Cost per visit*"].map((h, i) => (
                      <th key={h} scope="col" className={`px-3 py-2.5 font-medium ${i > 0 ? "text-right" : ""}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {[...bySource, all].map((r) => (
                    <SourceLine key={r.source} r={r} maxCpv={maxCpv} />
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-sm text-muted">
              *Assumption: monthly spend per source is invented (portal ₹12L, social ₹9L, website ₹3L, hoarding ₹4L, WhatsApp ₹2L; ₹30L in total, as in the brief) and pro-rated to the period. Show-up rate = visited ÷ (visited + no-show).
            </p>
          </section>
        </>
      )}

      <section aria-labelledby="flagged">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="flagged" className="font-display text-2xl">Flagged chats to review</h2>
          <span className="text-sm text-muted">{flagged.length} waiting</span>
        </div>
        {flagged.length === 0 ? (
          <EmptyState title="Nothing to review">Chats are flagged when the assistant hit a missing fact, a price or discount question, a blocked reply or an outage.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {flagged.map((s) => {
              const lastBuyer = [...s.messages].reverse().find((m) => m.role === "BUYER");
              const lastBot = [...s.messages].reverse().find((m) => m.role === "ASSISTANT");
              return (
                <li key={s.id} className="rounded-lg border border-line bg-surface p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="flex flex-wrap items-center gap-2">
                      <Link href={`/admin/leads/${s.leadId}`} className="font-medium hover:text-accent hover:underline">{s.lead?.name ?? "Unknown"}</Link>
                      <Chip tone="warn">{s.flagReason?.split(":")[0].replaceAll("_", " ").toLowerCase() ?? "flagged"}</Chip>
                      <span className="text-sm text-muted">{formatDateTime(s.startedAt)}</span>
                    </p>
                    <PostButton url="/api/admin/reviews" body={{ sessionId: s.id }}>Mark reviewed</PostButton>
                  </div>
                  {lastBuyer && <p className="mt-2 text-sm"><span className="text-muted">Buyer: </span>{lastBuyer.content}</p>}
                  {lastBot && <p className="mt-1 text-sm"><span className="text-muted">Assistant: </span>{lastBot.content}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Target({ label, value, target, ok }: { label: string; value: string; target: string; ok: boolean }) {
  return (
    <div className="bg-surface p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-display text-3xl">{value}</p>
      <p className={`mt-1 text-sm ${ok ? "text-accent" : "text-warn"}`}>{ok ? "On target. " : "Below target. "}{target}</p>
    </div>
  );
}

function SourceLine({ r, maxCpv }: { r: SourceRow; maxCpv: number }) {
  const total = r.source === "ALL";
  return (
    <tr className={total ? "border-t-2 border-line-strong font-medium" : "border-b border-line"}>
      <th scope="row" className="px-3 py-2.5 text-left font-medium">{total ? "All sources" : SOURCE_LABEL[r.source as keyof typeof SOURCE_LABEL]}</th>
      <td className="px-3 py-2.5 text-right">{r.leads}</td>
      <td className="px-3 py-2.5 text-right">{r.medianFirstResponseMs == null ? "—" : formatDuration(r.medianFirstResponseMs)}</td>
      <td className="px-3 py-2.5 text-right">{pct(r.reachedWithin48hPct)}</td>
      <td className="px-3 py-2.5 text-right">{r.visitsBooked}</td>
      <td className="px-3 py-2.5 text-right">{r.showUpRate == null ? "—" : `${Math.round(r.showUpRate * 100)}%`} <span className="text-muted">({r.visited}/{r.visited + r.noShow})</span></td>
      <td className="px-3 py-2.5 text-right">{pct(r.leadToVisitPct)}</td>
      <td className="px-3 py-2.5 text-right">
        <span className="inline-flex items-center justify-end gap-2">
          {!total && r.costPerVisit != null && <span aria-hidden className="h-1.5 rounded-full bg-accent/60" style={{ width: `${Math.max(4, (r.costPerVisit / maxCpv) * 64)}px` }} />}
          {inr(r.costPerVisit)}
        </span>
      </td>
    </tr>
  );
}
