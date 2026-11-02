import { createHmac } from "node:crypto";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";

/**
 * Normalise an Indian-context phone number to E.164.
 * Accepts "98765 43210", "+91-9876543210", "09876543210", "919876543210".
 * Returns null when it is not a valid mobile/landline number.
 */
export function normalisePhone(raw: string): string | null {
  const cleaned = raw.trim().replace(/[\s\-().]/g, "");
  if (!cleaned) return null;
  let candidate = cleaned;
  // 12-digit "91XXXXXXXXXX" without plus is common in portal exports.
  if (/^91\d{10}$/.test(candidate)) candidate = `+${candidate}`;
  const parsed = parsePhoneNumberFromString(candidate, "IN");
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number;
}

export function hashPhone(e164: string): string {
  const secret = process.env.PHONE_HASH_SECRET;
  if (!secret) throw new Error("PHONE_HASH_SECRET is not set");
  return createHmac("sha256", secret).update(e164).digest("hex");
}

/** "+919876543210" → "••••• •3210" for list views. */
export function maskPhone(e164: string | null | undefined): string {
  if (!e164) return "—";
  return `••••• •${e164.slice(-4)}`;
}
