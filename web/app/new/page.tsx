"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icons";
import { createApplicant, type Session } from "@/lib/api";
import { useLang } from "@/lib/i18n";

type F = { name: string; content: string };
type P = { name: string; short: string; institution: string; department: string; admissions_url: string; faculty_url: string };

export default function NewApplicant() {
  const [lang, setLang, t] = useLang();
  const router = useRouter();
  const [name, setName] = useState("");
  const [files, setFiles] = useState<F[]>([
    { name: "cv.md", content: "" },
    { name: "interests.md", content: "" },
    { name: "sop_draft.md", content: "" },
    { name: "recommenders.md", content: "" },
  ]);
  const [programs, setPrograms] = useState<P[]>([{ name: "", short: "", institution: "", department: "", admissions_url: "", faculty_url: "" }]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Session | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onFile(i: number, file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    setFiles((fs) => fs.map((f, k) => (k === i ? { name: file.name, content: text } : f)));
  }

  async function submit() {
    setBusy(true); setErr(null);
    try {
      const s = await createApplicant({
        name,
        files: files.filter((f) => f.content.trim()),
        programs: programs.filter((p) => p.name.trim() && p.institution.trim()).map((p) => Object.fromEntries(Object.entries(p).filter(([, v]) => v.trim()))),
      });
      setDone(s);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
        <div className="card text-center">
          <Image src="/mascot-duo.png" alt="" width={240} height={253} className="mx-auto h-auto w-40" />
          <h1 className="mt-3 text-xl font-semibold">{done.name}</h1>
          <p className="mt-2 text-sm text-muted">{t("newCodeNote")}</p>
          <div className="mt-2 rounded-xl bg-background px-4 py-3 font-mono text-lg tracking-widest">{done.code}</div>
          <button className="btn mt-4" onClick={() => router.push("/app")}>{t("loginGo")} <Icon.arrow size={16} /></button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Image src="/mascot-bot.png" alt="" width={30} height={40} className="h-8 w-auto" />
          <span>Hi<span className="text-brand">Offer</span></span>
        </Link>
        <div className="flex gap-2">
          <button className="chip" onClick={() => setLang(lang === "en" ? "zh" : "en")}>{lang === "en" ? "中文" : "EN"}</button>
          <Link href="/login" className="chip">{t("loginTitle")}</Link>
        </div>
      </div>
      <h1 className="text-2xl font-semibold">{t("newTitle")}</h1>
      <p className="mt-1 text-sm text-muted">{t("newSub")}</p>

      <div className="card mt-6">
        <label className="text-sm font-medium">{t("newName")}</label>
        <input className="mt-1 w-full rounded-xl border border-line px-4 py-2 outline-none focus:border-brand" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="card mt-4 space-y-4">
        <div className="text-sm font-medium">{t("newFiles")}</div>
        {files.map((f, i) => (
          <div key={i}>
            <div className="flex items-center gap-2">
              <input className="w-48 rounded-lg border border-line px-2 py-1 font-mono text-xs" value={f.name} onChange={(e) => setFiles((fs) => fs.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
              <label className="chip cursor-pointer">
                <input type="file" accept=".md,.txt" className="hidden" onChange={(e) => onFile(i, e.target.files?.[0])} /> upload .md / .txt
              </label>
            </div>
            <textarea className="mt-1 h-28 w-full rounded-xl border border-line p-3 text-sm" value={f.content} onChange={(e) => setFiles((fs) => fs.map((x, k) => (k === i ? { ...x, content: e.target.value } : x)))} />
          </div>
        ))}
        <button className="chip" onClick={() => setFiles((fs) => [...fs, { name: `material-${fs.length + 1}.md`, content: "" }])}><Icon.plus size={14} /> {t("newAddFile")}</button>
      </div>

      <div className="card mt-4 space-y-4">
        <div className="text-sm font-medium">{t("newPrograms")}</div>
        {programs.map((p, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-2">
            {(["name", "short", "institution", "department", "admissions_url", "faculty_url"] as const).map((k) => (
              <input key={k} className="rounded-lg border border-line px-3 py-1.5 text-sm" placeholder={k.replace(/_/g, " ")} value={p[k]} onChange={(e) => setPrograms((ps) => ps.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))} />
            ))}
          </div>
        ))}
        <button className="chip" onClick={() => setPrograms((ps) => [...ps, { name: "", short: "", institution: "", department: "", admissions_url: "", faculty_url: "" }])}><Icon.plus size={14} /> {t("newAddProgram")}</button>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button className="btn" onClick={submit} disabled={busy || !name.trim()}>{t("newCreate")}</button>
        {err && <span className="text-sm text-bad">{err}</span>}
      </div>
    </main>
  );
}
