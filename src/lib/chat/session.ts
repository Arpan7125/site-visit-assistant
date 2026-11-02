import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { signToken, verifyToken } from "@/lib/links";

export const CHAT_COOKIE = "sv_chat";
const MAX_AGE_DAYS = 30;

export async function setChatCookie(sessionId: string) {
  const exp = new Date(Date.now() + MAX_AGE_DAYS * 86_400_000);
  (await cookies()).set(CHAT_COOKIE, `${sessionId}.${signToken("chat", sessionId, exp)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: exp,
  });
}

/** The buyer's chat session id, only if the cookie's signature is valid. */
export async function chatSessionId(): Promise<string | null> {
  const raw = (await cookies()).get(CHAT_COOKIE)?.value;
  if (!raw) return null;
  const i = raw.indexOf(".");
  if (i < 0) return null;
  const id = raw.slice(0, i);
  return verifyToken("chat", id, raw.slice(i + 1)) ? id : null;
}

/** Per-IP and per-session limits for public endpoints; returns a 429 response when exceeded. */
export function limitPublic(req: Request, bucket: string, sessionId: string | null, perMinute = 20): NextResponse | null {
  const checks = [rateLimit(`${bucket}:ip:${clientIp(req)}`, perMinute * 3, 60_000)];
  if (sessionId) checks.push(rateLimit(`${bucket}:s:${sessionId}`, perMinute, 60_000));
  const blocked = checks.find((c) => !c.ok);
  if (!blocked) return null;
  return NextResponse.json(
    { error: "RATE_LIMITED", retryAfterSec: blocked.retryAfterSec },
    { status: 429, headers: { "Retry-After": String(blocked.retryAfterSec) } },
  );
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: "BAD_REQUEST", message, details }, { status: 400 });
}
