/*
 * Street map for crew routes. Leaflet draws OpenStreetMap tiles; pins, base markers and route lines take each
 * person's color. Only loaded by the route screens, so the customer quote app never downloads Leaflet.
 * Patterned on extra-mile-apps' CRM StreetMap: wheel zoom only after the map has focus, and the view refits only
 * when `fitKey` changes, so selecting a stop never resets it.
 */
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { cx } from "./ui";
import type { LatLng } from "../lib/types";

export interface MapStop extends LatLng {
  id: string;
  /** Number shown in the pin (route order). Omit for a "?" pin. */
  n?: number;
  label: string;
  /** Placed at the town center, not the street address. */
  approx?: boolean;
  done?: boolean;
}

export interface MapRoute {
  id: string;
  /** CSS color, e.g. rgb(var(--c-info)). */
  color: string;
  base?: LatLng & { label?: string };
  stops: MapStop[];
  /** Road shape from the routing service. Without it, straight dashed lines are drawn. */
  path?: LatLng[] | null;
  returnToBase?: boolean;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** SVG stroke attributes can't read CSS variables, so resolve a token color to rgb() inside the map. */
function resolver(host: HTMLElement) {
  const probe = document.createElement("span");
  probe.style.display = "none";
  host.append(probe);
  const cache = new Map<string, string>();
  return {
    get(color: string) {
      if (!cache.has(color)) {
        probe.style.color = color;
        cache.set(color, getComputedStyle(probe).color || color);
      }
      return cache.get(color)!;
    },
    dispose: () => probe.remove(),
  };
}

export function RouteMap({ routes, loose = [], selectedId, onSelect, fitKey, className, label = "Route map" }: {
  routes: MapRoute[];
  /** Stops nobody has been routed to. */
  loose?: MapStop[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  fitKey: string;
  className?: string;
  label?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  const fitted = useRef<string | null>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  const [tilesDown, setTilesDown] = useState(false);

  // Create the map once.
  useEffect(() => {
    if (!host.current) return;
    const m = L.map(host.current, { zoomControl: true, scrollWheelZoom: false, minZoom: 5, maxZoom: 18 }).setView([34.58, -112.45], 9);
    m.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener noreferrer">Leaflet</a>');
    m.on("focus click", () => m.scrollWheelZoom.enable());
    m.on("blur mouseout", () => m.scrollWheelZoom.disable());
    let errors = 0;
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      referrerPolicy: "origin",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    })
      .on("loading", () => { errors = 0; })
      .on("tileerror", () => { errors++; })
      .on("load", () => setTilesDown(errors > 0))
      .addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    // The map often mounts inside a card that is still animating or sizing.
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(host.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
      layer.current = null;
    };
  }, []);

  // Draw pins and lines whenever the routes change.
  useEffect(() => {
    const m = map.current, g = layer.current;
    if (!m || !g || !host.current) return;
    g.clearLayers();
    markers.current.clear();
    const colors = resolver(host.current);
    const bounds: L.LatLngExpression[] = [];

    const pin = (s: MapStop, color: string) => {
      const icon = L.divIcon({
        className: "route-pin-wrap",
        html: `<span class="${cx("route-pin", s.approx && "route-pin--approx", s.done && "route-pin--done", s.n == null && "route-pin--loose")}" style="--pin:${color}">${s.n ?? "?"}</span>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      const marker = L.marker([s.lat, s.lng], { icon, keyboard: true, title: s.label, riseOnHover: true })
        .bindTooltip(`${esc(s.label)}${s.approx ? '<br><span class="route-tip-note">Approximate: town center</span>' : ""}`, { direction: "top", offset: [0, -14] })
        .on("click", () => select.current?.(s.id))
        .addTo(g);
      markers.current.set(s.id, marker);
      if (s.approx) L.circle([s.lat, s.lng], { radius: 1200, color, weight: 1.5, dashArray: "4 6", fill: false, interactive: false }).addTo(g);
      bounds.push([s.lat, s.lng]);
    };

    for (const r of routes) {
      const color = colors.get(r.color);
      if (r.base) {
        L.marker([r.base.lat, r.base.lng], {
          icon: L.divIcon({ className: "route-pin-wrap", html: `<span class="route-base" style="--pin:${color}"></span>`, iconSize: [18, 18], iconAnchor: [9, 9] }),
          interactive: !!r.base.label,
          keyboard: false,
          // Keep the start marker under the numbered stops when they overlap.
          zIndexOffset: -1000,
        }).bindTooltip(esc(r.base.label || "Start"), { direction: "top", offset: [0, -8] }).addTo(g);
        bounds.push([r.base.lat, r.base.lng]);
      }
      const line = [...(r.base ? [r.base] : []), ...r.stops, ...(r.base && r.returnToBase ? [r.base] : [])];
      if (r.path && r.path.length > 1) {
        L.polyline(r.path.map((p) => [p.lat, p.lng] as L.LatLngTuple), { color, weight: 4, opacity: 0.85, interactive: false }).addTo(g);
      } else if (line.length > 1) {
        L.polyline(line.map((p) => [p.lat, p.lng] as L.LatLngTuple), { color, weight: 2.5, opacity: 0.8, dashArray: "6 8", interactive: false }).addTo(g);
      }
      r.stops.forEach((s) => pin(s, color));
    }
    const grey = colors.get("rgb(var(--c-fg) / .45)");
    loose.forEach((s) => pin(s, grey));
    colors.dispose();

    if (fitted.current !== fitKey && bounds.length) {
      fitted.current = fitKey;
      if (bounds.length === 1) m.setView(bounds[0], 13);
      else m.fitBounds(L.latLngBounds(bounds), { padding: [28, 28], maxZoom: 14 });
    }
  }, [routes, loose, fitKey]);

  // Highlight the selected stop, panning to it if it's off screen.
  useEffect(() => {
    markers.current.forEach((mk, id) => {
      const el = mk.getElement()?.querySelector(".route-pin");
      el?.classList.toggle("route-pin--selected", id === selectedId);
    });
    const mk = selectedId ? markers.current.get(selectedId) : undefined;
    if (mk && map.current && !map.current.getBounds().contains(mk.getLatLng())) map.current.panTo(mk.getLatLng());
  }, [selectedId, routes, loose]);

  return (
    <div className={cx("route-map relative isolate z-0 overflow-hidden rounded-2xl border border-fg/10 bg-sunken", className)}>
      <div ref={host} role="region" aria-label={label} className="h-full w-full" />
      {tilesDown && (
        <div className="pointer-events-none absolute inset-x-2 top-2 z-[500] rounded-lg bg-surface/90 px-3 py-1.5 text-center text-xs text-fg/60">
          Some map tiles didn't load. Pins and routes are still accurate.
        </div>
      )}
    </div>
  );
}
