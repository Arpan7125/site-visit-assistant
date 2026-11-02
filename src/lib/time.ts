export const TZ = "Asia/Kolkata";
/** IST has no DST, so a fixed offset is exact. */
const IST_OFFSET_MIN = 330;

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Build a UTC Date from an IST wall-clock date (YYYY-MM-DD) and hour/minute. */
export function istToUtc(date: string, hour: number, minute = 0): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hour, minute) - IST_OFFSET_MIN * MINUTE);
}

/** IST calendar date (YYYY-MM-DD) for a UTC instant. */
export function istDateKey(at: Date): string {
  return new Date(at.getTime() + IST_OFFSET_MIN * MINUTE).toISOString().slice(0, 10);
}

/** Day of week in IST (0 = Sunday). */
export function istWeekday(at: Date): number {
  return new Date(at.getTime() + IST_OFFSET_MIN * MINUTE).getUTCDay();
}

const LOCALES = { EN: "en-IN", HI: "hi-IN", GU: "gu-IN" } as const;
export type LangCode = keyof typeof LOCALES;

export function formatDateTime(at: Date, lang: LangCode = "EN"): string {
  return new Intl.DateTimeFormat(LOCALES[lang], {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(at);
}

export function formatDate(at: Date, lang: LangCode = "EN"): string {
  return new Intl.DateTimeFormat(LOCALES[lang], {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(at);
}

export function formatTime(at: Date, lang: LangCode = "EN"): string {
  return new Intl.DateTimeFormat(LOCALES[lang], {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
  }).format(at);
}

/** Human duration like "4 min", "3 h 10 min", "2 d 4 h". */
export function formatDuration(ms: number): string {
  if (ms < MINUTE) return `${Math.max(0, Math.round(ms / 1000))} s`;
  if (ms < HOUR) return `${Math.round(ms / MINUTE)} min`;
  if (ms < DAY) {
    const h = Math.floor(ms / HOUR);
    const m = Math.round((ms % HOUR) / MINUTE);
    return m ? `${h} h ${m} min` : `${h} h`;
  }
  const d = Math.floor(ms / DAY);
  const h = Math.round((ms % DAY) / HOUR);
  return h ? `${d} d ${h} h` : `${d} d`;
}
