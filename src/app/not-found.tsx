import Link from "next/link";
import { buttonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <p className="text-sm text-muted">Company A, Ahmedabad</p>
      <h1 className="mt-4 font-display text-3xl font-light">There&apos;s no page here</h1>
      <p className="mt-3 text-muted">The link may be mistyped or out of date. You can still ask us anything or book a site visit.</p>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Link href="/chat" className={buttonClass("primary")}>
          Chat with us
        </Link>
        <Link href="/" className="font-medium text-accent underline-offset-4 hover:underline">
          Back to the homes
        </Link>
      </div>
    </main>
  );
}
