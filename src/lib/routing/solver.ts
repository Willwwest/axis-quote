import { ceilTo, now, rng } from "./util";

/*
 * Built-in route optimizer: a vehicle routing problem with time windows, solved in the browser.
 *
 *   - Each person is a vehicle with their own base, shift and regions; jobs can be pinned to a person and/or a time.
 *   - Several deterministic starting solutions (regret-2, regret-3, nearest-base clusters, seeded insertion orders),
 *     each improved by local search: exact best order per route when it has ≤ 10 stops (Held-Karp dynamic programming
 *     over subsets, with time windows), 2-opt / or-opt above that, then moves and swaps between people.
 *   - The cheapest result wins. Cost = drive minutes + heavy penalties for lateness, overtime and jobs left out.
 *
 * Same input, same answer: there's no wall-clock randomness. The time budget only guards very large inputs.
 */

export interface SolverVehicle {
  /** Matrix index of the base. */
  start: number;
  /** Matrix index to return to, or null to end at the last stop. */
  end: number | null;
  /** Minutes since midnight. */
  shiftStart: number;
  shiftEnd: number;
  regions?: string[];
  /** Takes only jobs pinned to it (someone outside the people being planned who keeps their own stops). */
  pinnedOnly?: boolean;
}

export interface SolverJob {
  loc: number;
  /** Minutes on site including setup buffer. */
  service: number;
  /** Arrival window, minutes since midnight. */
  window?: [number, number];
  /** Must start at this time (locked or "keep times"). */
  fixedStart?: number;
  region?: string;
  /** Vehicle index this job must stay with. */
  pinned?: number;
  /** Start times round up to this many minutes (default 5). */
  round?: number;
}

export interface SolverInput {
  vehicles: SolverVehicle[];
  jobs: SolverJob[];
  /** Drive minutes between matrix indices. */
  minutes: number[][];
  budgetMs?: number;
}

export interface Visit { job: number; arrive: number; start: number; end: number; drive: number; late: number }

export interface RouteEval { visits: Visit[]; drive: number; returnDrive: number; finish: number; late: number; overtime: number; cost: number }

export interface Solution { routes: number[][]; unassigned: number[]; cost: number }

export const WEIGHTS = { late: 30, overtime: 20, unassigned: 5000, finish: 0.001 };
const EPS = 1e-6;
const EXACT_MAX = 10;

/** When the job can start if we get there at `arrive`, and how late that is. Non-decreasing in `arrive`. */
function serve(job: SolverJob, arrive: number): [start: number, late: number] {
  if (job.fixedStart != null) {
    const start = arrive <= job.fixedStart ? job.fixedStart : ceilTo(arrive, 5);
    return [start, start - job.fixedStart];
  }
  const start = ceilTo(job.window ? Math.max(arrive, job.window[0]) : arrive, job.round ?? 5);
  return [start, job.window ? Math.max(0, start - job.window[1]) : 0];
}

export function evalRoute(inp: SolverInput, v: number, seq: number[]): RouteEval {
  const veh = inp.vehicles[v];
  const M = inp.minutes;
  let t = veh.shiftStart;
  let at = veh.start;
  let drive = 0;
  let late = 0;
  const visits: Visit[] = [];
  for (const j of seq) {
    const job = inp.jobs[j];
    const d = M[at][job.loc];
    const [start, l] = serve(job, t + d);
    visits.push({ job: j, arrive: t + d, start, end: start + job.service, drive: d, late: l });
    drive += d;
    late += l;
    t = start + job.service;
    at = job.loc;
  }
  const returnDrive = seq.length && veh.end != null ? M[at][veh.end] : 0;
  const finish = seq.length ? t + returnDrive : veh.shiftStart;
  const overtime = Math.max(0, finish - veh.shiftEnd);
  const cost = seq.length ? drive + returnDrive + WEIGHTS.late * late + WEIGHTS.overtime * overtime + WEIGHTS.finish * finish : 0;
  return { visits, drive, returnDrive, finish, late, overtime, cost };
}

/**
 * Same cost as evalRoute, without building anything: the hot path for insertion and moves.
 * Optionally skips the stop at index `skip` and/or visits job `ins` just before index `pos`.
 */
