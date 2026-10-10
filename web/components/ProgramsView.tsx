"use client";

import { useState } from "react";
import { Icon } from "@/components/Icons";
import type { Key } from "@/lib/i18n";
import { ProgramMap } from "./ProgramMap";
import { Logo, RankChips, RequirementsCard } from "./Cards";

type T = (k: Key) => string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type State = any;

function statusOf(p: State) {
  if (p.final?.passed) return "complete";
  if (p.final) return "needs_review";
  if (p.requirements) return "researched";
  return "not_started";
}

/** Programs page: the same programs as a list, as place cards, or on a map. */
export function ProgramsView({ state, t, onAction }: { state: State; t: T; onAction: (m: string) => void }) {
  const [mode, setMode] = useState<"list" | "cards" | "map">("cards");
  const [selected, setSelected] = useState<string | undefined>();
  const places = state.places ?? {};
  const items = state.programs.map((p: State) => ({
    name: p.name,
    short: p.short,
    deadline: p.requirements?.facts?.find((f: State) => f.key === "deadline")?.value?.split(/[,(]/)[0]?.trim(),
    advisors: p.advisors?.advisors?.length ?? 0,
    facts: p.requirements?.facts?.length ?? 0,
    status: statusOf(p),
    place: places[p.name],
    ranking: (state.rankings ?? {})[p.institution],
    institution: p.institution,
    requirements: p.requirements,
  }));
  const modes = [
    ["list", t("viewList")],
    ["cards", t("viewCards")],
    ["map", t("viewMap")],
  ] as const;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-full border border-line bg-surface p-1">
          {modes.map(([k, label]) => (
            <button key={k} className={`rounded-full px-3 py-1 text-sm ${mode === k ? "bg-brand text-white" : "text-muted hover:text-foreground"}`} onClick={() => setMode(k)}>
              {label}
            </button>
          ))}
        </div>
        <button className="chip" onClick={() => onAction(t("quick5"))}>
          <Icon.compass size={14} className="text-brand" /> {t("quick5")}
        </button>
      </div>

      {mode === "map" && (
        <>
          <ProgramMap items={items} selected={selected} onSelect={setSelected} />
          <div className="grid gap-3 md:grid-cols-3">
            {items.map((it: State) => (
              <PlaceCard key={it.name} it={it} t={t} active={selected === it.name} onClick={() => setSelected(it.name)} compact />
            ))}
          </div>
        </>
      )}

      {mode === "cards" && (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((it: State) => (
            <PlaceCard key={it.name} it={it} t={t} active={false} onClick={() => { setSelected(it.name); setMode("map"); }} />
          ))}
        </div>
      )}

      {mode === "list" &&
        items.map((it: State) => it.requirements && <RequirementsCard key={it.name} card={{ kind: "requirements", program: it.name, ...it.requirements }} t={t} />)}
      {mode === "list" && items.every((it: State) => !it.requirements) && <p className="text-sm text-muted">{t("nothingYet")}</p>}
    </>
  );
}

function PlaceCard({ it, t, active, onClick, compact }: { it: State; t: T; active: boolean; onClick: () => void; compact?: boolean }) {
  const p = it.place;
  const c = p?.climate;
  const statusColor = it.status === "complete" ? "text-ok" : it.status === "needs_review" ? "text-warn" : "text-muted";
  return (
    <button onClick={onClick} className={`card text-left transition hover:border-brand ${active ? "border-brand" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <Logo src={p?.logo} name={it.institution} size={36} />
          <div>
            <div className="font-semibold">{it.name}</div>
            <div className="text-xs text-muted">
              {p ? `${p.city}, ${p.region}` : "—"} · {it.deadline ? `${t("deadline")} ${it.deadline}` : ""}
            </div>
            <div className="mt-1"><RankChips r={it.ranking} compact={compact} /></div>
          </div>
        </div>
        <span className={`text-xs font-medium ${statusColor}`}>{t(`status_${it.status}` as Key)}</span>
      </div>
      {c && (
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Mini label={t("janLow")} value={`${c.jan_low_c}°C`} />
          <Mini label={t("julHigh")} value={`${c.jul_high_c}°C`} />
          <Mini label={t("rainDays")} value={`${c.rain_days}`} />
        </div>
      )}
      {p?.living && !compact && (
        <div className="mt-3 space-y-1 text-sm">
          <div>
            <span className="tag mr-2">{t("costOfLiving")}</span>
            {p.living.cost_of_living} · {p.living.rent_note}
          </div>
          <div className="text-muted">{p.living.city_feel}</div>
          <div className="text-muted">{p.living.international_note}</div>
          <div className="text-xs text-muted">
            {p.living.caveat}{" "}
            <a className="text-brand underline" href={p.verify_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
              {t("verify")}
            </a>
            {c && <span> · {t("climateSource")}: Open-Meteo {c.year}</span>}
          </div>
        </div>
      )}
      <div className="mt-3 text-xs text-muted">
        {it.facts} {t("facts")} · {it.advisors} {t("advisors").toLowerCase()}
      </div>
    </button>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background px-2 py-2">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}
