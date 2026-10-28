import { digits, toCsv } from "../../lib/format";
import { paymentValue } from "../../lib/money";
import { WON_STATUSES, jobsFor, newJob } from "../../lib/project";
import { getSession } from "../../lib/session";
import { appointments, contacts, invoices, leads, newId, notes } from "../../lib/store";
import type { Contact, Lead, MessageLog, Note, Payment } from "../../lib/types";

/** "John Doe (ACME Inc)", or just one of them when they match. */
export const displayName = (c: Pick<Contact, "name" | "company">) => (c.company && c.company !== c.name ? `${c.name} (${c.company})` : c.name || c.company || "Unnamed");

export const DEFAULT_PREFS: Contact["prefs"] = { sms: true, email: true, reminders: true, followups: true };

export function blankContact(p: Partial<Contact> = {}): Contact {
  return { id: newId("CT"), name: "", phone: "", email: "", tags: [], notes: "", prefs: { ...DEFAULT_PREFS }, createdAt: new Date().toISOString(), ...p };
}

export const cleanTag = (t: string) => t.trim().toLowerCase().replace(/\s+/g, " ");
export const uniq = <T,>(a: T[]) => [...new Set(a)];

/* ---------- Per-contact rollups ---------- */

export interface ContactStats { jobs: Lead[]; won: number; value: number; last: string }

export function contactStats(cs: Contact[], ls: Lead[], pays: Payment[], msgs: MessageLog[], ns: Note[]) {
  const paid = new Map<string, number>();
  const lastPay = new Map<string, string>();
  for (const p of pays) {
    paid.set(p.leadId, (paid.get(p.leadId) ?? 0) + paymentValue(p));
    if (p.date > (lastPay.get(p.leadId) ?? "")) lastPay.set(p.leadId, p.date);
  }
  const lastMsg = new Map<string, string>();
  for (const m of msgs) if (m.leadId && m.at > (lastMsg.get(m.leadId) ?? "")) lastMsg.set(m.leadId, m.at);
  const lastNote = new Map<string, string>();
  for (const n of ns) for (const k of [n.leadId, n.contactId]) if (k && n.createdAt > (lastNote.get(k) ?? "")) lastNote.set(k, n.createdAt);

  const out = new Map<string, ContactStats>();
  for (const c of cs) {
    const jobs = jobsFor(c, ls);
    const dates = [c.createdAt, lastNote.get(c.id) ?? ""];
    for (const j of jobs) dates.push(j.createdAt, j.statusChangedAt ?? "", lastMsg.get(j.id) ?? "", lastPay.get(j.id) ?? "", lastNote.get(j.id) ?? "");
    out.set(c.id, {
      jobs,
      won: jobs.filter((j) => WON_STATUSES.includes(j.status)).length,
      value: jobs.reduce((s, j) => s + (paid.get(j.id) ?? 0), 0),
      last: dates.reduce((a, b) => (b > a ? b : a), ""),
    });
  }
  return out;
}

/* ---------- Tags ---------- */

export interface TagStat { tag: string; contacts: number; jobs: number; won: number; pct: number }

/** Conversion per tag: won jobs out of all jobs for contacts carrying that tag. */
export function tagStats(cs: Contact[], ls: Lead[]): TagStat[] {
  const map = new Map<string, TagStat>();
  for (const c of cs) {
    const jobs = jobsFor(c, ls);
    const won = jobs.filter((j) => WON_STATUSES.includes(j.status)).length;
    for (const tag of c.tags) {
      const t = map.get(tag) ?? { tag, contacts: 0, jobs: 0, won: 0, pct: 0 };
      t.contacts++; t.jobs += jobs.length; t.won += won;
      map.set(tag, t);
    }
  }
  return [...map.values()].map((t) => ({ ...t, pct: t.jobs ? Math.round((t.won / t.jobs) * 100) : 0 })).sort((a, b) => b.contacts - a.contacts || a.tag.localeCompare(b.tag));
}

export function renameTag(from: string, to: string) {
  const next = cleanTag(to);
  for (const c of contacts.all()) if (c.tags.includes(from)) contacts.update(c.id, { tags: uniq(c.tags.map((t) => (t === from ? next : t)).filter(Boolean)) });
}

