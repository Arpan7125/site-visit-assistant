import { createHmac, timingSafeEqual } from "node:crypto";

function secret(): string {
  const s = process.env.LINK_SIGNING_SECRET;
  if (!s) throw new Error("LINK_SIGNING_SECRET is not set");
  return s;
}

function mac(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** "<expiryEpochSeconds>.<mac>" bound to a purpose and id, e.g. ("visit", visitId). */
export function signToken(purpose: string, id: string, expiresAt: Date): string {
  const exp = Math.floor(expiresAt.getTime() / 1000);
  return `${exp}.${mac(`${purpose}:${id}:${exp}`)}`;
}

export function verifyToken(purpose: string, id: string, token: string | null | undefined, now = new Date()): boolean {
  if (!token) return false;
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || !sig || exp * 1000 < now.getTime()) return false;
  const expected = Buffer.from(mac(`${purpose}:${id}:${exp}`));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Visit links stay valid until 7 days after the visit, so buyers can open them from reminders. */
export function visitLink(visitId: string, startsAt: Date): string {
  const token = signToken("visit", visitId, new Date(startsAt.getTime() + 7 * 86_400_000));
  return `/visit/${visitId}?t=${token}`;
}
