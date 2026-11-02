"use client";

import clsx from "clsx";
import { ArrowUp, UserRound } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button, ErrorNote, inputClass } from "@/components/ui";
import { VisitPass } from "@/components/VisitPass";
import type { ChatCard } from "@/lib/ai/tools";
import type { ChatState, UiMessage } from "@/lib/chat/transcript";
import { LANGS, htmlLang, t, type Lang } from "@/lib/i18n";

type Project = { id: string; name: string; reraNumber: string };
type Pending = { kind: "idle" } | { kind: "sending" } | { kind: "error"; text: string; message: string };
const MAX = 1000;

export function ChatApp({ initial, projects, projectHint }: { initial: ChatState | null; projects: Project[]; projectHint?: string }) {
  const [state, setState] = useState<ChatState | null>(initial);
  const [lang, setLang] = useState<Lang>(initial?.language ?? "EN");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  async function start(language: Lang) {
    setStarting(true);
    setStartError(null);
    try {
      const res = await fetch("/api/chat/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ language, projectId: projectHint }),
      });
      if (res.status === 429) throw new Error(t("rateLimited", language));
      if (!res.ok) throw new Error(t("sendFailed", language));
      const s: ChatState = await res.json();
      setLang(language);
      setState(s);
    } catch (e) {
      setStartError(e instanceof Error ? e.message : t("sendFailed", language));
    } finally {
      setStarting(false);
    }
  }

  if (!state) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-5 py-10" lang={htmlLang(lang)}>
        <Link href="/" className="text-sm text-muted hover:text-ink">
          Company A, Ahmedabad
        </Link>
        <h1 className="mt-6 font-display text-4xl font-light leading-tight">Which language would you like to chat in?</h1>
        <p className="mt-3 text-muted">You can switch at any time.</p>
        <div className="mt-8 grid gap-3">
          {LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              disabled={starting}
              onClick={() => start(l.code)}
              lang={l.htmlLang}
              className="flex min-h-14 items-center justify-between rounded-md border border-line-strong bg-surface px-5 text-left text-lg transition-colors hover:border-accent disabled:opacity-60"
            >
              {l.name}
              <span aria-hidden className="text-muted">
                {l.label}
              </span>
            </button>
          ))}
        </div>
        {starting && <p className="mt-4 text-muted" role="status">…</p>}
        {startError && (
          <div className="mt-4">
            <ErrorNote title={startError} />
          </div>
        )}
      </main>
    );
  }
  return <Conversation state={state} lang={lang} setLang={setLang} projects={projects} projectHint={projectHint} />;
}

