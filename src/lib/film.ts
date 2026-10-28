import { CUTS, FULL_VEHICLE, HOME_FILMS, ZONES, type BodyType, type Zone } from "../data/config";
import { DEFAULT_TRIM, optimize, roomPrefix, type CutPiece } from "./cutopt";
import { notify } from "./notify";
import { homeSqft, zoneLabel } from "./pricing";
import { getSession } from "./session";
import { filmLog, filmTypes, getSettings, nextNumber, newId, rolls as rollStore } from "./store";
import type { Appointment, FilmRoll, FilmType, FilmUse, Lead, Measurement, Room } from "./types";

export interface Piece { w: number; h: number; qty: number }

/**
 * Inches of roll pulled to cut these pieces. Each piece is laid whichever way uses less length;
 * a piece wider than the roll both ways is spliced from side-by-side strips.
 */
export function pullInches(pieces: Piece[], widthIn: number, wastePct: number) {
  if (widthIn <= 0) return 0;
  const raw = pieces.reduce((sum, p) => {
    if (p.w <= 0 || p.h <= 0 || p.qty <= 0) return sum;
    return sum + p.qty * Math.min(Math.ceil(p.w / widthIn) * p.h, Math.ceil(p.h / widthIn) * p.w);
  }, 0);
  return Math.round(raw * (1 + wastePct / 100));
}

/** Inches of roll for a residential job, which is measured in square feet rather than cut sizes. */
export function areaInches(sqft: number, widthIn: number, wastePct: number) {
  return widthIn > 0 ? Math.round(((sqft * 144) / widthIn) * (1 + wastePct / 100)) : 0;
}

export function vehiclePieces(body: BodyType, zones: Zone[]): Piece[] {
  return zones.flatMap((z) => CUTS[body][z].map(([w, h, qty]) => ({ w, h, qty })));
}

export function inchesLeft(roll: FilmRoll, log: FilmUse[]) {
  return roll.lengthFt * 12 - log.reduce((sum, u) => (u.rollId === roll.id ? sum + u.inches : sum), 0);
}

export const feet = (inches: number) => `${(inches / 12).toLocaleString("en-US", { maximumFractionDigits: 1 })} ft`;

export type RollHealth = "ok" | "low" | "empty";
export function rollHealth(roll: FilmRoll, left: number): RollHealth {
  if (left <= 0) return "empty";
  return left <= roll.lowFt * 12 ? "low" : "ok";
}

/** How many full sedans (fronts, rears, back glass) the rest of a roll covers: a gut check the crew already thinks in. */
export function sedansLeft(roll: FilmRoll, left: number, wastePct: number) {
  const per = pullInches(vehiclePieces("sedan", FULL_VEHICLE), roll.widthIn, wastePct);
  return per ? Math.max(0, Math.floor(left / per)) : 0;
}

/** One film + shade a job needs, so each can be deducted from the right roll. */
export interface FilmNeed {
  key: string;
  film: string;
  vlt: number | null;
  label: string;
  pieces?: Piece[];
  sqft?: number;
  /** Catalog film the job names (flat-glass rooms). */
  filmTypeId?: string;
  /** Measured, labelled panes: when present the estimate comes from the cut layout. */
  cut?: CutPiece[];
}

export function jobNeeds(lead: Lead): FilmNeed[] {
  const v = lead.vehicle;
  if (v) {
    const needs = new Map<string, FilmNeed & { zones: Zone[] }>();
    for (const z of ZONES) {
      if (!v.zones.includes(z.id)) continue;
      // Same film and shade rules as the quote (see vehicleLines).
      const film = z.id === "windshield" ? "Clear ceramic" : v.film === "ceramic" ? "Ceramic" : "Carbon";
      const vlt = z.id === "windshield" ? 70 : z.id === "frontSides" ? v.frontVlt : z.id === "visor" ? 5 : v.rearVlt;
      const key = `${film}-${vlt}`;
      const n = needs.get(key) ?? { key, film, vlt, label: "", zones: [] };
      n.zones.push(z.id);
      needs.set(key, n);
    }
    return [...needs.values()].map(({ zones, ...n }) => ({
      ...n,
      label: zones.map((z) => zoneLabel(z, v)).join(", "),
      pieces: vehiclePieces(v.body, zones),
    }));
  }
  // Real measurements beat the quote's pane-size guess.
  const rooms = roomNeeds(lead);
  if (rooms.length) return rooms;
  if (lead.home) {
    const film = HOME_FILMS[lead.home.film];
    const shade = film.shades.find((s) => s.name === lead.home!.shade);
    return [{ key: "home", film: film.name, vlt: shade?.vlt ?? null, label: `${lead.home.shade || film.name} · ~${homeSqft(lead.home)} sq ft`, sqft: homeSqft(lead.home) }];
  }
  return [];
}

