import { CalendarPlus, MapPin } from "lucide-react";
import Link from "next/link";
import { t, type Lang } from "@/lib/i18n";

export type VisitPassProps = {
  lang: Lang;
  projectName: string;
  label: string;
  address: string;
  mapUrl: string;
  reraNumber: string;
  remindersOn: boolean;
  manageHref?: string;
  icsHref?: string;
  status?: string;
};

/**
 * The confirmation, styled as a printed visit pass: the one strong visual moment in the flow.
 * The perforation separates what the buyer needs on the day (time, place) from the stub
 * (RERA number, reminders, actions).
 */
export function VisitPass(p: VisitPassProps) {
  return (
    <section
      aria-label={t("visitBooked", p.lang)}
      className="relative w-full max-w-md animate-rise overflow-hidden rounded-lg border border-line-strong bg-surface"
    >
      <div className="px-5 pb-5 pt-4">
        <p className="text-sm text-accent">{p.status ?? t("visitBooked", p.lang)}</p>
        <p className="mt-2 font-display text-[1.7rem] leading-tight">{p.label}</p>
        <p className="mt-3 font-medium">{p.projectName}</p>
        <p className="text-muted">{p.address}</p>
        <a
          href={p.mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex min-h-11 items-center gap-2 font-medium text-accent underline-offset-4 hover:underline"
        >
          <MapPin aria-hidden size={18} /> {t("openMap", p.lang)}
        </a>
      </div>

      <div aria-hidden className="relative h-0 border-t border-dashed border-line-strong">
        <span className="absolute -left-2.5 -top-2.5 h-5 w-5 rounded-full border border-line-strong bg-paper" />
        <span className="absolute -right-2.5 -top-2.5 h-5 w-5 rounded-full border border-line-strong bg-paper" />
      </div>

      <div className="space-y-3 px-5 py-4 text-sm">
        <p className="text-muted">{p.remindersOn ? t("remindersOn", p.lang) : t("remindersOff", p.lang)}</p>
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          {p.icsHref && (
            <a href={p.icsHref} className="inline-flex min-h-11 items-center gap-2 font-medium text-accent underline-offset-4 hover:underline">
              <CalendarPlus aria-hidden size={18} /> {t("addCalendar", p.lang)}
            </a>
          )}
          {p.manageHref && (
            <Link href={p.manageHref} className="inline-flex min-h-11 items-center font-medium text-accent underline-offset-4 hover:underline">
              {t("manageVisit", p.lang)}
            </Link>
          )}
        </div>
        <p className="text-[0.8rem] text-muted">
          {t("rera", p.lang)} {p.reraNumber}
        </p>
      </div>
    </section>
  );
}
