"use client";

import { Button } from "@/components/ui";

export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="max-w-lg rounded-lg border border-danger/30 bg-danger-soft p-6">
      <h1 className="font-display text-2xl text-danger">This page couldn&apos;t load</h1>
      <p className="mt-2 text-danger">The data service didn&apos;t respond. Nothing you entered was lost. Try again in a moment.</p>
      <Button className="mt-5" variant="secondary" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