function fastCost(inp: SolverInput, v: number, seq: number[], skip = -1, ins = -1, pos = -1): number {
  const veh = inp.vehicles[v];
  const M = inp.minutes;
  let t = veh.shiftStart;
  let at = veh.start;
  let drive = 0;
  let late = 0;
  let count = 0;
  for (let i = 0; i <= seq.length; i++) {
    for (let pass = 0; pass < 2; pass++) {
      const j = pass === 0 ? (i === pos ? ins : -1) : i < seq.length && i !== skip ? seq[i] : -1;
      if (j < 0) continue;
      const job = inp.jobs[j];
      const d = M[at][job.loc];
      const arrive = t + d;
      let start: number;
      if (job.fixedStart != null) {
        start = arrive <= job.fixedStart ? job.fixedStart : ceilTo(arrive, 5);
        late += start - job.fixedStart;
      } else {
        start = ceilTo(job.window ? Math.max(arrive, job.window[0]) : arrive, job.round ?? 5);
        if (job.window && start > job.window[1]) late += start - job.window[1];
      }
      drive += d;
      t = start + job.service;
      at = job.loc;
      count++;
    }
  }
  if (!count) return 0;
  const back = veh.end != null ? M[at][veh.end] : 0;
  const finish = t + back;
  return drive + back + WEIGHTS.late * late + WEIGHTS.overtime * Math.max(0, finish - veh.shiftEnd) + WEIGHTS.finish * finish;
}

const costOf = (inp: SolverInput, v: number, seq: number[]) => fastCost(inp, v, seq);

function allowed(inp: SolverInput, j: number, v: number) {
  const job = inp.jobs[j];
  if (job.pinned != null) return job.pinned === v;
  if (inp.vehicles[v].pinnedOnly) return false;
  const regions = inp.vehicles[v].regions;
  return !job.region || !regions?.length || regions.includes(job.region);
}

/* ---------- Exact order for one route (Held-Karp with time windows) ---------- */

interface Label { cost: number; time: number; prev: Label | null; job: number }

/**
 * Best visiting order for these jobs on this vehicle. Labels per (visited set, last stop) keep the Pareto front of
 * (cost so far, clock): a later clock can only make what follows worse, so a label beaten on both is safe to drop.
 */
export function exactOrder(inp: SolverInput, v: number, jobs: number[]): number[] {
  const n = jobs.length;
  if (n <= 1) return [...jobs];
  const veh = inp.vehicles[v];
  const M = inp.minutes;
  const fronts: Label[][][] = Array.from({ length: 1 << n }, () => Array.from({ length: n }, () => []));
  const add = (front: Label[], l: Label) => {
    for (const o of front) if (o.cost <= l.cost + EPS && o.time <= l.time + EPS) return;
    for (let i = front.length - 1; i >= 0; i--) if (l.cost <= front[i].cost + EPS && l.time <= front[i].time + EPS) front.splice(i, 1);
    front.push(l);
  };
  const step = (from: Label | null, fromLoc: number, k: number): Label => {
    const job = inp.jobs[jobs[k]];
    const d = M[fromLoc][job.loc];
    const [start, late] = serve(job, (from ? from.time : veh.shiftStart) + d);
    return { cost: (from ? from.cost : 0) + d + WEIGHTS.late * late, time: start + job.service, prev: from, job: k };
  };
  for (let k = 0; k < n; k++) add(fronts[1 << k][k], step(null, veh.start, k));
  for (let mask = 1; mask < 1 << n; mask++) {
    for (let last = 0; last < n; last++) {
      const front = fronts[mask][last];
      if (!front.length) continue;
      const lastLoc = inp.jobs[jobs[last]].loc;
      for (let k = 0; k < n; k++) {
        if (mask & (1 << k)) continue;
        for (const l of front) add(fronts[mask | (1 << k)][k], step(l, lastLoc, k));
      }
    }
  }
  let best: Label | null = null;
  let bestCost = Infinity;
  const full = (1 << n) - 1;
  for (let last = 0; last < n; last++) {
    const back = veh.end != null ? M[inp.jobs[jobs[last]].loc][veh.end] : 0;
    for (const l of fronts[full][last]) {
      const finish = l.time + back;
      const total = l.cost + back + WEIGHTS.overtime * Math.max(0, finish - veh.shiftEnd) + WEIGHTS.finish * finish;
      if (total < bestCost - EPS) { bestCost = total; best = l; }
    }
  }
  const order: number[] = [];
  for (let l = best; l; l = l.prev) order.unshift(jobs[l.job]);
  return order;
}