export function needInches(need: FilmNeed, roll: FilmRoll, wastePct: number) {
  return needInchesAt(need, roll.widthIn, wastePct);
}

/** Inches a need pulls off a roll this wide. Measured jobs use the cut layout (trim included), so no waste % on top. */
export function needInchesAt(need: FilmNeed, widthIn: number, wastePct: number) {
  if (widthIn <= 0) return 0;
  if (need.cut?.length) return Math.ceil(optimize(need.cut, { widths: [widthIn], trim: DEFAULT_TRIM, rotate: true, multi: false, maxLengthIn: 0 }).lengthIn);
  return need.pieces ? pullInches(need.pieces, widthIn, wastePct) : areaInches(need.sqft ?? 0, widthIn, wastePct);
}

/**
 * A stocked roll with the same shade whose name mentions the film line ("ceramic", "carbon", "view", …).
 * No guess beats a wrong one: deducting carbon from a ceramic roll throws both counts off.
 * With the catalog and job passed in, it matches on film type and prefers a roll set aside for this job.
 */
export function suggestRoll(need: FilmNeed, rolls: FilmRoll[], log: FilmUse[], leadId?: string, types: FilmType[] = []) {
  const usable = rolls.filter((r) => r.status !== "lost" && inchesLeft(r, log) > 0 && rollMatches(need, r, types));
  return usable.find((r) => leadId && r.reservedLeadId === leadId) ?? usable.find((r) => !r.reservedLeadId) ?? usable[0];
}

const lineWord = (film: string) => film.toLowerCase().split(" ").pop()!;

/** The catalog film a need is for: named directly by rooms, else matched on film line and shade. */
export function needType(need: FilmNeed, types: FilmType[]) {
  if (need.filmTypeId) return types.find((t) => t.id === need.filmTypeId);
  const line = lineWord(need.film);
  return types.find((t) => t.vlt === need.vlt && `${t.series} ${t.name}`.toLowerCase().includes(line));
}

export function rollMatches(need: FilmNeed, roll: FilmRoll, types: FilmType[]) {
  const t = needType(need, types);
  if (t && roll.filmTypeId) return roll.filmTypeId === t.id;
  if (need.filmTypeId) return false;
  return roll.vlt === need.vlt && roll.name.toLowerCase().includes(lineWord(need.film));
}

/* ---------- Roll maths ---------- */

export const fullInches = (r: FilmRoll) => r.lengthFt * 12;
export const sqftOf = (widthIn: number, inches: number) => (widthIn * Math.max(0, inches)) / 144;
export const inStock = (r: FilmRoll) => r.status !== "lost";

/** Tint Wiz's figure: roll cost over the full roll's area. */
export const costPerSqft = (r: FilmRoll) => (r.cost ? r.cost / sqftOf(r.widthIn, fullInches(r)) : null);

/** What this much film off the roll cost the shop. */
export const costOf = (r: FilmRoll | undefined, inches: number) => (r?.cost ? (r.cost / fullInches(r)) * inches : 0);

/** Remaining inches from the scale: full length × (weight − core) / (full weight − core). Null until both weights are set. */
export function weighInches(r: FilmRoll, weightLb: number) {
  const core = r.coreWeightLb ?? 0;
  if (!r.fullWeightLb || r.fullWeightLb <= core || !Number.isFinite(weightLb)) return null;
  return Math.round(Math.max(0, Math.min(1, (weightLb - core) / (r.fullWeightLb - core))) * fullInches(r));
}

