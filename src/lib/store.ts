import { useSyncExternalStore } from "react";
import { DEFAULT_SETTINGS, type Settings } from "../data/config";
import type {
  Appointment, Contact, DocTemplate, FilmRoll, FilmType, FilmUse, GeocodeEntry, Invoice, Lead, LeadStatus, MessageLog, Note,
  Notification, Payment, Proposal, ProposalTemplate, Remnant, Review, SignedDoc, Staff,
} from "./types";

/*
 * Persistence. Every record type is a `collection()` keyed in local storage. To share data across devices,
 * replace `adapter` with one backed by a server (e.g. one Supabase table of {collection, id, data});
 * nothing else in the app touches storage directly.
 */

/*
 * Businesses. One login can run several shops: each business keeps its own records and settings under its own key
 * prefix ("axis." for the first, "axis~<id>." for the rest). Code always uses "axis.*" names; the adapter maps them.
 */
export interface Business { id: string; name: string }
const BIZ_LIST = "axisBusinesses";
const BIZ_ACTIVE = "axisBusiness";
const MAIN = "main";

export function businesses(): Business[] {
  try {
    const list = JSON.parse(localStorage.getItem(BIZ_LIST) || "[]") as Business[];
    return list.some((b) => b.id === MAIN) ? list : [{ id: MAIN, name: "Axis Glass Tinting" }, ...list];
  } catch {
    return [{ id: MAIN, name: "Axis Glass Tinting" }];
  }
}
export function activeBusiness(): Business {
  let id = MAIN;
  try { id = localStorage.getItem(BIZ_ACTIVE) || MAIN; } catch { /* private mode */ }
  return businesses().find((b) => b.id === id) ?? businesses()[0];
}
const prefix = () => (activeBusiness().id === MAIN ? "axis." : `axis~${activeBusiness().id}.`);
const physical = (key: string) => (key.startsWith("axis.") ? prefix() + key.slice(5) : key);

/** Storage keys that belong to the business in use, as [stored key, "axis.*" name]. */
export function businessKeys(): [string, string][] {
  const p = prefix();
  try {
    return Object.keys(localStorage).filter((k) => k.startsWith(p)).map((k) => [k, "axis." + k.slice(p.length)]);
  } catch {
    return [];
  }
}

