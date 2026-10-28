import { REGIONS, type CrewProfile, type RegionId } from "../../data/config";
import { dayDate, time12, today } from "../format";
import { notify } from "../notify";
import { setStatus } from "../project";
import { apptAddress, isoDate, parseIso } from "../schedule";
import { getSession, OWNER_ID, ownerUser } from "../session";
import { appointments, contacts, getSettings, leads, newId, staff } from "../store";
import type { Appointment, LatLng, Lead, Role } from "../types";
import { cityPoint, jobPoint, locateAddress } from "./geo";
import type { CrewMember, DayPlan, MemberRoute, OptimizeOptions, PlannedStop, Stop, WeekPlan, WeekProposal } from "./index";
import { bestOrder, evalRoute, orderOnly, solve, type SolverInput, type SolverJob, type SolverVehicle } from "./solver";
import { travelMatrix, type MatrixResult } from "./travel";
import { fromMin, haversineKm, toMin } from "./util";
import { solveWithVroom } from "./vroom";

/* ---------- Crew ---------- */

const FIELD_DEFAULT: Record<Role, boolean> = { owner: true, admin: false, installer: true, technician: true };
const WEEKDAYS = [1, 2, 3, 4, 5];

function member(id: string, name: string, color: string, role: Role, phone: string | undefined, p: CrewProfile | undefined): CrewMember {
  const r = getSettings().routing;
  const base = p?.base?.geo ?? (p?.base?.address ? locateAddress(p.base.address) : null) ?? r.base.geo ?? cityPoint("Prescott")!;
  return {
    id, name, color, role,
    phone: phone || undefined,
    base,
    baseLabel: p?.base?.address || r.base.address || base.label || "Base",
    days: p?.days?.length ? [...p.days] : WEEKDAYS,
    start: toMin(p?.start || r.dayStart),
    end: toMin(p?.end || r.dayEnd),
    regions: p?.regions?.length ? [...p.regions] : undefined,
  };
}

/** People who get routed: the owner and active installers/technicians, unless their profile says otherwise. */
export function crew(): CrewMember[] {
  const profiles = getSettings().routing.crew;
  const out: CrewMember[] = [];
  if (profiles[OWNER_ID]?.field ?? true) {
    const u = ownerUser();
    out.push(member(OWNER_ID, u.name, u.color, "owner", undefined, profiles[OWNER_ID]));
  }
  for (const s of staff.all()) {
    if (s.active && (profiles[s.id]?.field ?? FIELD_DEFAULT[s.role])) out.push(member(s.id, s.name, s.color, s.role, s.phone, profiles[s.id]));
  }
  return out;
}

/** Anyone by id, even when they aren't set up for field work: their booked jobs still need a route. */
export function memberById(id: string | undefined): CrewMember | null {
  if (!id) return null;
  const found = crew().find((m) => m.id === id);
  if (found) return found;
  const profiles = getSettings().routing.crew;
  if (id === OWNER_ID) {
    const u = ownerUser();
    return member(OWNER_ID, u.name, u.color, "owner", undefined, profiles[OWNER_ID]);
  }
  const s = staff.get(id);
  return s ? member(s.id, s.name, s.color, s.role, s.phone, profiles[s.id]) : null;
}

/* ---------- Stops ---------- */

const ACTIVE = new Set<Appointment["status"]>(["scheduled", "checked_in", "done"]);
const weekday = (date: string) => parseIso(date).getDay();
const plainName = (name: string) => name.replace(/\s*\(Sample\)\s*$/, "");

export function toStop(a: Appointment): Stop | null {
  const lead = leads.get(a.leadId);
  const contact = contacts.get(a.contactId ?? lead?.contactId);
  if (a.type === "misc" && !lead && !contact) return null;
  const point = lead || contact ? jobPoint(lead, contact) : null;
  if (a.type === "misc" && !point) return null;
  const booked = toMin(a.start);
  const promised = !!lead?.appointment || a.notifyCustomer;
  return {
    id: a.id, appointment: a, lead, contact, type: a.type, title: a.title,
    customer: contact?.name ?? lead?.contact.name ?? a.title,
    phone: contact?.phone || lead?.contact.phone || undefined,
    address: apptAddress(a),
    point,
    durationMin: a.durationMin,
    booked,
    window: promised ? [booked - 30, booked + 30] : undefined,
    assigneeId: a.assigneeId,
    locked: a.status !== "scheduled",
    region: lead?.region ?? undefined,
  };
}

