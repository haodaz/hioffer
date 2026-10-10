"use client";

import Image from "next/image";
import Link from "next/link";
import { useLang } from "@/lib/i18n";

export default function Landing() {
  const [lang, setLang, t] = useLang();
  const modules = [
    ["m_programs", "m_programs_d"],
    ["m_advisors", "m_advisors_d"],
    ["m_materials", "m_materials_d"],
    ["m_process", "m_process_d"],
    ["m_signals", "m_signals_d"],
    ["m_decide", "m_decide_d"],
  ] as const;
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <header className="flex items-center justify-between">
        <div className="text-2xl font-bold tracking-tight">
          hi<span className="text-brand">offer</span>
        </div>
        <div className="flex items-center gap-3">
          <button className="chip" onClick={() => setLang(lang === "en" ? "zh" : "en")}>
            {lang === "en" ? "中文" : "EN"}
          </button>
          <Link href="/app" className="btn">
            {t("cta")}
          </Link>
        </div>
      </header>

      <section className="mt-6 overflow-hidden rounded-3xl border border-line bg-surface shadow-sm">
        <Image src="/cover.png" alt="hioffer" width={1600} height={900} priority className="h-auto w-full" />
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">{t("modules")}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map(([k, d], i) => (
            <div key={k} className="card">
              <div className="flex items-center gap-2">
                <span className="tag">{i + 1}</span>
                <h3 className="font-semibold">{t(k)}</h3>
              </div>
              <p className="mt-2 text-sm text-muted">{t(d)}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-muted">{t("boundary")}</p>
      </section>

      <footer className="mt-12 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-sm text-muted">
        <span>{t("builtInPublic")}</span>
        <span>neatlogs · Entire · cfo.ai</span>
      </footer>
    </main>
  );
}
