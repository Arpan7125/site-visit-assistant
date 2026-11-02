import Link from "next/link";
import { buttonClass } from "@/components/ui";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Landing() {
  const projects = await prisma.project.findMany({ orderBy: { id: "asc" } });

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-5 pb-10 pt-8 sm:px-8">
      <header className="flex items-center justify-between">
        <p className="text-[0.95rem] text-muted">Company A, Ahmedabad</p>
        <Link href="/login" className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
          Staff sign in
        </Link>
      </header>

      <section className="mt-16 max-w-2xl sm:mt-24">
        <h1 className="font-display text-[2.6rem] leading-[1.08] font-light sm:text-6xl">
          Two neighbourhoods. Homes you can walk through this week.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted">
          Ask anything about the homes, in English, हिन्दी or ગુજરાતી, and book a site visit at a time that is actually free.
          Replies come in seconds, day or night.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link href="/chat" className={buttonClass("primary", "px-6 text-base")}>
            Chat with us
          </Link>
          <span className="text-sm text-muted">No sign-up. A person is one tap away.</span>
        </div>
      </section>

      <section aria-label="Projects" className="mt-auto grid gap-px overflow-hidden rounded-lg border border-line bg-line pt-0 sm:mt-24 sm:grid-cols-2">
        {projects.map((p) => (
          <article key={p.id} className="bg-surface p-6">
            <h2 className="font-display text-2xl">{p.name}</h2>
            <p className="mt-1 text-muted">{p.locality}, Ahmedabad</p>
            <p className="mt-4 max-w-sm">{p.tagline}</p>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <Link href={`/chat?project=${p.id}`} className="font-medium text-accent underline-offset-4 hover:underline">
                Ask about {p.name}
              </Link>
              <p className="text-[0.8rem] text-muted">RERA No. {p.reraNumber}</p>
            </div>
          </article>
        ))}
      </section>
      <p className="mt-4 text-[0.8rem] text-muted">
        Demo site with fictional projects. RERA numbers shown are placeholders. Details and prices are from the developer&apos;s fact
        sheet and are confirmed by the sales team.
      </p>
    </main>
  );
}
