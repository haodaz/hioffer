"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/Icons";
import type { Conversation } from "@/lib/conversations";
import { getSession, setSession } from "@/lib/api";
import type { Key, Lang } from "@/lib/i18n";

export const NAV = ["programs", "advisors", "materials", "timeline", "signals", "offers", "interview"] as const;
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
  const item = (href: string, active: boolean, label: string, I: (p: { size?: number; className?: string }) => React.ReactElement) => (
    <Link
      key={href}
      href={href}
      className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition ${active ? "bg-brand-soft font-medium text-brand-ink" : "text-foreground/80 hover:bg-background"}`}
    >
      <I size={18} className={active ? "text-brand" : "text-muted"} />
      {label}
    </Link>
  );
  return (
    <div className="flex h-screen">
      <aside className="flex w-64 shrink-0 flex-col border-r border-line bg-surface/80 backdrop-blur">
        <Link href="/" className="flex items-center gap-2 px-5 py-4 text-lg font-bold tracking-tight">
          <Image src="/mascot-bot.png" alt="" width={30} height={40} className="h-8 w-auto" />
          <span>
            Hi<span className="text-brand">Offer</span>
          </span>
        </Link>
        <nav className="space-y-0.5 px-3">
          {item("/app", path === "/app", t("chat"), Icon.chat)}
          {NAV.map((k) => item(`/app/${k}`, path === `/app/${k}`, t(k), Icon[k]))}
        </nav>
        <div className="mt-5 flex items-center justify-between px-5 text-xs font-medium text-muted">
          <span>{t("history")}</span>
          <button
            className="flex items-center gap-1 text-brand hover:underline"
            onClick={() => {
              onNewConversation();
              if (path !== "/app") router.push("/app");
            }}
          >
            <Icon.plus size={14} /> {t("newChat")}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-1">
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                onSelectConversation(c.id);
                if (path !== "/app") router.push("/app");
              }}
              className={`block w-full truncate rounded-xl px-3 py-1.5 text-left text-sm ${c.id === activeConversation ? "bg-background font-medium" : "text-foreground/80 hover:bg-background"}`}
              title={c.title}
            >
              {c.title || "…"}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-line px-5 py-3 text-xs text-muted">
          <span className="truncate">
            {getSession()?.name ?? "—"}{" "}
            <button className="text-brand hover:underline" onClick={() => { setSession(null); router.push("/login"); }}>
              · {t("switchApplicant")}
            </button>
          </span>
          <button className="chip" onClick={() => setLang(lang === "en" ? "zh" : "en")}>
            {lang === "en" ? "中文" : "EN"}
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
