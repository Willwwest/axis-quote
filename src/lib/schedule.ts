import type { RegionId, Settings } from "../data/config";
import type { Lead } from "./types";

export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const parseIso = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const prettyDate = (s: string, opts: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric" }) =>
  parseIso(s).toLocaleDateString("en-US", opts);

export interface Day {
  date: string;
  open: string[];
  inRegion: boolean;
}

/** The next `count` days starting tomorrow, with the slots still open for a region. */
export function upcomingDays(s: Settings, region: RegionId, leads: Lead[], count = 28): Day[] {
  const taken = new Set(
    leads
      .filter((l) => l.appointment && l.status !== "lost")
      .map((l) => `${l.appointment!.date}|${l.appointment!.slot}`),
  );
  const days: Day[] = [];
  const d = new Date();
  for (let i = 1; i <= count; i++) {
    d.setDate(d.getDate() + 1);
    const date = isoDate(d);
    const inRegion = s.regionDays[region].includes(d.getDay()) && !s.blockedDates.includes(date);
    const open = inRegion ? s.slots.filter((slot) => !taken.has(`${date}|${slot}`)) : [];
    days.push({ date, open, inRegion });
  }
  return days;
}

function slotToDate(date: string, slot: string) {
  const d = parseIso(date);
  const m = slot.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (m) {
    let h = Number(m[1]) % 12;
    if (m[3].toUpperCase() === "PM") h += 12;
    d.setHours(h, Number(m[2]));
  }
  return d;
}

const icsStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function downloadIcs(opts: { date: string; slot: string; title: string; details: string; location: string; hours: number }) {
  const start = slotToDate(opts.date, opts.slot);
  const end = new Date(start.getTime() + opts.hours * 3600_000);
  const esc = (s: string) => s.replace(/[,;\\]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  const body = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Axis Glass Tinting//Quote//EN", "BEGIN:VEVENT",
    `UID:${Date.now()}@axisglasstinting.com`, `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`, `DTEND:${icsStamp(end)}`,
    `SUMMARY:${esc(opts.title)}`, `DESCRIPTION:${esc(opts.details)}`, `LOCATION:${esc(opts.location)}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([body], { type: "text/calendar" }));
  a.download = "axis-appointment.ics";
  a.click();
  URL.revokeObjectURL(a.href);
}