/* ---------- Order improvement for longer routes (2-opt and or-opt, as in extra-mile's visit planner) ---------- */

function improveLong(inp: SolverInput, v: number, seq: number[]): number[] {
  let best = [...seq];
  let bestCost = costOf(inp, v, best);
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 1 && !improved; i++) {
      for (let k = i + 1; k < best.length && !improved; k++) {
        const cand = [...best.slice(0, i), ...best.slice(i, k + 1).reverse(), ...best.slice(k + 1)];
        const c = costOf(inp, v, cand);
        if (c < bestCost - EPS) { best = cand; bestCost = c; improved = true; }
      }
    }
    for (let len = 1; len <= 3 && !improved; len++) {
      for (let i = 0; i + len <= best.length && !improved; i++) {
        const seg = best.slice(i, i + len);
        const rest = [...best.slice(0, i), ...best.slice(i + len)];
        for (let p = 0; p <= rest.length && !improved; p++) {
          if (p === i) continue;
          const cand = [...rest.slice(0, p), ...seg, ...rest.slice(p)];
          const c = costOf(inp, v, cand);
          if (c < bestCost - EPS) { best = cand; bestCost = c; improved = true; }
        }
      }
    }
  }
  return best;
}

function nearestNeighbor(inp: SolverInput, v: number, jobs: number[]): number[] {
  const left = [...jobs];
  const out: number[] = [];
  let at = inp.vehicles[v].start;
  while (left.length) {
    let bi = 0;
    for (let i = 1; i < left.length; i++) if (inp.minutes[at][inp.jobs[left[i]].loc] < inp.minutes[at][inp.jobs[left[bi]].loc] - EPS) bi = i;
    const j = left.splice(bi, 1)[0];
    out.push(j);
    at = inp.jobs[j].loc;
  }
  return out;
}

/** Best order for one route: exact when small, otherwise nearest-neighbor + 2-opt + or-opt. */
export function bestOrder(inp: SolverInput, v: number, seq: number[], memo?: Map<string, number[]>): number[] {
  if (seq.length <= 1) return [...seq];
  const id = `${v}|${[...seq].sort((a, b) => a - b).join(",")}`;
  const hit = memo?.get(id);
  if (hit) return [...hit];
  let out: number[];
  if (seq.length <= EXACT_MAX) out = exactOrder(inp, v, seq);
  else {
    const a = improveLong(inp, v, seq);
    const b = improveLong(inp, v, nearestNeighbor(inp, v, seq));
    out = costOf(inp, v, b) < costOf(inp, v, a) - EPS ? b : a;
  }
  memo?.set(id, out);
  return [...out];
}

/* ---------- Construction ---------- */

function bestInsertion(inp: SolverInput, routes: number[][], costs: number[], j: number) {
  const per: { v: number; pos: number; delta: number }[] = [];
  for (let v = 0; v < inp.vehicles.length; v++) {
    if (!allowed(inp, j, v)) continue;
    let best = { v, pos: 0, delta: Infinity };
    for (let p = 0; p <= routes[v].length; p++) {
      const delta = fastCost(inp, v, routes[v], -1, j, p) - costs[v];
      if (delta < best.delta - EPS) best = { v, pos: p, delta };
    }
    per.push(best);
  }
  return per.sort((a, b) => a.delta - b.delta || a.v - b.v);
}

