"use client";

import { useState } from "react";
import type { Card } from "@/lib/api";
import type { Key } from "@/lib/i18n";

type T = (k: Key) => string;
type Fact = { key: string; required?: string; value: string; source_url?: string; quote?: string };
type Paper = { id: string; title: string; year?: number; venue?: string; url?: string };
type Advisor = {
  name: string;
  areas?: string[];
  match_reason?: string;
  fit_score?: number;
  profile_url?: string | null;
  papers: Paper[];
  takes_students?: { verdict: string; evidence?: string | null; source_url?: string | null };
  connections?: { type: string; via: string; evidence: string; source_url?: string }[];
  identity?: { confidence: "high" | "medium" | "low"; sources: { type: string; url?: string; detail?: string }[]; reasons: string[] };
};

export function CardView({ card, t, onAction }: { card: Card; t: T; onAction: (msg: string) => void }) {
  switch (card.kind) {
    case "programs":
      return <ProgramsCard rows={card.programs as never[]} t={t} />;
    case "requirements":
      return <RequirementsCard card={card} t={t} />;
    case "advisor":
      return <AdvisorCard a={card as unknown as Advisor} t={t} onAction={onAction} />;
    case "materials":
      return <MaterialsCard card={card} t={t} />;
    case "library":
      return <LibraryCard items={card.items as never[]} t={t} />;
    case "todos":
      return <TodosCard todos={card.todos as never[]} t={t} />;
    case "confirm":
      return <ConfirmCard card={card} t={t} onAction={onAction} />;
    case "recommendations":
      return <RecommendationsCard card={card} t={t} onAction={onAction} />;
    case "signals":
      return <SignalsCard signals={card.signals as Signal[]} t={t} />;
    case "offers":
      return <OffersCard cmp={card as unknown as Comparison} t={t} />;
    default:
      return <pre className="card overflow-auto text-xs">{JSON.stringify(card, null, 2)}</pre>;
  }
}

function Status({ s, t }: { s: string; t: T }) {
  const color =
    s === "complete" ? "text-ok" : s === "needs_review" || s === "blocked" ? "text-warn" : "text-muted";
  const key = (`status_${s}` as Key) in ({} as never) ? (`status_${s}` as Key) : (`status_${s}` as Key);
  return <span className={`text-xs font-medium ${color}`}>{safeT(t, key, s)}</span>;
}
function safeT(t: T, k: Key, fallback: string) {
  try {
    return t(k) || fallback;
  } catch {
    return fallback;
  }
}

export function ProgramsCard({ rows, t }: { rows: { name: string; deadline?: string; advisors: number; facts: number; status: string }[]; t: T }) {
  return (
    <div className="card">
      <div className="mb-2 text-sm font-semibold">{t("programs")}</div>
      <div className="divide-y divide-line">
        {rows.map((r) => (
          <div key={r.name} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div>
              <div className="font-medium">{r.name}</div>
              <div className="text-xs text-muted">
                {t("deadline")}: {r.deadline ?? "—"} · {r.facts} {t("facts")} · {r.advisors} {t("advisors").toLowerCase()}
              </div>
            </div>
            <Status s={r.status} t={t} />
          </div>
        ))}
      </div>
    </div>
  );
}

function reqLabel(r: string | undefined, t: T) {
  if (r === "yes") return t("required");
  if (r === "no") return t("notRequired");
  if (r === "optional") return t("optional");
  return t("unknown");
}

