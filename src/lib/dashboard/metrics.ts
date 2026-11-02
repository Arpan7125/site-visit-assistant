import type { LeadSource, PrismaClient } from "@prisma/client";
import { MONTHLY_SPEND_INR, SOURCES } from "@/lib/config";
import { DAY, HOUR } from "@/lib/time";

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Visited / (visited + no-show). Visits still upcoming or cancelled don't count either way. */
export function showUpRate(visited: number, noShow: number): number | null {
  return visited + noShow === 0 ? null : visited / (visited + noShow);
}

/** Spend for the period, pro-rated from the monthly figure, divided by visits that happened. */
export function costPerVisit(monthlySpend: number, periodDays: number, visited: number): number | null {
  if (visited === 0) return null;
  return (monthlySpend * (periodDays / 30)) / visited;
}

export type SourceRow = {
  source: LeadSource | "ALL";
  leads: number;
  medianFirstResponseMs: number | null;
  reachedWithin48hPct: number | null;
  visitsBooked: number;
  visited: number;
  noShow: number;
  showUpRate: number | null;
  leadToVisitPct: number | null;
  spend: number;
  costPerVisit: number | null;
};

/**
 * Per-source funnel for leads created in [from, to). Duplicates are excluded so one person
 * counts once (their original lead keeps the first source). "Reached within 48 h" only counts
 * leads at least 48 h old, otherwise new leads would look unreached.
 */
export async function sourceMetrics(db: PrismaClient, args: { from: Date; to: Date; now?: Date }): Promise<SourceRow[]> {
  const now = args.now ?? new Date();
  const leads = await db.lead.findMany({
    where: { createdAt: { gte: args.from, lt: args.to }, duplicateOfId: null, deletedAt: null },
    select: { source: true, firstContactAt: true, firstResponseAt: true, visits: { select: { status: true } } },
  });
  const periodDays = Math.max(1, (args.to.getTime() - args.from.getTime()) / DAY);

  const build = (source: SourceRow["source"], rows: typeof leads, spend: number): SourceRow => {
    const responses = rows.filter((l) => l.firstResponseAt).map((l) => l.firstResponseAt!.getTime() - l.firstContactAt.getTime());
    const old = rows.filter((l) => now.getTime() - l.firstContactAt.getTime() >= 48 * HOUR);
    const reached = old.filter((l) => l.firstResponseAt && l.firstResponseAt.getTime() - l.firstContactAt.getTime() <= 48 * HOUR);
    const visits = rows.flatMap((l) => l.visits);
    const visited = visits.filter((v) => v.status === "COMPLETED").length;
    const noShow = visits.filter((v) => v.status === "NO_SHOW").length;
    const leadsWithVisit = rows.filter((l) => l.visits.some((v) => v.status === "COMPLETED")).length;
    return {
      source,
      leads: rows.length,
      medianFirstResponseMs: median(responses),
      reachedWithin48hPct: old.length ? (reached.length / old.length) * 100 : null,
      visitsBooked: visits.filter((v) => v.status !== "CANCELLED").length,
      visited,
      noShow,
      showUpRate: showUpRate(visited, noShow),
      leadToVisitPct: rows.length ? (leadsWithVisit / rows.length) * 100 : null,
      spend: spend * (periodDays / 30),
      costPerVisit: costPerVisit(spend, periodDays, visited),
    };
  };

  const rows = SOURCES.map((s) => build(s, leads.filter((l) => l.source === s), MONTHLY_SPEND_INR[s]));
  const totalSpend = SOURCES.reduce((n, s) => n + MONTHLY_SPEND_INR[s], 0);
  return [...rows, build("ALL", leads, totalSpend)];
}
