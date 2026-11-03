"use client";

import Link from "next/link";
import { Button } from "@/components/ui";

/** Buyer-facing error page: calm, says what happened and what to do next. */
export default function BuyerError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <p className="text-sm text-muted">Company A, Ahmedabad</p>
      <h1 className="mt-4 font-display text-3xl font-light">This page didn&apos;t load</h1>
      <p className="mt-3 text-muted">
        Our system didn&apos;t respond just now. Nothing you entered was lost. Try again in a moment.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button onClick={reset}>Try again</Button>
        <Link href="/" className="font-medium text-accent underline-offset-4 hover:underline">
          Back to the homes
        </Link>
      </div>
    </main>
  );
}
