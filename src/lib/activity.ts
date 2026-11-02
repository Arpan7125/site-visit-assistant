import type { Prisma } from "@prisma/client";
import type { Db } from "@/lib/db";

export async function logActivity(
  db: Db,
  entry: { actorId: string | null; action: string; entityType: string; entityId: string; meta?: Prisma.InputJsonValue },
) {
  await db.activityLog.create({ data: entry });
}
