import { NextResponse } from "next/server";
import { z } from "zod";
import { startSession } from "@/lib/ai/agent";
import { badRequest, chatSessionId, limitPublic, setChatCookie } from "@/lib/chat/session";
import { chatState } from "@/lib/chat/transcript";
import { prisma } from "@/lib/db";

const startSchema = z.object({ language: z.enum(["EN", "HI", "GU"]), projectId: z.enum(["aranya", "vasant"]).optional() }).strict();

/** Resume the buyer's chat from the signed cookie. */
export async function GET() {
  const id = await chatSessionId();
  const state = id ? await chatState(prisma, id) : null;
  if (!state) return NextResponse.json({ error: "NO_SESSION" }, { status: 404 });
  return NextResponse.json(state);
}

/** Start a chat: creates the lead and returns the instant acknowledgement. */
export async function POST(req: Request) {
  const limited = limitPublic(req, "chat-start", null, 5);
  if (limited) return limited;
  const parsed = startSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid request", parsed.error.issues);
  const s = await startSession(prisma, parsed.data);
  await setChatCookie(s.sessionId);
  return NextResponse.json(await chatState(prisma, s.sessionId), { status: 201 });
}
