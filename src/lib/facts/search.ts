import type { FactSheetEntry, Language } from "@prisma/client";
import type { Db } from "@/lib/db";

/** Topic words → fact keys/categories. Lets "where", "कहाँ", "ક્યાં" all reach the location entries. */
const SYNONYMS: Record<string, string[]> = {
  location: ["where", "location", "address", "area", "locality", "located", "near", "nearby", "distance", "kahan", "कहाँ", "कहां", "पता", "लोकेशन", "ક્યાં", "સરનામું", "લોકેશન", "નજીક"],
  price: ["price", "prices", "cost", "rate", "rates", "budget", "starting", "kitna", "kimat", "कीमत", "दाम", "भाव", "कितना", "કિંમત", "ભાવ", "કેટલા", "કેટલું"],
  payment: ["payment", "plan", "emi", "loan", "bank", "installment", "instalment", "भुगतान", "लोन", "ईएमआई", "ચુકવણી", "લોન", "હપ્તા"],
  possession: ["possession", "handover", "completion", "ready", "when", "timeline", "delivery", "कब", "पज़ेशन", "कब्ज़ा", "ક્યારે", "કબજો", "પઝેશન"],
  amenities: ["amenities", "amenity", "facilities", "gym", "pool", "swimming", "clubhouse", "garden", "play", "park", "सुविधाएं", "सुविधा", "जिम", "पूल", "સુવિધા", "સુવિધાઓ", "જિમ", "પૂલ"],
  parking: ["parking", "car", "garage", "पार्किंग", "પાર્કિંગ"],
  configuration: ["bhk", "configuration", "size", "area", "carpet", "sqft", "sq", "feet", "bedroom", "rooms", "flat", "apartment", "फ्लैट", "कमरे", "साइज", "ફ્લેટ", "રૂમ", "સાઇઝ"],
  approvals: ["rera", "approval", "approvals", "approved", "registration", "legal", "title", "मंजूरी", "રેરા", "મંજૂરી"],
  construction: ["construction", "structure", "earthquake", "quality", "brand", "fittings", "flooring", "निर्माण", "બાંધકામ"],
  water: ["water", "power", "backup", "electricity", "पानी", "बिजली", "પાણી", "વીજળી"],
  security: ["security", "cctv", "guard", "safety", "सुरक्षा", "સુરક્ષા"],
  visit: ["visit", "timings", "open", "office", "site", "विज़िट", "વિઝિટ"],
  developer: ["developer", "builder", "company", "track", "record", "बिल्डर", "બિલ્ડર"],
  schools: ["school", "schools", "hospital", "mall", "metro", "station", "airport", "स्कूल", "अस्पताल", "સ્કૂલ", "હોસ્પિટલ"],
};

const STOP = new Set(["the", "a", "an", "is", "are", "of", "in", "at", "for", "to", "and", "or", "what", "which", "do", "does", "you", "your", "there", "any", "have", "has", "me", "tell", "about", "project", "please", "i", "it"]);

export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

function topicsFor(words: string[]): Set<string> {
  const topics = new Set<string>();
  for (const [topic, syns] of Object.entries(SYNONYMS)) {
    if (words.some((w) => w === topic || syns.includes(w))) topics.add(topic);
  }
  return topics;
}

export type FactHit = Pick<FactSheetEntry, "id" | "projectId" | "key" | "category" | "quotable" | "version"> & {
  value: string;
  score: number;
};

export function valueIn(entry: Pick<FactSheetEntry, "valueEn" | "valueHi" | "valueGu">, lang: Language): string {
  if (lang === "HI" && entry.valueHi) return entry.valueHi;
  if (lang === "GU" && entry.valueGu) return entry.valueGu;
  return entry.valueEn;
}

/**
 * Keyword + topic search over the fact sheet: the only knowledge source the assistant has.
 * Scores entries by topic match on key/category and word overlap with the entry text.
 * General entries (projectId = null) are always eligible.
 */
export async function searchFacts(
  db: Db,
  args: { query: string; projectId?: string | null; language: Language; limit?: number },
): Promise<FactHit[]> {
  const words = tokens(args.query);
  if (!words.length) return [];
  const topics = topicsFor(words);
  const entries = await db.factSheetEntry.findMany({
    where: args.projectId ? { OR: [{ projectId: args.projectId }, { projectId: null }] } : {},
  });
  const hits: FactHit[] = [];
  for (const e of entries) {
    const hay = `${e.key} ${e.category} ${e.valueEn} ${e.valueHi ?? ""} ${e.valueGu ?? ""}`.toLowerCase();
    const keyWords = tokens(`${e.key.replace(/[_.]/g, " ")} ${e.category}`);
    let score = 0;
    for (const t of topics) if (keyWords.includes(t) || e.category === t) score += 3;
    for (const w of words) {
      if (keyWords.includes(w)) score += 2;
      else if (w.length > 2 && hay.includes(w)) score += 1;
    }
    if (score > 0) {
      hits.push({
        id: e.id,
        projectId: e.projectId,
        key: e.key,
        category: e.category,
        quotable: e.quotable,
        version: e.version,
        value: valueIn(e, args.language),
        score,
      });
    }
  }
  // A single weak word overlap is noise; require a topic hit or two word hits.
  return hits
    .filter((h) => h.score >= 2)
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key))
    .slice(0, args.limit ?? 6);
}
