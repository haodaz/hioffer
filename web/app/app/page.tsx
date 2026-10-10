"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { CardView } from "@/components/Cards";
import { Chat, cardTitle } from "@/components/Chat";
import { Shell } from "@/components/Shell";
import { Icon } from "@/components/Icons";
import { getState, type Card } from "@/lib/api";
import { newConversation, useConversations, type Conversation, type Msg } from "@/lib/conversations";
import { useLang } from "@/lib/i18n";

export default function Page() {
  return (
    <Suspense>
      <ChatPage />
    </Suspense>
  );
}

function ChatPage() {
  const [lang, setLang, t] = useLang();
  const params = useSearchParams();
  const { list, save } = useConversations();
  const [conv, setConv] = useState<Conversation>(() => newConversation());
  const [pane, setPane] = useState<Card | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [state, setState] = useState<any>(null);
  const refresh = useCallback(() => {
    getState().then(setState).catch(() => setState(null));
  }, []);
  useEffect(refresh, [refresh]);
  // `?q=` lets the landing page, the panel pages and demo links open the chat with a first question sent.
  const seed = params.get("q") ?? undefined;

  const onMessages = useCallback(
    (messages: Msg[]) => {
      setConv((c) => {
        const next = { ...c, messages };
        save(next);
        return next;
      });
    },
    [save],
  );

  return (
    <Shell
      lang={lang}
      setLang={setLang}
      t={t}
      conversations={list}
      activeConversation={conv.id}
      onSelectConversation={(id) => {
        const c = list.find((x) => x.id === id);
        if (c) {
          setConv(c);
          setPane(null);
        }
      }}
      onNewConversation={() => {
        setConv(newConversation());
        setPane(null);
      }}
    >
      <div className="flex h-full">
        <div className={`min-w-0 flex-1 ${pane ? "hidden md:block" : ""}`}>
          <Chat
            key={conv.id}
            lang={lang}
            t={t}
            messages={conv.messages}
            onMessages={onMessages}
            onCard={setPane}
            onStateChange={refresh}
            state={state}
            seed={seed}
          />
        </div>
        {pane && (
          <aside className="flex w-full flex-col border-l border-line bg-background md:w-[46%] md:max-w-2xl">
            <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-2 text-sm">
              <span className="font-medium">{cardTitle(pane)}</span>
              <button className="chip" onClick={() => setPane(null)} aria-label="close">
                <Icon.close size={16} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <CardView card={pane} t={t} onAction={(m) => onMessagesSeed(m)} />
            </div>
          </aside>
        )}
      </div>
    </Shell>
  );

  function onMessagesSeed(m: string) {
    // A card action becomes a chat message: navigate the same page with ?q= so the Chat seeds it.
    window.location.href = `/app?q=${encodeURIComponent(m)}`;
  }
}
