import { dayDate, firstName, time12 } from "../format";
import { encodeSnap } from "../links";
import { sendSms } from "../messages";
import type { LatLng } from "../types";
import type { MemberRoute, RouteSnap } from "./index";
import { fromMin } from "./util";

/*
 * Getting a route to the crew without a server: the route rides in a link (like customer proposal links), and the
 * text goes out from this phone's Messages app. Google Maps legs follow extra-mile's visit planner (places.js):
 * at most 3 waypoints plus a destination per link (the mobile limit), each leg starting where the last one ended.
 */

export function routeSnap(route: MemberRoute): RouteSnap {
  return {
    v: 1,
    date: route.date,
    member: { id: route.member.id, name: route.member.name, color: route.member.color },
    base: { label: route.member.baseLabel, lat: route.member.base.lat, lng: route.member.base.lng },
    stops: route.stops.map((ps) => ({
      id: ps.stop.id,
      type: ps.stop.type,
      title: ps.stop.title,
      customer: ps.stop.customer,
      phone: ps.stop.phone,
      address: ps.stop.address,
      ...(ps.stop.point ? { lat: Math.round(ps.stop.point.lat * 1e5) / 1e5, lng: Math.round(ps.stop.point.lng * 1e5) / 1e5 } : {}),
      start: fromMin(ps.start),
      end: fromMin(ps.end),
      driveMin: ps.driveMin,
      ...(ps.stop.appointment.notes ? { notes: ps.stop.appointment.notes } : {}),
    })),
    driveMin: route.driveMin,
    driveMiles: route.driveMiles,
    returnMin: route.returnMin,
    sentAt: new Date().toISOString(),
  };
}

/** Public link to a person's route for a day: /route/:memberId-:date#snapshot. */
export const routeLink = (route: MemberRoute) =>
  `${location.origin}${import.meta.env.BASE_URL}route/${encodeURIComponent(route.member.id)}-${route.date}#${encodeSnap(routeSnap(route))}`;

const GOOGLE_DIR = "https://www.google.com/maps/dir/?";
const PER_LEG = 4; // 3 waypoints + destination
const MAX_URL = 2048;

const place = (s: { lat?: number; lng?: number; address?: string }) =>
  s.lat != null && s.lng != null ? `${s.lat.toFixed(6)},${s.lng.toFixed(6)}` : (s.address ?? "").trim();

/** Google Maps driving directions in legs. Without a start, the first leg begins at the phone's location. */
export function directionsLegs(start: LatLng | null, stops: { lat?: number; lng?: number; address?: string }[]): string[] {
  const places = stops.map(place).filter(Boolean);
  const urls: string[] = [];
  let origin = start ? place(start) : "";
  let i = 0;
  while (i < places.length) {
    let chunk = places.slice(i, i + PER_LEG);
    const build = (c: string[]) => {
      const params = new URLSearchParams({ api: "1", destination: c[c.length - 1], travelmode: "driving" });
      if (origin) params.set("origin", origin);
      if (c.length > 1) params.set("waypoints", c.slice(0, -1).join("|"));
      return GOOGLE_DIR + params;
    };
    let url = build(chunk);
    while (url.length > MAX_URL && chunk.length > 1) {
      chunk = chunk.slice(0, -1);
      url = build(chunk);
    }
    if (url.length > MAX_URL) { i++; continue; } // one absurdly long address: skip it rather than break the link
    urls.push(url);
    origin = chunk[chunk.length - 1];
    i += chunk.length;
  }
  return urls;
}

/** Texts a crew member their route link from this phone's Messages app, and logs it (kind "route"). */
export function sendRoute(route: MemberRoute): void {
  const n = route.stops.length;
  const when = dayDate(route.date);
  const body = n
    ? `Hi ${firstName(route.member.name)}, your Axis route for ${when}: ${n} stop${n === 1 ? "" : "s"}, first at ${time12(fromMin(route.stops[0].start))}. ${routeLink(route)}`
    : `Hi ${firstName(route.member.name)}, no stops on your Axis route for ${when}.`;
  sendSms(route.member.phone ?? "", body, "route");
}