/** The day's appointments that need someone on site (not cancelled or no-show). */
export function stopsFor(date: string): Stop[] {
  return appointments.all()
    .filter((a) => a.date === date && ACTIVE.has(a.status))
    .map(toStop)
    .filter((s): s is Stop => !!s)
    .sort((a, b) => a.booked - b.booked || a.id.localeCompare(b.id));
}

/* ---------- Building and reading a solver problem ---------- */

interface Problem {
  date: string;
  members: CrewMember[];
  stops: Stop[];
  points: LatLng[];
  input: SolverInput;
  matrix: MatrixResult;
}

async function buildProblem(date: string, members: CrewMember[], stops: Stop[], spec: (s: Stop) => Partial<SolverJob>): Promise<Problem> {
  const r = getSettings().routing;
  const points: LatLng[] = [...members.map((m) => m.base), ...stops.map((s) => s.point!)];
  const matrix = await travelMatrix(points);
  const vehicles: SolverVehicle[] = members.map((m, i) => ({ start: i, end: r.returnToBase ? i : null, shiftStart: m.start, shiftEnd: m.end, regions: m.regions }));
  const jobs: SolverJob[] = stops.map((s, k) => ({ loc: members.length + k, service: s.durationMin + r.bufferMin, window: s.window, region: s.region, ...spec(s) }));
  return { date, members, stops, points, matrix, input: { vehicles, jobs, minutes: matrix.seconds.map((row) => row.map((x) => x / 60)) } };
}

const miles = (meters: number) => meters / 1609.344;
const round1 = (n: number) => Math.round(n * 10) / 10;

function toPlan(p: Problem, routes: number[][], unassigned: DayPlan["unassigned"], optimizer: DayPlan["optimizer"], warnings: string[]): DayPlan {
  const n = p.members.length;
  const out: MemberRoute[] = routes.map((seq, v) => {
    const ev = evalRoute(p.input, v, seq);
    let at = v;
    let mi = 0;
    const stops: PlannedStop[] = ev.visits.map((vis) => {
      const s = p.stops[vis.job];
      const leg = miles(p.matrix.meters[at][n + vis.job]);
      at = n + vis.job;
      mi += leg;
      return { stop: s, arrive: vis.arrive, start: vis.start, end: vis.start + s.durationMin, driveMin: Math.round(vis.drive), driveMiles: round1(leg), late: vis.late > 0.5 };
    });
    const back = seq.length && p.input.vehicles[v].end != null ? miles(p.matrix.meters[at][v]) : 0;
    return {
      member: p.members[v], date: p.date, stops,
      driveMin: Math.round(ev.drive + ev.returnDrive),
      driveMiles: round1(mi + back),
      returnMin: Math.round(ev.returnDrive),
      finish: ev.finish,
      overtime: ev.overtime > 0.5,
    };
  });
  const notes = [...warnings];
  if (p.matrix.warning) notes.unshift(p.matrix.warning);
  const approx = p.stops.filter((s) => s.point?.source === "city").length;
  if (approx) notes.push(`${approx} stop${approx === 1 ? " is" : "s are"} at the town center until the address is looked up, so those drive times are rough.`);
  for (const r of out) if (r.overtime) notes.push(`${r.member.name} would be out until ${time12(fromMin(r.finish))}, past their ${time12(fromMin(r.member.end))} finish.`);
  const late = out.reduce((a, r) => a + r.stops.filter((s) => s.late).length, 0);
  if (late) notes.push(`${late} stop${late === 1 ? "" : "s"} would start after the time the customer was given.`);
  return {
    date: p.date,
    routes: out,
    unassigned,
    driveMin: out.reduce((a, r) => a + r.driveMin, 0),
    driveMiles: round1(out.reduce((a, r) => a + r.driveMiles, 0)),
    travel: p.matrix.source,
    optimizer,
    warnings: [...new Set(notes)],
  };
}

