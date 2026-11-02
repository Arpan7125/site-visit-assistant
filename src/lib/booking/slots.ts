import type { Db } from "@/lib/db";

export type FreeSlot = { id: string; projectId: string; startsAt: Date; endsAt: Date };

/**
 * Slots a buyer can actually book: in the future, active, and with no BOOKED visit.
 * This is advisory (for offering choices); bookVisit re-checks under a row lock.
 */
export async function getFreeSlots(
  db: Db,
  args: { projectId: string; from: Date; to: Date; limit?: number; now?: Date },
): Promise<FreeSlot[]> {
  const now = args.now ?? new Date();
  const from = args.from > now ? args.from : now;
  return db.visitSlot.findMany({
    where: {
      projectId: args.projectId,
      isActive: true,
      startsAt: { gt: from, lte: args.to },
      visits: { none: { status: "BOOKED" } },
    },
    orderBy: { startsAt: "asc" },
    take: args.limit ?? 200,
    select: { id: true, projectId: true, startsAt: true, endsAt: true },
  });
}
