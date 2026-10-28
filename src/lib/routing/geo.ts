import { AZ_PLACES } from "../../data/azPlaces";
import { contacts, geocodes, getSettings, leads } from "../store";
import type { Contact, GeoPoint, Lead } from "../types";
import { fetchJson } from "./util";

/*
 * Where things are. Exact spots come from an open geocoder (OpenStreetMap's Nominatim, or Photon), asked at most once
 * per address and cached on this device, hits and misses alike. Until an address is looked up, a job sits at its town
 * center from the bundled Census place table, marked source "city" so the UI can say it's approximate.
 */

const placeIndex = new Map(Object.entries(AZ_PLACES).map(([name, ll]) => [squash(name), { name, ll }]));

function squash(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Town center from the bundled Arizona place table ("Prescott Valley", "prescott valley, az 86314"). */
export function cityPoint(city?: string): GeoPoint | null {
  if (!city) return null;
  const name = city.replace(/\b\d{5}(-\d{4})?\b/g, "").replace(/,?\s*(az|arizona)\.?\s*$/i, "").trim();
  const hit = placeIndex.get(squash(name));
  return hit ? { lat: hit.ll[0], lng: hit.ll[1], source: "city", label: hit.name } : null;
}

/** "123 Main St, Prescott, AZ" for a street and town, without repeating the town or state. */
function fullAddress(address = "", city = "") {
  const a = address.trim();
  const c = city.trim();
  let q = a && c && !a.toLowerCase().includes(c.toLowerCase()) ? `${a}, ${c}` : a || c;
  if (q && !/\b(AZ|Arizona)\b|,\s*[A-Z]{2}\b(\s+\d{5})?\s*$/i.test(q)) q += ", AZ";
  return q;
}

export const addressKey = (address = "", city = "") => fullAddress(address, city).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** The town named in an address like "12 Mesa View Dr, Dewey-Humboldt, AZ". */
function cityFromAddress(address: string) {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = cityPoint(parts[i]);
    if (p) return p;
  }
  return null;
}

/** Best known spot without going online: cached geocode, else the town center. */
export function locateAddress(address?: string, city?: string): GeoPoint | null {
  if (address?.trim()) {
    const cached = geocodes.get(addressKey(address, city));
    if (cached?.point) return cached.point;
  }
  return cityPoint(city) ?? (address ? cityFromAddress(address) : null);
}

// Arizona, padded: a match outside this box is a different "123 Main St" somewhere else.
const inArizona = (lat: number, lng: number) => lat > 31.2 && lat < 37.1 && lng > -115 && lng < -108.9;

let queue: Promise<unknown> = Promise.resolve();
let lastCall = 0;

/** Runs geocoder calls one at a time, at least 1.1 s apart (Nominatim's usage policy). */
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastCall + 1100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return fn();
  });
  queue = run.catch(() => undefined);
  return run;
}

async function lookup(q: string): Promise<GeoPoint | null> {
  const r = getSettings().routing;
  if (r.geocoder === "photon") {
    const bias = r.base.geo ? `&lat=${r.base.geo.lat}&lon=${r.base.geo.lng}` : "";
    const data = await fetchJson<{ features?: { geometry: { coordinates: [number, number] }; properties: Record<string, string> }[] }>(
      `https://photon.komoot.io/api/?limit=1&q=${encodeURIComponent(q)}${bias}`,
    );
    const f = data.features?.[0];
    if (!f) return null;
    const [lng, lat] = f.geometry.coordinates;
    const p = f.properties;
    const label = [p.housenumber && p.street ? `${p.housenumber} ${p.street}` : p.name, p.city].filter(Boolean).join(", ");
    return inArizona(lat, lng) ? { lat, lng, source: "geocoded", label: label || q, at: new Date().toISOString() } : null;
  }
  const data = await fetchJson<{ lat: string; lon: string; display_name: string }[]>(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(q)}`,
    { headers: { Accept: "application/json" } },
  );
  const hit = data[0];
  if (!hit) return null;
  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inArizona(lat, lng)) return null;
  // "201, South Cortez Street, Cortez Circle Apartments, Prescott, …" → "201 South Cortez Street, Cortez Circle Apartments"
  const parts = hit.display_name.split(",").map((p) => p.trim());
  if (/^\d+[a-z]?$/i.test(parts[0] ?? "") && parts[1]) parts.splice(0, 2, `${parts[0]} ${parts[1]}`);
  return { lat, lng, source: "geocoded", label: parts.slice(0, 2).join(", "), at: new Date().toISOString() };
}

/** Looks an address up with the configured geocoder (queued, cached). Null when not found, offline, or turned off. */
export async function geocodeAddress(address: string, city?: string): Promise<GeoPoint | null> {
  const q = fullAddress(address, city);
  if (!q || getSettings().routing.geocoder === "off") return null;
  const id = addressKey(address, city);
  const cached = geocodes.get(id);
  if (cached) return cached.point;
  try {
    const point = await throttled(() => lookup(q));
    geocodes.save({ id, address: q, point, at: new Date().toISOString() });
    return point;
  } catch {
    // Network trouble isn't a "no match": don't cache it, so the next try can still find it.
    return null;
  }
}

/** Street address for a job: the job site, else the customer's address. */
export const jobAddress = (lead?: Lead, contact?: Contact) => lead?.address || contact?.address || "";
export const jobCity = (lead?: Lead, contact?: Contact) => lead?.city || contact?.city || "";

/** Where a job happens: lead.geo, then contact.geo, then the cached or town-center spot for its address. */
export function jobPoint(lead?: Lead, contact?: Contact): GeoPoint | null {
  const c = contact ?? contacts.get(lead?.contactId);
  return lead?.geo ?? c?.geo ?? locateAddress(jobAddress(lead, c), jobCity(lead, c));
}

/** Geocodes jobs whose spot is missing or only the town center, saving lead.geo. Never overwrites a hand-set spot. */
export async function geocodeJobs(leadIds: string[], onProgress?: (done: number, total: number) => void): Promise<{ found: number; missed: number }> {
  let found = 0;
  let missed = 0;
  const todo = leadIds.map((id) => leads.get(id)).filter((l): l is Lead => !!l);
  for (let i = 0; i < todo.length; i++) {
    const lead = todo[i];
    const c = contacts.get(lead.contactId);
    const current = jobPoint(lead, c);
    const street = jobAddress(lead, c);
    if (current && current.source !== "city") {
      // Already exact (geocoded, set by hand, or demo data).
    } else if (!street || !/\d/.test(street)) {
      missed++;
    } else {
      const p = await geocodeAddress(street, jobCity(lead, c));
      if (p) {
        leads.update(lead.id, { geo: p });
        found++;
      } else missed++;
    }
    onProgress?.(i + 1, todo.length);
  }
  return { found, missed };
}