function Conversation({
  state,
  lang,
  setLang,
  projects,
  projectHint,
}: {
  state: ChatState;
  lang: Lang;
  setLang: (l: Lang) => void;
  projects: Project[];
  projectHint?: string;
}) {
  const [messages, setMessages] = useState<UiMessage[]>(state.messages);
  const [lead, setLead] = useState(state.lead);
  const [text, setText] = useState("");
  const [pending, setPending] = useState<Pending>({ kind: "idle" });
  const [pendingSlot, setPendingSlot] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Follow new messages only if the buyer is already at the bottom: no jumps while reading back.
  const onScroll = () => {
    const el = listRef.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };
  useLayoutEffect(() => {
    if (stickToBottom.current) endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, pending]);

  const append = useCallback((m: UiMessage) => setMessages((xs) => [...xs, m]), []);

  // Back/forward navigation can restore a cached render; re-sync with the server's transcript.
  useEffect(() => {
    let live = true;
    fetch("/api/chat/session")
      .then((r) => (r.ok ? (r.json() as Promise<ChatState>) : null))
      .then((s) => {
        if (live && s) {
          setMessages(s.messages);
          setLead(s.lead);
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  async function post(url: string, body: unknown): Promise<Response> {
    return fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  }

  async function send(raw: string, opts: { human?: boolean } = {}) {
    const value = raw.trim();
    if ((!value && !opts.human) || pending.kind === "sending") return;
    const shown = opts.human ? t("talkToPerson", lang) : value;
    append({ id: `local-${Date.now()}`, role: "BUYER", content: shown, cards: [] });
    setText("");
    setPending({ kind: "sending" });
    stickToBottom.current = true;
    try {
      const res = await post("/api/chat/message", opts.human ? { human: true } : { text: value });
      if (res.status === 429) {
        setPending({ kind: "error", text: value, message: t("rateLimited", lang) });
        return;
      }
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { message: UiMessage; language: Lang };
      if (data.language !== lang) setLang(data.language);
      append(data.message);
      setPending({ kind: "idle" });
    } catch {
      setPending({ kind: "error", text: value, message: t("sendFailed", lang) });
    }
  }

  async function switchLanguage(l: Lang) {
    setLang(l);
    await post("/api/chat/language", { language: l }).catch(() => undefined);
  }

  async function openSlots(projectId: string) {
    setPending({ kind: "sending" });
    try {
      const res = await fetch(`/api/chat/slots?projectId=${projectId}`);
      if (!res.ok) throw new Error();
      const card = (await res.json()) as ChatCard;
      append({ id: `slots-${Date.now()}`, role: "ASSISTANT", content: "", cards: [card] });
      setPending({ kind: "idle" });
    } catch {
      setPending({ kind: "error", text: "", message: t("sendFailed", lang) });
    }
  }

  async function book(slotId: string, nameKnown = lead.hasName) {
    if (!nameKnown) {
      setPendingSlot(slotId);
      append({ id: `contact-${Date.now()}`, role: "ASSISTANT", content: "", cards: [{ type: "contact", reason: "booking" }] });
      return;
    }
    setPending({ kind: "sending" });
    stickToBottom.current = true;
    try {
      const res = await post("/api/chat/book", { slotId });
      if (res.status === 409) {
        setPending({ kind: "idle" });
        setPendingSlot(slotId);
        append({ id: `contact-${Date.now()}`, role: "ASSISTANT", content: "", cards: [{ type: "contact", reason: "booking" }] });
        return;
      }
      if (res.status === 429) {
        setPending({ kind: "error", text: "", message: t("rateLimited", lang) });
        return;
      }
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { message: UiMessage };
      append(data.message);
      setPending({ kind: "idle" });
    } catch {
      setPending({ kind: "error", text: "", message: t("sendFailed", lang) });
    }
  }

  async function contactSaved(consent: boolean) {
    setLead((l) => ({ ...l, hasName: true, hasPhone: consent || l.hasPhone, consent }));
    if (pendingSlot) {
      const slot = pendingSlot;
      setPendingSlot(null);
      await book(slot, true);
    }
  }

  const projectForVisit = lead.projectId ?? projectHint ?? null;
  const hasBooking = messages.some((m) => m.cards.some((c) => c.type === "booking"));
  const last = messages[messages.length - 1];
  const showChips = pending.kind === "idle" && last?.role === "ASSISTANT" && !last.cards.some((c) => c.type === "slots" || c.type === "contact");

  return (
    <div className="flex h-dvh flex-col" lang={htmlLang(lang)}>
      <header className="border-b border-line bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/80">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-2.5">
          <Link href="/" className="whitespace-nowrap font-display text-lg leading-tight max-[419px]:sr-only" lang="en">
            Company A
          </Link>
          <div className="flex flex-1 items-center justify-between gap-2 min-[420px]:flex-none">
            <div role="group" aria-label="Language" className="flex rounded-md border border-line-strong p-0.5">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  lang={l.htmlLang}
                  aria-pressed={lang === l.code}
                  aria-label={l.name}
                  onClick={() => switchLanguage(l.code)}
                  className={clsx(
                    "min-h-9 min-w-10 rounded px-2 text-sm transition-colors",
                    lang === l.code ? "bg-ink text-paper" : "text-muted hover:text-ink",
                  )}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => send("", { human: true })}
              disabled={pending.kind === "sending"}
              className="inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-md border border-line-strong px-2.5 text-sm hover:border-ink disabled:opacity-60"
            >
              <UserRound aria-hidden size={16} />
              <span>{t("talkToPerson", lang)}</span>
            </button>
          </div>
        </div>
      </header>

      <div ref={listRef} onScroll={onScroll} className="flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-2xl px-4 pb-6 pt-5">
          <p className="mb-6 text-sm text-muted">{t("aiNote", lang)}</p>
          <ol aria-live="polite" aria-relevant="additions" className="space-y-5">
            {messages.map((m) => (
              <li key={m.id} className={clsx("flex flex-col gap-3", m.role === "BUYER" ? "items-end" : "items-start")}>
                {m.content && (
                  <div
                    className={clsx(
                      "max-w-[85%] whitespace-pre-line",
                      m.role === "BUYER" ? "rounded-lg rounded-br-sm bg-accent-soft px-4 py-2.5" : "pr-6 text-[1.05rem]",
                    )}
                  >
                    {m.role === "EXECUTIVE" && <span className="mb-1 block text-sm text-muted">Sales team</span>}
                    {m.content}
                  </div>
                )}
                {m.cards.map((c, i) => (
                  <Card
                    key={i}
                    card={c}
                    lang={lang}
                    onPick={book}
                    busy={pending.kind === "sending"}
                    onContactSaved={contactSaved}
                    contactDone={lead.hasName}
                  />
                ))}
              </li>
            ))}
            {pending.kind === "sending" && (
              <li className="flex items-center gap-1.5 py-2" role="status">
                <span className="sr-only">{t("typing", lang)}</span>
                {[0, 1, 2].map((i) => (
                  <span key={i} aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted/60" style={{ animationDelay: `${i * 180}ms` }} />
                ))}
              </li>
            )}
          </ol>
          {pending.kind === "error" && (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-danger" role="alert">
              <span>{pending.message}</span>
              {pending.text && (
                <button type="button" className="font-medium underline underline-offset-4" onClick={() => { setMessages((xs) => xs.slice(0, -1)); void send(pending.text); }}>
                  {t("retry", lang)}
                </button>
              )}
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <footer className="border-t border-line bg-paper pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-2xl px-4 pt-3">
          {showChips && (
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {hasBooking ? null : projectForVisit ? (
                <Chip onClick={() => openSlots(projectForVisit)}>{t("chipVisit", lang)}</Chip>
              ) : (
                projects.map((p) => (
                  <Chip key={p.id} onClick={() => openSlots(p.id)}>
                    {t("chipVisit", lang)}: {p.name}
                  </Chip>
                ))
              )}
              {projectForVisit && <Chip onClick={() => send(t("chipLocation", lang))}>{t("chipLocation", lang)}</Chip>}
              {projectForVisit && <Chip onClick={() => send(t("chipPrice", lang))}>{t("chipPrice", lang)}</Chip>}
            </div>
          )}
          <form
            className="flex items-end gap-2 pb-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send(text);
            }}
          >
            <label htmlFor="composer" className="sr-only">
              {t("placeholder", lang)}
            </label>
            <textarea
              id="composer"
              ref={inputRef}
              rows={1}
              value={text}
              maxLength={MAX}
              placeholder={t("placeholder", lang)}
              onChange={(e) => {
                setText(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send(text);
                }
              }}
              className={clsx(inputClass, "max-h-40 resize-none")}
            />
            <Button type="submit" aria-label={t("send", lang)} disabled={!text.trim() || pending.kind === "sending"} className="h-11 w-11 shrink-0 px-0">
              <ArrowUp aria-hidden size={20} />
            </Button>
          </form>
          {text.length > MAX - 100 && <p className="-mt-2 pb-2 text-right text-xs text-muted">{MAX - text.length}</p>}
        </div>
      </footer>
    </div>
  );
}

function Chip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="min-h-9 shrink-0 rounded-full border border-line-strong bg-surface px-3.5 text-sm hover:border-accent hover:text-accent">
      {children}
    </button>
  );
}

function Card({
  card,
  lang,
  onPick,
  busy,
  onContactSaved,
  contactDone,
}: {
  card: ChatCard;
  lang: Lang;
  onPick: (slotId: string) => void;
  busy: boolean;
  onContactSaved: (consent: boolean) => Promise<void>;
  contactDone: boolean;
}) {
  if (card.type === "slots") return <SlotPicker card={card} lang={lang} onPick={onPick} busy={busy} />;
  if (card.type === "booking") {
    return (
      <VisitPass
        lang={lang}
        projectName={card.projectName}
        label={card.label}
        address={card.address}
        mapUrl={card.mapUrl}
        reraNumber={card.reraNumber}
        remindersOn={card.remindersOn}
        manageHref={card.link}
        icsHref={card.link.replace(/^\/visit\/([^?]+)\?t=/, "/api/visit/$1/ics?t=")}
      />
    );
  }
  if (card.type === "handoff") {
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <UserRound aria-hidden size={16} /> {t("passedTo", lang)} {card.executiveName}
      </p>
    );
  }
  return contactDone ? <p className="text-sm text-muted">{t("saved", lang)}</p> : <ContactForm reason={card.reason} lang={lang} onSaved={onContactSaved} />;
}

function SlotPicker({ card, lang, onPick, busy }: { card: Extract<ChatCard, { type: "slots" }>; lang: Lang; onPick: (id: string) => void; busy: boolean }) {
  const [chosen, setChosen] = useState<string | null>(null);
  if (!card.slots.length) return <p className="text-muted">{t("noSlots", lang)}</p>;
  // Group by day so the list reads like a calendar, not a wall of buttons.
  const days = new Map<string, typeof card.slots>();
  for (const s of card.slots) {
    const day = s.label.split(",").slice(0, 2).join(",");
    days.set(day, [...(days.get(day) ?? []), s]);
  }
  return (
    <fieldset className="w-full max-w-md animate-rise rounded-lg border border-line bg-surface p-4">
      <legend className="px-1 text-sm text-muted">
        {t("chooseTime", lang)}: {card.projectName}
      </legend>
      <div className="space-y-3">
        {[...days.entries()].slice(0, 4).map(([day, slots]) => (
          <div key={day}>
            <p className="mb-1.5 text-sm font-medium">{day}</p>
            <div className="flex flex-wrap gap-2">
              {slots.map((s) => {
                const time = s.label.split(",").slice(2).join(",").trim() || s.label;
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={busy || chosen !== null}
                    onClick={() => {
                      setChosen(s.id);
                      onPick(s.id);
                    }}
                    aria-label={s.label}
                    className={clsx(
                      "min-h-10 min-w-20 rounded-md border px-3 text-sm transition-colors disabled:cursor-default",
                      chosen === s.id ? "border-accent bg-accent text-white" : "border-line-strong hover:border-accent disabled:opacity-50",
                    )}
                  >
                    {time}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </fieldset>
  );
}

function ContactForm({ reason, lang, onSaved }: { reason: "booking" | "handoff"; lang: Lang; onSaved: (consent: boolean) => Promise<void> }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<{ field: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const id = useRef(`c${Math.random().toString(36).slice(2, 8)}`).current;

  useEffect(() => setError(null), [name, phone, consent]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/chat/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, consent, ...(consent ? { phone } : {}) }),
      });
      if (res.status === 422 || res.status === 400) {
        const data = await res.json();
        setError({ field: data.field ?? "name", message: data.message ?? "Please check your details" });
        return;
      }
      if (!res.ok) throw new Error();
      await onSaved(consent);
    } catch {
      setError({ field: "form", message: t("sendFailed", lang) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-md animate-rise space-y-4 rounded-lg border border-line bg-surface p-4" noValidate>
      <div>
        <p className="font-medium">{t("contactTitle", lang)}</p>
        <p className="text-sm text-muted">{reason === "booking" ? t("contactWhyBooking", lang) : t("contactWhyHandoff", lang)}</p>
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${id}-name`} className="block text-sm font-medium">{t("name", lang)}</label>
        <input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required minLength={2} maxLength={80} className={inputClass} aria-invalid={error?.field === "name"} />
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-accent)]" />
        <span>{t("consent", lang)}</span>
      </label>
      {consent ? (
        <div className="space-y-1.5">
          <label htmlFor={`${id}-phone`} className="block text-sm font-medium">{t("phone", lang)}</label>
          <input id={`${id}-phone`} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="98765 43210" maxLength={20} className={inputClass} aria-invalid={error?.field === "phone"} />
        </div>
      ) : (
        <p className="text-sm text-muted">{t("noConsentNote", lang)}</p>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error.message}</p>}
      <Button type="submit" disabled={saving || name.trim().length < 2} className="w-full">
        {t("save", lang)}
      </Button>
    </form>
  );
}
