"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui";

/** A button that POSTs JSON to an admin API and refreshes the page. Shows the server's error inline. */
export function PostButton({
  url,
  body,
  children,
  variant = "secondary",
  confirm,
  method = "POST",
  onDone,
}: {
  url: string;
  body: unknown;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "quiet" | "danger";
  confirm?: string;
  method?: "POST" | "DELETE";
  onDone?: (data: unknown) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        type="button"
        variant={variant}
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          setError(null);
          start(async () => {
            const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              setError(typeof data.error === "string" ? data.error : "That didn't work. Try again.");
              return;
            }
            onDone?.(data);
            router.refresh();
          });
        }}
      >
        {children}
      </Button>
      {error && (
        <span role="alert" className="text-sm text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
