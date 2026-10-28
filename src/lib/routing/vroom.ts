import type { LatLng } from "../types";
import type { SolverInput } from "./solver";
import { fetchJson } from "./util";

/*
 * Optional: VROOM (github.com/VROOM-Project/vroom, open source) through OpenRouteService's optimization API, which
 * needs a free key. Returns job order per vehicle; times are recomputed by our own evaluator so plans read the same
 * whichever solver ran. Throws on any failure so the caller can fall back to the built-in solver.
 */

const REGION_SKILL: Record<string, number> = { quad: 1, phx: 2, other: 3 };

export async function solveWithVroom(inp: SolverInput, points: LatLng[], apiKey: string): Promise<{ routes: number[][]; unassigned: number[] }> {
  const ll = (i: number) => [points[i].lng, points[i].lat];
  const pinSkill = (v: number) => 100 + v;
  const body = {
    vehicles: inp.vehicles.map((v, i) => ({
      id: i + 1,
      profile: "driving-car",
      start: ll(v.start),
      ...(v.end != null ? { end: ll(v.end) } : {}),
      time_window: [v.shiftStart * 60, (v.shiftEnd + 120) * 60],
      skills: [...(v.regions?.length ? v.regions.map((r) => REGION_SKILL[r]).filter(Boolean) : Object.values(REGION_SKILL)), pinSkill(i)],
    })),
    jobs: inp.jobs.map((j, i) => {
      const window = j.fixedStart != null ? [j.fixedStart, j.fixedStart] : j.window;
      const skills = [
        ...(j.region && REGION_SKILL[j.region] && j.pinned == null ? [REGION_SKILL[j.region]] : []),
        ...(j.pinned != null ? [pinSkill(j.pinned)] : []),
      ];
      return {
        id: i + 1,
        location: ll(j.loc),
        service: Math.round(j.service * 60),
        ...(window ? { time_windows: [[Math.round(window[0] * 60), Math.round(window[1] * 60)]] } : {}),
        ...(skills.length ? { skills } : {}),
      };
    }),
  };
  const data = await fetchJson<{ code: number; error?: string; routes?: { vehicle: number; steps: { type: string; job?: number; id?: number }[] }[]; unassigned?: { id: number }[] }>(
    "https://api.openrouteservice.org/optimization",
    { method: "POST", headers: { Authorization: apiKey, "Content-Type": "application/json" }, body: JSON.stringify(body) },
    15000,
  );
  if (data.code !== 0 || !data.routes) throw new Error(data.error || `VROOM code ${data.code}`);
  const routes = inp.vehicles.map(() => [] as number[]);
  for (const r of data.routes) {
    for (const s of r.steps) {
      const id = s.job ?? s.id;
      if (s.type === "job" && id != null) routes[r.vehicle - 1].push(id - 1);
    }
  }
  return { routes, unassigned: (data.unassigned ?? []).map((u) => u.id - 1) };
}