export function addBusiness(name: string): Business {
  const biz = { id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "shop"}-${Date.now().toString(36)}`, name: name.trim() };
  const list = businesses();
  localStorage.setItem(BIZ_LIST, JSON.stringify([...list, biz]));
  return biz;
}
export function renameBusiness(id: string, name: string) {
  localStorage.setItem(BIZ_LIST, JSON.stringify(businesses().map((b) => (b.id === id ? { ...b, name: name.trim() } : b))));
}
/** Switches business, signs out (each business has its own PINs) and reloads into its dashboard. */
export function switchBusiness(id: string) {
  localStorage.setItem(BIZ_ACTIVE, id);
  try { sessionStorage.removeItem("axis.session"); sessionStorage.removeItem("axis.viewAs"); } catch { /* ignore */ }
  location.assign(`${import.meta.env.BASE_URL}admin`);
}

interface Adapter {
  read(key: string): unknown;
  write(key: string, value: unknown): void;
}

const adapter: Adapter = {
  read(key) {
    try {
      const raw = localStorage.getItem(physical(key));
      return raw ? JSON.parse(raw) : undefined;
    } catch {
      return undefined;
    }
  },
  write(key, value) {
    try {
      localStorage.setItem(physical(key), JSON.stringify(value));
    } catch (e) {
      console.warn("Could not save", key, e);
      throw e;
    }
  },
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
export const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

// useSyncExternalStore needs stable snapshots, so parsed values are cached until the next write.
const cache = new Map<string, unknown>();
function snapshot<T>(key: string, fallback: T): T {
  if (!cache.has(key)) cache.set(key, adapter.read(key) ?? fallback);
  return cache.get(key) as T;
}
function write(key: string, value: unknown) {
  adapter.write(key, value);
  cache.set(key, value);
  emit();
}

// Another tab saved something: drop our copy so the next read sees it.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key?.startsWith(prefix())) {
      cache.delete("axis." + e.key.slice(prefix().length));
      emit();
    }
  });
}

export interface Collection<T extends { id: string }> {
  all(): T[];
  get(id: string | undefined): T | undefined;
  save(item: T): T;
  saveMany(items: T[]): void;
  update(id: string, patch: Partial<T> | ((t: T) => Partial<T>)): T | undefined;
  remove(id: string): void;
  use(): T[];
  useOne(id: string | undefined): T | undefined;
}

function collection<T extends { id: string }>(key: string, migrate?: (t: T) => T): Collection<T> {
  let migrated = !migrate;
  const all = (): T[] => {
    const list = snapshot<T[]>(key, []);
    if (!migrated) {
      migrated = true;
      const next = list.map(migrate!);
      if (next.some((t, i) => t !== list[i])) {
        cache.set(key, next);
        try { adapter.write(key, next); } catch { /* keep in memory */ }
        return next;
      }
    }
    return list;
  };
  const c: Collection<T> = {
    all,
    get: (id) => (id ? all().find((t) => t.id === id) : undefined),
    save(item) {
      const list = all();
      write(key, list.some((t) => t.id === item.id) ? list.map((t) => (t.id === item.id ? item : t)) : [item, ...list]);
      return item;
    },
    saveMany(items) {
      const ids = new Set(items.map((i) => i.id));
      write(key, [...items, ...all().filter((t) => !ids.has(t.id))]);
    },
    update(id, patch) {
      const cur = c.get(id);
      if (!cur) return undefined;
      const next = { ...cur, ...(typeof patch === "function" ? patch(cur) : patch) };
      c.save(next);
      return next;
    },
    remove: (id) => write(key, all().filter((t) => t.id !== id)),
    use: () => useSyncExternalStore(subscribe, all),
    useOne: (id) => useSyncExternalStore(subscribe, () => c.get(id)),
  };
  return c;
}

/* ---------- Collections ---------- */

const OLD_STATUS: Record<string, LeadStatus> = { contacted: "consult", completed: "installed" };

export const leads = collection<Lead>("axis.leads.v1", (l) => (OLD_STATUS[l.status] ? { ...l, status: OLD_STATUS[l.status] } : l));
export const contacts = collection<Contact>("axis.contacts.v1");
export const staff = collection<Staff>("axis.staff.v1");
export const appointments = collection<Appointment>("axis.appointments.v1");
export const proposals = collection<Proposal>("axis.proposals.v1");
export const proposalTemplates = collection<ProposalTemplate>("axis.proposalTemplates.v1");
export const invoices = collection<Invoice>("axis.invoices.v1");
export const payments = collection<Payment>("axis.payments.v1");
export const notes = collection<Note>("axis.notes.v1");
export const docTemplates = collection<DocTemplate>("axis.docTemplates.v1");
export const signedDocs = collection<SignedDoc>("axis.signedDocs.v1");
export const reviews = collection<Review>("axis.reviews.v1");
export const messages = collection<MessageLog>("axis.messages.v1");
export const notifications = collection<Notification>("axis.notifications.v1");
export const filmTypes = collection<FilmType>("axis.filmTypes.v1");
export const rolls = collection<FilmRoll>("axis.rolls.v1", (r) => (r.status ? r : { ...r, status: "in" }));
export const filmLog = collection<FilmUse>("axis.filmlog.v1");
export const remnants = collection<Remnant>("axis.remnants.v1");
export const geocodes = collection<GeocodeEntry>("axis.geocodes.v1");

/* ---------- Settings ---------- */

const SETTINGS_KEY = "axis.settings.v1";

/** Saved settings over defaults, one level deep so new nested defaults appear for existing installs. */
export function getSettings(): Settings {
  const saved = snapshot<Partial<Settings>>(SETTINGS_KEY, {});
  const out = { ...DEFAULT_SETTINGS, ...saved } as Settings;
  for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const d = DEFAULT_SETTINGS[k];
    if (d && typeof d === "object" && !Array.isArray(d) && saved[k] && typeof saved[k] === "object") {
      (out as unknown as Record<string, unknown>)[k] = { ...d, ...(saved[k] as object) };
    }
  }
  return out;
}

export function saveSettings(s: Settings) {
  write(SETTINGS_KEY, s);
}

export function patchSettings(p: Partial<Settings> | ((s: Settings) => Partial<Settings>)) {
  const s = getSettings();
  saveSettings({ ...s, ...(typeof p === "function" ? p(s) : p) });
}

let settingsSnap: Settings | null = null;
let settingsSrc: unknown = null;
export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, () => {
    const src = snapshot(SETTINGS_KEY, {});
    if (src !== settingsSrc) {
      settingsSrc = src;
      settingsSnap = getSettings();
    }
    return settingsSnap!;
  });
}

/* ---------- Back-compat helpers used across the app ---------- */

export const getLeads = () => leads.all();
export const useLeads = () => leads.use();
export const saveLead = (lead: Lead) => leads.save(lead);
export const deleteLead = (id: string) => leads.remove(id);

export const getRolls = () => rolls.all();
export const useRolls = () => rolls.use();
export const saveRoll = (r: FilmRoll) => rolls.save(r);
/** Removes the roll and its cut history. */
export function deleteRoll(id: string) {
  rolls.remove(id);
  write("axis.filmlog.v1", filmLog.all().filter((u) => u.rollId !== id));
}
export const getFilmLog = () => filmLog.all();
export const useFilmLog = () => filmLog.use();
export const addFilmUse = (...uses: FilmUse[]) => filmLog.saveMany(uses);
export const deleteFilmUse = (id: string) => filmLog.remove(id);

/** Forwards an event to the owner's Zapier / Make / CRM hook, if one is configured. */
export async function forwardLead(lead: Lead, url: string) {
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "lead.created", ...lead, completion: undefined }),
    });
  } catch (e) {
    console.warn("Lead webhook failed", e);
  }
}

export function newId(prefix: string) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}-${s}`;
}

/** Next number in a human-facing sequence (invoice 1001, roll 10001…), stored with settings. */
export function nextNumber(seq: "invoice" | "roll" | "proposal"): string {
  const s = getSettings();
  const n = s.sequences[seq];
  saveSettings({ ...s, sequences: { ...s.sequences, [seq]: n + 1 } });
  return String(n);
}

/** Wipes every record of the business in use from this device. Other businesses are untouched. */
export function resetAll() {
  businessKeys().forEach(([k]) => localStorage.removeItem(k));
  cache.clear();
  emit();
}
