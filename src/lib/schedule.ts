import type { RegionId, Settings } from "../data/config";
import { publicUrl } from "./links";
import { appointments, contacts, leads } from "./store";
import type { Appointment, Lead } from "./types";

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

/** "13:00" from "1:00 PM". Local copy: format.ts imports this file, so importing its to24 back would be circular. */
const slot24 = (slot: string) => {
  const d = slotToDate("2000-01-01", slot);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** The next `count` days starting tomorrow, with the slots still open for a region. */
export function upcomingDays(s: Settings, region: RegionId, leads: Lead[], count = 28): Day[] {
  const taken = new Set(
    leads
      .filter((l) => l.appointment && l.status !== "lost")
      .map((l) => `${l.appointment!.date}|${slot24(l.appointment!.slot)}`),
  );
  // Calendar bookings made by the crew take the arrival window they start in.
  for (const a of appointments.all()) if (a.status !== "cancelled") taken.add(`${a.date}|${a.start}`);
  const days: Day[] = [];
  const d = new Date();
  for (let i = 1; i <= count; i++) {
    d.setDate(d.getDate() + 1);
    const date = isoDate(d);
    const inRegion = s.regionDays[region].includes(d.getDay()) && !s.blockedDates.includes(date);
    const open = inRegion ? s.slots.filter((slot) => !taken.has(`${date}|${slot24(slot)}`)) : [];
    days.push({ date, open, inRegion });
  }
  return days;
}

function slotToDate(date: string, slot: string) {
  const d = parseIso(date);
  const m = slot.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (m) {
    let h = Number(m[1]);
    if (m[3]) h = (h % 12) + (m[3].toUpperCase() === "PM" ? 12 : 0);
    d.setHours(h, Number(m[2]));
  }
  return d;
}

const icsStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Accepts a "9:00 AM" slot or a 24h "09:00" start. */
export function downloadIcs(opts: { date: string; slot: string; title: string; details: string; location: string; hours: number; uid?: string }) {
  const start = slotToDate(opts.date, opts.slot);
  const end = new Date(start.getTime() + opts.hours * 3600_000);
  const esc = (s: string) => s.replace(/[,;\\]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  const body = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Axis Glass Tinting//Quote//EN", "BEGIN:VEVENT",
    `UID:${opts.uid ?? Date.now()}@axisglasstinting.com`, `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`, `DTEND:${icsStamp(end)}`,
    `SUMMARY:${esc(opts.title)}`, `DESCRIPTION:${esc(opts.details)}`, `LOCATION:${esc(opts.location)}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([body], { type: "text/calendar" }));
  a.download = "axis-appointment.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** .ics for a calendar appointment. */
export const appointmentIcs = (a: Pick<Appointment, "id" | "date" | "start" | "durationMin" | "title">, location: string, details = "") =>
  downloadIcs({ date: a.date, slot: a.start, title: a.title, details, location, hours: a.durationMin / 60, uid: a.id });

/* ---------- Maps (no API key: hand off to the phone's maps app) ---------- */

export const mapsUrl = (address: string) => `https://maps.google.com/?q=${encodeURIComponent(address)}`;

/** Turn-by-turn through every stop in order, starting from the phone's current location. */
export function routeUrl(stops: string[]) {
  if (!stops.length) return "";
  const dest = stops[stops.length - 1];
  const via = stops.slice(0, -1);
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}${via.length ? `&waypoints=${encodeURIComponent(via.join("|"))}` : ""}&travelmode=driving`;
}

/** The 7 ISO dates of the week holding `date`. */
export function weekOf(date: string, weekStart: 0 | 1) {
  const d = parseIso(date);
  d.setDate(d.getDate() - ((d.getDay() - weekStart + 7) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    return isoDate(x);
  });
}

/* ---------- Appointment helpers shared by the calendar, outbox and public page ---------- */

/** Where the work happens: the job's address, else the contact's, else the city. */
export function apptAddress(a: Pick<Appointment, "leadId" | "contactId">) {
  const lead = leads.get(a.leadId);
  const c = contacts.get(a.contactId ?? lead?.contactId);
  return lead?.address || [c?.address, c?.city || lead?.city].filter(Boolean).join(", ") || lead?.city || "";
}

/** What the public /a/:id page needs when the record isn't on the customer's device. */
export interface AppointmentSnap { t: string; ty: Appointment["type"]; d: string; s: string; m: number; a: string; n: string; st: Appointment["status"] }

export function apptSnap(a: Appointment): AppointmentSnap {
  const lead = leads.get(a.leadId);
  const name = contacts.get(a.contactId ?? lead?.contactId)?.name ?? lead?.contact.name ?? "";
  return { t: a.title, ty: a.type, d: a.date, s: a.start, m: a.durationMin, a: apptAddress(a), n: name.split(/\s+/)[0] ?? "", st: a.status };
}

export const apptLink = (a: Appointment) => publicUrl("a", a.id, apptSnap(a));
