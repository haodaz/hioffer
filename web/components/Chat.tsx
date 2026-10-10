"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { chat, type Card, type Event } from "@/lib/api";
import type { Key, Lang } from "@/lib/i18n";
import { CardView } from "./Cards";

type Msg =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; cards: Card[]; tools: string[]; pending?: boolean };

export function Chat({ lang, t, onStateChange, seed }: { lang: Lang; t: (k: Key) => string; onStateChange: () => void; seed?: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const seeded = useRef(false);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  useEffect(() => {
    if (seed && !seeded.current) {
      seeded.current = true;
      send(seed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    const history = msgs.map((m) => ({ role: m.role, content: m.content }));
    setMsgs((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "", cards: [], tools: [], pending: true }]);
    setInput("");
    setBusy(true);
    let touched = false;
    await chat(text, history, lang, (e: Event) => {
      setMsgs((m) => {
        const last = { ...(m[m.length - 1] as Extract<Msg, { role: "assistant" }>) };
        if (e.type === "tool_start") last.tools = [...last.tools, e.name];
        if (e.type === "tool_log") last.tools = [...last.tools, e.text];
        if (e.type === "card") last.cards = [...last.cards, e.card];
        if (e.type === "delta") last.content += e.text;
        if (e.type === "error") last.content += `\n⚠️ ${e.message}`;
        if (e.type === "final") last.pending = false;
        return [...m.slice(0, -1), last];
      });
      if (e.type === "tool_end" && ["add_todo", "run_prepare"].includes(e.name)) touched = true;
    });
    setMsgs((m) => {
      const last = { ...(m[m.length - 1] as Extract<Msg, { role: "assistant" }>), pending: false };
      return [...m.slice(0, -1), last];
    });
    setBusy(false);
    if (touched) onStateChange();
  }

  const quick = ["quick1", "quick2", "quick3", "quick4"] as const;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {msgs.length === 0 && (
          <div className="card">
            <p className="text-sm">
              👋 {t("tagline")} {t("sub")}
            </p>
            <p className="mt-1 text-xs text-muted">{t("boundary")}</p>
          </div>
        )}
        {msgs.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-auto max-w-[85%] rounded-2xl bg-brand px-4 py-2 text-sm text-white">
              {m.content}
            </div>
          ) : (
            <div key={i} className="space-y-2">
              {m.tools.length > 0 && (
                <details className="text-xs text-muted" open={m.pending}>
                  <summary className="cursor-pointer">
                    {m.pending ? t("thinking") : `${m.tools.filter((x) => !x.startsWith("[")).length} steps`}
                  </summary>
                  <ul className="ml-4 mt-1 list-disc">
                    {m.tools.map((x, k) => (
                      <li key={k} className="font-mono">
                        {x}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {m.cards.map((c, k) => (
                <CardView key={k} card={c} t={t} onAction={send} />
              ))}
              {m.content && (
                <div className="prose-sm max-w-none text-sm leading-relaxed">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              )}
              {m.pending && !m.content && m.tools.length === 0 && <div className="text-xs text-muted">{t("thinking")}</div>}
            </div>
          ),
        )}
        <div ref={bottom} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {quick.map((q) => (
          <button key={q} className="chip" onClick={() => send(t(q))} disabled={busy}>
            {t(q)}
          </button>
        ))}
      </div>
      <form
        className="mt-2 flex gap-2"
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
  );
}