/* ---------- Duplicates & merge ---------- */

/** Groups of contacts sharing a phone number (7+ digits) or an email. */
export function duplicateGroups(cs: Contact[]): Contact[][] {
  const parent = cs.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const seen = new Map<string, number>();
  cs.forEach((c, i) => {
    const keys = [digits(c.phone).slice(-10), digits(c.workPhone ?? "").slice(-10)].filter((k) => k.length >= 7).map((k) => `p${k}`);
    if (c.email.includes("@")) keys.push(`e${c.email.trim().toLowerCase()}`);
    for (const k of keys) {
      const j = seen.get(k);
      if (j == null) seen.set(k, i);
      else parent[find(i)] = find(j);
    }
  });
  const groups = new Map<number, Contact[]>();
  cs.forEach((c, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), c]));
  return [...groups.values()].filter((g) => g.length > 1);
}

/** Moves jobs, appointments, invoices and notes onto `primary`, combines tags and blank fields, deletes the rest. */
export function mergeContacts(primary: Contact, others: Contact[]) {
  const ids = new Set(others.map((o) => o.id));
  const phones = new Set(others.map((o) => digits(o.phone)).filter(Boolean));
  for (const l of leads.all()) {
    if ((l.contactId && ids.has(l.contactId)) || (!l.contactId && phones.has(digits(l.contact.phone)))) leads.update(l.id, { contactId: primary.id });
  }
  for (const a of appointments.all()) if (a.contactId && ids.has(a.contactId)) appointments.update(a.id, { contactId: primary.id });
  for (const i of invoices.all()) if (i.contactId && ids.has(i.contactId)) invoices.update(i.id, { contactId: primary.id });
  for (const n of notes.all()) if (n.contactId && ids.has(n.contactId)) notes.update(n.id, { contactId: primary.id });
  const pick = <K extends keyof Contact>(k: K) => primary[k] || others.find((o) => o[k])?.[k];
  const otherPhone = others.map((o) => o.phone).find((p) => p && digits(p) !== digits(primary.phone));
  contacts.save({
    ...primary,
    company: pick("company"), email: primary.email || others.find((o) => o.email)?.email || "", address: pick("address"), city: pick("city"),
    workPhone: primary.workPhone || otherPhone, source: pick("source"),
    notes: [primary.notes, ...others.map((o) => o.notes)].filter(Boolean).join("\n\n"),
    tags: uniq([...primary.tags, ...others.flatMap((o) => o.tags)]),
    createdAt: [primary.createdAt, ...others.map((o) => o.createdAt)].sort()[0],
  });
  others.forEach((o) => contacts.remove(o.id));
  notes.save({
    id: newId("NT"), contactId: primary.id, authorId: getSession().user?.id, createdAt: new Date().toISOString(), replies: [],
    body: `Merged in ${others.map((o) => [o.name, o.phone, o.email].filter(Boolean).join(" / ")).join("; ")}`,
  });
}

/* ---------- CSV ---------- */