export const ftNum = (inches: number, digits = 1) => (inches / 12).toLocaleString("en-US", { maximumFractionDigits: digits });
export const sqftLabel = (n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: n < 100 ? 1 : 0 })} sq ft`;

/* ---------- Recording film use ---------- */

export type NewUse = Omit<FilmUse, "id" | "date" | "byId">;

/**
 * Saves film taken off (or put back on) rolls, signed by whoever is logged in.
 * Pings the crew when a roll crosses its low-stock line, once, at the moment it crosses.
 */
export function takeOff(...uses: NewUse[]): FilmUse[] {
  const before = filmLog.all();
  const date = new Date().toISOString();
  const byId = getSession().user?.id;
  const saved = uses.map((u) => ({ ...u, id: newId("C"), date, byId }));
  if (!saved.length) return [];
  filmLog.saveMany(saved);
  const after = filmLog.all();
  for (const id of new Set(saved.map((u) => u.rollId))) {
    const r = rollStore.get(id);
    if (!r) continue;
    const was = inchesLeft(r, before), now = inchesLeft(r, after);
    if (now < was && rollHealth(r, now) !== "ok" && rollHealth(r, was) !== rollHealth(r, now)) {
      notify("stock", now <= 0 ? `Roll ${rollTag(r)} is used up` : `Roll ${rollTag(r)} is down to ${feet(now)}`, `/admin/inventory/rolls/${r.id}`);
    }
  }
  return saved;
}

export const rollTag = (r: FilmRoll) => (r.code ? `${r.code} · ${r.name}` : r.name);

/* ---------- Codes, labels, scanning ---------- */

export function codeIssue(code: string, rolls: FilmRoll[], selfId?: string) {
  if (!/^[A-Za-z0-9]{4,10}$/.test(code)) return "4 to 10 letters or numbers";
  const other = rolls.find((r) => r.id !== selfId && r.code?.toLowerCase() === code.toLowerCase());
  return other ? `Already on ${other.name}` : null;
}

/** The next free sequential code, without using it up (the form may be cancelled). */
export function peekCode(rolls: FilmRoll[]) {
  let n = getSettings().sequences.roll;
  while (rolls.some((r) => r.code === String(n))) n++;
  return String(n);
}

/** Moves the roll sequence past a code that was just used. */
export function claimCode(code: string) {
  if (!/^\d+$/.test(code)) return;
  while (getSettings().sequences.roll <= Number(code)) nextNumber("roll");
}

/** Rolls added before codes existed get the next numbers, so every roll can be labelled and scanned. */
export function codeOldRolls() {
  const missing = rollStore.all().filter((r) => !r.code);
  if (!missing.length) return;
  const taken = new Set(rollStore.all().map((r) => r.code));
  rollStore.saveMany(missing.map((r) => {
    let code = nextNumber("roll");
    while (taken.has(code)) code = nextNumber("roll");
    taken.add(code);
    return { ...r, code };
  }));
}

/** What a roll's QR label encodes: opens the roll in the app from any phone camera. */
export const rollUrl = (code: string) => `${location.origin}${import.meta.env.BASE_URL}admin/inventory/r/${encodeURIComponent(code)}`;

/** A scanned label (full URL) or a typed code → the code. */
export function parseScan(text: string) {
  const m = text.match(/\/inventory\/r\/([^/?#\s]+)/);
  return (m ? decodeURIComponent(m[1]) : text).trim();
}

export const findByCode = (code: string, rolls: FilmRoll[]) => rolls.find((r) => r.code?.toLowerCase() === code.toLowerCase());

/* ---------- Film type catalog ---------- */

export const typeLabel = (t: FilmType) => [t.brand, t.name].filter(Boolean).join(" ");

export const CATEGORIES: { id: FilmType["category"]; label: string }[] = [
  { id: "auto", label: "Automotive" },
  { id: "flat", label: "Flat glass" },
  { id: "ppf", label: "PPF" },
  { id: "other", label: "Other" },
];

/** Axis's house films plus the Edge lines it installs. Fixed ids so a second seed can't duplicate them. */
export function seedTypes(): FilmType[] {
  const rate = getSettings().homeRatePerSqft;
  const t = (id: string, brand: string, series: string, name: string, vlt: number, category: FilmType["category"], pricePerSqft = 0): FilmType =>
    ({ id: `FT-${id}`, brand, series, name, vlt, category, pricePerSqft, description: "" });
  return [
    ...[5, 15, 20, 35, 50].map((v) => t(`axis-carbon-${v}`, "Axis", "Carbon", `Carbon ${v}`, v, "auto")),
    ...[5, 15, 20, 35, 50, 70].map((v) => t(`axis-ceramic-${v}`, "Axis", "Ceramic", `Ceramic ${v}`, v, "auto")),
    ...HOME_FILMS.ultraview.shades.map((s) => t(`edge-${s.name.toLowerCase().replace(/\s+/g, "-")}`, "Edge", "Ultra View", s.name, s.vlt, "flat", rate.ultraview)),
    ...HOME_FILMS.pristine.shades.map((s) => t(`edge-${s.name.toLowerCase().replace(/\s+/g, "-")}`, "Edge", "Pristine", s.name, s.vlt, "flat", rate.pristine)),
  ];
}

export function seedFilmTypes() {
  if (!filmTypes.all().length) filmTypes.saveMany(seedTypes());
}

/* ---------- Flat-glass measurements ---------- */

export const itemSqft = (m: Measurement, roundUp = false) => {
  const a = (m.w * m.h * m.qty) / 144;
  // Rounds the whole entry (qty included), like Tint Wiz; 12.00 stays 12.
  return roundUp ? Math.ceil(a - 1e-9) : a;
};
export const itemLinearFt = (m: Measurement) => (2 * (m.w + m.h) * m.qty) / 12;

/** Room initials for cut labels, made unique per job (Living Room LR, Laundry Room LR2). */
export function roomPrefixes(rooms: Room[]) {
  const used = new Map<string, number>();
  return new Map(rooms.map((r) => {
    const p = roomPrefix(r.name);
    const n = (used.get(p) ?? 0) + 1;
    used.set(p, n);
    return [r.id, n === 1 ? p : `${p}${n}`];
  }));
}

export interface RoomGroup {
  filmTypeId: string;
  pieces: CutPiece[];
  rooms: string[];
  sqft: number;
  panes: number;
}

/** Approved rooms' panes grouped by film (the item's film, else the room's), ready for the cut optimizer. */
export function roomGroups(lead: Lead): RoomGroup[] {
  const rooms = (lead.rooms ?? []).filter((r) => r.approved);
  const prefixes = roomPrefixes(lead.rooms ?? []);
  const groups = new Map<string, RoomGroup>();
  for (const room of rooms) {
    for (const m of room.items) {
      if (!(m.w > 0 && m.h > 0 && m.qty > 0)) continue;
      const id = m.filmTypeId || room.filmTypeId || "";
      const g = groups.get(id) ?? { filmTypeId: id, pieces: [], rooms: [], sqft: 0, panes: 0 };
      g.pieces.push({ prefix: prefixes.get(room.id)!, w: m.w, h: m.h, qty: m.qty });
      if (!g.rooms.includes(room.name)) g.rooms.push(room.name);
      g.sqft += itemSqft(m);
      g.panes += m.qty;
      groups.set(id, g);
    }
  }
  return [...groups.values()];
}

function roomNeeds(lead: Lead): FilmNeed[] {
  const types = filmTypes.all();
  return roomGroups(lead).map((g) => {
    const t = types.find((x) => x.id === g.filmTypeId);
    return {
      key: `ft-${g.filmTypeId || "none"}`,
      film: t ? typeLabel(t) : "Film not picked",
      vlt: t?.vlt ?? null,
      label: `${g.rooms.join(", ")} · ${g.panes} pane${g.panes === 1 ? "" : "s"} · ${sqftLabel(g.sqft)}`,
      filmTypeId: g.filmTypeId || undefined,
      pieces: g.pieces.map(({ w, h, qty }) => ({ w, h, qty })),
      cut: g.pieces,
      sqft: g.sqft,
    };
  });
}

/* ---------- Inventory summary ---------- */

export interface TypeSummary {
  key: string;
  name: string;
  type?: FilmType;
  installs: number;
  pricePerSqft: number | null;
  rolls: FilmRoll[];
  sqft: number;
  inches: number;
  value: number;
  low: number;
}

/** One row per film type in stock (or ever installed): Tint Wiz's summary, plus stock value. Lost rolls don't count as stock. */
export function summarize(types: FilmType[], rolls: FilmRoll[], log: FilmUse[]): TypeSummary[] {
  const rows = new Map<string, TypeSummary>();
  const keyOf = (r: FilmRoll) => (r.filmTypeId && types.some((t) => t.id === r.filmTypeId) ? r.filmTypeId : `name:${r.name.toLowerCase()}`);
  const row = (key: string, r?: FilmRoll) => {
    let s = rows.get(key);
    if (!s) {
      const type = types.find((t) => t.id === key);
      s = { key, type, name: type ? typeLabel(type) : r?.name ?? key, installs: 0, pricePerSqft: type ? type.pricePerSqft || null : null, rolls: [], sqft: 0, inches: 0, value: 0, low: 0 };
      rows.set(key, s);
    }
    return s;
  };
  const left = new Map(rolls.map((r) => [r.id, inchesLeft(r, log)]));
  for (const r of rolls) {
    const s = row(keyOf(r), r);
    if (!inStock(r)) continue;
    const l = Math.max(0, left.get(r.id)!);
    s.rolls.push(r);
    s.inches += l;
    s.sqft += sqftOf(r.widthIn, l);
    s.value += costOf(r, l);
    if (rollHealth(r, l) !== "ok") s.low++;
  }
  const jobs = new Map<string, Set<string>>();
  for (const u of log) {
    const r = rolls.find((x) => x.id === u.rollId);
    if (!r || !u.leadId || u.inches <= 0) continue;
    const k = keyOf(r);
    jobs.set(k, (jobs.get(k) ?? new Set()).add(u.leadId));
  }
  for (const [k, set] of jobs) row(k).installs = set.size;
  return [...rows.values()];
}

/* ---------- Forecast ---------- */

export interface ForecastJob { lead: Lead; date: string }

/** Approved or booked jobs with an install date in the next `days` days, soonest first. */
export function forecastJobs(leads: Lead[], appts: Appointment[], days: number, from = new Date()): ForecastJob[] {
  const start = isoLocal(from);
  const end = isoLocal(new Date(from.getFullYear(), from.getMonth(), from.getDate() + days));
  const out: ForecastJob[] = [];
  for (const lead of leads) {
    if (lead.status !== "approved" && lead.status !== "booked") continue;
    const dates = appts
      .filter((a) => a.leadId === lead.id && a.type === "install" && (a.status === "scheduled" || a.status === "checked_in"))
      .map((a) => a.date);
    if (lead.appointment?.date) dates.push(lead.appointment.date);
    const date = dates.filter((d) => d >= start && d <= end).sort()[0];
    if (date) out.push({ lead, date });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

const isoLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export interface ForecastRow {
  key: string;
  film: string;
  type?: FilmType;
  jobs: { lead: Lead; date: string; need: FilmNeed; sqft: number }[];
  needSqft: number;
  stockSqft: number;
  rolls: FilmRoll[];
  /** Width used to turn square feet into feet of roll: the most common matching roll, else a typical one. */
  refWidth: number;
  shortSqft: number;
}

export function forecast(jobs: ForecastJob[], rolls: FilmRoll[], log: FilmUse[], types: FilmType[], wastePct: number): ForecastRow[] {
  const ids = new Set(jobs.map((j) => j.lead.id));
  const rows = new Map<string, ForecastRow>();
  for (const { lead, date } of jobs) {
    for (const need of jobNeeds(lead)) {
      const t = needType(need, types);
      const key = t ? t.id : `${need.film}-${need.vlt}`.toLowerCase();
      let row = rows.get(key);
      if (!row) {
        // Rolls set aside for a job outside this window aren't free for these.
        const matching = rolls.filter((r) => inStock(r) && rollMatches(need, r, types) && (!r.reservedLeadId || ids.has(r.reservedLeadId)));
        const widths = matching.map((r) => r.widthIn);
        const refWidth = widths.length ? mode(widths) : need.cut || need.sqft ? 60 : 40;
        row = {
          key, film: t ? typeLabel(t) : `${need.film}${need.vlt != null ? ` ${need.vlt}%` : ""}`, type: t, jobs: [], needSqft: 0,
          stockSqft: matching.reduce((s, r) => s + sqftOf(r.widthIn, inchesLeft(r, log)), 0), rolls: matching, refWidth, shortSqft: 0,
        };
        rows.set(key, row);
      }
      const sqft = sqftOf(row.refWidth, needInchesAt(need, row.refWidth, wastePct));
      row.jobs.push({ lead, date, need, sqft });
      row.needSqft += sqft;
    }
  }
  for (const r of rows.values()) r.shortSqft = Math.max(0, r.needSqft - r.stockSqft);
  return [...rows.values()].sort((a, b) => b.shortSqft - a.shortSqft || b.needSqft - a.needSqft);
}

function mode(ns: number[]) {
  const c = new Map<number, number>();
  ns.forEach((n) => c.set(n, (c.get(n) ?? 0) + 1));
  return [...c.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
}
