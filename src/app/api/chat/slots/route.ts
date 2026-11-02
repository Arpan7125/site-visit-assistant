import { NextResponse } from "next/server";
import { z } from "zod";
import { getFreeSlots } from "@/lib/booking/slots";
import { badRequest, chatSessionId, limitPublic } from "@/lib/chat/session";
import { prisma } from "@/lib/db";
import { DAY, formatDateTime } from "@/lib/time";

const schema = z.object({ projectId: z.enum(["aranya", "vasant"]) });

/** Free slots for the picker card, read straight from the database (no model involved). */
export async function GET(req: Request) {
  const sessionId = await chatSessionId();
  if (!sessionId) return NextResponse.json({ error: "NO_SESSION" }, { status: 401 });
  const limited = limitPublic(req, "chat-slots", sessionId, 30);
  if (limited) return limited;
  const parsed = schema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return badRequest("Unknown project");

  const [session, project] = await Promise.all([
    prisma.chatSession.findUniqueOrThrow({ where: { id: sessionId } }),
    prisma.project.findUniqueOrThrow({ where: { id: parsed.data.projectId } }),
  ]);
  const now = new Date();
  const slots = await getFreeSlots(prisma, { projectId: project.id, from: now, to: new Date(now.getTime() + 7 * DAY), limit: 21 });
  return NextResponse.json({
    type: "slots",
    projectId: project.id,
    projectName: project.name,
    slots: slots.map((s) => ({ id: s.id, startsAt: s.startsAt.toISOString(), label: formatDateTime(s.startsAt, session.language) })),
  });
}
