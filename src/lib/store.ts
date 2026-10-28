import { useSyncExternalStore } from "react";
import { DEFAULT_SETTINGS, type Settings } from "../data/config";
import type { Lead } from "./types";

// Local persistence. Swap these four functions for Supabase calls to share data across devices.

const SETTINGS_KEY = "axis.settings.v1";
const LEADS_KEY = "axis.leads.v1";

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("Could not save", key, e);
  }
  cache.delete(key);
  emit();
}

// useSyncExternalStore needs stable snapshots, so parsed values are cached until the next write.
const cache = new Map<string, unknown>();
function snapshot<T>(key: string, fallback: T): T {
  if (!cache.has(key)) cache.set(key, read(key, fallback));
  return cache.get(key) as T;
}

export function getSettings(): Settings {
  const saved = snapshot<Partial<Settings>>(SETTINGS_KEY, {});
  return { ...DEFAULT_SETTINGS, ...saved };
}

export function saveSettings(s: Settings) {
  write(SETTINGS_KEY, s);
}

export function getLeads(): Lead[] {
  return snapshot<Lead[]>(LEADS_KEY, []);
}

export function saveLead(lead: Lead) {
  const leads = getLeads().filter((l) => l.id !== lead.id);
  write(LEADS_KEY, [lead, ...leads]);
}

export function deleteLead(id: string) {
  write(LEADS_KEY, getLeads().filter((l) => l.id !== id));
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

export function useLeads(): Lead[] {
  return useSyncExternalStore(subscribe, getLeads);
}

/** Forwards a new lead to the owner's CRM / Zapier / Make hook, if one is configured. */
export async function forwardLead(lead: Lead, url: string) {
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...lead, completion: undefined }),
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
