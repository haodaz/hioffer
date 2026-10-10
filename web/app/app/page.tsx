"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Chat } from "@/components/Chat";
import { Panels, type Tab } from "@/components/Panels";
import { getState } from "@/lib/api";
import { useLang } from "@/lib/i18n";

export default function App() {
  const [lang, setLang, t] = useLang();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [state, setState] = useState<any>(null);
  const [tab, setTab] = useState<Tab>("programs");
  const [seed, setSeed] = useState<string | undefined>();
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(() => {
    getState()
      .then((s) => {
        setState(s);
        setErr(null);
      })
      .catch((e) => setErr(String(e)));
  }, []);
  useEffect(refresh, [refresh]);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-2">
        <Link href="/" className="text-xl font-bold tracking-tight">
          hi<span className="text-brand">offer</span>
        </Link>
        <div className="flex items-center gap-2 text-sm">
          {state && <span className="text-muted">{state.applicant}</span>}
          {err && <span className="text-bad">API offline</span>}
          <button className="chip" onClick={() => setLang(lang === "en" ? "zh" : "en")}>
            {lang === "en" ? "中文" : "EN"}
          </button>
        </div>
      </header>
      <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[1fr_1fr]">
        <section className="flex min-h-0 flex-col rounded-2xl border border-line bg-background p-3">
          <Chat lang={lang} t={t} onStateChange={refresh} seed={seed} />
        </section>
        <section className="flex min-h-0 flex-col rounded-2xl border border-line bg-background p-3">
          <Panels state={state} tab={tab} setTab={setTab} t={t} onAction={(m) => setSeed(m + " ")} refresh={refresh} />
        </section>
      </main>
    </div>
  );
}