/**
 * The crew for a date: whoever works that weekday, plus anyone already booked that day (even on a day off, or
 * outside `only`), so their stops stay theirs.
 */
function crewFor(date: string, stops: Stop[], only?: string[]) {
  const wd = weekday(date);
  const members = crew().filter((m) => m.days.includes(wd) && (!only || only.includes(m.id)));
  for (const s of stops) {
    if (s.assigneeId && !members.some((m) => m.id === s.assigneeId)) {
      const extra = memberById(s.assigneeId);
      if (extra) members.push(extra);
    }
  }
  return members;
}

const regionLabel = (id?: RegionId) => REGIONS.find((r) => r.id === id)?.label ?? "this area";
const weekdayName = (date: string) => parseIso(date).toLocaleDateString("en-US", { weekday: "long" });

/* ---------- Day plans ---------- */

/** The day as booked now: each person's stops in start-time order, with the drives between them. */
export async function currentPlan(date: string): Promise<DayPlan> {
  const all = stopsFor(date);
  const members = crewFor(date, all);
  const unassigned: DayPlan["unassigned"] = [];
  const routable: Stop[] = [];
  for (const s of all) {
    if (!s.point) unassigned.push({ stop: s, reason: "No map location for this address yet." });
    else if (!s.assigneeId || !members.some((m) => m.id === s.assigneeId)) unassigned.push({ stop: s, reason: "Not assigned to anyone yet." });
    else routable.push(s);
  }
  const p = await buildProblem(date, members, routable, (s) => ({ fixedStart: s.booked, pinned: members.findIndex((m) => m.id === s.assigneeId) }));
  const routes = members.map((m) => routable.map((s, k) => (s.assigneeId === m.id ? k : -1)).filter((k) => k >= 0));
  return toPlan(p, routes, unassigned, "current", []);
}

/** The solver problem for a day (exported for tests and gap measurements; UI code uses optimizeDay). */
export async function prepareDay(date: string, opts: OptimizeOptions = {}) {
  const all = stopsFor(date);
  const only = opts.memberIds?.length ? opts.memberIds : undefined;
  const members = crewFor(date, all, only);
  const unassigned: DayPlan["unassigned"] = [];
  const routable = all.filter((s) => {
    if (s.point) return true;
    unassigned.push({ stop: s, reason: "No map location for this address yet." });
    return false;
  });
  const index = (id?: string) => (id ? members.findIndex((m) => m.id === id) : -1);
  const p = await buildProblem(date, members, routable, (s) => {
    const owner = index(s.assigneeId);
    const elsewhere = !!only && !!s.assigneeId && !only.includes(s.assigneeId);
    const pin = owner >= 0 && (s.locked || opts.keepAssignees || elsewhere);
    const fixed = s.locked || opts.keepTimes || elsewhere;
    return { ...(pin ? { pinned: owner } : {}), ...(fixed ? { fixedStart: s.booked } : {}) };
  });
  // People outside `only` keep their own stops and take nothing new.
  if (only) p.input.vehicles.forEach((v, i) => { if (!only.includes(members[i].id)) v.pinnedOnly = true; });
  return { p, members, unassigned };
}

