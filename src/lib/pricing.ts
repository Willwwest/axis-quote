import {
  AZ_FRONT_MIN_VLT, FULL_VEHICLE, HOME_FILMS, PANES, REAR_SIDE_LABEL, REGIONS, ZONES,
  type Settings, type Zone,
} from "../data/config";
import type { HomeSpec, Quote, QuoteLine, QuoteState, VehicleSpec } from "./types";

export const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function zoneLabel(zone: Zone, v: VehicleSpec) {
  if (zone === "rearSides") return REAR_SIDE_LABEL[v.body];
  return ZONES.find((z) => z.id === zone)!.label;
}

export function isFullVehicle(zones: Zone[]) {
  return FULL_VEHICLE.every((z) => zones.includes(z));
}

/** Price of one zone for the chosen film, or null when that film isn't offered there. */
export function zonePrice(s: Settings, v: VehicleSpec, zone: Zone): number | null {
  const cell = s.prices[v.body][zone];
  // Windshields only come in clear ceramic.
  if (zone === "windshield") return cell.ceramic;
  return cell[v.film];
}

export function vehicleLines(s: Settings, v: VehicleSpec): QuoteLine[] {
  const lines: QuoteLine[] = [];
  const full = isFullVehicle(v.zones);
  for (const z of ZONES) {
    if (!v.zones.includes(z.id)) continue;
    const price = zonePrice(s, v, z.id) ?? 0;
    if (z.id === "visor" && full) {
      lines.push({ label: "Visor strip", amount: 0, note: `Free with full tint (${money(price)} value)` });
      continue;
    }
    const film = z.id === "windshield" ? "Clear ceramic" : v.film === "ceramic" ? "Ceramic" : "Carbon";
    const shade = z.id === "windshield" ? "70%" : z.id === "frontSides" ? `${v.frontVlt}%` : z.id === "visor" ? "5%" : `${v.rearVlt}%`;
    lines.push({ label: zoneLabel(z.id, v), amount: price, note: `${film} · ${shade}` });
  }
  if (v.removal) lines.push({ label: "Old tint removal", amount: s.removalFee });
  return lines;
}

export function homeSqft(h: HomeSpec) {
  return PANES.reduce((sum, p) => sum + p.sqft * (h.panes[p.id] || 0), 0);
}

export function homePaneCount(h: HomeSpec) {
  return PANES.reduce((sum, p) => sum + (h.panes[p.id] || 0), 0);
}

export function buildQuote(s: Settings, q: QuoteState): Quote {
  const lines: QuoteLine[] = [];
  let range: [number, number] | undefined;

  if (q.kind === "vehicle") {
    lines.push(...vehicleLines(s, q.vehicle));
  } else if (q.kind) {
    const sqft = homeSqft(q.home);
    const rate = s.homeRatePerSqft[q.home.film];
    const raw = sqft * rate;
    const film = HOME_FILMS[q.home.film];
    lines.push({
      label: `${film.name} film`,
      amount: Math.max(raw, sqft ? s.homeMinimum : 0),
      note: `${homePaneCount(q.home)} windows · ~${sqft} sq ft${raw < s.homeMinimum && sqft ? " · job minimum" : ""}`,
    });
  }

  if (q.region && lines.length) {
    const fee = s.travelFee[q.region];
    if (fee) lines.push({ label: "Travel", amount: fee, note: REGIONS.find((r) => r.id === q.region)!.label });
  }
  if (q.referral && lines.length) {
    lines.push({ label: "Referral credit", amount: -s.referralCredit, note: `Code ${q.referral}` });
  }

  const total = Math.max(0, lines.reduce((sum, l) => sum + l.amount, 0));
  if (q.kind && q.kind !== "vehicle" && total) {
    range = [Math.round((total * 0.9) / 10) * 10, Math.round((total * 1.15) / 10) * 10];
  }
  return { lines, total, range };
}

export function frontsLegal(v: VehicleSpec) {
  return !v.zones.includes("frontSides") || v.frontVlt >= AZ_FRONT_MIN_VLT;
}

/** How dark glass reads for a given visible-light transmission (0..1 overlay opacity). */
export function tintOpacity(vlt: number) {
  return Math.min(0.95, 1 - Math.pow(vlt / 100, 0.75));
}
