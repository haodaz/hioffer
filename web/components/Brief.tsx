"use client";

import Image from "next/image";
import { Icon } from "@/components/Icons";
import type { Key, Lang } from "@/lib/i18n";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type State = any;

/** The home brief: who you are to the agent right now, and what is ongoing. Computed from server state only. */
export function Brief({ state, lang, t, onAsk }: { state: State | null; lang: Lang; t: (k: Key) => string; onAsk: (q: string) => void }) {
  const name = "Priya";
  const programs: State[] = state?.programs ?? [];
  const todos: State[] = state?.todos ?? [];
  const signals: State[] = state?.signals ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  const verifiedAdvisors = programs.reduce((n: number, p: State) => n + (p.advisors?.advisors?.length ?? 0), 0);
  const drafted = programs.filter((p: State) => p.final?.passed).length;
  const due30 = todos.filter((x: State) => !x.done && x.due && x.due >= today && x.due <= in30);
  const open = todos.filter((x: State) => !x.done);
  const nextTodo = [...open].sort((a: State, b: State) => (a.due ?? "9").localeCompare(b.due ?? "9"))[0];
  const deadlines = programs
    .map((p: State) => ({ name: p.short ?? p.name, d: p.requirements?.facts?.find((f: State) => f.key === "deadline")?.value?.split(/[,(]/)[0]?.trim() }))
    .filter((x: State) => x.d);
  const positive = signals.filter((s: State) => ["reply_positive", "interview", "admit", "funding_offer"].includes(s.kind));
  const blocked = programs.filter((p: State) => !p.requirements || !p.advisors?.advisors?.length);

  const L = lang === "zh";
  const lines: { icon: keyof typeof Icon; text: string }[] = [
    { icon: "programs", text: L ? `你在申请 ${programs.length} 个项目；${drafted} 个的材料已通过校验。` : `You are applying to ${programs.length} programs; ${drafted} have verified materials.` },
    deadlines.length
      ? { icon: "timeline", text: L ? `最近的截止：${deadlines.map((x: State) => `${x.name} ${x.d}`).join("，")}。` : `Deadlines: ${deadlines.map((x: State) => `${x.name} ${x.d}`).join(", ")}.` }
      : { icon: "timeline", text: L ? "还没有截止日期，先让我研究一个项目。" : "No deadlines yet. Ask me to research a program." },
    nextTodo
      ? { icon: "check", text: L ? `下一步：${nextTodo.task}${nextTodo.due ? `（${nextTodo.due}）` : ""}。还有 ${open.length - 1} 件待办。` : `Next: ${nextTodo.task}${nextTodo.due ? ` (${nextTodo.due})` : ""}. ${open.length - 1} more to-dos after that.` }
      : { icon: "check", text: L ? "待办清单是空的。" : "Your to-do list is empty." },
    { icon: "signals", text: L ? `${signals.length} 条信号，其中 ${positive.length} 条是正面的。` : `${signals.length} signals logged, ${positive.length} of them positive.` },
    blocked.length
      ? { icon: "question", text: L ? `${blocked.map((p: State) => p.short ?? p.name).join("、")} 还缺研究或导师，我可以继续。` : `${blocked.map((p: State) => p.short ?? p.name).join(", ")} still need research or advisors; I can continue.` }
      : { icon: "shield", text: L ? "所有项目都有来源明确的要求和已验证的导师。" : "Every program has sourced requirements and verified advisors." },
  ];
  const quick = L
    ? ["我今天最该做什么？", "UW 最匹配的导师是谁？", "我还应该申请哪些学校？", "看 UW 的草稿"]
    : ["What should I do this week?", "Who are the best-fit advisors at UW?", "Where else should I apply?", "Show my UW drafts"];

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-4">
        <Image src="/mascot-duo.png" alt="" width={300} height={316} className="hidden h-auto w-44 shrink-0 md:block" priority />
        <div className="card flex-1">
          <div className="text-2xl font-semibold tracking-tight">
            {L ? `你好，${name}。我是 HiOffer。` : `Hi, ${name}. I'm HiOffer.`}
          </div>
          <p className="mt-1 text-sm text-muted">{t("sub")}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label={t("programs")} value={programs.length} />
            <Stat label={L ? "已验证导师" : "verified advisors"} value={verifiedAdvisors} />
            <Stat label={L ? "材料已校验" : "drafts verified"} value={drafted} tone="ok" />
            <Stat label={L ? "30 天内待办" : "due in 30 days"} value={due30.length} tone={due30.length ? "warn" : undefined} />
          </div>
        </div>
      </div>
      <div className="card">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted">
          <Image src="/mascot-bot.png" alt="" width={20} height={27} className="h-5 w-auto" /> {L ? "HiOffer 说" : "HiOffer says"}
        </div>
        <ul className="space-y-2">
          {lines.map((l, i) => {
            const I = Icon[l.icon];
            return (
              <li key={i} className="flex items-start gap-2.5 text-[15px]">
                <span className="mt-0.5 text-muted">
                  <I size={16} />
                </span>
                <span>{l.text}</span>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="flex flex-wrap gap-2">
        {quick.map((q) => (
          <button key={q} className="chip" onClick={() => onAsk(q)}>
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: "ok" | "warn" }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className={`value ${tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : "text-brand-ink"}`}>{value}</div>
    </div>
  );
}