export function RequirementsCard({ card, t }: { card: Card; t: T }) {
  const facts = (card.facts as Fact[]) ?? [];
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="card">
      <div className="mb-2 text-sm font-semibold">{card.program as string}</div>
      <ul className="space-y-1">
        {facts.map((f, i) => (
          <li key={i} className="text-sm">
            <button className="w-full text-left" onClick={() => setOpen(open === f.key + i ? null : f.key + i)}>
              <span className="tag mr-2">{f.key.replace(/_/g, " ")}</span>
              <span className="mr-2 text-xs text-muted">{reqLabel(f.required, t)}</span>
              {f.value}
            </button>
            {open === f.key + i && (
              <div className="mt-1 rounded-lg bg-background p-2 text-xs text-muted">
                {f.quote && <p className="italic">“{f.quote}”</p>}
                {f.source_url && (
                  <a className="text-brand underline" href={f.source_url} target="_blank" rel="noreferrer">
                    {t("source")}: {f.source_url}
                  </a>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      {Array.isArray(card.notes) && (card.notes as string[]).length > 0 && (
        <ul className="mt-3 list-disc pl-5 text-xs text-muted">
          {(card.notes as string[]).map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AdvisorCard({ a, t, onAction }: { a: Advisor; t: T; onAction: (m: string) => void }) {
  const ts = a.takes_students?.verdict ?? "unknown";
  const tsColor = ts === "yes" ? "text-ok" : ts === "no" ? "text-bad" : "text-muted";
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold">
            {a.profile_url ? (
              <a href={a.profile_url} target="_blank" rel="noreferrer" className="hover:text-brand">
                {a.name}
              </a>
            ) : (
              a.name
            )}
          </div>
          <div className="text-xs text-muted">{(a.areas ?? []).join(" · ")}</div>
        </div>
        <div className="text-right text-xs">
          <div>
            {t("fit")} {"★".repeat(a.fit_score ?? 0)}
          </div>
          <div className={tsColor}>
            {t("takesStudents")}: {ts}
          </div>
        </div>
      </div>
      {a.identity && (
        <div className="mt-1 text-xs text-muted">
          <span className={`font-medium ${a.identity.confidence === "high" ? "text-ok" : a.identity.confidence === "medium" ? "text-warn" : "text-bad"}`}>
            {t("identity")}: {t(`identity_${a.identity.confidence}` as Key)}
          </span>{" "}
          ·{" "}
          {a.identity.sources.map((s, i) => (
            <span key={i}>
              {i > 0 && " + "}
              {s.url ? (
                <a className="underline" href={s.url} target="_blank" rel="noreferrer">
                  {s.type.replace(/_/g, " ")}
                </a>
              ) : (
                s.type.replace(/_/g, " ")
              )}
              {s.detail ? ` (${s.detail})` : ""}
            </span>
          ))}
          {a.identity.reasons.length > 0 && <span> · {a.identity.reasons.join("; ")}</span>}
        </div>
      )}
      {a.match_reason && <p className="mt-2 text-sm">{a.match_reason}</p>}
      {a.takes_students?.evidence && (
        <p className="mt-1 text-xs text-muted">
          “{a.takes_students.evidence}”{" "}
          {a.takes_students.source_url && (
            <a className="text-brand underline" href={a.takes_students.source_url} target="_blank" rel="noreferrer">
              {t("source")}
            </a>
          )}
        </p>
      )}
      <div className="mt-2 text-xs font-medium text-muted">{t("papers")}</div>
      <ul className="list-disc pl-5 text-sm">
        {a.papers.map((p) => (
          <li key={p.id}>
            <a href={p.url ?? `https://openalex.org/${p.id}`} target="_blank" rel="noreferrer" className="hover:text-brand">
              {p.title}
            </a>{" "}
            <span className="text-xs text-muted">
              {p.venue ? `${p.venue}, ` : ""}
              {p.year}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2 text-xs font-medium text-muted">{t("connections")}</div>
      {a.connections && a.connections.length > 0 ? (
        <ul className="list-disc pl-5 text-sm">
          {a.connections.map((c, i) => (
            <li key={i}>
              <span className="tag mr-1">{c.type.replace(/_/g, " ")}</span>
              {c.evidence}{" "}
              {c.source_url && (
                <a className="text-brand underline" href={c.source_url} target="_blank" rel="noreferrer">
                  {t("evidence")}
                </a>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted">{t("noConnections")}</p>
      )}
      <div className="mt-3 flex gap-2">
        <button className="btn-ghost" onClick={() => onAction(`Show the outreach email draft for ${a.name}`)}>
          ✉️ {t("emails")}
        </button>
      </div>
    </div>
  );
}

function CopyButton({ text, t }: { text: string; t: T }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      className="chip"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        } catch {}
      }}
    >
      {ok ? t("copied") : t("copy")}
    </button>
  );
}

const stripTags = (s: string) => s.replace(/\s*\[(lib|paper|advisor):[^\]]+\]/g, "");

export function MaterialsCard({ card, t }: { card: Card; t: T }) {
  const sop = card.sop as { text: string; word_count: number; word_limit: number | null };
  const fits = (card.fit_paragraphs as { advisor: string; text: string }[]) ?? [];
  const emails = (card.emails as { advisor: string; subject: string; body: string }[]) ?? [];
  const v = (card.verification as { passed?: boolean; writer_issues?: unknown[] }) ?? {};
  const [tab, setTab] = useState<"sop" | "fit" | "emails">("sop");
  const [showTags, setShowTags] = useState(false);
  const render = (s: string) => (showTags ? s : stripTags(s));
  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold">
          {card.program as string} · v{String(card.version)}
        </div>
        <div className={`text-xs font-medium ${v.passed ? "text-ok" : "text-warn"}`}>
          {v.passed ? `✓ ${t("verified")}` : `${t("needsReview")} · ${(v.writer_issues ?? []).length} ${t("issues")}`}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {(["sop", "fit", "emails"] as const).map((k) => (
          <button key={k} className={`chip ${tab === k ? "border-brand text-brand" : ""}`} onClick={() => setTab(k)}>
            {k === "sop" ? t("sop") : k === "fit" ? t("fitParagraphs") : t("emails")}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1 text-xs text-muted">
          <input type="checkbox" checked={showTags} onChange={(e) => setShowTags(e.target.checked)} /> citations
        </label>
      </div>
      {tab === "sop" && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs text-muted">
            <span>
              {sop.word_count} {t("words")}
              {sop.word_limit ? ` / ${t("limit")} ${sop.word_limit}` : ""}
            </span>
            <CopyButton text={stripTags(sop.text)} t={t} />
          </div>
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{render(sop.text)}</div>
        </div>
      )}
      {tab === "fit" &&
        fits.map((f) => (
          <div key={f.advisor} className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium">{f.advisor}</span>
              <CopyButton text={stripTags(f.text)} t={t} />
            </div>
            <p className="text-sm leading-relaxed">{render(f.text)}</p>
          </div>
        ))}
      {tab === "emails" &&
        emails.map((e) => (
          <div key={e.advisor} className="mt-3 rounded-xl bg-background p-3">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium">
                → {e.advisor} · {e.subject}
              </span>
              <CopyButton text={`Subject: ${e.subject}\n\n${stripTags(e.body)}`} t={t} />
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{render(e.body)}</p>
          </div>
        ))}
    </div>
  );
}

export function LibraryCard({ items, t }: { items: { id: string; type: string; title: string; summary: string; word_count: number; key_facts: string[] }[]; t: T }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="card">
      <div className="mb-2 text-sm font-semibold">{t("library")}</div>
      <ul className="divide-y divide-line">
        {items.map((i) => (
          <li key={i.id} className="py-2">
            <button className="w-full text-left" onClick={() => setOpen(open === i.id ? null : i.id)}>
              <span className="tag mr-2">{i.type}</span>
              <span className="font-medium">{i.title}</span>
              <span className="ml-2 text-xs text-muted">
                {i.word_count} {t("words")}
              </span>
            </button>
            <p className="text-xs text-muted">{i.summary}</p>
            {open === i.id && (
              <ul className="mt-1 list-disc pl-5 text-xs">
                {i.key_facts.map((f, k) => (
                  <li key={k}>{f}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TodosCard({ todos, t, onToggle }: { todos: { id: string; task: string; program?: string; due?: string | null; done: boolean }[]; t: T; onToggle?: (id: string, done: boolean) => void }) {
  return (
    <div className="card">
      <div className="mb-2 text-sm font-semibold">{t("timeline")}</div>
      {todos.length === 0 && <p className="text-xs text-muted">—</p>}
      <ul className="space-y-1">
        {todos.map((td) => (
          <li key={td.id} className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={td.done} disabled={!onToggle} onChange={(e) => onToggle?.(td.id, e.target.checked)} className="mt-1" />
            <div className={td.done ? "line-through text-muted" : ""}>
              {td.task}
              <div className="text-xs text-muted">
                {td.program ?? ""}
                {td.due ? ` · ${td.due}` : ""}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ConfirmCard({ card, t, onAction }: { card: Card; t: T; onAction: (m: string) => void }) {
  return (
    <div className="card border-brand">
      <div className="text-sm font-semibold">
        {t("confirmRun")} {card.program as string}
      </div>
      <div className="mt-1 text-xs text-muted">{(card.steps as string[]).join(" → ")}</div>
      <p className="mt-1 text-xs text-muted">{card.note as string}</p>
      <div className="mt-3 flex gap-2">
        <button className="btn" onClick={() => onAction(`Yes, run the pipeline for ${card.program} now (confirmed).`)}>
          {t("confirmYes")}
        </button>
        <button className="btn-ghost" onClick={() => onAction("Not now.")}>
          {t("confirmNo")}
        </button>
      </div>
    </div>
  );
}

export type Signal = { id: string; date: string; program: string; advisor?: string | null; kind: string; note?: string; sample?: boolean };
export type Offer = { id: string; program: string; advisor?: string | null; stipend_usd?: number | null; years_guaranteed?: number | null; respond_by?: string | null; note?: string; sample?: boolean };
export type Comparison = { weights: Record<string, number>; ranked: (Offer & { subscores: Record<string, number>; total: number; reasons: string[] })[] };

const KIND_COLOR: Record<string, string> = {
  reply_positive: "text-ok", interview: "text-ok", admit: "text-ok", funding_offer: "text-ok",
  reply_negative: "text-bad", reject: "text-bad", waitlist: "text-warn",
};

export function SignalsCard({ signals, t }: { signals: Signal[]; t: T }) {
  const sorted = [...signals].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between text-sm font-semibold">
        <span>{t("signals")}</span>
        {signals.some((s) => s.sample) && <span className="tag">{t("sample")}</span>}
      </div>
      {sorted.length === 0 && <p className="text-xs text-muted">{t("noSignals")}</p>}
      <ul className="space-y-2">
        {sorted.map((s) => (
          <li key={s.id} className="text-sm">
            <span className="mr-2 font-mono text-xs text-muted">{s.date}</span>
            <span className={`mr-2 text-xs font-medium ${KIND_COLOR[s.kind] ?? "text-muted"}`}>{s.kind.replace(/_/g, " ")}</span>
            <span className="font-medium">{s.advisor ?? s.program}</span>
            {s.advisor && <span className="text-xs text-muted"> · {s.program}</span>}
            {s.note && <div className="text-xs text-muted">{s.note}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function OffersCard({ cmp, t }: { cmp: Comparison; t: T }) {
  const keys = Object.keys(cmp.weights);
  return (
    <div className="card">
      <div className="mb-1 flex items-center justify-between text-sm font-semibold">
        <span>{t("compare")}</span>
        {cmp.ranked.some((o) => o.sample) && <span className="tag">{t("sample")}</span>}
      </div>
      <p className="mb-2 text-xs text-muted">{t("decideNote")}</p>
      {cmp.ranked.length === 0 && <p className="text-xs text-muted">{t("noOffers")}</p>}
      {cmp.ranked.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-1 pr-2">{t("programs")}</th>
                {keys.map((k) => (
                  <th key={k} className="py-1 pr-2">
                    {k.replace(/_/g, " ")} <span className="font-normal">×{cmp.weights[k]}</span>
                  </th>
                ))}
                <th className="py-1">{t("total")}</th>
              </tr>
            </thead>
            <tbody>
              {cmp.ranked.map((o, i) => (
                <tr key={o.id} className="border-t border-line align-top">
                  <td className="py-2 pr-2">
                    <div className="font-medium">
                      {i === 0 ? "① " : i === 1 ? "② " : `${i + 1}. `}
                      {o.program}
                    </div>
                    <div className="text-muted">
                      {o.advisor ?? "—"} · {t("stipend")} ${(o.stipend_usd ?? 0).toLocaleString()} · {o.years_guaranteed ?? 0} {t("years")}
                      {o.respond_by ? ` · ${t("respondBy")} ${o.respond_by}` : ""}
                    </div>
                    {o.note && <div className="text-muted">{o.note}</div>}
                  </td>
                  {keys.map((k) => (
                    <td key={k} className="py-2 pr-2">
                      <div className="h-2 w-16 rounded bg-background">
                        <div className="h-2 rounded bg-brand" style={{ width: `${Math.round(o.subscores[k] * 100)}%` }} />
                      </div>
                      <div className="text-muted">{o.subscores[k].toFixed(2)}</div>
                    </td>
                  ))}
                  <td className="py-2 font-semibold">{o.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

type RecItem = { institution: string; department_guess?: string; papers?: number; reason: string; evidence_url?: string; tier: string };
export function RecommendationsCard({ card, t, onAction }: { card: Card; t: T; onAction: (m: string) => void }) {
  const tiers = (card.tiers as Record<string, RecItem[]>) ?? {};
  const existing = new Set((card.existing as string[]) ?? []);
  const label: Record<string, string> = { reach: t("reach"), match: t("match"), safety: t("safety") };
  return (
    <div className="card">
      <div className="mb-1 text-sm font-semibold">{t("recommendations")}</div>
      {typeof card.positioning === "string" && <p className="mb-2 text-sm">{card.positioning}</p>}
      <p className="mb-2 text-xs text-muted">
        OpenAlex · {(card.queries as string[])?.join(" / ")} · {card.caveat as string}
      </p>
      {(["reach", "match", "safety"] as const).map((k) => (
        <div key={k} className="mt-2">
          <div className="text-xs font-medium text-muted">{label[k]}</div>
          <ul className="divide-y divide-line">
            {(tiers[k] ?? []).map((it) => (
              <li key={it.institution} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{it.institution}</span>
                  <span className="text-xs text-muted"> · {it.department_guess}</span>
                  {it.evidence_url && (
                    <a className="ml-2 text-xs text-brand underline" href={it.evidence_url} target="_blank" rel="noreferrer">
                      {it.papers} {t("papersShort")}
                    </a>
                  )}
                  <div className="text-xs text-muted">{it.reason}</div>
                </div>
                {existing.has(it.institution) ? (
                  <span className="text-xs text-ok">✓ {t("inList")}</span>
                ) : (
                  <button className="chip" onClick={() => onAction(`Add ${it.institution} (${it.department_guess ?? "Computer Science"}) PhD to my programs`)}>
                    + {t("addProgram")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
