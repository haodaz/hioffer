"use client";

import { useEffect, useRef } from "react";

/** Leaflet via CDN (no bundler config, no API key) with OpenStreetMap tiles. */
type Place = { lat: number; lng: number; city?: string; region?: string; climate?: { jan_low_c?: number; jul_high_c?: number; rain_days?: number }; living?: { cost_of_living?: string } };
type Item = { name: string; short?: string; deadline?: string; advisors: number; status: string; place?: Place };

declare global {
  interface Window {
    L?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  }
}

function loadLeaflet(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.L) return Promise.resolve();
  return new Promise((resolve) => {
    if (!document.querySelector("link[data-leaflet]")) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      css.setAttribute("data-leaflet", "1");
      document.head.appendChild(css);
    }
    const s = document.createElement("script");
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.onload = () => resolve();
    document.head.appendChild(s);
  });
}

export function ProgramMap({ items, selected, onSelect }: { items: Item[]; selected?: string; onSelect: (name: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<Record<string, any>>({});

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then(() => {
      if (cancelled || !ref.current || mapRef.current) return;
      const L = window.L;
      const map = L.map(ref.current, { scrollWheelZoom: false, zoomControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap contributors", maxZoom: 18 }).addTo(map);
      mapRef.current = map;
      const pts: [number, number][] = [];
      for (const it of items) {
        if (!it.place) continue;
        const { lat, lng } = it.place;
        pts.push([lat, lng]);
        const icon = L.divIcon({
          className: "",
          html: `<div style="background:#2f6bff;color:#fff;border-radius:999px;padding:4px 10px;font:600 12px system-ui;white-space:nowrap;box-shadow:0 2px 8px rgba(22,33,58,.25)">${it.short ?? it.name}</div>`,
          iconAnchor: [30, 14],
        });
        const c = it.place.climate ?? {};
        const m = L.marker([lat, lng], { icon }).addTo(map);
        m.bindPopup(
          `<div style="font:13px system-ui;min-width:200px"><b>${it.name}</b><br/>${it.place.city ?? ""}${it.place.region ? ", " + it.place.region : ""}<br/>` +
            (c.jan_low_c != null ? `Jan low ${c.jan_low_c}°C · Jul high ${c.jul_high_c}°C · ${c.rain_days} rain days<br/>` : "") +
            (it.place.living?.cost_of_living ? `Cost of living: ${it.place.living.cost_of_living}<br/>` : "") +
            (it.deadline ? `Deadline: ${it.deadline}<br/>` : "") +
            `${it.advisors} advisors · ${it.status}</div>`,
        );
        m.on("click", () => onSelect(it.name));
        markersRef.current[it.name] = m;
      }
      if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 6 });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  useEffect(() => {
    const m = selected ? markersRef.current[selected] : null;
    if (m && mapRef.current) {
      mapRef.current.flyTo(m.getLatLng(), 8, { duration: 0.8 });
      m.openPopup();
    }
  }, [selected]);

  return <div ref={ref} className="h-[520px] w-full overflow-hidden rounded-2xl border border-line" />;
}
