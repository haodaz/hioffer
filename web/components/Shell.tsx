"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Conversation } from "@/lib/conversations";
import type { Key, Lang } from "@/lib/i18n";

export const NAV = ["programs", "advisors", "materials", "timeline", "signals", "offers"] as const;
export type NavKey = (typeof NAV)[number];

export function Shell({
  lang, setLang, t, conversations, activeConversation, onSelectConversation, onNewConversation, children,
}: {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: Key) => string;
  conversations: Conversation[];
  activeConversation?: string;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();
  return (
    <div className="flex h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-surface">
        <Link href="/app" className="flex items-center gap-2 px-4 py-3 text-lg font-bold tracking-tight">
          <Image src="/hioffer-bot.png" alt="" width={28} height={39} className="h-7 w-auto" />
          <span>
            hi<span className="text-brand">offer</span>
          </span>
        </Link>
        <nav className="px-2">
          <Link href="/app" className={`block rounded-lg px-3 py-1.5 text-sm ${path === "/app" ? "bg-brand-soft text-brand" : "hover:bg-background"}`}>
            💬 {t("chat")}
          </Link>
          {NAV.map((k) => (
            <Link key={k} href={`/app/${k}`} className={`block rounded-lg px-3 py-1.5 text-sm ${path === `/app/${k}` ? "bg-brand-soft text-brand" : "hover:bg-background"}`}>
              {ICON[k]} {t(k)}
            </Link>
          ))}
        </nav>
        <div className="mt-4 flex items-center justify-between px-4 text-xs font-medium text-muted">
          <span>{t("history")}</span>
          <button
            className="text-brand hover:underline"
            onClick={() => {
              onNewConversation();
              if (path !== "/app") router.push("/app");
            }}
          >
            + {t("newChat")}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1">
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                onSelectConversation(c.id);
                if (path !== "/app") router.push("/app");
              }}
              className={`block w-full truncate rounded-lg px-3 py-1.5 text-left text-sm ${c.id === activeConversation ? "bg-background font-medium" : "hover:bg-background"}`}
              title={c.title}
            >
              {c.title || "…"}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-line px-4 py-2 text-xs text-muted">
          <span>priya · demo</span>
          <button className="chip" onClick={() => setLang(lang === "en" ? "zh" : "en")}>
            {lang === "en" ? "中文" : "EN"}
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}

const ICON: Record<NavKey, string> = { programs: "🎓", advisors: "🧑‍🏫", materials: "📄", timeline: "🗓", signals: "📡", offers: "⚖️" };
