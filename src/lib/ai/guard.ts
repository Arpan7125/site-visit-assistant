import { asciiDigits } from "./language";

/**
 * Deterministic output guard. Every assistant reply passes through here before a buyer sees it.
 * The system prompt asks the model to behave; this code makes sure it did.
 */

export type GuardEvidence = {
  /** Text of fact sheet entries returned by search_fact_sheet in this turn. */
  facts: { id: string; text: string; quotable: boolean }[];
  /** Other tool output the reply may legitimately repeat (slot times, booking details). */
  toolText: string[];
  /** The buyer's own messages: repeating their numbers back is fine. */
  buyerText: string[];
};

export type GuardViolation =
  | { kind: "PRICE_UNGROUNDED"; detail: string }
  | { kind: "DISCOUNT_OFFER"; detail: string }
  | { kind: "BANNED_CLAIM"; detail: string }
  | { kind: "UNGROUNDED_NUMBER"; detail: string };

export type GuardResult = {
  ok: boolean;
  violations: GuardViolation[];
  /** True when the reply mentions a quotable price, so the "indicative" notice must be shown. */
  mentionsPrice: boolean;
};

const MONEY_UNIT =
  /(₹|rs\.?|inr|rupees?|lakh|lakhs|lac|lacs|crore|crores|cr\b|लाख|करोड़|करोड|रुपये|रुपए|लाख़|લાખ|કરોડ|રૂપિયા|રૂ\.?)/i;
// Generic words like "offer" or "off" are left out: "I can offer you a slot on the 12th" is fine.
const DISCOUNT_WORD = /(discount|%\s*off|cashback|special offer|offer price|waive|rebate|छूट|डिस्काउंट|ऑफ़र|ऑफर|ડિસ્કાઉન્ટ|છૂટ|ઑફર|ઓફર)/i;

// Claims RERA forbids unless they are in the registered details (i.e. the fact sheet).
export const BANNED_CLAIMS = [
  "guaranteed",
  "guarantee",
  "assured return",
  "assured returns",
  "assured rental",
  "best project",
  "best in",
  "no. 1",
  "number one",
  "#1",
  "ready possession",
  "ready to move",
  "lowest price",
  "cheapest",
  "price will go up",
  "prices will rise",
  "appreciation",
  "double your money",
  "risk-free",
  "risk free",
  "गारंटी",
  "गारंटीड",
  "सबसे अच्छा",
  "सबसे बेहतरीन",
  "निश्चित रिटर्न",
  "रेडी पज़ेशन",
  "सबसे सस्ता",
  "ગેરંટી",
  "શ્રેષ્ઠ",
  "સૌથી સારું",
  "નિશ્ચિત વળતર",
  "તૈયાર કબજો",
  "સૌથી સસ્તું",
];

/** Numbers in a text, digits normalised, thousands separators removed ("1,450" → "1450"). */
export function numbersIn(text: string): string[] {
  const t = asciiDigits(text);
  return (t.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => n.replace(/,/g, "").replace(/\.0+$/, ""));
}

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?।\n])\s+/).filter(Boolean);
}

export function guardReply(reply: string, ev: GuardEvidence): GuardResult {
  const violations: GuardViolation[] = [];
  const lower = reply.toLowerCase();
  const factText = ev.facts.map((f) => f.text).join("\n");
  const quotableNumbers = new Set(ev.facts.filter((f) => f.quotable).flatMap((f) => numbersIn(f.text)));
  const allowedNumbers = new Set([
    ...ev.facts.flatMap((f) => numbersIn(f.text)),
    ...ev.toolText.flatMap(numbersIn),
    ...ev.buyerText.flatMap(numbersIn),
  ]);
  let mentionsPrice = false;

  for (const s of sentences(reply)) {
    const nums = numbersIn(s);
    const money = MONEY_UNIT.test(s);
    const discount = DISCOUNT_WORD.test(s) || (money && /\boff\b/i.test(s));
    if (discount && (nums.length || /%/.test(s))) {
      violations.push({ kind: "DISCOUNT_OFFER", detail: s });
      continue;
    }
    if (money && nums.length) {
      const untraced = nums.filter((n) => !quotableNumbers.has(n));
      if (untraced.length) violations.push({ kind: "PRICE_UNGROUNDED", detail: s });
      else mentionsPrice = true;
    }
  }

  for (const claim of BANNED_CLAIMS) {
    if (lower.includes(claim.toLowerCase()) && !factText.toLowerCase().includes(claim.toLowerCase())) {
      violations.push({ kind: "BANNED_CLAIM", detail: claim });
    }
  }

  // Every other number must come from the facts, tool output or the buyer. Small integers
  // (BHK counts, clock hours, "1 day before") are allowed as ordinary language.
  for (const n of numbersIn(reply)) {
    if (allowedNumbers.has(n)) continue;
    if (/^\d+$/.test(n) && Number(n) <= 12) continue;
    if (!violations.some((v) => v.detail.includes(n))) {
      violations.push({ kind: "UNGROUNDED_NUMBER", detail: n });
    }
  }

  return { ok: violations.length === 0, violations, mentionsPrice };
}
