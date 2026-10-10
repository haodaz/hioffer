"use client";

import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/Icons";
import demo from "@/lib/demo.json";
import { useLang, type Lang } from "@/lib/i18n";

const copy = {
  en: {
    h1a: "Your PhD application,",
    h1b: "run by an agent that shows its sources.",
    pitch:
      "Give hioffer one goal. It finds programs worth applying to, reads each program's official pages, matches advisors on verified papers, tailors your statement and emails, and keeps your timeline. You send, pay and submit.",
    cta: "Open the live demo",
    cta2: "See the six modules",
    proof: ["Every requirement with a quoted source", "Every paper verified on OpenAlex", "Every sentence traced to your files"],
    modulesTitle: "Six modules, one conversation",
    modulesSub: "Each module is a page you can manage by hand, and a set of things the agent does for you in chat.",
    builtTitle: "Built in public, measured honestly",
    builtSub: "48 hours at neatHack. Every run traced, every session checkpointed, every number in the business plan from a measured run.",
    stats: [["7", "defects found in traces, all fixed"], ["2×", "fewer input tokens per call after pruning"], ["$19.60", "max cost per user for a 60% margin at $49"], ["0", "emails sent by the agent, ever"]],
    boundary: "hioffer drafts, checks and reminds. It never sends an email, pays a fee or submits a form.",
    sample: "Real output for the fictional demo applicant",
  },
  zh: {
    h1a: "你的博士申请，",
    h1b: "交给一个处处给出来源的 agent。",
    pitch:
      "给 hioffer 一个目标。它会找值得申请的项目、读每个项目的官方页面、按已验证的论文匹配导师、为每个项目定制你的陈述和套磁信，并帮你盯住时间线。发信、交费、提交由你来做。",
    cta: "打开在线演示",
    cta2: "看六个模块",
    proof: ["每条要求附原文引用", "每篇论文经 OpenAlex 验证", "每句话可追溯到你的材料"],
    modulesTitle: "六个模块，一场对话",
    modulesSub: "每个模块既是一个你可以手动管理的页面，也是 agent 在对话里替你做的一组事。",
    builtTitle: "公开构建，诚实度量",
    builtSub: "neatHack 48 小时。每次运行都有 trace，每次会话都有存档，商业计划里的每个数字都来自实际运行。",
    stats: [["7", "个在 trace 里发现并修复的缺陷"], ["2×", "裁剪后每次调用输入 token 减半"], ["$19.60", "$49 定价下保 60% 毛利的单用户成本上限"], ["0", "agent 代发的邮件数"]],
    boundary: "hioffer 起草、核对、提醒。它从不发邮件、交费或提交表单。",
    sample: "虚构演示申请人的真实输出",
  },
} as const;

type Mod = { icon: keyof typeof Icon; title: string; does: string; bullets: string[] };
const modules: Record<Lang, Mod[]> = {
  en: [
    { icon: "compass", title: "Find programs", does: "Where is your research actually happening?", bullets: ["Counts recent papers on your topics per university, from OpenAlex", "Tiers reach / match / safety with the counts as evidence", "Never states admit rates or deadlines it has not read"] },
    { icon: "programs", title: "Check requirements", does: "Every rule, with the sentence it came from.", bullets: ["Reads the official admissions pages and follows the right links", "Deadline, fee, letters, statements, tests: each with URL + quote", "Marks what it could not find instead of guessing"] },
    { icon: "advisors", title: "Assess advisors", does: "Professors whose last two years match you.", bullets: ["Keeps only papers OpenAlex actually returned, with venue and year", "Anchors identity with two sources: faculty page + affiliation history", "Flags whether they say they are taking students"] },
    { icon: "materials", title: "Assemble materials", does: "One library, tailored per program, every claim tagged.", bullets: ["SOP variant within the limit, a fit paragraph per advisor, an outreach email each", "A verifier checks citations, word limits and claims, then sends failures back", "You copy; it never sends"] },
    { icon: "timeline", title: "Support the process", does: "What only you can do, dated.", bullets: ["Email each advisor (draft ready), ask and remind recommenders", "Test scores, transcripts, fee and submit, before each deadline", "Tick things off; the agent keeps the rest"] },
    { icon: "offers", title: "Track signals, decide offers", does: "Replies, interviews, admits; then a transparent comparison.", bullets: ["Log a reply by telling the agent", "Offers scored with visible weights: fit, funding, signals, guarantee", "Decision support, not a decision"] },
  ],
  zh: [
    { icon: "compass", title: "找项目", does: "你的研究方向到底在哪些学校活跃？", bullets: ["按主题统计各校近两年论文数，数据来自 OpenAlex", "冲 / 稳 / 保分层，以论文数为证据", "从不编造录取率或没读过的截止日期"] },
    { icon: "programs", title: "查要求", does: "每条规则，附上它出自的那句话。", bullets: ["读官方招生页并沿正确链接深入", "截止、费用、推荐信、陈述、考试：每条都有链接 + 原文", "找不到就标注“未找到”，不猜"] },
    { icon: "advisors", title: "看导师", does: "近两年工作和你匹配的教授。", bullets: ["只保留 OpenAlex 真实返回的论文，含期刊和年份", "两来源钉住身份：教师页 + 机构履历", "标注是否表示在招学生"] },
    { icon: "materials", title: "组材料", does: "一份材料库，按项目定制，每句有标签。", bullets: ["限额内的 SOP 变体、每位导师一段匹配、一封套磁信", "校验器检查引用、字数和事实，不通过打回重写", "你复制，它不发"] },
    { icon: "timeline", title: "助力过程", does: "只有你能做的事，排好日期。", bullets: ["给每位导师发信（草稿已备好）、联系并提醒推荐人", "考试成绩、成绩单、交费与提交，都在截止前", "打勾完成，其余 agent 记着"] },
    { icon: "offers", title: "跟踪信号，决策 offer", does: "回信、面试、录取；然后是透明的对比。", bullets: ["告诉 agent 一句话就能记录回信", "offer 按公开权重打分：匹配、资助、信号、保障", "是决策辅助，不是决定"] },
  ],
};

