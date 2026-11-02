import { NextResponse } from "next/server";
import { z } from "zod";
import { setSessionLanguage } from "@/lib/ai/agent";
import { badRequest, chatSessionId, limitPublic } from "@/lib/chat/session";
import { prisma } from "@/lib/db";

const schema = z.object({ language: z.enum(["EN", "HI", "GU"]) }).strict();

export async function POST(req: Request) {
  const sessionId = await chatSessionId();
  if (!sessionId) return NextResponse.json({ error: "NO_SESSION" }, { status: 401 });
  const limited = limitPublic(req, "chat-lang", sessionId, 20);
  if (limited) return limited;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid language");
  await setSessionLanguage(prisma, sessionId, parsed.data.language);
  return NextResponse.json({ language: parsed.data.language });
}
