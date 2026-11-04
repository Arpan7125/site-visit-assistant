import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { STANDARD_SLOT_PATTERN } from "@/lib/config";
import { DAY, istDateKey, istToUtc, istWeekday } from "@/lib/time";
import { cancelVisit } from "./book";

export const slotPatternSchema = z
  .object({
    projectId: z.string().min(1).max(40),
    fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    days: z.number().int().min(1).max(60),
    weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    startHour: z.number().int().min(6).max(21),
    endHour: z.number().int().min(7).max(22),
    minutes: z.union([z.literal(30), z.literal(60), z.literal(90), z.literal(120)]),
  })
  .strict()
  .refine((p) => p.endHour > p.startHour, { message: "End time must be after start time", path: ["endHour"] });

/** Future slot times for a weekly pattern (IST). */
function planSlots(p: z.infer<typeof slotPatternSchema>, now: Date) {
  const data: { projectId: string; startsAt: Date; endsAt: Date }[] = [];
  const firstDay = istToUtc(p.fromDate, 12);
  for (let d = 0; d < p.days; d++) {
    const date = istDateKey(new Date(firstDay.getTime() + d * DAY));
    if (!p.weekdays.includes(istWeekday(istToUtc(date, 12)))) continue;
    for (let m = p.startHour * 60; m + p.minutes <= p.endHour * 60; m += p.minutes) {
      const startsAt = istToUtc(date, Math.floor(m / 60), m % 60);
      if (startsAt <= now) continue;
      data.push({ projectId: p.projectId, startsAt, endsAt: new Date(startsAt.getTime() + p.minutes * 60_000) });
    }
  }
  return data;
}

/** Generate slots by weekly pattern. Existing slots at the same time are kept (unique per project/time). */
export async function generateSlots(db: PrismaClient, p: z.infer<typeof slotPatternSchema>, actorId: string, now = new Date()) {
  const data = planSlots(p, now);
  const res = await db.visitSlot.createMany({ data, skipDuplicates: true });
  await logActivity(db, { actorId, action: "slots.generated", entityType: "Project", entityId: p.projectId, meta: { requested: data.length, created: res.count } });
  return { requested: data.length, created: res.count };
}

/**
 * Keep the standard pattern (Assumption A4) open for the next `days` days for every project,
 * so buyers always see free times. Runs with the reminder job. Only adds missing slots:
 * a slot the sales head disabled stays disabled, and nothing is logged when nothing changes.
 */
export async function topUpSlots(db: PrismaClient, now = new Date()) {
  const projects = await db.project.findMany({ select: { id: true } });
  let created = 0;
  for (const { id } of projects) {
    const data = planSlots({ ...STANDARD_SLOT_PATTERN, projectId: id, fromDate: istDateKey(now) }, now);
    const res = await db.visitSlot.createMany({ data, skipDuplicates: true });
    if (res.count) {
      created += res.count;
      await logActivity(db, { actorId: null, action: "slots.topped_up", entityType: "Project", entityId: id, meta: { created: res.count } });
    }
  }
  return { created };
}

export class SlotHasBooking extends Error {
  constructor(readonly visitId: string) {
    super("This slot has a booked visit");
  }
}

/**
 * Disable or re-enable a slot. A slot with a booked visit cannot be disabled unless the caller
 * explicitly confirms cancelling that visit (the buyer's reminders are cancelled with it).
 */
export async function setSlotActive(db: PrismaClient, args: { slotId: string; active: boolean; cancelBooked?: boolean; actorId: string }) {
  if (!args.active) {
    const booked = await db.visit.findFirst({ where: { slotId: args.slotId, status: "BOOKED" } });
    if (booked && !args.cancelBooked) throw new SlotHasBooking(booked.id);
    if (booked) await cancelVisit(db, { visitId: booked.id, actorId: args.actorId, reason: "slot_disabled" });
  }
  const slot = await db.visitSlot.update({ where: { id: args.slotId }, data: { isActive: args.active } });
  await logActivity(db, { actorId: args.actorId, action: args.active ? "slot.enabled" : "slot.disabled", entityType: "VisitSlot", entityId: slot.id });
  return slot;
}

export async function addSlot(db: PrismaClient, args: { projectId: string; date: string; hour: number; minute: number; minutes: number; actorId: string }) {
  const startsAt = istToUtc(args.date, args.hour, args.minute);
  if (startsAt <= new Date()) throw new Error("Choose a time in the future");
  const slot = await db.visitSlot.create({ data: { projectId: args.projectId, startsAt, endsAt: new Date(startsAt.getTime() + args.minutes * 60_000) } });
  await logActivity(db, { actorId: args.actorId, action: "slot.added", entityType: "VisitSlot", entityId: slot.id });
  return slot;
}

