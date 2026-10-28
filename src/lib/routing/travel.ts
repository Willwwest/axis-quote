import { getSettings } from "../store";
import type { LatLng } from "../types";
import { fetchJson, haversineKm } from "./util";

/*
 * Drive times. Default: OSRM (open source, public server, no key). Optional: OpenRouteService (free key).
 * Fallback: straight-line distance × a detour factor at an average speed. A failure never throws; the matrix just
 * comes back as an estimate with one warning. Every pair OSRM answers is cached, so re-optimizing the same day,
 * or a sub-day of the week planner, doesn't fetch again.
 */

export interface MatrixResult {
  seconds: number[][];
  meters: number[][];
  source: "osrm" | "ors" | "estimate";
  /** Set when road times were asked for but couldn't be fetched. */
  warning?: string;
}

const MAX_POINTS = 100;
const key = (p: LatLng) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
const pairs = new Map<string, [seconds: number, meters: number, source: "osrm" | "ors"]>();
const pairKey = (a: LatLng, b: LatLng, provider: string) => `${provider}|${key(a)}|${key(b)}`;

/** Forgets cached drive times and any "server is down" pause, e.g. after the routing settings change. */
export function resetTravelCache() {
  pairs.clear();
  downUntil = 0;
}

function estimate(points: LatLng[]) {
  const { detourFactor, avgMph } = getSettings().routing;
  const meters = points.map((a) => points.map((b) => haversineKm(a, b) * 1000 * (detourFactor || 1.3)));
  const mps = ((avgMph || 45) * 1609.344) / 3600;
  return { meters, seconds: meters.map((row) => row.map((m) => m / mps)) };
}

async function osrmTable(points: LatLng[], base: string) {
  const coords = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(";");
  const data = await fetchJson<{ code: string; durations?: (number | null)[][]; distances?: (number | null)[][] }>(
    `${base.replace(/\/+$/, "")}/table/v1/driving/${coords}?annotations=duration,distance`,
  );
  if (data.code !== "Ok" || !data.durations || !data.distances) throw new Error(`OSRM ${data.code}`);
  return { seconds: data.durations, meters: data.distances };
}

async function orsTable(points: LatLng[], apiKey: string) {
  const data = await fetchJson<{ durations?: (number | null)[][]; distances?: (number | null)[][] }>(
    "https://api.openrouteservice.org/v2/matrix/driving-car",
    {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ locations: points.map((p) => [p.lng, p.lat]), metrics: ["duration", "distance"] }),
    },
  );
  if (!data.durations || !data.distances) throw new Error("ORS matrix: empty answer");
  return { seconds: data.durations, meters: data.distances };
}

// After a failure, use estimates for a minute instead of waiting on a timeout again for every re-plan.
let downUntil = 0;
let downWarning = "";
let downServer = "";

/** Drive times and distances between every pair of points. */
export async function travelMatrix(points: LatLng[]): Promise<MatrixResult> {
  const r = getSettings().routing;
  const est = estimate(points);
  const provider = r.travel === "ors" && r.orsKey ? "ors" : r.travel === "estimate" ? null : "osrm";
  if (!provider || points.length < 2) return { ...est, source: provider && points.length < 2 ? provider : "estimate" };
  const server = provider === "ors" ? "ors" : `osrm:${r.osrmUrl}`;

  const cached = () => {
    const seconds: number[][] = [];
    const meters: number[][] = [];
    for (const a of points) {
      const sr: number[] = [];
      const mr: number[] = [];
      for (const b of points) {
        if (key(a) === key(b)) { sr.push(0); mr.push(0); continue; }
        const hit = pairs.get(pairKey(a, b, server));
        if (!hit) return null;
        sr.push(hit[0]);
        mr.push(hit[1]);
      }
      seconds.push(sr);
      meters.push(mr);
    }
    return { seconds, meters };
  };
  const hit = cached();
  if (hit) return { ...hit, source: provider };
  if (Date.now() < downUntil && downServer === server) return { ...est, source: "estimate", warning: downWarning };

  // Fetch only the distinct points (the same base or address can appear more than once).
  const unique = [...new Map(points.map((p) => [key(p), p])).values()];
  if (unique.length > MAX_POINTS) {
    return { ...est, source: "estimate", warning: `More than ${MAX_POINTS} places at once, so drive times are straight-line estimates.` };
  }
  try {
    const t = provider === "ors" ? await orsTable(unique, r.orsKey) : await osrmTable(unique, r.osrmUrl || "https://router.project-osrm.org");
    unique.forEach((a, i) => unique.forEach((b, j) => {
      const s = t.seconds[i]?.[j];
      const m = t.meters[i]?.[j];
      // A null means "no road between these" (an island, a bad snap): keep the estimate for that pair.
      if (i !== j && s != null && m != null) pairs.set(pairKey(a, b, server), [s, m, provider]);
    }));
    const seconds = points.map((a, i) => points.map((b, j) => (i === j || key(a) === key(b) ? 0 : pairs.get(pairKey(a, b, server))?.[0] ?? est.seconds[i][j])));
    const meters = points.map((a, i) => points.map((b, j) => (i === j || key(a) === key(b) ? 0 : pairs.get(pairKey(a, b, server))?.[1] ?? est.meters[i][j])));
    return { seconds, meters, source: provider };
  } catch {
    const name = provider === "ors" ? "OpenRouteService" : "The OSRM road-routing server";
    downUntil = Date.now() + 60_000;
    downServer = server;
    downWarning = `${name} didn't answer, so drive times are straight-line estimates for now.`;
    return { ...est, source: "estimate", warning: downWarning };
  }
}

const shapes = new Map<string, LatLng[] | null>();

/** Road shape through the points in order, for drawing. Null when unavailable (draw straight lines instead). */
export async function roadPath(points: LatLng[]): Promise<LatLng[] | null> {
  if (points.length < 2) return null;
  const r = getSettings().routing;
  const provider = r.travel === "ors" && r.orsKey ? "ors" : r.travel === "estimate" ? null : "osrm";
  if (!provider) return null;
  const id = `${provider}|${points.map(key).join(";")}`;
  if (shapes.has(id)) return shapes.get(id)!;
  let line: LatLng[] | null = null;
  try {
    if (provider === "ors") {
      const data = await fetchJson<{ features?: { geometry: { coordinates: [number, number][] } }[] }>(
        "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
        { method: "POST", headers: { Authorization: r.orsKey, "Content-Type": "application/json" }, body: JSON.stringify({ coordinates: points.map((p) => [p.lng, p.lat]) }) },
        10000,
      );
      line = data.features?.[0]?.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })) ?? null;
    } else {
      const coords = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(";");
      const data = await fetchJson<{ code: string; routes?: { geometry: { coordinates: [number, number][] } }[] }>(
        `${(r.osrmUrl || "https://router.project-osrm.org").replace(/\/+$/, "")}/route/v1/driving/${coords}?overview=full&geometries=geojson`,
        {},
        10000,
      );
      line = data.code === "Ok" ? data.routes?.[0]?.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })) ?? null : null;
    }
  } catch {
    line = null;
  }
  // Cache failures for this session too, so a flaky server doesn't get hammered on every redraw.
  shapes.set(id, line);
  return line;
}
