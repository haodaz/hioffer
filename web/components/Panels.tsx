"use client";

import { useState } from "react";
import type { Key } from "@/lib/i18n";
import { addSignal, upsertTodo } from "@/lib/api";
import { AdvisorCard, LibraryCard, MaterialsCard, OffersCard, SignalsCard, TodosCard } from "./Cards";
import { Interview } from "./Interview";
import { ProgramsView } from "./ProgramsView";

type T = (k: Key) => string;
export type Tab = "programs" | "advisors" | "materials" | "timeline" | "signals" | "offers" | "interview";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type State = any;

export function PanelContent({ state, tab, t, onAction, refresh, lang }: { state: State; tab: Tab; t: T; onAction: (m: string) => void; refresh: () => void; lang?: "en" | "zh" }) {
  switch (tab) {
    case "programs":
      return <ProgramsView state={state} t={t} onAction={onAction} />;
    case "interview":
      return <Interview state={state} lang={lang ?? "en"} t={t} />;
    case "advisors":
      return <AdvisorsPanel state={state} t={t} onAction={onAction} />;
    case "materials":
      return <MaterialsPanel state={state} t={t} />;
    case "timeline":
      return <TimelinePanel state={state} t={t} refresh={refresh} />;
    case "signals":
      return <SignalsPanel state={state} t={t} refresh={refresh} />;
    case "offers":
      return <OffersCard cmp={state.comparison} t={t} />;
  }
}


function AdvisorsPanel({ state, t, onAction }: { state: State; t: T; onAction: (m: string) => void }) {
  return (
    <>
      {state.programs.map((p: State) => (
        <div key={p.key}>
          <div className="mb-2 text-sm font-semibold">{p.name}</div>
          {!p.advisors?.advisors?.length && <p className="text-xs text-muted">{t("nothingYet")}</p>}
          <div className="space-y-3">
            {(p.advisors?.advisors ?? []).map((a: State) => (
              <AdvisorCard key={a.name} a={a} t={t} onAction={onAction} />
            ))}
          </div>
          {p.advisors?.skipped?.length > 0 && (
            <p className="mt-2 text-xs text-muted">
              {t("skipped")}: {p.advisors.skipped.map((s: State) => s.name).join(", ")}
            </p>
          )}
        </div>
      ))}
    </>
  );
}

function MaterialsPanel({ state, t }: { state: State; t: T }) {
  return (
    <>
      <LibraryCard items={state.library} t={t} />
      {state.programs.map((p: State) =>
        p.materials ? (
          <MaterialsCard key={p.key} card={{ kind: "materials", program: p.name, version: p.final?.materials_version ?? 0, verification: p.verification ?? {}, ...p.materials }} t={t} />
        ) : (
          <div key={p.key} className="card text-xs text-muted">
            {p.name}: {t("nothingYet")}
          </div>
        ),
      )}
    </>
  );
}

function TimelinePanel({ state, t, refresh }: { state: State; t: T; refresh: () => void }) {
  const [task, setTask] = useState("");
  const [due, setDue] = useState("");
  const deadlines = state.programs
    .map((p: State) => ({ name: p.name, d: p.requirements?.facts?.find((f: State) => f.key === "deadline")?.value }))
    .filter((x: State) => x.d);
  return (
    <>
      <div className="card">
        <div className="mb-2 text-sm font-semibold">{t("deadline")}</div>
        <ul className="text-sm">
          {deadlines.map((x: State) => (
            <li key={x.name}>
              <span className="font-medium">{x.name}</span>: {x.d}
            </li>
          ))}
        </ul>
      </div>
      <TodosCard
        todos={[...state.todos].sort((a: State, b: State) => (a.due ?? "9999").localeCompare(b.due ?? "9999"))}
        t={t}
        onToggle={async (id, done) => {
          await upsertTodo({ id, done });
          refresh();
        }}
      />
      <form
        className="card flex flex-wrap gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!task.trim()) return;
          await upsertTodo({ task, due: due || null });
          setTask("");
          setDue("");
          refresh();
        }}
      >
        <input className="flex-1 rounded-xl border border-line px-3 py-2 text-sm" placeholder={t("addTodo")} value={task} onChange={(e) => setTask(e.target.value)} />
        <input type="date" className="rounded-xl border border-line px-3 py-2 text-sm" value={due} onChange={(e) => setDue(e.target.value)} />
        <button className="btn">{t("addTodo")}</button>
      </form>
    </>
  );
}

const KINDS = ["email_sent", "reply_positive", "reply_neutral", "reply_negative", "interview", "waitlist", "admit", "reject", "funding_offer"];

function SignalsPanel({ state, t, refresh }: { state: State; t: T; refresh: () => void }) {
  const [program, setProgram] = useState<string>(state.programs[0]?.name ?? "");
  const [advisor, setAdvisor] = useState("");
  const [kind, setKind] = useState("email_sent");
  const [note, setNote] = useState("");
  return (
    <>
      <SignalsCard signals={state.signals} t={t} />
      <form
        className="card grid gap-2 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          await addSignal({ program, advisor: advisor || null, kind, note });
          setNote("");
          refresh();
        }}
      >
        <select className="rounded-xl border border-line px-3 py-2 text-sm" value={program} onChange={(e) => setProgram(e.target.value)}>
          {state.programs.map((p: State) => (
            <option key={p.key} value={p.name}>
              {p.short ?? p.name}
            </option>
          ))}
        </select>
        <select className="rounded-xl border border-line px-3 py-2 text-sm" value={kind} onChange={(e) => setKind(e.target.value)}>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <input className="rounded-xl border border-line px-3 py-2 text-sm" placeholder={t("advisors")} value={advisor} onChange={(e) => setAdvisor(e.target.value)} />
        <input className="rounded-xl border border-line px-3 py-2 text-sm" placeholder="note" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn sm:col-span-2">{t("logSignal")}</button>
      </form>
    </>
  );
}
