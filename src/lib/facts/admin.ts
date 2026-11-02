import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { logActivity } from "@/lib/activity";

export const factSchema = z
  .object({
    id: z.string().max(40).optional(),
    projectId: z.string().max(40).nullable(),
    key: z.string().trim().min(2).max(60).regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers and underscores"),
    category: z.enum(["configuration", "price", "payment", "possession", "location", "amenities", "parking", "approvals", "construction", "water", "security", "visit", "developer", "schools"]),
    valueEn: z.string().trim().min(3).max(600),
    valueHi: z.string().trim().max(600).optional().transform((v) => v || null),
    valueGu: z.string().trim().max(600).optional().transform((v) => v || null),
    quotable: z.boolean(),
  })
  .strict();

export type FactInput = z.input<typeof factSchema>;

/** Create or edit a fact sheet entry; every edit bumps the version and is logged. */
export async function saveFact(db: PrismaClient, input: FactInput, actor: { id: string; name: string }) {
  const f = factSchema.parse(input);
  const data = { projectId: f.projectId, key: f.key, category: f.category, valueEn: f.valueEn, valueHi: f.valueHi, valueGu: f.valueGu, quotable: f.quotable, updatedBy: actor.name };
  const entry = f.id
    ? await db.factSheetEntry.update({ where: { id: f.id }, data: { ...data, version: { increment: 1 } } })
    : await db.factSheetEntry.create({ data });
  await logActivity(db, { actorId: actor.id, action: f.id ? "fact.edited" : "fact.created", entityType: "FactSheetEntry", entityId: entry.id, meta: { key: entry.key, version: entry.version } });
  return entry;
}

export async function deleteFact(db: PrismaClient, id: string, actorId: string) {
  const entry = await db.factSheetEntry.delete({ where: { id } });
  await logActivity(db, { actorId, action: "fact.deleted", entityType: "FactSheetEntry", entityId: id, meta: { key: entry.key, valueEn: entry.valueEn } });
}
