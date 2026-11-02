import type { ReminderKind } from "@prisma/client";
import { DAY, HOUR } from "@/lib/time";

export type PlannedReminder = { kind: ReminderKind; sendAt: Date };

/**
 * Reminders for a visit booked at `now`.
 * - T-1d only if that moment is still in the future.
 * - T-2h always, but never scheduled in the past: a visit less than 2 h away gets one
 *   reminder that goes out on the next cron run.
 * - A visit already started gets none.
 */
export function planReminders(startsAt: Date, now: Date): PlannedReminder[] {
  if (startsAt <= now) return [];
  const out: PlannedReminder[] = [];
  const dayBefore = new Date(startsAt.getTime() - DAY);
  if (dayBefore > now) out.push({ kind: "T_MINUS_1D", sendAt: dayBefore });
  const twoHours = new Date(startsAt.getTime() - 2 * HOUR);
  out.push({ kind: "T_MINUS_2H", sendAt: twoHours > now ? twoHours : now });
  return out;
}
