import { useSyncExternalStore } from "react";
import type { Role, Staff } from "./types";
import { getSettings, staff, subscribe } from "./store";

/*
 * Who is using the crew dashboard. The owner signs in with the business PIN; each staff member has their own PIN.
 * This gate runs in the browser, so it keeps honest people in their lane; it is not security until a server holds the data.
 */

export type Perm =
  | "dashboard" | "jobs" | "jobs.all" | "contacts" | "calendar" | "calendar.all" | "proposals" | "invoices" | "payments"
  | "inventory" | "inventory.manage" | "tasks" | "documents" | "reviews" | "analytics" | "messages" | "settings" | "staff";

export const ROLES: { id: Role; label: string; desc: string }[] = [
  { id: "owner", label: "Owner", desc: "Everything, including staff and business settings." },
  { id: "admin", label: "Admin", desc: "Runs the office: leads, proposals, invoices, schedule, settings. Can't manage staff." },
  { id: "installer", label: "Installer", desc: "Jobs, the whole calendar, film stock and tasks. No money or settings." },
  { id: "technician", label: "Technician", desc: "Only their own appointments, those jobs' work sheets, tasks and logging film." },
];

const ALL: Perm[] = ["dashboard", "jobs", "jobs.all", "contacts", "calendar", "calendar.all", "proposals", "invoices", "payments", "inventory", "inventory.manage", "tasks", "documents", "reviews", "analytics", "messages", "settings", "staff"];

export const PERMS: Record<Role, Perm[]> = {
  owner: ALL,
  admin: ALL.filter((p) => p !== "staff"),
  installer: ["dashboard", "jobs", "jobs.all", "contacts", "calendar", "calendar.all", "inventory", "inventory.manage", "tasks", "documents"],
  technician: ["jobs", "calendar", "inventory", "tasks"],
};

export interface User {
  id: string;
  name: string;
  role: Role;
  color: string;
}

export const OWNER_ID = "owner";

const KEY = "axis.session";
const VIEW_KEY = "axis.viewAs";

function read(): { userId: string | null; viewAs: Role | null } {
  try {
    return { userId: sessionStorage.getItem(KEY), viewAs: (sessionStorage.getItem(VIEW_KEY) as Role) || null };
  } catch {
    return { userId: null, viewAs: null };
  }
}

let snap = read();
const local = new Set<() => void>();
const bump = () => { snap = read(); local.forEach((l) => l()); };

export function ownerUser(): User {
  return { id: OWNER_ID, name: getSettings().ownerName || "Owner", role: "owner", color: "rgb(var(--c-accent))" };
}

export function userFor(id: string | null | undefined): User | null {
  if (!id) return null;
  if (id === OWNER_ID) return ownerUser();
  const s = staff.get(id);
  return s && s.active ? { id: s.id, name: s.name, role: s.role, color: s.color } : null;
}

/** Name for any person id stored on a record (author, assignee…). */
export const personName = (id: string | null | undefined) => (id === OWNER_ID ? ownerUser().name : staff.get(id ?? undefined)?.name) ?? "Unassigned";

/** Returns the signed-in user, or null when the PIN doesn't match anyone. */
export function signIn(pin: string): User | null {
  const match: Staff | undefined = staff.all().find((s) => s.active && s.pin && s.pin === pin);
  const id = match ? match.id : pin === getSettings().adminPin ? OWNER_ID : null;
  if (!id) return null;
  try { sessionStorage.setItem(KEY, id); sessionStorage.removeItem(VIEW_KEY); } catch { /* private mode */ }
  bump();
  return userFor(id);
}

export function signOut() {
  try { sessionStorage.removeItem(KEY); sessionStorage.removeItem(VIEW_KEY); } catch { /* ignore */ }
  bump();
}

/** Owner-only preview of what another role sees. */
export function setViewAs(role: Role | null) {
  try { role ? sessionStorage.setItem(VIEW_KEY, role) : sessionStorage.removeItem(VIEW_KEY); } catch { /* ignore */ }
  bump();
}

export interface Session {
  user: User | null;
  /** Role used for permission checks (differs from user.role while the owner is using "View as"). */
  role: Role | null;
  viewAs: Role | null;
  can: (p: Perm) => boolean;
}

function build(): Session {
  const user = userFor(snap.userId);
  const viewAs = user?.role === "owner" ? snap.viewAs : null;
  const role = viewAs ?? user?.role ?? null;
  return { user, role, viewAs, can: (p) => !!role && PERMS[role].includes(p) };
}

let sessionSnap: Session = build();
let deps: unknown[] = [];
function current() {
  const next = [snap, staff.all(), getSettings().ownerName];
  if (next.some((d, i) => d !== deps[i])) { deps = next; sessionSnap = build(); }
  return sessionSnap;
}

export function useSession(): Session {
  return useSyncExternalStore((l) => {
    local.add(l);
    const off = subscribe(l);
    return () => { local.delete(l); off(); };
  }, current);
}

export const getSession = current;
