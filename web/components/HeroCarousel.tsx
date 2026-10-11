"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

/** Four moments of one applicant's journey, cross-fading. Images are transparent cutouts in web/public. */
const SCENES = [
  { src: "/scene-schools.png", en: "Choosing where to apply", zh: "选校" },
  { src: "/mascot-duo.png", en: "Writing with sources", zh: "做材料" },
  { src: "/scene-interview.png", en: "Rehearsing the interview", zh: "模拟面试" },
  { src: "/scene-offer.png", en: "The offer", zh: "拿到 offer" },
];

export function HeroCarousel({ lang }: { lang: "en" | "zh" }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const h = window.setInterval(() => setI((x) => (x + 1) % SCENES.length), 3600);
    return () => window.clearInterval(h);
  }, []);
  return (
    <div className="relative mx-auto aspect-square w-full max-w-md">
      <div className="absolute inset-8 rounded-full bg-brand-soft blur-3xl" />
      {SCENES.map((s, k) => (
        <Image
          key={s.src}
          src={s.src}
          alt={s.en}
          fill
          priority={k === 0}
          sizes="448px"
          className={`object-contain object-bottom transition-opacity duration-700 ${k === i ? "opacity-100" : "opacity-0"}`}
        />
      ))}
      <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-surface/90 px-3 py-1.5 text-xs shadow-sm backdrop-blur">
        {SCENES.map((s, k) => (
          <button key={s.src} onClick={() => setI(k)} aria-label={s.en} className={`h-1.5 rounded-full transition-all ${k === i ? "w-6 bg-brand" : "w-1.5 bg-line"}`} />
        ))}
        <span className="ml-1 text-muted">{lang === "zh" ? SCENES[i].zh : SCENES[i].en}</span>
      </div>
    </div>
  );
}