/** RFC-4180-ish: quoted fields, doubled quotes, commas and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

export const IMPORT_COLUMNS = ["Name", "Company", "Mobile", "Work Phone", "Email", "Address", "City", "Tags", "Notes", "Vehicle Year", "Vehicle Make", "Vehicle Model"] as const;

type Field = "name" | "company" | "phone" | "workPhone" | "email" | "address" | "city" | "tags" | "notes" | "year" | "make" | "model";
// Our column names, plus Tint Wiz's export names so their file imports as-is.
const ALIASES: Record<string, Field> = {
  name: "name", "full name": "name", company: "company", mobile: "phone", "mobile phone": "phone", phone: "phone", cell: "phone",
  "work phone": "workPhone", phone2: "workPhone", email: "email", address: "address", city: "city", tags: "tags", notes: "notes",
  "vehicle year": "year", year: "year", "vehicle make": "make", make: "make", "vehicle model": "model", model: "model",
};

export interface ImportRow {
  line: number;
  contact: Contact;
  ymm: string;
  status: "ok" | "skip" | "dup";
  reason?: string;
  warn?: string;
}

export function readImport(text: string, existing: Contact[]): { rows: ImportRow[]; ignored: string[]; error?: string } {
  const [head, ...body] = parseCsv(text);
  if (!head) return { rows: [], ignored: [], error: "That file is empty." };
  const cols = head.map((h) => ALIASES[h.trim().toLowerCase()]);
  if (!cols.includes("name")) return { rows: [], ignored: [], error: "No Name column. Start from the template so the headers match." };
  const ignored = head.filter((_, i) => !cols[i]).map((h) => h.trim()).filter(Boolean);
  const known = new Map(existing.map((c) => [digits(c.phone).slice(-10), c] as const).filter(([k]) => k.length >= 7));
  const inFile = new Map<string, number>();
  const rows = body.map((cells, i): ImportRow => {
    const v: Partial<Record<Field, string>> = {};
    cols.forEach((f, j) => { if (f) v[f] = (cells[j] ?? "").trim(); });
    const contact = blankContact({
      name: v.name ?? "", company: v.company || undefined, phone: v.phone ?? "", workPhone: v.workPhone || undefined, email: v.email ?? "",
      address: v.address || undefined, city: v.city || undefined, notes: v.notes ?? "", source: "Import",
      tags: uniq((v.tags ?? "").split(/[;,]/).map(cleanTag).filter(Boolean)),
    });
    const ymm = [v.year, v.make, v.model].filter(Boolean).join(" ");
    const line = i + 2;
    const key = digits(contact.phone).slice(-10);
    const warn = key && key.length < 10 ? "Phone looks short" : contact.email && !/^\S+@\S+\.\S+$/.test(contact.email) ? "Email looks wrong" : undefined;
    if (!contact.name) return { line, contact, ymm, status: "skip", reason: "No name" };
    if (key.length >= 7 && known.has(key)) return { line, contact, ymm, status: "dup", reason: `Already a contact: ${known.get(key)!.name}` };
    if (key.length >= 7 && inFile.has(key)) return { line, contact, ymm, status: "dup", reason: `Same phone as row ${inFile.get(key)}` };
    if (key.length >= 7) inFile.set(key, line);
    return { line, contact, ymm, status: "ok", warn };
  });
  return { rows, ignored };
}

/** Saves the good rows; optionally opens a vehicle job for rows with a year / make / model. */
export function runImport(rows: ImportRow[], withJobs: boolean) {
  const ok = rows.filter((r) => r.status === "ok");
  contacts.saveMany(ok.map((r) => r.contact));
  let jobs = 0;
  if (withJobs) {
    for (const r of ok) {
      if (!r.ymm) continue;
      const lead = newJob("vehicle", r.contact);
      leads.update(lead.id, (l) => ({ vehicle: l.vehicle && { ...l.vehicle, ymm: r.ymm }, source: "Import" }));
      jobs++;
    }
  }
  return { contacts: ok.length, jobs };
}

export const importTemplate = () => toCsv([
  [...IMPORT_COLUMNS],
  ["Jane Sample", "", "(928) 555-0199", "", "jane@example.com", "123 Sample St", "Prescott", "referral;repeat", "Prefers texts", "2022", "Toyota", "RAV4"],
  ["Sample Fleet Manager", "Sample Plumbing Co", "(928) 555-0198", "(928) 555-0197", "fleet@example.com", "", "Prescott Valley", "fleet", "", "", "", ""],
]);

export function exportContacts(list: Contact[], stats: Map<string, ContactStats>) {
  return toCsv([
    [...IMPORT_COLUMNS.slice(0, 9), "Source", "Tax exempt", "Created", "Jobs", "Lifetime value", "Last activity"],
    ...list.map((c) => {
      const s = stats.get(c.id);
      return [c.name, c.company, c.phone, c.workPhone, c.email, c.address, c.city, c.tags.join(";"), c.notes, c.source, c.taxExempt ? "yes" : "",
        c.createdAt.slice(0, 10), s?.jobs.length ?? 0, s?.value ?? 0, s?.last.slice(0, 10)];
    }),
  ]);
}