function regretConstruct(inp: SolverInput, k: number, order: number[], from?: number[][]): Solution {
  const routes = from ? from.map((r) => [...r]) : inp.vehicles.map(() => [] as number[]);
  const costs = routes.map((r, v) => costOf(inp, v, r));
  const unassigned: number[] = [];
  const left = [...order];
  while (left.length) {
    let pick = -1;
    let pickRegret = -Infinity;
    let pickBest = Infinity;
    let pickIns: { v: number; pos: number; delta: number } | null = null;
    for (let i = 0; i < left.length; i++) {
      const ins = bestInsertion(inp, routes, costs, left[i]);
      const best = ins[0]?.delta ?? Infinity;
      let regret = 0;
      for (let r = 1; r < k; r++) regret += (ins[r]?.delta ?? WEIGHTS.unassigned) - best;
      if (regret > pickRegret + EPS || (Math.abs(regret - pickRegret) <= EPS && best < pickBest - EPS)) {
        pick = i;
        pickRegret = regret;
        pickBest = best;
        pickIns = ins[0] ?? null;
      }
    }
    const j = left.splice(pick, 1)[0];
    // Pinned jobs (under way, or kept with their person) always go in, whatever they cost.
    if (!pickIns || (pickIns.delta >= WEIGHTS.unassigned && inp.jobs[j].pinned == null)) { unassigned.push(j); continue; }
    routes[pickIns.v].splice(pickIns.pos, 0, j);
    costs[pickIns.v] = costOf(inp, pickIns.v, routes[pickIns.v]);
  }
  return finish(inp, routes, unassigned);
}

function sequentialConstruct(inp: SolverInput, order: number[]): Solution {
  const routes = inp.vehicles.map(() => [] as number[]);
  const costs = inp.vehicles.map(() => 0);
  const unassigned: number[] = [];
  for (const j of order) {
    const best = bestInsertion(inp, routes, costs, j)[0];
    if (!best || (best.delta >= WEIGHTS.unassigned && inp.jobs[j].pinned == null)) { unassigned.push(j); continue; }
    routes[best.v].splice(best.pos, 0, j);
    costs[best.v] = costOf(inp, best.v, routes[best.v]);
  }
  return finish(inp, routes, unassigned);
}

/** Each job to the allowed person whose base is nearest, then the best order for each person. */
function clusterConstruct(inp: SolverInput, memo: Map<string, number[]>): Solution {
  const routes = inp.vehicles.map(() => [] as number[]);
  const unassigned: number[] = [];
  inp.jobs.forEach((job, j) => {
    let bv = -1;
    for (let v = 0; v < inp.vehicles.length; v++) {
      if (!allowed(inp, j, v)) continue;
      if (bv < 0 || inp.minutes[inp.vehicles[v].start][job.loc] < inp.minutes[inp.vehicles[bv].start][job.loc] - EPS) bv = v;
    }
    if (bv < 0) unassigned.push(j);
    else routes[bv].push(j);
  });
  return finish(inp, routes.map((r, v) => bestOrder(inp, v, r, memo)), unassigned);
}

function finish(inp: SolverInput, routes: number[][], unassigned: number[]): Solution {
  const cost = routes.reduce((a, r, v) => a + costOf(inp, v, r), 0) + unassigned.length * WEIGHTS.unassigned;
  return { routes, unassigned, cost };
}

/* ---------- Local search ---------- */

