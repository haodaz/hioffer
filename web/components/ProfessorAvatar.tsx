"use client";

/**
 * A stylised, neutral academic figure for the interviewer's seat. It is deliberately not a likeness of any
 * real professor: the name and institution are shown as text under it. Drop a `professor.png` into
 * `web/public/` to replace the vector with an illustration.
 */
import { useEffect, useState } from "react";

export function ProfessorAvatar({ size = 200, talking = false }: { size?: number; talking?: boolean }) {
  const [custom, setCustom] = useState<string | null>(null);
  useEffect(() => {
    const img = new Image();
    img.onload = () => setCustom("/professor.png");
    img.src = "/professor.png";
  }, []);
  if (custom) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={custom} alt="" width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  const mouth = talking ? "M 84 128 q 16 10 32 0" : "M 86 128 q 14 4 28 0";
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" role="img" aria-label="Professor">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e9f0ff" />
          <stop offset="1" stopColor="#fdeeea" />
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r="98" fill="url(#bg)" />
      {/* shoulders / blazer */}
      <path d="M 30 200 C 32 150 60 140 100 140 C 140 140 168 150 170 200 Z" fill="#2b3a67" />
      <path d="M 86 142 L 100 175 L 114 142 Z" fill="#ffffff" />
      <path d="M 95 142 L 100 160 L 105 142 Z" fill="#c0262d" />
      {/* neck */}
      <rect x="88" y="118" width="24" height="26" rx="8" fill="#e9c5a6" />
      {/* head */}
      <ellipse cx="100" cy="92" rx="34" ry="40" fill="#f1d2b6" />
      {/* hair, grey at the temples */}
      <path d="M 66 86 C 64 50 136 50 134 86 C 128 70 116 62 100 62 C 84 62 72 70 66 86 Z" fill="#4a4a52" />
      <path d="M 66 86 C 66 76 70 70 74 66 L 70 92 Z" fill="#b8b8c0" />
      <path d="M 134 86 C 134 76 130 70 126 66 L 130 92 Z" fill="#b8b8c0" />
      {/* glasses */}
      <g fill="none" stroke="#2b3a67" strokeWidth="3">
        <circle cx="86" cy="96" r="11" />
        <circle cx="114" cy="96" r="11" />
        <path d="M 97 96 L 103 96 M 75 94 L 68 90 M 125 94 L 132 90" />
      </g>
      <circle cx="86" cy="97" r="2.5" fill="#2b3a67" />
      <circle cx="114" cy="97" r="2.5" fill="#2b3a67" />
      {/* brows, nose, mouth */}
      <path d="M 76 82 q 10 -5 20 0 M 104 82 q 10 -5 20 0" fill="none" stroke="#4a4a52" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M 100 100 q -4 10 2 14" fill="none" stroke="#d9a98b" strokeWidth="2" strokeLinecap="round" />
      <path d={mouth} fill="none" stroke="#b06a5a" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