/** Best assignment and order for the day across the crew. Doesn't save anything. */
export async function optimizeDay(date: string, opts: OptimizeOptions = {}): Promise<DayPlan> {
  const r = getSettings().routing;
  const { p, members, unassigned } = await prepareDay(date, opts);
  const warnings: string[] = [];
  const allPinned = p.input.jobs.every((j) => j.pinned != null);
  let best = allPinned
    ? orderOnly(p.input, members.map((_, v) => p.input.jobs.map((j, k) => (j.pinned === v ? k : -1)).filter((k) => k >= 0)))
    : solve(p.input);
  let optimizer: DayPlan["optimizer"] = "builtin";

  if (r.optimizer === "vroom") {
    if (!r.orsKey) warnings.push("VROOM needs a free OpenRouteService key (Settings → Routing), so the built-in optimizer planned this day.");
    else {
      try {
        const v = await solveWithVroom(p.input, p.points, r.orsKey);
        const cost = v.routes.reduce((a, seq, i) => a + evalRoute(p.input, i, seq).cost, 0) + v.unassigned.length * 5000;
        // Keep whichever is better by the same yardstick; VROOM's own clock comes from its road data, not ours.
        if (cost <= best.cost + 1e-6) { best = { ...v, cost }; optimizer = "vroom"; }
      } catch {
        warnings.push("VROOM (OpenRouteService) didn't answer, so the built-in optimizer planned this day.");
      }
    }
  }

  for (const k of best.unassigned) {
    const s = p.stops[k];
    const covers = members.some((m) => !m.regions || !s.region || m.regions.includes(s.region));
    unassigned.push({
      stop: s,
      reason: covers ? "Doesn't fit anyone's hours that day." : `No one covering ${regionLabel(s.region)} works ${weekdayName(date)}.`,
    });
  }
  if (!members.length) warnings.push(`No one is set up to work ${weekdayName(date)}s (Settings → Routing).`);
  return toPlan(p, best.routes, unassigned, optimizer, warnings);
}

/** Saves a plan: updates each appointment's person and start time (with a history entry). Returns how many changed. */
export function applyDayPlan(plan: DayPlan): number {
  const by = getSession().user?.id;
  const at = new Date().toISOString();
  const touched = new Set<string>();
  let changed = 0;
  for (const route of plan.routes) {
    for (const ps of route.stops) {
      if (ps.stop.proposed) continue;
      const a = appointments.get(ps.stop.id);
      if (!a) continue;
      const start = fromMin(ps.start);
      if (a.assigneeId === route.member.id && a.start === start) continue;
      appointments.update(a.id, {
        assigneeId: route.member.id,
        start,
        history: [...(a.history ?? []), { at, text: `Route planner: moved to ${route.member.name} at ${time12(start)}`, by }],
      });
      if (a.assigneeId) touched.add(a.assigneeId);
      touched.add(route.member.id);
      changed++;
    }
  }
  for (const id of touched) {
    if (id !== by) notify("appointment", `Your route for ${dayDate(plan.date)} changed`, `/admin/routes?d=${plan.date}`, [id]);
  }
  return changed;
}

/* ---------- Week planning ---------- */