function localSearch(inp: SolverInput, start: Solution, memo: Map<string, number[]>, deadline: number): Solution {
  const routes = start.routes.map((r) => [...r]);
  const unassigned = [...start.unassigned];
  const costs = routes.map((r, v) => costOf(inp, v, r));
  const reorder = (v: number) => {
    const next = bestOrder(inp, v, routes[v], memo);
    const c = costOf(inp, v, next);
    if (c < costs[v] - EPS) { routes[v] = next; costs[v] = c; return true; }
    return false;
  };
  routes.forEach((_, v) => reorder(v));

  let improved = true;
  while (improved && now() < deadline) {
    improved = false;

    // Put back anything left out, if it now fits for less than leaving it out.
    for (let u = 0; u < unassigned.length; u++) {
      const best = bestInsertion(inp, routes, costs, unassigned[u])[0];
      if (best && best.delta < WEIGHTS.unassigned - EPS) {
        routes[best.v].splice(best.pos, 0, unassigned[u]);
        costs[best.v] = costOf(inp, best.v, routes[best.v]);
        unassigned.splice(u, 1);
        reorder(best.v);
        improved = true;
        break;
      }
    }
    if (improved) continue;

    // Leave a job out when it costs more (overtime, lateness) than leaving it out. Pinned jobs always stay.
    drop: for (let a = 0; a < routes.length; a++) {
      for (let i = 0; i < routes[a].length; i++) {
        const j = routes[a][i];
        if (inp.jobs[j].pinned != null) continue;
        const without = bestOrder(inp, a, [...routes[a].slice(0, i), ...routes[a].slice(i + 1)], memo);
        const ca = costOf(inp, a, without);
        if (ca + WEIGHTS.unassigned < costs[a] - EPS) {
          routes[a] = without; costs[a] = ca;
          unassigned.push(j);
          improved = true;
          break drop;
        }
      }
    }
    if (improved) continue;

    // Move one job to someone else.
    outer: for (let a = 0; a < routes.length; a++) {
      for (let i = 0; i < routes[a].length; i++) {
        const j = routes[a][i];
        if (inp.jobs[j].pinned != null) continue;
        const ca = fastCost(inp, a, routes[a], i);
        for (let b = 0; b < routes.length; b++) {
          if (b === a || !allowed(inp, j, b)) continue;
          for (let p = 0; p <= routes[b].length; p++) {
            const cb = fastCost(inp, b, routes[b], -1, j, p);
            if (ca + cb < costs[a] + costs[b] - EPS) {
              routes[a] = [...routes[a].slice(0, i), ...routes[a].slice(i + 1)]; costs[a] = ca;
              routes[b] = [...routes[b].slice(0, p), j, ...routes[b].slice(p)]; costs[b] = cb;
              reorder(a); reorder(b);
              improved = true;
              break outer;
            }
          }
        }
      }
    }
    if (improved) continue;

    // Swap two jobs between people.
    swap: for (let a = 0; a < routes.length; a++) {
      for (let b = a + 1; b < routes.length; b++) {
        for (let i = 0; i < routes[a].length; i++) {
          const ja = routes[a][i];
          if (inp.jobs[ja].pinned != null || !allowed(inp, ja, b)) continue;
          for (let k = 0; k < routes[b].length; k++) {
            const jb = routes[b][k];
            if (inp.jobs[jb].pinned != null || !allowed(inp, jb, a)) continue;
            const ra = [...routes[a]]; ra[i] = jb;
            const rb = [...routes[b]]; rb[k] = ja;
            const oa = bestOrder(inp, a, ra, memo);
            const ob = bestOrder(inp, b, rb, memo);
            const ca = costOf(inp, a, oa);
            const cb = costOf(inp, b, ob);
            if (ca + cb < costs[a] + costs[b] - EPS) {
              routes[a] = oa; costs[a] = ca;
              routes[b] = ob; costs[b] = cb;
              improved = true;
              break swap;
            }
          }
        }
      }
    }
  }
  return finish(inp, routes, unassigned);
}

/* ---------- Entry points ---------- */

/** Solves from routes that already exist (e.g. everyone keeps their jobs): best order per person, no moves. */
export function orderOnly(inp: SolverInput, routes: number[][]): Solution {
  const memo = new Map<string, number[]>();
  return finish(inp, routes.map((r, v) => bestOrder(inp, v, r, memo)), []);
}

export function solve(inp: SolverInput): Solution {
  const deadline = now() + (inp.budgetMs ?? 600);
  const memo = new Map<string, number[]>();
  const ids = inp.jobs.map((_, j) => j);
  // Pinned and tightly-timed jobs first, then the rest by id: a stable order for the seeded variants to shuffle.
  const tight = (j: number) => (inp.jobs[j].pinned != null ? 0 : inp.jobs[j].fixedStart != null ? 1 : inp.jobs[j].window ? 2 : 3);
  const base = [...ids].sort((a, b) => tight(a) - tight(b) || a - b);

  const starts: (() => Solution)[] = [
    () => regretConstruct(inp, 2, base),
    () => regretConstruct(inp, 3, base),
    () => clusterConstruct(inp, memo),
    ...[1, 2, 3, 4, 5].map((seed) => () => {
      const r = rng(seed * 7919 + inp.jobs.length);
      const order = [...base];
      for (let i = order.length - 1; i > 0; i--) {
        const k = Math.floor(r() * (i + 1));
        [order[i], order[k]] = [order[k], order[i]];
      }
      return sequentialConstruct(inp, order);
    }),
  ];

  let best: Solution | null = null;
  for (const make of starts) {
    if (best && now() > deadline) break;
    const sol = localSearch(inp, make(), memo, deadline);
    if (!best || sol.cost < best.cost - EPS) best = sol;
  }
  return ruinAndRecreate(inp, best!, memo, deadline);
}

