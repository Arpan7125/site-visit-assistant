import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { topUpSlots } from "@/lib/booking/admin";
import { prisma } from "@/lib/db";
import { sendDueReminders } from "@/lib/reminders/send";

export const dynamic = "force-dynamic";

function authorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  if (!secret) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Called every 15 min (GitHub Actions) and daily (Vercel Cron) with Bearer CRON_SECRET.
 * Sends due reminders and keeps the next 14 days of visit slots open. Safe to call repeatedly.
 */
export async function GET(req: Request) {
  if (!authorised(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const summary = await sendDueReminders(prisma);
  const slots = await topUpSlots(prisma);
  return NextResponse.json({ ...summary, slotsCreated: slots.created });
}

export const POST = GET;