/** Won jobs (approved or booked) with no upcoming install on the calendar. */
export function unscheduledJobs(): Lead[] {
  const t = today();
  const booked = new Set(
    appointments.all().filter((a) => a.type === "install" && a.date >= t && a.status !== "cancelled" && a.status !== "no_show").map((a) => a.leadId),
  );
  return leads.all()
    .filter((l) => (l.status === "approved" || l.status === "booked") && !booked.has(l.id))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

/** How long an install takes: vehicles 2.5 h (+30 min for a windshield), flat glass by measured area. */
export function installMinutes(lead: Lead) {
  if (lead.kind === "vehicle") return 150 + (lead.vehicle?.zones.includes("windshield") ? 30 : 0);
  const sq = (lead.rooms ?? []).filter((r) => r.approved).reduce((a, r) => a + r.items.reduce((b, it) => b + (it.w * it.h * it.qty) / 144, 0), 0);
  return sq ? Math.min(480, Math.max(120, Math.round(sq / 60) * 60)) : getSettings().calendar.defaultDurationMin;
}

const ANCHORS: { id: RegionId; at: LatLng }[] = [
  { id: "quad", at: { lat: 34.5815, lng: -112.4528 } },
  { id: "phx", at: { lat: 33.4484, lng: -112.074 } },
];

/** Region for a job that doesn't say: the nearer of the Quad Cities and the Valley, else statewide. */
function regionAt(p: LatLng): RegionId {
  const near = ANCHORS.map((a) => ({ id: a.id, km: haversineKm(p, a.at) })).sort((a, b) => a.km - b.km)[0];
  return near.km < (near.id === "phx" ? 70 : 50) ? near.id : "other";
}

const SHORT: Record<RegionId, string> = { quad: "Quad Cities", phx: "Valley", other: "statewide" };

function dateRange(from: string, days: number) {
  const d = parseIso(from);
  return Array.from({ length: days }, (_, i) => {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    return isoDate(x);
  });
}

/** Turns an unscheduled job into a stop-shaped thing the planner can place. */
function proposalStop(lead: Lead, date: string, durationMin: number, region: RegionId): Stop {
  const contact = contacts.get(lead.contactId);
  const name = contact?.name ?? lead.contact.name;
  const appointment: Appointment = {
    id: `proposal-${lead.id}`, leadId: lead.id, contactId: lead.contactId, type: "install", title: `Install · ${plainName(name)}`,
    date, start: "08:00", durationMin, notifyCustomer: true, status: "scheduled",
  };
  return {
    id: appointment.id, appointment, lead, contact, type: "install", title: appointment.title, customer: name,
    phone: contact?.phone || lead.contact.phone || undefined, address: apptAddress(appointment), point: jobPoint(lead, contact),
    durationMin, booked: 8 * 60, assigneeId: undefined, locked: false, region, proposed: true,
  };
}

/** Puts unscheduled jobs on route days for their region with the person who adds the least driving. Doesn't save. */
export async function planWeek(from: string, days = 7, opts: { leadIds?: string[] } = {}): Promise<WeekPlan> {
  const s = getSettings();
  const jobs = opts.leadIds ? opts.leadIds.map((id) => leads.get(id)).filter((l): l is Lead => !!l) : unscheduledJobs();
  const dates = dateRange(from, Math.max(1, days));
  const unplaced: WeekPlan["unplaced"] = [];

  const todo = jobs.flatMap((lead) => {
    const point = jobPoint(lead);
    if (!point) { unplaced.push({ lead, reason: "No map location for this address yet." }); return []; }
    return [{ lead, point, region: (lead.region ?? regionAt(point)) as RegionId, minutes: installMinutes(lead) }];
  });

  // One matrix for everything up front; every per-day problem below is then answered from the cache.
  const existing = dates.map((d) => stopsFor(d));
  const everyone = crew();
  await travelMatrix([...everyone.map((m) => m.base), ...existing.flat().filter((x) => x.point).map((x) => x.point!), ...todo.map((t) => t.point)]);

  // A problem per day: that day's booked stops (kept with their person and time) plus every job we might add.
  const problems = await Promise.all(dates.map(async (date, di) => {
    const booked = existing[di].filter((x) => x.point);
    const members = crewFor(date, booked);
    const candidates = todo.map((t) => proposalStop(t.lead, date, t.minutes, t.region));
    const p = await buildProblem(date, members, [...booked, ...candidates], (x) => {
      if (x.proposed) return { window: undefined, round: 30 };
      const owner = members.findIndex((m) => m.id === x.assigneeId);
      return owner >= 0 ? { pinned: owner, fixedStart: x.booked } : { fixedStart: x.booked };
    });
    const routes = members.map((m) => booked.map((x, k) => (x.assigneeId === m.id ? k : -1)).filter((k) => k >= 0));
    return { date, di, members, p, routes, bookedCount: booked.length, unbooked: existing[di].filter((x) => !x.point) };
  }));

  const chosen: { t: (typeof todo)[number]; ti: number; day: (typeof problems)[number]; v: number }[] = [];
  todo.forEach((t, ti) => {
    let best: { day: (typeof problems)[number]; v: number; delta: number; seq: number[] } | null = null;
    let reason = "";
    const routeDays = s.regionDays[t.region] ?? [];
    for (const day of problems) {
      const wd = weekday(day.date);
      // Too late to book a customer for today.
      if (day.date <= today() || s.blockedDates.includes(day.date)) continue;
      if (routeDays.length ? !routeDays.includes(wd) : !WEEKDAYS.includes(wd)) continue;
      const jobIdx = day.bookedCount + ti;
      day.members.forEach((m, v) => {
        if (!m.days.includes(wd) || (m.regions && !m.regions.includes(t.region))) return;
        const installs = day.routes[v].filter((k) => day.p.stops[k].type === "install").length;
        if (installs >= s.routing.maxJobsPerDay) { reason ||= `Every ${SHORT[t.region]} day in the next ${days} days is full.`; return; }
        const before = evalRoute(day.p.input, v, day.routes[v]);
        const seq = bestOrder(day.p.input, v, [...day.routes[v], jobIdx]);
        const after = evalRoute(day.p.input, v, seq);
        // Adding a job must not make anyone late or keep them past their finish.
        if (after.late > before.late + 0.5 || after.overtime > before.overtime + 0.5) { reason ||= `No ${SHORT[t.region]} day in the next ${days} days has room.`; return; }
        const delta = after.cost - before.cost;
        if (!best || delta < best.delta - 1e-6) best = { day, v, delta, seq };
      });
    }
    if (!best) {
      const covers = everyone.some((m) => !m.regions || m.regions.includes(t.region));
      unplaced.push({
        lead: t.lead,
        reason: !covers ? `No one is set up to cover ${regionLabel(t.region)}.` : reason || `No ${SHORT[t.region]} route day in the next ${days} days.`,
      });
      return;
    }
    const b = best as { day: (typeof problems)[number]; v: number; delta: number; seq: number[] };
    b.day.routes[b.v] = b.seq;
    chosen.push({ t, ti, day: b.day, v: b.v });
  });

  // Final order and times per day; proposals take the time their slot in the route gives them.
  const proposals: WeekProposal[] = [];
  const outDays = problems.map((day) => {
    const wd = weekday(day.date);
    const regions = REGIONS.filter((r) => s.regionDays[r.id].includes(wd)).map((r) => r.id);
    const routes = day.routes.map((seq, v) => (seq.length ? bestOrder(day.p.input, v, seq) : seq));
    const unassigned = day.unbooked.map((x) => ({ stop: x, reason: "No map location for this address yet." }));
    const plan = toPlan(day.p, routes, unassigned, chosen.some((c) => c.day === day) ? "builtin" : "current", []);
    for (const c of chosen.filter((x) => x.day === day)) {
      const route = plan.routes[c.v];
      const i = route.stops.findIndex((ps) => ps.stop.id === `proposal-${c.t.lead.id}`);
      if (i < 0) continue;
      const ps = route.stops[i];
      const prev = i > 0 ? plainName(route.stops[i - 1].stop.customer) : route.member.baseLabel.replace(/,\s*(AZ|Arizona)\b.*$/i, "");
      const dayShort = parseIso(day.date).toLocaleDateString("en-US", { weekday: "short" });
      const lead = c.t.region === "other" ? `${dayShort} has room` : `${dayShort} is a ${SHORT[c.t.region]} day`;
      proposals.push({ lead: c.t.lead, date: day.date, memberId: route.member.id, start: ps.start, durationMin: c.t.minutes, reason: `${lead} · ${ps.driveMin} min from ${prev}` });
    }
    return { date: day.date, regions, plan };
  });
  proposals.sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  return { from, days: outDays, proposals, unplaced };
}

/** Creates the install appointments from a week plan and marks those jobs booked. Returns the new appointments. */
export function applyWeekPlan(plan: WeekPlan): Appointment[] {
  const by = getSession().user?.id;
  const at = new Date().toISOString();
  return plan.proposals.map((p) => {
    const lead = leads.get(p.lead.id) ?? p.lead;
    const name = plainName(contacts.get(lead.contactId)?.name ?? lead.contact.name);
    const start = fromMin(p.start);
    const who = memberById(p.memberId)?.name ?? "the crew";
    const a: Appointment = {
      id: newId("AP"), leadId: lead.id, contactId: lead.contactId, type: "install", title: `Install · ${name}`,
      date: p.date, start, durationMin: p.durationMin, assigneeId: p.memberId, notifyCustomer: true, status: "scheduled",
      history: [{ at, text: `Booked by the route planner with ${who}`, by }],
    };
    appointments.save(a);
    setStatus(lead, "booked");
    leads.update(lead.id, { appointment: { date: p.date, slot: time12(start) } });
    if (p.memberId !== by) notify("appointment", `New install: ${name} on ${dayDate(p.date)} at ${time12(start)}`, `/admin/jobs/${lead.id}`, [p.memberId]);
    return a;
  });
}
