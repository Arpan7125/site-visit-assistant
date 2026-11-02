import { NextResponse } from "next/server";
import { z } from "zod";
import { apiStaff } from "@/lib/authz";
import { SlotHasBooking, addSlot, generateSlots, setSlotActive, slotPatternSchema } from "@/lib/booking/admin";
import { prisma } from "@/lib/db";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("generate"), pattern: z.unknown() }).strict(),
  z
    .object({
      action: z.literal("add"),
      projectId: z.string().max(40),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      time: z.string().regex(/^\d{2}:\d{2}$/),
      minutes: z.number().int().min(30).max(180),
    })
    .strict(),
  z.object({ action: z.literal("toggle"), slotId: z.string().max(40), active: z.boolean(), cancelBooked: z.boolean().optional() }).strict(),
]);

export async function POST(req: Request) {
  const staff = await apiStaff("SALES_HEAD");
  if (staff instanceof NextResponse) return staff;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "BAD_REQUEST", issues: parsed.error.issues }, { status: 400 });
  const body = parsed.data;
  try {
    if (body.action === "generate") {
      const pattern = slotPatternSchema.safeParse(body.pattern);
      if (!pattern.success) return NextResponse.json({ error: pattern.error.issues[0]?.message ?? "Invalid pattern" }, { status: 400 });
      return NextResponse.json(await generateSlots(prisma, pattern.data, staff.id));
    }
    if (body.action === "add") {
      const [h, m] = body.time.split(":").map(Number);
      return NextResponse.json(await addSlot(prisma, { projectId: body.projectId, date: body.date, hour: h, minute: m, minutes: body.minutes, actorId: staff.id }));
    }
    return NextResponse.json(await setSlotActive(prisma, { ...body, actorId: staff.id }));
  } catch (e) {
    if (e instanceof SlotHasBooking) return NextResponse.json({ error: "SLOT_HAS_BOOKING", visitId: e.visitId }, { status: 409 });
    if (e instanceof Error && "code" in e && e.code === "P2002") return NextResponse.json({ error: "A slot already exists at that time" }, { status: 409 });
    if (e instanceof Error && e.message === "Choose a time in the future") return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
