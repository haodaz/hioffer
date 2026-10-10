"use client";

import { useState } from "react";
import type { Key } from "@/lib/i18n";
import { upsertTodo } from "@/lib/api";
import { AdvisorCard, LibraryCard, MaterialsCard, ProgramsCard, RequirementsCard, TodosCard } from "./Cards";

type T = (k: Key) => string;
export type Tab = "programs" | "advisors" | "materials" | "timeline";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type State = any;

export function Panels({ state, tab, setTab, t, onAction, refresh }: { state: State; tab: Tab; setTab: (t: Tab) => void; t: T; onAction: (m: string) => void; refresh: () => void }) {
  const tabs: Tab[] = ["programs", "advisors", "materials", "timeline"];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex gap-2">
        {tabs.map((k) => (
          <button key={k} className={`chip ${tab === k ? "border-brand text-brand" : ""}`} onClick={() => setTab(k)}>
            {t(k)}
          </button>
        ))}
      </div>
      <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {!state && <p className="text-sm text-muted">…</p>}
        {state && tab === "programs" && <ProgramsPanel state={state} t={t} />}
        {state && tab === "advisors" && <AdvisorsPanel state={state} t={t} onAction={onAction} />}
        {state && tab === "materials" && <MaterialsPanel state={state} t={t} />}
        {state && tab === "timeline" && <TimelinePanel state={state} t={t} refresh={refresh} />}
      </div>
    </div>
  );
}

function statusOf(p: State) {
  if (p.final?.passed) return "complete";
  if (p.final) return "needs_review";
  if (p.requirements) return "researched";
  return "not_started";
}

function ProgramsPanel({ state, t }: { state: State; t: T }) {
  const rows = state.programs.map((p: State) => ({
    name: p.name,
    deadline: p.requirements?.facts?.find((f: State) => f.key === "deadline")?.value,
    advisors: p.advisors?.advisors?.length ?? 0,
    facts: p.requirements?.facts?.length ?? 0,
    status: statusOf(p),
  }));
  return (
    <>
      <ProgramsCard rows={rows} t={t} />
      {state.programs.map((p: State) => p.requirements && <RequirementsCard key={p.key} card={{ kind: "requirements", program: p.name, ...p.requirements }} t={t} />)}
    </>
  );
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
        todos={state.todos}
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
