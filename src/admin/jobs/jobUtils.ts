import { useEffect, useState } from "react";
import { INITIAL } from "../../pages/quote/context";
import { at } from "../../lib/format";
import { buildQuote } from "../../lib/pricing";
import { ownerUser, OWNER_ID } from "../../lib/session";
import { staff } from "../../lib/store";
import type { Appointment, HomeSpec, Lead, QuoteState } from "../../lib/types";
import type { Settings } from "../../data/config";

/** Shrinks a phone photo to a ~1200px JPEG so it fits in local storage. */
export function compressImage(file: File, max = 1200): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/** Images get compressed; other files are stored as-is. */
export const fileToDataUrl = (f: File) => (f.type.startsWith("image/") && f.type !== "image/gif" ? compressImage(f) : readDataUrl(f));

export const BLANK_HOME: HomeSpec = { panes: { small: 0, standard: 0, large: 0, door: 0 }, goals: [], film: INITIAL.home.film, shade: INITIAL.home.shade };

/** The quote-flow state a job was (or would have been) priced from. */
export function quoteState(lead: Lead): QuoteState {
  const { vehicle, home, ...rest } = lead;
  return { ...rest, vehicle: vehicle ?? INITIAL.vehicle, home: home ?? BLANK_HOME };
}

export const requote = (lead: Lead, s: Settings) => buildQuote(s, quoteState(lead));

export type KindFilter = "vehicle" | "home" | "business";
export const kindOf = (l: Lead): KindFilter => (l.kind === "vehicle" ? "vehicle" : l.kind === "business" ? "business" : "home");

export const isLive = (a: Appointment) => a.status === "scheduled" || a.status === "checked_in";

/** Earliest upcoming (or in-progress) appointment per job. */
export function nextAppointments(list: Appointment[]) {
  const now = Date.now() - 3 * 3600_000;
  const map = new Map<string, Appointment>();
  for (const a of list) {
    if (!a.leadId || !isLive(a) || +at(a.date, a.start) < now) continue;
    const cur = map.get(a.leadId);
    if (!cur || `${a.date}${a.start}` < `${cur.date}${cur.start}`) map.set(a.leadId, a);
  }
  return map;
}

/** Owner plus active staff, for assignee pickers. */
export function people() {
  return [{ id: OWNER_ID, name: ownerUser().name, color: ownerUser().color }, ...staff.all().filter((s) => s.active).map((s) => ({ id: s.id, name: s.name, color: s.color }))];
}

/** Technicians only see jobs assigned to them or that they have an appointment on. */
export function techCanSee(lead: Lead, userId: string | undefined, appts: Appointment[]) {
  return !!userId && (lead.assigneeId === userId || appts.some((a) => a.leadId === lead.id && a.assigneeId === userId));
}

export function useIsDesktop(query = "(min-width: 1024px)") {
  const [match, setMatch] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatch(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return match;
}

export const mapsUrl = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
