"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { chat, type Card, type Event } from "@/lib/api";
import type { Msg } from "@/lib/conversations";
import type { Key, Lang } from "@/lib/i18n";
import { ConfirmCard } from "./Cards";

const CARD_ICON: Record<string, string> = {
  programs: "🎓", requirements: "📋", advisor: "🧑‍🏫", materials: "📄", library: "🗂", todos: "🗓",
  signals: "📡", offers: "⚖️", recommendations: "🧭", confirm: "❓",
};

export function cardTitle(c: Card): string {
  const p = typeof c.program === "string" ? c.program : "";
  switch (c.kind) {
    case "advisor":
      return String(c.name);
    case "requirements":
    case "materials":
      return p;
    default:
      return c.kind;
  }
}

export function Chat({
  lang, t, messages, onMessages, onCard, onStateChange, seed,
}: {
  lang: Lang;
  t: (k: Key) => string;
  messages: Msg[];
  onMessages: (m: Msg[]) => void;
  onCard: (c: Card) => void;
  onStateChange: () => void;
  seed?: string;
}) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const seeded = useRef<string | undefined>(undefined);
  const msgsRef = useRef<Msg[]>(messages);
  msgsRef.current = messages;

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (seed && seeded.current !== seed) {
      seeded.current = seed;
      send(seed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  function update(fn: (last: Extract<Msg, { role: "assistant" }>) => void) {
    const m = msgsRef.current;
    const last = { ...(m[m.length - 1] as Extract<Msg, { role: "assistant" }>) };
    fn(last);
    const next = [...m.slice(0, -1), last];
    msgsRef.current = next;
    onMessages(next);
  }

  async function send(text: string) {
    if (!text.trim() || busy) return;
    const history = msgsRef.current.map((m) => ({ role: m.role, content: m.content }));
    const next: Msg[] = [...msgsRef.current, { role: "user", content: text }, { role: "assistant", content: "", cards: [], tools: [], pending: true }];
    msgsRef.current = next;
    onMessages(next);
    setInput("");
    setBusy(true);
    let touched = false;
    await chat(text, history, lang, (e: Event) => {
      update((last) => {
        if (e.type === "tool_start") last.tools = [...last.tools, e.name];
        if (e.type === "tool_log") last.tools = [...last.tools, e.text];
        if (e.type === "card") {
          last.cards = [...last.cards, e.card];
          if (e.card.kind !== "confirm") onCard(e.card);
        }
        if (e.type === "delta") last.content += e.text;
        if (e.type === "error") last.content += `\n⚠️ ${e.message}`;
        if (e.type === "final") last.pending = false;
      });
      if (e.type === "tool_end" && ["add_todo", "run_prepare", "log_signal", "add_offer", "add_program"].includes(e.name)) touched = true;
    });
    update((last) => {
      last.pending = false;
    });
    setBusy(false);
    if (touched) onStateChange();
  }

  const quick = ["quick1", "quick5", "quick2", "quick3", "quick4"] as const;

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6">
          {messages.length === 0 && (
            <div className="flex items-center gap-4">
              <Image src="/hioffer-bot.png" alt="hioffer" width={96} height={134} className="h-auto w-20 shrink-0" priority />
              <div>
                <p className="text-base">
                  👋 {t("tagline")} {t("sub")}
                </p>
                <p className="mt-1 text-xs text-muted">{t("boundary")}</p>
              </div>
            </div>
          )}
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="ml-auto w-fit max-w-[85%] rounded-2xl bg-brand px-4 py-2 text-sm text-white">
                {m.content}
              </div>
            ) : (
              <div key={i} className="flex gap-3">
                <Image src="/hioffer-bot.png" alt="" width={32} height={45} className="mt-1 h-11 w-8 shrink-0 self-start object-contain" />
                <div className="min-w-0 flex-1 space-y-2">
                  {m.tools.length > 0 && (
                    <details className="text-xs text-muted" open={m.pending}>
                      <summary className="cursor-pointer">{m.pending ? t("thinking") : `${m.tools.length} steps`}</summary>
                      <ul className="ml-4 mt-1 list-disc">
                        {m.tools.map((x, k) => (
                          <li key={k} className="font-mono">
                            {x}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {m.cards.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {m.cards.map((c, k) =>
                        c.kind === "confirm" ? (
                          <div key={k} className="w-full">
                            <ConfirmCard card={c} t={t} onAction={send} />
                          </div>
                        ) : (
                          <button key={k} className="chip" onClick={() => onCard(c)}>
                            {CARD_ICON[c.kind] ?? "🗂"} {cardTitle(c)}
                          </button>
                        ),
                      )}
                    </div>
                  )}
                  {m.content && (
                    <div className="prose-sm max-w-none text-sm leading-relaxed">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  )}
                  {m.pending && !m.content && m.tools.length === 0 && <div className="text-xs text-muted">{t("thinking")}</div>}
                </div>
              </div>
            ),
          )}
          <div ref={bottom} />
        </div>
      </div>
      <div className="border-t border-line bg-surface">
        <div className="mx-auto w-full max-w-2xl px-4 py-3">
          <div className="mb-2 flex flex-wrap gap-2">
            {quick.map((q) => (
              <button key={q} className="chip" onClick={() => send(t(q))} disabled={busy}>
                {t(q)}
              </button>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              className="flex-1 rounded-xl border border-line bg-surface px-4 py-2 text-sm outline-none focus:border-brand"
              placeholder={t("placeholder")}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy}
            />
            <button className="btn" disabled={busy || !input.trim()}>
              {t("send")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
