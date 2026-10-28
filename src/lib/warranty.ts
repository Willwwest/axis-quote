import { BODY_TYPES, FILMS, HOME_FILMS, type Settings } from "../data/config";
import { zoneLabel } from "./pricing";
import type { Lead } from "./types";

/** Everything the customer's certificate shows. Encoded into the link so it opens on any phone. */
export interface Cert {
  id: string;
  name: string;
  date: string;
  subject: string;
  film: string;
  coverage: string;
  ref: string;
  // Owner settings travel in the link too, since the customer's phone has none of them.
  review: string;
  credit: number;
}

export function certFor(lead: Lead, certId: string, date: string, s: Settings): Cert {
  let subject = "", film = "", coverage = "";
  if (lead.vehicle) {
    const v = lead.vehicle;
    subject = v.ymm || BODY_TYPES.find((b) => b.id === v.body)!.label;
    film = `${FILMS[v.film].name} window film`;
    coverage = v.zones.map((z) => {
      const shade = z === "windshield" ? 70 : z === "frontSides" ? v.frontVlt : z === "visor" ? 5 : v.rearVlt;
      return `${zoneLabel(z, v)} ${shade}%`;
    }).join(" · ");
  } else if (lead.home) {
    subject = `${lead.kind === "business" ? "Commercial" : "Residential"} glass · ${lead.city}`;
    film = `${HOME_FILMS[lead.home.film].name} (${lead.home.shade})`;
    coverage = lead.quote.lines[0]?.note ?? "";
  }
  return { id: certId, name: lead.contact.name, date, subject, film, coverage, ref: referralCode(lead), review: s.googleReviewUrl, credit: s.referralCredit };
}

export function referralCode(lead: Lead) {
  const first = lead.contact.name.split(" ")[0].replace(/[^a-z]/gi, "").toUpperCase().slice(0, 8) || "AXIS";
  return `${first}-${lead.id.slice(-4)}`;
}

export function encodeCert(c: Cert) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(c)))).replace(/=+$/, "");
}

export function decodeCert(s: string): Cert | null {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(s))));
  } catch {
    return null;
  }
}

export const certUrl = (c: Cert) => `${location.origin}${import.meta.env.BASE_URL}warranty#${encodeCert(c)}`;
export const referralUrl = (code: string) => `${location.origin}${import.meta.env.BASE_URL}?ref=${encodeURIComponent(code)}`;
