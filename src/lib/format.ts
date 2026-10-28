import { isoDate, parseIso } from "./schedule";

export const money = (n: number, cents = false) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });

export const digits = (phone: string) => phone.replace(/\D/g, "");

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

/** "Oct 27" */
export const shortDate = (iso: string) => {
  const d = iso.length === 10 ? parseIso(iso) : new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

/** "Mon, Oct 27" */
export const dayDate = (iso: string) => {
  const d = iso.length === 10 ? parseIso(iso) : new Date(iso);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
};

/** "9:30 AM" from "09:30" */
export function time12(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** "09:30" from "9:30 AM" (the customer app's slot labels). */
export function to24(slot: string) {
  const m = slot.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return "09:00";
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

export function addMinutes(hhmm: string, min: number) {
  const [h, m] = hhmm.split(":").map(Number);
  const t = h * 60 + m + min;
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/** Local Date for an appointment's date + start. */
export function at(date: string, hhmm: string) {
  const d = parseIso(date);
  const [h, m] = hhmm.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

export function relative(iso: string) {
  const diff = Date.now() - +new Date(iso);
  const min = Math.round(diff / 60000);
  if (Math.abs(min) < 1) return "just now";
  if (Math.abs(min) < 60) return min > 0 ? `${min}m ago` : `in ${-min}m`;
  const h = Math.round(min / 60);
  if (Math.abs(h) < 24) return h > 0 ? `${h}h ago` : `in ${-h}h`;
  const d = Math.round(h / 24);
  if (Math.abs(d) < 30) return d > 0 ? `${d}d ago` : `in ${-d}d`;
  return shortDate(iso);
}

export const today = () => isoDate(new Date());

export function addDays(iso: string, n: number) {
  const d = parseIso(iso);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

export const sqft = (wIn: number, hIn: number, qty = 1) => (wIn * hIn * qty) / 144;

export function downloadFile(name: string, body: string, type = "text/plain") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([body], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function toCsv(rows: (string | number | null | undefined)[][]) {
  return rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
}
