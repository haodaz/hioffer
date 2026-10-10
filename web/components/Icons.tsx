"use client";

/** Small line-icon set (24px grid, 1.6 stroke) so the UI never needs emoji. */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 18) => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
});

export const Icon = {
  chat: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M4 5h16v11H9l-5 4z" /></svg>
  ),
  programs: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M2 9l10-4 10 4-10 4z" /><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5" /><path d="M22 9v6" /></svg>
  ),
  advisors: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" /></svg>
  ),
  materials: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4" /><path d="M9.5 12h5M9.5 15.5h5" /></svg>
  ),
  timeline: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></svg>
  ),
  signals: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><circle cx="12" cy="12" r="2" /><path d="M8.5 15.5a5 5 0 010-7M15.5 8.5a5 5 0 010 7M5.5 18.5a9 9 0 010-13M18.5 5.5a9 9 0 010 13" /></svg>
  ),
  offers: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M12 3v18M4 7h16" /><path d="M7 7l-3.5 7a3.5 3.5 0 007 0zM17 7l-3.5 7a3.5 3.5 0 007 0z" /></svg>
  ),
  check: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
  ),
  arrow: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
  ),
  spark: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></svg>
  ),
  link: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" /></svg>
  ),
  shield: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" /><path d="M9 12l2 2 4-4" /></svg>
  ),
  mail: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="M4 7l8 6 8-6" /></svg>
  ),
  close: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>
  ),
  plus: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M12 5v14M5 12h14" /></svg>
  ),
  compass: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></svg>
  ),
  library: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M4 4h4v16H4zM10 4h4v16h-4zM16.5 5l3.5 1-3.5 14-3.5-1z" /></svg>
  ),
  question: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 015 0c0 1.5-2.5 2-2.5 3.5M12 17h.01" /></svg>
  ),
};

export type IconName = keyof typeof Icon;
