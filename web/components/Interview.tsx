"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icons";
import { API, APPLICANT } from "@/lib/api";
import type { Key, Lang } from "@/lib/i18n";

type Q = { id: string; stage: string; question: string; why: string; strong_answer_includes: string[] };
type Plan = { advisor: string; program: string; questions: Q[]; stages: string[]; caveat: string; answers: Eval[] };
type Eval = { question_id: string; answer: string; scores: { fit: number; depth: number; clarity: number }; feedback: string; follow_up: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type State = any;

/** Voice mock interview. Browser speech synthesis asks; browser speech recognition (Chrome) listens; typing always works. */
export function Interview({ state, lang, t }: { state: State; lang: Lang; t: (k: Key) => string }) {
  const programs: State[] = state?.programs ?? [];
  const [program, setProgram] = useState<string>(programs[0]?.name ?? "");
  const advisors: State[] = programs.find((p: State) => p.name === program)?.advisors?.advisors ?? [];
  const [advisor, setAdvisor] = useState<string>(advisors[0]?.name ?? "");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "speaking" | "listening" | "evaluating">("idle");
  const [evals, setEvals] = useState<Eval[]>([]);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const L = lang === "zh";

  useEffect(() => {
    if (!advisors.find((a: State) => a.name === advisor)) setAdvisor(advisors[0]?.name ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program]);

  const canListen = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  function speak(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.98;
    const voices = window.speechSynthesis.getVoices();
    const v = voices.find((x) => /en-US/.test(x.lang) && /Samantha|Google US English|Aria|Jenny/.test(x.name)) ?? voices.find((x) => /en-US/.test(x.lang));
    if (v) u.voice = v;
    u.onstart = () => setStatus("speaking");
    u.onend = () => setStatus("idle");
    window.speechSynthesis.speak(u);
  }

  async function start() {
    setError(null);
    setStatus("loading");
    const r = await fetch(`${API}/api/applicants/${APPLICANT}/interview/plan`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ program, advisor }) });
    if (!r.ok) {
      setError(`HTTP ${r.status}`);
      setStatus("idle");
      return;
    }
    const p: Plan = await r.json();
    setPlan(p);
    setEvals(p.answers ?? []);
    setIdx(0);
    setStatus("idle");
    speak(p.questions[0].question);
  }

  function listen() {
    if (!canListen) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = true;
    let final = "";
    rec.onresult = (e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) final += res[0].transcript + " ";
        else interim += res[0].transcript;
      }
      setAnswer((final + interim).trim());
    };
    rec.onend = () => setStatus("idle");
    rec.start();
    recRef.current = rec;
    setStatus("listening");
  }

  function stopListening() {
    recRef.current?.stop();
    setStatus("idle");
  }

  async function submit() {
    if (!plan || !answer.trim()) return;
    stopListening();
    setStatus("evaluating");
    const q = plan.questions[idx];
    const r = await fetch(`${API}/api/applicants/${APPLICANT}/interview/answer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ program, advisor, question_id: q.id, answer }),
    });
    setStatus("idle");
    if (!r.ok) {
      setError(r.status === 429 ? (L ? "这场面试的评估次数已用完。" : "Evaluation limit reached for this interview.") : `HTTP ${r.status}`);
      return;
    }
    const ev: Eval = await r.json();
    setEvals((x) => [...x, ev]);
    setAnswer("");
    speak(ev.feedback + " " + ev.follow_up);
  }

  function next() {
    if (!plan) return;
    const n = Math.min(idx + 1, plan.questions.length - 1);
    setIdx(n);
    setAnswer("");
    speak(plan.questions[n].question);
  }

  const q = plan?.questions[idx];
  const done = evals.filter((e) => e.question_id === q?.id);
  const avg = (k: "fit" | "depth" | "clarity") => (evals.length ? (evals.reduce((s, e) => s + e.scores[k], 0) / evals.length).toFixed(1) : "–");

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <div className="text-xs text-muted">{t("programs")}</div>
          <select className="mt-1 rounded-xl border border-line px-3 py-2" value={program} onChange={(e) => setProgram(e.target.value)}>
            {programs.map((p: State) => (
              <option key={p.key} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <div className="text-xs text-muted">{t("advisors")}</div>
          <select className="mt-1 rounded-xl border border-line px-3 py-2" value={advisor} onChange={(e) => setAdvisor(e.target.value)}>
            {advisors.map((a: State) => (
              <option key={a.name} value={a.name}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <button className="btn" onClick={start} disabled={!advisor || status === "loading"}>
          {status === "loading" ? t("thinking") : t("startInterview")}
        </button>
        {!canListen && <span className="text-xs text-muted">{t("voiceChromeOnly")}</span>}
        {error && <span className="text-xs text-bad">{error}</span>}
      </div>

      {plan && q && (
        <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
          <div className="card">
            <div className="flex items-center gap-3">
              <div className={`relative rounded-full p-1 ${status === "speaking" ? "ring-4 ring-brand-soft" : ""}`}>
                <Image src="/mascot-bot.png" alt="" width={72} height={96} className="h-20 w-auto" />
              </div>
              <div>
                <div className="text-xs text-muted">
                  {plan.advisor} · {t("stage")} {plan.stages.indexOf(q.stage) + 1}/{plan.stages.length} · {q.stage.replace(/_/g, " ")}
                </div>
                <div className="text-xs text-muted">
                  {status === "speaking" ? t("speaking") : status === "listening" ? t("listening") : status === "evaluating" ? t("thinking") : ""}
                </div>
              </div>
            </div>
            <p className="mt-4 text-lg font-medium leading-snug">{q.question}</p>
            <p className="mt-2 text-xs text-muted">{q.why}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {status === "listening" ? (
                <button className="btn-ghost" onClick={stopListening}>
                  {t("stop")}
                </button>
              ) : (
                <button className="btn-ghost" onClick={listen} disabled={!canListen}>
                  {t("speakAnswer")}
                </button>
              )}
              <button className="btn-ghost" onClick={() => speak(q.question)}>
                {t("repeat")}
              </button>
              <button className="btn-ghost" onClick={next} disabled={idx >= plan.questions.length - 1}>
                {t("nextQuestion")} <Icon.arrow size={14} />
              </button>
            </div>
            <textarea className="mt-3 h-32 w-full rounded-xl border border-line p-3 text-sm" placeholder={t("typeAnswer")} value={answer} onChange={(e) => setAnswer(e.target.value)} />
            <button className="btn mt-2" onClick={submit} disabled={!answer.trim() || status === "evaluating"}>
              {t("getFeedback")}
            </button>
            <p className="mt-3 text-xs text-muted">{plan.caveat}</p>
          </div>
          <div className="space-y-3">
            <div className="card">
              <div className="text-xs font-medium text-muted">{t("scoresSoFar")}</div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(["fit", "depth", "clarity"] as const).map((k) => (
                  <div key={k} className="stat">
                    <div className="label">{k}</div>
                    <div className="value text-brand-ink">{avg(k)}</div>
                  </div>
                ))}
              </div>
            </div>
            {done.map((e, i) => (
              <div key={i} className="card">
                <div className="text-xs text-muted">
                  {t("yourAnswer")} · fit {e.scores.fit} · depth {e.scores.depth} · clarity {e.scores.clarity}
                </div>
                <p className="mt-1 text-sm text-muted">{e.answer}</p>
                <p className="mt-2 text-sm">{e.feedback}</p>
                <p className="mt-2 text-sm font-medium">{t("followUp")}: {e.follow_up}</p>
              </div>
            ))}
            <div className="card">
              <div className="text-xs font-medium text-muted">{t("strongAnswer")}</div>
              <ul className="mt-1 list-disc pl-5 text-sm">
                {q.strong_answer_includes.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
