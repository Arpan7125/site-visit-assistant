import type { Language } from "@prisma/client";

const DEVANAGARI = /[ऀ-ॿ]/;
const GUJARATI = /[઀-૿]/;

/**
 * Script-based language detection (Assumption A11). Returns null for Latin text so the
 * session keeps whatever language the buyer chose; romanised Hindi stays in the current language.
 */
export function detectScriptLanguage(text: string): Language | null {
  if (GUJARATI.test(text)) return "GU";
  if (DEVANAGARI.test(text)) return "HI";
  return null;
}

/** Convert Devanagari and Gujarati digits to ASCII so numeric checks work in every language. */
export function asciiDigits(text: string): string {
  return text
    .replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966))
    .replace(/[૦-૯]/g, (d) => String(d.charCodeAt(0) - 0x0ae6));
}

function normalise(text: string): string {
  return asciiDigits(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}%\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Whole-message opt-out phrases (DPDP: honour opt-outs). Matched on the normalised message
// so "STOP", "stop.", "Band karo!" all count, but "don't stop" inside a sentence does not.
const OPT_OUT_EXACT = [
  "stop",
  "stop messages",
  "stop messaging me",
  "unsubscribe",
  "opt out",
  "optout",
  "do not contact me",
  "dont contact me",
  "don t contact me",
  "band karo",
  "band kar do",
  "bandh karo",
  "message band karo",
  "messages band karo",
  "बंद करो",
  "बंद कर दो",
  "मैसेज बंद करो",
  "संदेश बंद करो",
  "બંધ કરો",
  "બંધ કરી દો",
  "મેસેજ બંધ કરો",
  "સંદેશા બંધ કરો",
];

export function isOptOut(text: string): boolean {
  const n = normalise(text);
  return OPT_OUT_EXACT.includes(n);
}

const HUMAN_PATTERNS = [
  /\b(talk|speak|chat)\s+(to|with)\s+(a\s+)?(person|human|someone|agent|executive|salesperson|sales person|real person)\b/,
  /\b(human|real person|call me|callback|call back)\b/,
  /\bagent\s+(please|pls)\b/,
  /इंसान|व्यक्ति से बात|किसी से बात|कॉल करें|फ़ोन करें|फोन करें/,
  /માણસ|વ્યક્તિ સાથે વાત|કોઈની સાથે વાત|ફોન કરો|કૉલ કરો/,
];

export function asksForHuman(text: string): boolean {
  const n = normalise(text);
  return HUMAN_PATTERNS.some((p) => p.test(n));
}

const DISCOUNT_PATTERNS = [
  /\b(discount|discounts|negotiat\w*|bargain|cashback|best price|best rate|lowest price|final price|last price|best deal|special offer|offer price|freebie|waive\w*)\b/,
  /\b\d+\s*%\s*(off|discount|less)\b/,
  /\b(reduce|lower|less)\s+(the\s+)?(price|rate|cost)\b/,
  /\bkam\s+(karo|kijiye|kar do)\b/,
  /छूट|डिस्काउंट|कम कर|कम कीजिए|आखिरी कीमत|फाइनल कीमत|मोलभाव/,
  /ડિસ્કાઉન્ટ|છૂટ|ઓછું કર|ઓછા કર|છેલ્લો ભાવ|ફાઇનલ ભાવ|ભાવતાલ/,
];

/** Negotiation or discount requests always go to a person (brief: never quote a final price or discount). */
export function asksForDiscount(text: string): boolean {
  const n = normalise(text);
  return DISCOUNT_PATTERNS.some((p) => p.test(n));
}
