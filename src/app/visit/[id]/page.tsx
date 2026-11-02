import type { Metadata } from "next";
import Link from "next/link";
import { VisitPass } from "@/components/VisitPass";
import { getFreeSlots } from "@/lib/booking/slots";
import { prisma } from "@/lib/db";
import type { Lang } from "@/lib/i18n";
import { verifyToken } from "@/lib/links";
import { DAY, formatDateTime } from "@/lib/time";
import { ManageVisit } from "./ManageVisit";

export const metadata: Metadata = { title: "Your site visit" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  BOOKED: "Site visit booked",
  CANCELLED: "This visit was cancelled",
  COMPLETED: "Thank you for visiting",
  NO_SHOW: "This visit was missed",
};

export default async function VisitPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const { id } = await params;
  const { t } = await searchParams;
  if (!verifyToken("visit", id, t)) {
    return (
      <main className="mx-auto max-w-md px-5 py-16">
        <h1 className="font-display text-3xl">This link has expired</h1>
        <p className="mt-3 text-muted">Visit links work until a week after the visit. To book or change a visit, start a chat and we&apos;ll help.</p>
        <Link href="/chat" className="mt-6 inline-block font-medium text-accent underline underline-offset-4">
          Open the chat
        </Link>
      </main>
    );
  }
  const visit = await prisma.visit.findUnique({ where: { id }, include: { slot: { include: { project: true } }, lead: true } });
  if (!visit) {
    return (
      <main className="mx-auto max-w-md px-5 py-16">
        <h1 className="font-display text-3xl">Visit not found</h1>
        <p className="mt-3 text-muted">It may have been removed. Start a chat to book a new time.</p>
      </main>
    );
  }
  const lang = visit.lead.language as Lang;
  const p = visit.slot.project;
  const now = new Date();
  const free =
    visit.status === "BOOKED"
      ? await getFreeSlots(prisma, { projectId: p.id, from: now, to: new Date(now.getTime() + 10 * DAY), limit: 24 })
      : [];

  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <Link href="/" className="text-sm text-muted hover:text-ink">
        Company A, Ahmedabad
      </Link>
      <h1 className="mb-6 mt-4 font-display text-3xl font-light">Your site visit</h1>
      <VisitPass
        lang={lang}
        status={STATUS[visit.status]}
        projectName={p.name}
        label={formatDateTime(visit.slot.startsAt, lang)}
        address={p.address}
        mapUrl={p.mapUrl}
        reraNumber={p.reraNumber}
        remindersOn={visit.status === "BOOKED" && visit.lead.consentContact && !visit.lead.optedOut && !!visit.lead.phoneE164}
        icsHref={visit.status === "BOOKED" ? `/api/visit/${visit.id}/ics?t=${t}` : undefined}
      />
      {visit.status === "BOOKED" && (
        <ManageVisit
          visitId={visit.id}
          token={t!}
          slots={free.map((s) => ({ id: s.id, label: formatDateTime(s.startsAt, lang) }))}
        />
      )}
    </main>
  );
}
