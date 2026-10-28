import { addDays, today } from "../../lib/format";
import { isoDate, parseIso } from "../../lib/schedule";

/** Inclusive local ISO dates. */
export interface Range { from: string; to: string }

export type Preset = "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth" | "thisQuarter" | "thisYear" | "custom";
export type Compare = "previous" | "lastYear" | "none";

export const PRESETS: { id: Preset; label: string }[] = [
  { id: "thisWeek", label: "This week" },
  { id: "lastWeek", label: "Last week" },
  { id: "thisMonth", label: "This month" },
  { id: "lastMonth", label: "Last month" },
  { id: "thisQuarter", label: "This quarter" },
  { id: "thisYear", label: "This year" },
  { id: "custom", label: "Custom" },
];

export const MAX_DAYS = 366;

/** Same day-of-month n months away, clamped to the month's end (Jan 31 + 1 → Feb 28). */
export function addMonths(iso: string, n: number) {
  const d = parseIso(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return isoDate(d);
}

const monthStart = (iso: string) => `${iso.slice(0, 8)}01`;
const monthEnd = (iso: string) => addDays(addMonths(monthStart(iso), 1), -1);
export const daysIn = (r: Range) => Math.round((+parseIso(r.to) - +parseIso(r.from)) / 864e5) + 1;

export function weekRange(iso: string, weekStart: 0 | 1): Range {
  const d = parseIso(iso);
  const from = addDays(iso, -((d.getDay() - weekStart + 7) % 7));
  return { from, to: addDays(from, 6) };
}

export function monthRange(iso: string): Range {
  return { from: monthStart(iso), to: monthEnd(iso) };
}

export function presetRange(p: Preset, weekStart: 0 | 1, now = today()): Range {
  switch (p) {
    case "thisWeek": return weekRange(now, weekStart);
    case "lastWeek": return weekRange(addDays(now, -7), weekStart);
    case "thisMonth": return monthRange(now);
    case "lastMonth": return monthRange(addMonths(monthStart(now), -1));
    case "thisQuarter": {
      const q = Math.floor((parseIso(now).getMonth()) / 3) * 3;
      const from = `${now.slice(0, 4)}-${String(q + 1).padStart(2, "0")}-01`;
      return { from, to: addDays(addMonths(from, 3), -1) };
    }
    case "thisYear": return { from: `${now.slice(0, 4)}-01-01`, to: `${now.slice(0, 4)}-12-31` };
    default: return { from: addDays(now, -29), to: now };
  }
}

/** The period to compare against: the one just before (same kind of period), or the same dates a year earlier. */
export function compareRange(r: Range, p: Preset, c: Compare): Range | null {
  if (c === "none") return null;
  if (c === "lastYear") return { from: addMonths(r.from, -12), to: addMonths(r.to, -12) };
  if (p === "thisWeek" || p === "lastWeek") return { from: addDays(r.from, -7), to: addDays(r.to, -7) };
  if (p === "thisMonth" || p === "lastMonth") return monthRange(addMonths(r.from, -1));
  if (p === "thisQuarter") { const from = addMonths(r.from, -3); return { from, to: addDays(r.from, -1) }; }
  if (p === "thisYear") return { from: addMonths(r.from, -12), to: addDays(r.from, -1) };
  const n = daysIn(r);
  return { from: addDays(r.from, -n), to: addDays(r.from, -1) };
}

export type Grain = "day" | "week" | "month";
export const grainFor = (r: Range): Grain => (daysIn(r) <= 31 ? "day" : daysIn(r) <= 120 ? "week" : "month");

export interface Bucket extends Range { label: string }

const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => parseIso(iso).toLocaleDateString("en-US", o);

/** Consecutive slices of the range: days, 7-day weeks from the start, or calendar months. */
export function buckets(r: Range, g: Grain): Bucket[] {
  const out: Bucket[] = [];
  let from = r.from;
  while (from <= r.to && out.length < 400) {
    const end = g === "day" ? from : g === "week" ? addDays(from, 6) : monthEnd(from);
    const to = end > r.to ? r.to : end;
    out.push({ from, to, label: g === "month" ? fmt(from, { month: "short" }) : fmt(from, { month: "short", day: "numeric" }) });
    from = addDays(to, 1);
  }
  return out;
}

export function rangeLabel(r: Range) {
  const sameYear = r.from.slice(0, 4) === r.to.slice(0, 4);
  const a = fmt(r.from, { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
  const b = fmt(r.to, { month: "short", day: "numeric", year: "numeric" });
  return r.from === r.to ? b : `${a} – ${b}`;
}

/** Keeps a custom range in order and within a year. */
export function clampRange(r: Range): Range {
  const [from, to] = r.from <= r.to ? [r.from, r.to] : [r.to, r.from];
  return daysIn({ from, to }) > MAX_DAYS ? { from: addDays(to, -(MAX_DAYS - 1)), to } : { from, to };
}