/**
 * Shakes the best answer loose a few times: take out one job and its two nearest neighbours, put them back by
 * regret insertion, improve, keep it if it's cheaper. The rounds are fixed (not timed), so the result repeats.
 */
function ruinAndRecreate(inp: SolverInput, start: Solution, memo: Map<string, number[]>, deadline: number): Solution {
  let best = start;
  const free = inp.jobs.map((_, j) => j).filter((j) => inp.jobs[j].pinned == null);
  if (free.length < 2) return best;
  const rounds = Math.min(free.length > 25 ? 15 : 40, free.length * 3);
  for (let r = 0; r < rounds && now() < deadline; r++) {
    const seed = free[r % free.length];
    const size = 2 + (Math.floor(r / free.length) % 3); // 2, 3, then 4 jobs out
    const near = [...free].sort((a, b) => inp.minutes[inp.jobs[seed].loc][inp.jobs[a].loc] - inp.minutes[inp.jobs[seed].loc][inp.jobs[b].loc] || a - b).slice(0, size);
    const out = new Set(near);
    const routes = best.routes.map((route) => route.filter((j) => !out.has(j)));
    const pool = [...near, ...best.unassigned.filter((j) => !out.has(j))];
    const rebuilt = regretConstruct(inp, 2 + (r % 2), pool, routes);
    const sol = localSearch(inp, rebuilt, memo, deadline);
    if (sol.cost < best.cost - EPS) best = sol;
  }
  return best;
}

/**
 * Brute force for testing: every assignment of jobs to allowed vehicles, each route ordered exactly.
 * Only for tiny inputs (vehicles^jobs assignments).
 */
export function exhaustive(inp: SolverInput): Solution {
  const memo = new Map<string, number[]>();
  const n = inp.jobs.length;
  const V = inp.vehicles.length;
  let best: Solution | null = null;
  const assign = new Array<number>(n).fill(-1);
  const rec = (j: number) => {
    if (j === n) {
      const routes = inp.vehicles.map(() => [] as number[]);
      const unassigned: number[] = [];
      assign.forEach((v, k) => (v < 0 ? unassigned.push(k) : routes[v].push(k)));
      const sol = finish(inp, routes.map((r, v) => bestOrder(inp, v, r, memo)), unassigned);
      if (!best || sol.cost < best.cost - EPS) best = sol;
      return;
    }
    for (let v = 0; v < V; v++) if (allowed(inp, j, v)) { assign[j] = v; rec(j + 1); }
    if (inp.jobs[j].pinned == null || !allowed(inp, j, inp.jobs[j].pinned!)) { assign[j] = -1; rec(j + 1); }
  };
  rec(0);
  return best!;
}

/** Best of `count` seeded random insertion starts, each with local search (for measuring the main solver's gap). */
export function randomRestarts(inp: SolverInput, count: number, seed = 1): Solution {
  const memo = new Map<string, number[]>();
  let best: Solution | null = null;
  for (let s = 0; s < count; s++) {
    const r = rng(seed * 104729 + s);
    const order = inp.jobs.map((_, j) => j);
    for (let i = order.length - 1; i > 0; i--) {
      const k = Math.floor(r() * (i + 1));
      [order[i], order[k]] = [order[k], order[i]];
    }
    const sol = localSearch(inp, sequentialConstruct(inp, order), memo, Infinity);
    if (!best || sol.cost < best.cost - EPS) best = sol;
  }
  return best!;
}
