/*
 * Route planning: where each job is, how long the drives are, and who should go where on which day.
 *
 * Builds on extra-mile-apps' CRM visit planner (nearest-neighbor + 2-opt, Google Maps legs, Census place centers) and
 * adds open-source road routing: OSRM for drive times and road shapes, and VROOM (through OpenRouteService) as an
 * optional optimizer. Defaults need no account or key (OSRM's public server, Nominatim, the built-in solver), and
 * everything falls back to a straight-line drive estimate when a service doesn't answer.
 *
 * This file is the public API. UI code imports only from here. Internals:
 *   geo.ts (places and geocoding) · travel.ts (drive times) · solver.ts (optimizer) · vroom.ts (optional VROOM)
 *   plan.ts (crew, stops, day and week plans) · share.ts (route links and texts) · util.ts
 */
import type { Appointment, AppointmentType, Contact, GeoPoint, Lead, Role } from "../types";
import type { RegionId } from "../../data/config";

export { fromMin, haversineKm, toMin } from "./util";
export { addressKey, cityPoint, geocodeAddress, geocodeJobs, jobPoint, locateAddress } from "./geo";
export { resetTravelCache, roadPath, travelMatrix } from "./travel";
export {
  applyDayPlan, applyWeekPlan, crew, currentPlan, installMinutes, memberById, optimizeDay, planWeek, stopsFor, unscheduledJobs,
} from "./plan";
export { directionsLegs, routeLink, routeSnap, sendRoute } from "./share";

/* ---------- Crew ---------- */

export interface CrewMember {
  id: string;
  name: string;
  /** CSS color (token-based) used for their pins and route line. */
  color: string;
  phone?: string;
  role: Role;
  base: GeoPoint;
  baseLabel: string;
  days: number[];
  /** Minutes since midnight. */
  start: number;
  end: number;
  regions?: RegionId[];
}

/* ---------- Stops ---------- */

export interface Stop {
  /** Appointment id. */
  id: string;
  appointment: Appointment;
  lead?: Lead;
  contact?: Contact;
  type: AppointmentType;
  title: string;
  customer: string;
  phone?: string;
  address: string;
  point: GeoPoint | null;
  durationMin: number;
  /** Booked start, minutes since midnight. */
  booked: number;
  /** When the customer expects us (minutes since midnight), from their booked slot. */
  window?: [number, number];
  assigneeId?: string;
  /** Checked in or done: the optimizer leaves it with its person and time. */
  locked: boolean;
  region?: RegionId;
  /** Not on the calendar yet: a job the week planner is suggesting. */
  proposed?: boolean;
}

/* ---------- Travel ---------- */

export interface Matrix {
  seconds: number[][];
  meters: number[][];
  source: "osrm" | "ors" | "estimate";
  /** Set when road times were asked for but couldn't be fetched (the matrix is then an estimate). */
  warning?: string;
}

/* ---------- Day plans ---------- */

export interface PlannedStop {
  stop: Stop;
  /** Minutes since midnight. */
  arrive: number;
  start: number;
  end: number;
  /** Drive from the previous stop (or base). */
  driveMin: number;
  driveMiles: number;
  /** Starts after the customer's window. */
  late: boolean;
}

export interface MemberRoute {
  member: CrewMember;
  date: string;
  stops: PlannedStop[];
  /** The day's driving, including the drive back to base. */
  driveMin: number;
  driveMiles: number;
  /** Drive back to base after the last stop (0 when returnToBase is off). */
  returnMin: number;
  /** Back at base, minutes since midnight. */
  finish: number;
  overtime: boolean;
}

export interface DayPlan {
  date: string;
  routes: MemberRoute[];
  /** Stops nobody can reach in their hours, or with no known location. */
  unassigned: { stop: Stop; reason: string }[];
  driveMin: number;
  driveMiles: number;
  travel: Matrix["source"];
  optimizer: "current" | "builtin" | "vroom";
  warnings: string[];
}

export interface OptimizeOptions {
  /** Keep everyone's assigned jobs; only reorder and retime. */
  keepAssignees?: boolean;
  /** Keep booked start times; only reassign and reorder. */
  keepTimes?: boolean;
  /** Limit to these people. */
  memberIds?: string[];
}

/* ---------- Week planning ---------- */

export interface WeekProposal {
  lead: Lead;
  date: string;
  memberId: string;
  /** Minutes since midnight. */
  start: number;
  durationMin: number;
  /** e.g. "Wed is a Quad Cities day · 9 min from Linda Park" */
  reason: string;
}

export interface WeekPlan {
  from: string;
  days: { date: string; regions: RegionId[]; plan: DayPlan }[];
  proposals: WeekProposal[];
  unplaced: { lead: Lead; reason: string }[];
}

/* ---------- Sharing a route with the crew ---------- */

/** What a crew member's route link carries, so it opens on their phone without a server. */
export interface RouteSnap {
  v: 1;
  date: string;
  member: { id: string; name: string; color: string };
  base: { label: string; lat: number; lng: number };
  stops: {
    id: string;
    type: AppointmentType;
    title: string;
    customer: string;
    phone?: string;
    address: string;
    lat?: number;
    lng?: number;
    /** "HH:MM" */
    start: string;
    end: string;
    driveMin: number;
    notes?: string;
  }[];
  driveMin: number;
  driveMiles: number;
  returnMin: number;
  sentAt: string;
}
