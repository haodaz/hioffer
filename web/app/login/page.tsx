"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icons";
import { login } from "@/lib/api";
import { useLang } from "@/lib/i18n";

export default function Login() {
  const [lang, setLang, t] = useLang();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go(c: string) {
    setBusy(true); setErr(null);
    try {
      await login(c);
      router.push("/app");
    } catch {
      setErr(t("loginBad"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Image src="/mascot-bot.png" alt="" width={30} height={40} className="h-8 w-auto" />
          <span>Hi<span className="text-brand">Offer</span></span>
        </Link>
        <button className="chip" onClick={() => setLang(lang === "en" ? "zh" : "en")}>{lang === "en" ? "中文" : "EN"}</button>
      </div>
      <div className="card">
        <h1 className="text-xl font-semibold">{t("loginTitle")}</h1>
        <p className="mt-1 text-sm text-muted">{t("loginSub")}</p>
        <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); go(code); }}>
          <input className="flex-1 rounded-xl border border-line px-4 py-2 font-mono uppercase tracking-wider outline-none focus:border-brand" placeholder={t("loginCode")} value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
          <button className="btn" disabled={busy || !code.trim()}>{t("loginGo")}</button>
        </form>
        {err && <p className="mt-2 text-sm text-bad">{err}</p>}
      </div>
      <div className="card mt-4">
        <div className="text-xs font-medium text-muted">{t("loginDemo")}</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button className="chip" onClick={() => go("PRIYA-DEMO")} disabled={busy}>Priya Raman · NLP · PRIYA-DEMO</button>
          <button className="chip" onClick={() => go("ARJUN-DEMO")} disabled={busy}>Arjun Mehta · robotics · ARJUN-DEMO</button>
          <button className="chip" onClick={() => go("MEI-DEMO")} disabled={busy}>Mei Lin · HCI · MEI-DEMO</button>
        </div>
        <p className="mt-2 text-xs text-muted">All three are fictional applicants with real program pages.</p>
      </div>
      <Link href="/new" className="btn-ghost mt-4 justify-center">
        <Icon.plus size={16} /> {t("loginNew")}
      </Link>
    </main>
  );
}