export default function Landing() {
  const [lang, setLang, t] = useLang();
  const c = copy[lang];
  const mods = modules[lang];
  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-16">
      <header className="flex items-center justify-between py-5">
        <div className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Image src="/mascot-bot.png" alt="" width={30} height={40} className="h-8 w-auto" />
          <span>
            hi<span className="text-brand">offer</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button className="chip" onClick={() => setLang(lang === "en" ? "zh" : "en")}>
            {lang === "en" ? "中文" : "EN"}
          </button>
          <Link href="/app" className="btn">
            {c.cta}
          </Link>
        </div>
      </header>

      <section className="grid items-center gap-8 py-10 md:grid-cols-[1.1fr_0.9fr]">
        <div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
            {c.h1a}
            <br />
            <span className="text-brand">{c.h1b}</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">{c.pitch}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/app" className="btn">
              {c.cta} <Icon.arrow size={16} />
            </Link>
            <a href="#modules" className="btn-ghost">
              {c.cta2}
            </a>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
            {c.proof.map((p) => (
              <li key={p} className="flex items-center gap-1.5">
                <Icon.check size={16} className="text-ok" /> {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative">
          <div className="absolute inset-6 rounded-full bg-brand-soft blur-3xl" />
          <Image src="/mascot-duo.png" alt="hioffer: an applicant and her agent" width={760} height={800} priority className="relative mx-auto h-auto w-full max-w-md" />
        </div>
      </section>

      <section id="modules" className="pt-10">
        <h2 className="text-2xl font-semibold tracking-tight">{c.modulesTitle}</h2>
        <p className="mt-1 text-muted">{c.modulesSub}</p>
        <div className="mt-8 space-y-10">
          {mods.map((m, i) => {
            const I = Icon[m.icon];
            return (
              <div key={m.title} className={`grid items-center gap-8 md:grid-cols-2 ${i % 2 ? "md:[&>*:first-child]:order-2" : ""}`}>
                <div>
                  <div className="flex items-center gap-3">
                    <span className="icon-tile">
                      <I size={20} />
                    </span>
                    <span className="eyebrow">
                      {String(i + 1).padStart(2, "0")} · {m.title}
                    </span>
                  </div>
                  <h3 className="mt-3 text-2xl font-semibold tracking-tight">{m.does}</h3>
                  <ul className="mt-4 space-y-2 text-[15px] text-muted">
                    {m.bullets.map((b) => (
                      <li key={b} className="flex gap-2">
                        <Icon.check size={18} className="mt-0.5 shrink-0 text-brand" /> <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-3xl bg-brand-soft/60 p-4 md:p-6">
                  <div className="mb-2 text-xs text-muted">{c.sample}</div>
                  <Sample index={i} lang={lang} t={t} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-16 rounded-3xl border border-line bg-surface p-8">
        <h2 className="text-2xl font-semibold tracking-tight">{c.builtTitle}</h2>
        <p className="mt-1 max-w-2xl text-muted">{c.builtSub}</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {c.stats.map(([v, l]) => (
            <div key={l} className="stat">
              <div className="value text-brand">{v}</div>
              <div className="label mt-1">{l}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          <a className="flex items-center gap-1.5 hover:text-brand" href="https://github.com/haodaz/hioffer" target="_blank" rel="noreferrer">
            <Icon.link size={16} /> github.com/haodaz/hioffer
          </a>
          <a className="flex items-center gap-1.5 hover:text-brand" href="https://cfo.ai/s/A_qiW6hIGmm-3fDR" target="_blank" rel="noreferrer">
            <Icon.link size={16} /> cfo.ai business plan
          </a>
          <span className="flex items-center gap-1.5">
            <Icon.shield size={16} /> {c.boundary}
          </span>
        </div>
      </section>

      <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
        <span>{t("builtInPublic")}</span>
        <span>neatlogs · Entire · cfo.ai</span>
      </footer>
    </main>
  );
}

function Sample({ index, lang, t }: { index: number; lang: Lang; t: (k: never) => string }) {
  void t;
  const d = demo;
  const req = (r: string | null | undefined) => (r === "yes" ? (lang === "zh" ? "必需" : "required") : r === "no" ? (lang === "zh" ? "不需要" : "not required") : r ?? "");
  switch (index) {
    case 0:
      return (
        <div className="card">
          <div className="text-xs text-muted">OpenAlex · {d.queries.join(" / ")}</div>
          {(["reach", "match", "safety"] as const).map((k) => (
            <div key={k} className="mt-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">{lang === "zh" ? { reach: "冲", match: "稳", safety: "保" }[k] : k}</div>
              <ul className="mt-1 divide-y divide-line">
                {(d.tiers as unknown as Record<string, [string, number][]>)[k].map(([n, p]) => (
                  <li key={n} className="flex items-center justify-between py-1.5 text-sm">
                    <span>{n}</span>
                    <span className="tag">{p} papers</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      );
    case 1:
      return (
        <div className="card">
          <div className="text-sm font-semibold">{d.program}</div>
          <ul className="mt-2 space-y-2">
            {d.facts.map((f) => (
              <li key={f.key} className="text-sm">
                <span className="tag mr-2">{f.key.replace(/_/g, " ")}</span>
                <span className="mr-2 text-xs text-muted">{req(f.required)}</span>
                {f.value}
                {f.quote && <div className="mt-0.5 text-xs italic text-muted">“{f.quote}…”</div>}
              </li>
            ))}
          </ul>
        </div>
      );
    case 2:
      return (
        <div className="card">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-semibold">{d.advisor.name}</div>
              <div className="text-xs text-muted">{d.advisor.areas.join(" · ")}</div>
            </div>
            <div className="text-right text-xs">
              <div className="font-medium">fit {"★".repeat(d.advisor.fit_score)}</div>
              <div className="text-ok">taking students: {d.advisor.takes_students}</div>
            </div>
          </div>
          <div className="mt-1 text-xs"><span className="font-medium text-ok">identity: two sources agree</span> <span className="text-muted">· {d.advisor.identity_detail}</span></div>
          <p className="mt-2 text-sm">{d.advisor.match}</p>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {d.advisor.papers.map((p) => (
              <li key={p.title}>
                {p.title} <span className="text-xs text-muted">{p.venue}, {p.year}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    case 3:
      return (
        <div className="card">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold">SOP · {d.sop.words} words · {d.sop.citations} citations</span>
            <span className="font-medium text-ok">{d.sop.passed ? "verified" : "needs review"}</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed">{d.sop.excerpt}</p>
          <div className="mt-3 rounded-xl bg-background p-3 text-sm">
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <Icon.mail size={14} /> {d.email.to} · {d.email.subject}
            </div>
            <p className="mt-1">{d.email.excerpt}</p>
          </div>
        </div>
      );
    case 4:
      return (
        <div className="card">
          <ul className="space-y-2">
            {d.todos.map((td) => (
              <li key={td.id} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 h-4 w-4 shrink-0 rounded border border-line" />
                <div>
                  {td.task}
                  <div className="text-xs text-muted">{td.due}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      );
    default:
      return (
        <div className="card">
          <ul className="space-y-1.5 text-sm">
            {d.signals.map((s) => (
              <li key={s.id}>
                <span className="mr-2 font-mono text-xs text-muted">{s.date}</span>
                <span className={`mr-2 text-xs font-medium ${s.kind.includes("positive") ? "text-ok" : "text-muted"}`}>{s.kind.replace(/_/g, " ")}</span>
                {s.advisor}
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-line pt-3 text-xs text-muted">
            {lang === "zh" ? "offer 对比 · 权重公开" : "Offer comparison · visible weights"}
          </div>
          {d.offers.map((o, i) => (
            <div key={o.id} className="mt-1 flex items-center justify-between text-sm">
              <span>{i + 1}. {o.program}</span>
              <span className="text-xs text-muted">${(o.stipend_usd ?? 0).toLocaleString()} · {o.years_guaranteed} yrs</span>
            </div>
          ))}
        </div>
      );
  }
}
