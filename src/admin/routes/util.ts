import { time12 } from "../../lib/format";
import { fromMin, type DayPlan, type MemberRoute, type Stop } from "../../lib/routing";
import type { MapRoute, MapStop } from "../../components/RouteMap";

/** 95 → "1h 35m", 40 → "40 min". */
export function dur(min: number) {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  return m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60}h`;
}

export const miles = (mi: number) => `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi`;

/** Minutes since midnight → "9:15 AM". */
export const clock = (min: number) => time12(fromMin(min));

export const isApprox = (s: Stop) => !s.point || s.point.source === "city";

export function toMapRoutes(plan: DayPlan | null, returnToBase: boolean, paths: Record<string, unknown> = {}): MapRoute[] {
  if (!plan) return [];
  return plan.routes.map((r) => ({
    id: r.member.id,
    color: r.member.color,
    base: { lat: r.member.base.lat, lng: r.member.base.lng, label: `${r.member.name} · ${r.member.baseLabel}` },
    returnToBase,
    path: (paths[routeKey(r)] as MapRoute["path"]) ?? null,
    stops: r.stops.filter((p) => p.stop.point).map((p, i) => ({
      id: p.stop.id, n: i + 1, lat: p.stop.point!.lat, lng: p.stop.point!.lng, approx: p.stop.point!.source === "city",
      label: `${clock(p.start)} · ${p.stop.customer || p.stop.title}`,
    })),
  }));
}

export const looseStops = (plan: DayPlan | null): MapStop[] =>
  (plan?.unassigned ?? []).filter((u) => u.stop.point).map((u) => ({
    id: u.stop.id, lat: u.stop.point!.lat, lng: u.stop.point!.lng, approx: u.stop.point!.source === "city", label: `${u.stop.customer || u.stop.title} · not routed`,
  }));

/** Identifies one person's route as drawn, so a road shape is refetched only when the stops change. */
export const routeKey = (r: MemberRoute) => `${r.member.id}:${r.stops.map((p) => p.stop.id).join(",")}`;
