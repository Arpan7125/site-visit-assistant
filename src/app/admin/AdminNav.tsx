"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="flex gap-1">
      {links.map((l) => {
        const active = path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={clsx("min-h-9 rounded-md px-3 py-1.5 text-sm", active ? "bg-ink text-paper" : "text-muted hover:text-ink")}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
