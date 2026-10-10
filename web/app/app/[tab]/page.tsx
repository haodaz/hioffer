"use client";

import { useParams, useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { PanelContent, type Tab } from "@/components/Panels";
import { NAV, Shell } from "@/components/Shell";
import { getState } from "@/lib/api";
import { newConversation, useConversations } from "@/lib/conversations";
import { useLang } from "@/lib/i18n";

export default function Page() {
  return (
    <Suspense>
      <TabPage />
    </Suspense>
  );
}

function TabPage() {
  const [lang, setLang, t] = useLang();
  const { tab } = useParams<{ tab: string }>();
  const router = useRouter();
  const { list, save } = useConversations();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [state, setState] = useState<any>(null);
  const [ask, setAsk] = useState("");

  const refresh = useCallback(() => {
    getState().then(setState).catch(() => setState(null));
  }, []);
  useEffect(refresh, [refresh]);

  const valid = (NAV as readonly string[]).includes(tab) ? (tab as Tab) : "programs";
  const go = (q: string) => router.push(`/app?q=${encodeURIComponent(q)}`);

  return (
    <Shell
      lang={lang}
      setLang={setLang}
      t={t}
      conversations={list}
      onSelectConversation={() => router.push("/app")}
      onNewConversation={() => save(newConversation())}
    >
      <div className="flex h-full flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl space-y-3 px-4 py-6">
            <h1 className="text-lg font-semibold">{t(valid)}</h1>
            {state ? <PanelContent state={state} tab={valid} t={t} onAction={go} refresh={refresh} /> : <p className="text-sm text-muted">…</p>}
          </div>
        </div>
        <form
          className="border-t border-line bg-surface"
          onSubmit={(e) => {
            e.preventDefault();
            if (ask.trim()) go(`[${t(valid)}] ${ask}`);
          }}
        >
          <div className="mx-auto flex w-full max-w-4xl gap-2 px-4 py-3">
            <input className="flex-1 rounded-xl border border-line px-4 py-2 text-sm outline-none focus:border-brand" placeholder={t("askAbout")} value={ask} onChange={(e) => setAsk(e.target.value)} />
            <button className="btn">{t("send")}</button>
          </div>
        </form>
      </div>
    </Shell>
  );
}
