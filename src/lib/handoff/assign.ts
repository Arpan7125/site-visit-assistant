import type { Db } from "@/lib/db";

export type ExecLoad = { id: string; name: string; openLoad: number; lastAssignedAt: Date | null };

/**
 * Deterministic assignment: the active executive with the fewest open items
 * (unacknowledged handoffs + upcoming booked visits). Ties go to whoever was assigned
 * least recently, then by name, so equal teams rotate round-robin.
 */
export function pickExecutive(loads: ExecLoad[]): ExecLoad | null {
  if (!loads.length) return null;
  return [...loads].sort(
    (a, b) =>
      a.openLoad - b.openLoad ||
      (a.lastAssignedAt?.getTime() ?? 0) - (b.lastAssignedAt?.getTime() ?? 0) ||
      a.name.localeCompare(b.name),
  )[0];
}

export async function executiveLoads(db: Db, now = new Date()): Promise<ExecLoad[]> {
  const execs = await db.user.findMany({
    where: { role: "EXECUTIVE", active: true },
    select: {
      id: true,
      name: true,
      handoffs: { select: { acknowledgedAt: true, createdAt: true }, orderBy: { createdAt: "desc" } },
      visits: { where: { status: "BOOKED", slot: { startsAt: { gt: now } } }, select: { id: true } },
    },
  });
  return execs.map((e) => ({
    id: e.id,
    name: e.name,
    openLoad: e.handoffs.filter((h) => !h.acknowledgedAt).length + e.visits.length,
    lastAssignedAt: e.handoffs[0]?.createdAt ?? null,
  }));
}
