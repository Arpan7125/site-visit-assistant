import clsx from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";

const BUTTON: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white hover:bg-accent-strong disabled:bg-line-strong disabled:text-muted",
  secondary: "border border-line-strong bg-surface text-ink hover:border-ink disabled:text-muted",
  quiet: "text-accent hover:bg-accent-soft disabled:text-muted",
  danger: "border border-danger/40 text-danger hover:bg-danger-soft",
};

export function buttonClass(variant: ButtonVariant = "primary", extra?: string) {
  return clsx(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-[0.95rem] font-medium transition-colors disabled:cursor-not-allowed",
    BUTTON[variant],
    extra,
  );
}

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function ButtonLink({ variant = "primary", className, ...props }: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}

type Tone = "neutral" | "accent" | "warn" | "danger";
const CHIP: Record<Tone, string> = {
  neutral: "bg-paper text-muted ring-line-strong",
  accent: "bg-accent-soft text-accent-strong ring-accent/20",
  warn: "bg-warn-soft text-warn ring-warn/20",
  danger: "bg-danger-soft text-danger ring-danger/20",
};

export function Chip({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[0.8rem] leading-5 ring-1 ring-inset", CHIP[tone], className)}>
      {children}
    </span>
  );
}

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: string; error?: string; children: ReactNode; htmlFor: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-sm text-muted">{hint}</p>}
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  "block w-full rounded-md border border-line-strong bg-surface px-3 py-2.5 text-base text-ink placeholder:text-muted/80 focus:border-accent focus:outline-none focus-visible:outline-2 focus-visible:outline-accent";

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong px-6 py-10 text-center">
      <p className="font-display text-xl">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorNote({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-danger">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 text-sm">{children}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={clsx("animate-pulse rounded-md bg-line/70", className)} />;
}
