"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icons";
import { Logo } from "@/components/Cards";
import { ProfessorAvatar } from "@/components/ProfessorAvatar";
import { API, APPLICANT } from "@/lib/api";
import type { Key, Lang } from "@/lib/i18n";

type Q = { id: string; stage: string; question: string; why: string; strong_answer_includes: string[] };
type Plan = { advisor: string; program: string; questions: Q[]; stages: string[]; caveat: string; answers: Eval[] };
type Eval = { question_id: string; answer: string; scores: { fit: number; depth: number; clarity: number }; feedback: string; follow_up: string; impression_delta?: number; impression_note?: string; good?: string[]; improve?: string[]; model_answer_hint?: string };
type Phase = "idle" | "speaking" | "listening" | "thinking";
type Line = { role: "ai" | "you"; text: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type State = any;

const SILENCE_MS = 1800; // stop listening this long after the last recognised words
const MAX_ANSWER_MS = 90_000;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * Immersive voice mock interview. The professor's stand-in (the HiOffer robot) asks out loud, listens,
 * scores, follows up, and moves on by itself; the applicant only talks. Typing is always available.
 * Voice is the browser's own (speechSynthesis + SpeechRecognition in Chrome): no audio leaves the machine.
 */
export function Interview({ state, lang, t }: { state: State; lang: Lang; t: (k: Key) => string }) {
  const programs: State[] = state?.programs ?? [];
  const [program, setProgram] = useState<string>(programs[0]?.name ?? "");
  const advisors: State[] = programs.find((p: State) => p.name === program)?.advisors?.advisors ?? [];
  const [advisor, setAdvisor] = useState<string>(advisors[0]?.name ?? "");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [caption, setCaption] = useState("");
  const [answer, setAnswer] = useState("");
  const [typed, setTyped] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [evals, setEvals] = useState<Eval[]>([]);
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [showLog, setShowLog] = useState(false);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const lastWordsAt = useRef(0);
  const answerRef = useRef("");
  const audioCtx = useRef<AudioContext | null>(null);
  const levelTimer = useRef<number | null>(null);
  const silenceTimer = useRef<number | null>(null);
  const idxRef = useRef(0);
  const planRef = useRef<Plan | null>(null);
  const L = lang === "zh";
  const canListen = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  useEffect(() => {
    if (!advisors.find((a: State) => a.name === advisor)) setAdvisor(advisors[0]?.name ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program]);
  useEffect(() => {
    if (!plan || finished) return;
    const h = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(h);
  }, [plan, finished]);
  useEffect(() => () => stopAll(), []); // eslint-disable-line react-hooks/exhaustive-deps

  function stopAll() {
    try { window.speechSynthesis?.cancel(); } catch {}
    try { recRef.current?.stop(); } catch {}
    if (silenceTimer.current) window.clearTimeout(silenceTimer.current);
    if (levelTimer.current) window.clearInterval(levelTimer.current);
    audioCtx.current?.close().catch(() => {});
    audioCtx.current = null;
  }

  const say = useCallback((text: string, then?: () => void) => {
    setCaption(text);
    setLines((l) => [...l, { role: "ai", text }]);
    if (typeof window === "undefined" || !("speechSynthesis" in window)) { then?.(); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US"; u.rate = 0.97;
    const voices = window.speechSynthesis.getVoices();
    u.voice = voices.find((x) => /en-US/.test(x.lang) && /Samantha|Google US English|Aria|Jenny/.test(x.name)) ?? voices.find((x) => /en-US/.test(x.lang)) ?? null;
    u.onstart = () => setPhase("speaking");
    u.onend = () => { setPhase("idle"); then?.(); };
    u.onerror = () => { setPhase("idle"); then?.(); };
    window.speechSynthesis.speak(u);
  }, []);

  async function start() {
    setError(null); setLoading(true);
    const r = await fetch(`${API}/api/applicants/${APPLICANT}/interview/plan`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ program, advisor }) });
    setLoading(false);
    if (!r.ok) { setError(`HTTP ${r.status}`); return; }
    const p: Plan = await r.json();
    const prior = p.questions.map((qq) => [...(p.answers ?? [])].reverse().find((a) => a.question_id === qq.id)).filter(Boolean) as Eval[];
    setPlan(p); planRef.current = p; setEvals(prior); setLines([]); setElapsed(0); setFinished(false);
    setIdx(0); idxRef.current = 0;
    const surname = p.advisor.split(" ").pop();
    const intro = `Hello, and thank you for your interest in our group. I am standing in for Professor ${surname} today. ${p.questions.length} questions, about ten minutes. Take your time; I will wait for a pause.`;
    say(intro, () => ask(0));
  }

  function ask(i: number) {
    const p = planRef.current; if (!p) return;
    setIdx(i); idxRef.current = i;
    setAnswer(""); answerRef.current = ""; setTyped("");
    say(p.questions[i].question, () => listen());
  }

  async function startMeter() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext(); audioCtx.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser(); an.fftSize = 512; src.connect(an);
      const buf = new Uint8Array(an.fftSize);
      levelTimer.current = window.setInterval(() => {
        an.getByteTimeDomainData(buf);
        let s = 0; for (let k = 0; k < buf.length; k++) { const v = (buf[k] - 128) / 128; s += v * v; }
        setLevel(Math.min(1, Math.sqrt(s / buf.length) * 6));
      }, 80);
    } catch { /* no meter without mic permission; recognition may still work */ }
  }

  function listen() {
    if (!canListen) { setPhase("listening"); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR(); rec.lang = "en-US"; rec.interimResults = true; rec.continuous = true;
    let final = "";
    const startedAt = Date.now(); lastWordsAt.current = 0;
    rec.onresult = (e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) { const res = e.results[i]; if (res.isFinal) final += res[0].transcript + " "; else interim += res[0].transcript; }
      const text = (final + interim).trim();
      answerRef.current = text; setAnswer(text); lastWordsAt.current = Date.now();
      if (silenceTimer.current) window.clearTimeout(silenceTimer.current);
      silenceTimer.current = window.setTimeout(() => { if (answerRef.current.trim().length > 12) done(); }, SILENCE_MS);
    };
    rec.onend = () => { if (phaseRef.current === "listening" && Date.now() - startedAt < MAX_ANSWER_MS && !answerRef.current) { try { rec.start(); } catch {} } };
    rec.onerror = () => {};
    rec.start(); recRef.current = rec;
    setPhase("listening"); startMeter();
    window.setTimeout(() => { if (phaseRef.current === "listening" && recRef.current === rec) done(); }, MAX_ANSWER_MS);
  }
  const phaseRef = useRef<Phase>("idle"); phaseRef.current = phase;

  function interrupt() { try { window.speechSynthesis.cancel(); } catch {} setPhase("idle"); listen(); }

  async function done() {
    const p = planRef.current; if (!p) return;
    try { recRef.current?.stop(); } catch {}
    if (levelTimer.current) window.clearInterval(levelTimer.current);
    audioCtx.current?.close().catch(() => {}); audioCtx.current = null; setLevel(0);
    const text = (answerRef.current || typed).trim();
    if (!text) { setPhase("idle"); return; }
    setLines((l) => [...l, { role: "you", text }]);
    setPhase("thinking"); setCaption(L ? "…" : "…");
    const q = p.questions[idxRef.current];
    const r = await fetch(`${API}/api/applicants/${APPLICANT}/interview/answer`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ program, advisor, question_id: q.id, answer: text }) });
    if (!r.ok) { setPhase("idle"); setError(r.status === 429 ? t("limitReached") : `HTTP ${r.status}`); return; }
    const ev: Eval = await r.json();
    setEvals((x) => [...x, ev]);
    const next = idxRef.current + 1;
    say(ev.feedback, () => {
      if (next < p.questions.length) say((L ? "Next. " : "Next. ") + p.questions[next].question, () => { setIdx(next); idxRef.current = next; setAnswer(""); answerRef.current = ""; setTyped(""); listen(); });
      else { setFinished(true); say(L ? "That is the end. Here is your report." : "That is the end. Here is your report."); }
    });
  }

  function skip() { const n = idxRef.current + 1; if (planRef.current && n < planRef.current.questions.length) { try { recRef.current?.stop(); } catch {} ask(n); } else { setFinished(true); } }
  function endNow() { stopAll(); setFinished(true); setPhase("idle"); }

  const q = plan?.questions[idx];
  const avg = (k: "fit" | "depth" | "clarity") => (evals.length ? (evals.reduce((s, e) => s + e.scores[k], 0) / evals.length).toFixed(1) : "–");

  // ── setup ──
  if (!plan) {
    return (
      <div className="card flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <div className="text-xs text-muted">{t("programs")}</div>
          <select className="mt-1 rounded-xl border border-line px-3 py-2" value={program} onChange={(e) => setProgram(e.target.value)}>
            {programs.map((p: State) => (<option key={p.key} value={p.name}>{p.name}</option>))}
          </select>
        </label>
        <label className="text-sm">
          <div className="text-xs text-muted">{t("advisors")}</div>
          <select className="mt-1 rounded-xl border border-line px-3 py-2" value={advisor} onChange={(e) => setAdvisor(e.target.value)}>
            {advisors.map((a: State) => (<option key={a.name} value={a.name}>{a.name}</option>))}
          </select>
        </label>
        <button className="btn" onClick={start} disabled={!advisor || loading}>{loading ? t("thinking") : t("startInterview")}</button>
        <span className="text-xs text-muted">{canListen ? t("voiceHint") : t("voiceChromeOnly")}</span>
        {error && <span className="text-xs text-bad">{error}</span>}
      </div>
    );
  }

  // ── report ──
  if (finished) {
    return (
      <div className="space-y-4">
        <div className="card">
          <div className="text-xs text-muted">{plan.program} · {plan.advisor} · {fmt(elapsed)}</div>
          <div className="mt-1 text-xl font-semibold">{t("reportTitle")}</div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {(["fit", "depth", "clarity"] as const).map((k) => (<div key={k} className="stat"><div className="label">{k}</div><div className="value text-brand-ink">{avg(k)}</div></div>))}
          </div>
        </div>
        {plan.questions.map((qq) => { const e = evals.find((x) => x.question_id === qq.id); return (
          <div key={qq.id} className="card">
            <div className="text-xs text-muted">{qq.stage.replace(/_/g, " ")}</div>
            <div className="font-medium">{qq.question}</div>
            {e ? (<><p className="mt-2 text-sm text-muted">{e.answer}</p><p className="mt-2 text-sm">{e.feedback}</p><p className="mt-1 text-xs text-muted">fit {e.scores.fit} · depth {e.scores.depth} · clarity {e.scores.clarity}</p></>) : <p className="mt-2 text-xs text-muted">{t("skipped")}</p>}
            <ul className="mt-2 list-disc pl-5 text-xs text-muted">{qq.strong_answer_includes.map((s) => <li key={s}>{s}</li>)}</ul>
          </div>); })}
        <button className="btn-ghost" onClick={() => { setPlan(null); setFinished(false); }}>{t("practiceAgain")}</button>
      </div>
    );
  }

  // ── stage ──
  const stageIdx = plan.stages.indexOf(q!.stage);
  const impression = evals.reduce((v, e) => Math.max(0, Math.min(100, v + (e.impression_delta ?? 0) * 10)), 50);
  const latest = evals[evals.length - 1];
  return (
    <div className="grid gap-6 md:grid-cols-[1.15fr_0.85fr]">
    <div className="flex min-h-[70vh] flex-col items-center">
      <div className="flex w-full max-w-3xl items-center justify-between text-xs text-muted">
        <div className="flex gap-1">
          {plan.stages.map((s, i) => (<span key={s} className={`h-1.5 w-10 rounded-full ${i < stageIdx ? "bg-brand" : i === stageIdx ? "bg-brand/60" : "bg-line"}`} title={s} />))}
        </div>
        <span>{plan.advisor} · {idx + 1}/{plan.questions.length} · {q!.stage.replace(/_/g, " ")} · {fmt(elapsed)}</span>
      </div>

      <div className="relative mt-8 flex flex-col items-center">
        <div className={`absolute inset-0 rounded-full blur-2xl transition ${phase === "speaking" ? "bg-brand/30 animate-pulse" : phase === "listening" ? "bg-ok/25" : "bg-brand-soft"}`} style={{ transform: `scale(${1 + (phase === "listening" ? level * 0.8 : 0)})` }} />
        <div className={`relative rounded-full bg-surface p-2 ${phase === "speaking" ? "ring-8 ring-brand/30" : phase === "listening" ? "ring-8 ring-ok/30" : "ring-4 ring-line"}`}>
          <ProfessorAvatar size={190} talking={phase === "speaking"} />
        </div>
        <div className="relative mt-3 flex items-center gap-2 text-sm">
          <Logo src={state?.places?.[plan.program]?.logo} name={plan.program} size={22} />
          <span className="font-medium">{plan.advisor}</span>
          <span className="text-muted">· {plan.program}</span>
        </div>
      </div>

      <div className="mt-6 flex h-6 items-center gap-2 text-sm text-muted">
        {phase === "speaking" && <><Icon.spark size={16} className="text-brand" /> {t("speaking")}</>}
        {phase === "listening" && (<><span className="flex items-end gap-0.5">{Array.from({ length: 9 }, (_, i) => (<i key={i} className="w-1 rounded bg-ok" style={{ height: 4 + Math.max(0, level * 28 - Math.abs(i - 4) * 3) }} />))}</span> {t("listening")}</>)}
        {phase === "thinking" && <>{t("thinking")}</>}
      </div>

      <div className="mt-4 w-full max-w-2xl rounded-2xl bg-surface px-5 py-4 text-center text-lg leading-snug shadow-sm">{caption}</div>
      {q && phase !== "speaking" && <p className="mt-2 max-w-2xl text-center text-xs text-muted">{q.why}</p>}

      {answer && <div className="mt-3 w-full max-w-2xl rounded-2xl border border-line px-4 py-3 text-sm text-muted">{answer}</div>}

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {phase === "speaking" && <button className="btn-ghost" onClick={interrupt}>{t("interrupt")}</button>}
        {phase === "listening" && <button className="btn" onClick={done}>{t("imDone")}</button>}
        {phase === "idle" && <button className="btn" onClick={listen}>{t("speakAnswer")}</button>}
        <button className="btn-ghost" onClick={skip}>{t("skipQuestion")}</button>
        <button className="btn-ghost" onClick={endNow}>{t("endInterview")}</button>
      </div>

      <details className="mt-4 w-full max-w-2xl text-sm">
        <summary className="cursor-pointer text-xs text-muted">{t("typeInstead")}</summary>
        <div className="mt-2 flex gap-2">
          <input className="flex-1 rounded-xl border border-line px-3 py-2" value={typed} onChange={(e) => { setTyped(e.target.value); answerRef.current = e.target.value; }} placeholder={t("typeAnswer")} />
          <button className="btn" onClick={done} disabled={!typed.trim() || phase === "thinking"}>{t("getFeedback")}</button>
        </div>
      </details>

      <button className="mt-6 text-xs text-muted hover:text-brand" onClick={() => setShowLog((s) => !s)}>{showLog ? t("hideTranscript") : t("showTranscript")}</button>
      {showLog && (
        <div className="mt-2 w-full max-w-2xl space-y-1 text-sm">
          {lines.map((l, i) => (<div key={i} className={l.role === "ai" ? "text-foreground" : "text-muted"}><span className="mr-2 text-xs uppercase text-muted">{l.role === "ai" ? plan.advisor.split(" ").pop() : "you"}</span>{l.text}</div>))}
        </div>
      )}
      {error && <p className="mt-3 text-xs text-bad">{error}</p>}
      <p className="mt-6 text-xs text-muted">{plan.caveat}</p>
    </div>

    {/* coaching column: the interviewer's impression so far, then an analysis card per answer */}
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{t("impression")}</span>
          <span>{evals.length}/{plan.questions.length} {t("answered")}</span>
        </div>
        <div className="mt-2 flex items-end gap-3">
          <div className="text-4xl font-semibold tracking-tight" style={{ color: impression >= 60 ? "var(--ok)" : impression < 40 ? "var(--bad)" : "var(--brand-ink)" }}>{impression}</div>
          {latest?.impression_delta != null && (
            <div className={`mb-1 text-sm font-medium ${latest.impression_delta > 0 ? "text-ok" : latest.impression_delta < 0 ? "text-bad" : "text-muted"}`}>
              {latest.impression_delta > 0 ? "+" : ""}{latest.impression_delta * 10} <span className="font-normal text-muted">· {latest.impression_note}</span>
            </div>
          )}
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-background">
          <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${impression}%`, background: impression >= 60 ? "var(--ok)" : impression < 40 ? "var(--bad)" : "var(--brand)" }} />
        </div>
        {evals.length > 0 && <ImpressionChart evals={evals} total={plan.questions.length} questions={plan.questions} />}
      </div>

      {latest ? (
        <div className="card border-brand/40">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>{t("analysis")} · Q{plan.questions.findIndex((x) => x.id === latest.question_id) + 1}</span>
            <span>fit {latest.scores.fit} · depth {latest.scores.depth} · clarity {latest.scores.clarity}</span>
          </div>
          {latest.good?.length ? (<div className="mt-3"><div className="text-xs font-semibold text-ok">{t("whatWorked")}</div><ul className="mt-1 list-disc pl-5 text-sm">{latest.good.map((g) => <li key={g}>{g}</li>)}</ul></div>) : null}
          {latest.improve?.length ? (<div className="mt-3"><div className="text-xs font-semibold text-warn">{t("whatToImprove")}</div><ul className="mt-1 list-disc pl-5 text-sm">{latest.improve.map((g) => <li key={g}>{g}</li>)}</ul></div>) : null}
          {latest.model_answer_hint && <p className="mt-3 rounded-xl bg-background p-3 text-sm"><span className="text-xs font-semibold text-muted">{t("strongerVersion")} · </span>{latest.model_answer_hint}</p>}
          {!latest.good && <p className="mt-2 text-sm">{latest.feedback}</p>}
          <p className="mt-3 text-sm"><span className="text-xs font-semibold text-muted">{t("followUp")} · </span>{latest.follow_up}</p>
        </div>
      ) : (
        <div className="card text-sm text-muted">{t("analysisEmpty")}</div>
      )}

      {evals.length > 1 && (
        <details className="card text-sm">
          <summary className="cursor-pointer text-xs text-muted">{t("earlierAnswers")} ({evals.length - 1})</summary>
          <div className="mt-2 space-y-3">
            {evals.slice(0, -1).reverse().map((e, i) => (
              <div key={i} className="border-t border-line pt-2">
                <div className="text-xs text-muted">Q{plan.questions.findIndex((x) => x.id === e.question_id) + 1} · fit {e.scores.fit} · depth {e.scores.depth} · clarity {e.scores.clarity}{e.impression_delta != null ? ` · ${e.impression_delta > 0 ? "+" : ""}${e.impression_delta * 10}` : ""}</div>
                {e.improve?.length ? <ul className="mt-1 list-disc pl-5 text-xs">{e.improve.map((g) => <li key={g}>{g}</li>)}</ul> : <p className="mt-1 text-xs">{e.feedback}</p>}
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="card">
        <div className="text-xs font-semibold text-muted">{t("strongAnswer")}</div>
        <ul className="mt-1 list-disc pl-5 text-sm">{q!.strong_answer_includes.map((x) => <li key={x}>{x}</li>)}</ul>
      </div>
    </div>
    </div>
  );
}


/** Impression over the interview: 50 is neutral; each answer moves it by its delta. Green up, red down. */
function ImpressionChart({ evals, total, questions }: { evals: Eval[]; total: number; questions: Q[] }) {
  const W = 320, H = 120, padX = 18, padT = 16, padB = 22;
  const pts: { x: number; y: number; v: number; d: number; label: string; note?: string }[] = [];
  let v = 50;
  const x = (i: number) => padX + (i * (W - 2 * padX)) / Math.max(total, 1);
  const y = (val: number) => padT + (100 - val) * ((H - padT - padB) / 100);
  pts.push({ x: x(0), y: y(50), v: 50, d: 0, label: "" });
  evals.forEach((e, i) => {
    const d = (e.impression_delta ?? 0) * 10;
    v = Math.max(0, Math.min(100, v + d));
    pts.push({ x: x(i + 1), y: y(v), v, d, label: `Q${questions.findIndex((q) => q.id === e.question_id) + 1}`, note: e.impression_note });
  });
  return (
    <div className="mt-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <line x1={padX} x2={W - padX} y1={y(50)} y2={y(50)} stroke="var(--line)" strokeDasharray="3 3" />
        {pts.slice(1).map((pt, i) => {
          const prev = pts[i];
          return <line key={i} x1={prev.x} y1={prev.y} x2={pt.x} y2={pt.y} stroke={pt.d > 0 ? "var(--ok)" : pt.d < 0 ? "var(--bad)" : "var(--muted)"} strokeWidth="2.5" strokeLinecap="round" />;
        })}
        {pts.slice(1).map((pt, i) => (
          <g key={i}>
            <circle cx={pt.x} cy={pt.y} r="4.5" fill={pt.d > 0 ? "var(--ok)" : pt.d < 0 ? "var(--bad)" : "var(--muted)"} />
            <text x={pt.x} y={pt.y - 9} textAnchor="middle" fontSize="10" fontWeight="600" fill={pt.d > 0 ? "var(--ok)" : pt.d < 0 ? "var(--bad)" : "var(--muted)"}>{pt.d > 0 ? `+${pt.d}` : pt.d}</text>
            <text x={pt.x} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--muted)">{pt.label}</text>
          </g>
        ))}
        <circle cx={pts[0].x} cy={pts[0].y} r="3" fill="var(--muted)" />
      </svg>
      <div className="mt-1 flex flex-wrap gap-1">
        {pts.slice(1).map((pt, i) => (
          <span key={i} title={pt.note} className={`rounded-md px-1.5 py-0.5 text-[11px] ${pt.d > 0 ? "bg-ok-soft text-ok" : pt.d < 0 ? "bg-bad-soft text-bad" : "bg-background text-muted"}`}>
            {pt.label} {pt.d > 0 ? `+${pt.d}` : pt.d}
          </span>
        ))}
      </div>
    </div>
  );
}
