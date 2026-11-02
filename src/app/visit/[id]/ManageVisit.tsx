"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ErrorNote, inputClass } from "@/components/ui";

export function ManageVisit({ visitId, token, slots }: { visitId: string; token: string; slots: { id: string; label: string }[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "confirm-cancel" | "reschedule">("idle");
  const [slotId, setSlotId] = useState(slots[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(body: Record<string, string>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/visit/${visitId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ t: token, ...body }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.error === "SLOT_TAKEN") {
        setError("Someone just booked that time. Please choose another.");
        router.refresh();
        return;
      }
      if (res.status === 429) return setError("Too many attempts. Please wait a minute and try again.");
      if (!res.ok) return setError("That didn't work. Please refresh the page and try again.");
      if (data.link) router.push(data.link);
      else router.refresh();
      setMode("idle");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      {error && <ErrorNote title={error} />}
      {mode === "idle" && (
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setMode("reschedule")} disabled={!slots.length}>
            Change time
          </Button>
          <Button variant="quiet" onClick={() => setMode("confirm-cancel")}>
            Cancel visit
          </Button>
        </div>
      )}
      {mode === "confirm-cancel" && (
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="font-medium">Cancel this site visit?</p>
          <p className="mt-1 text-sm text-muted">The time will be released for someone else, and reminders will stop.</p>
          <div className="mt-4 flex gap-3">
            <Button variant="danger" disabled={busy} onClick={() => act({ action: "cancel" })}>
              Cancel visit
            </Button>
            <Button variant="quiet" onClick={() => setMode("idle")}>
              Keep it
            </Button>
          </div>
        </div>
      )}
      {mode === "reschedule" && (
        <form
          className="space-y-3 rounded-lg border border-line bg-surface p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void act({ action: "reschedule", slotId });
          }}
        >
          <label htmlFor="slot" className="block font-medium">
            New time
          </label>
          <select id="slot" value={slotId} onChange={(e) => setSlotId(e.target.value)} className={inputClass}>
            {slots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <p className="text-sm text-muted">Only times that are free right now are listed.</p>
          <div className="flex gap-3">
            <Button type="submit" disabled={busy || !slotId}>
              Move my visit
            </Button>
            <Button type="button" variant="quiet" onClick={() => setMode("idle")}>
              Back
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
