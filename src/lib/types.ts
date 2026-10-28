import type { BodyType, FilmTier, HomeFilm, HomeGoal, PaneSize, RegionId, Zone } from "../data/config";

export type JobKind = "vehicle" | "home" | "business";

export interface VehicleSpec {
  body: BodyType;
  ymm: string;
  paint: string;
  zones: Zone[];
  film: FilmTier;
  frontVlt: number;
  rearVlt: number;
  removal: boolean;
}

export interface HomeSpec {
  panes: Record<PaneSize, number>;
  goals: HomeGoal[];
  film: HomeFilm;
  shade: string;
}

export interface QuoteState {
  kind: JobKind | null;
  vehicle: VehicleSpec;
  home: HomeSpec;
  region: RegionId | null;
  city: string;
  garage: "yes" | "no" | null;
  appointment: { date: string; slot: string } | null;
  contact: { name: string; phone: string; email: string; notes: string; sms: boolean };
  referral: string;
}

export interface QuoteLine {
  label: string;
  amount: number;
  note?: string;
}

export interface Quote {
  lines: QuoteLine[];
  total: number;
  /** Residential jobs are estimated as a range until the on-site consult. */
  range?: [number, number];
}

export type LeadStatus = "new" | "contacted" | "booked" | "completed" | "lost";

export interface Completion {
  date: string;
  certId: string;
  photos: string[];
  notes: string;
  reviewRequested: boolean;
}

export interface Lead extends Omit<QuoteState, "vehicle" | "home"> {
  id: string;
  createdAt: string;
  status: LeadStatus;
  vehicle?: VehicleSpec;
  home?: HomeSpec;
  quote: Quote;
  completion?: Completion;
}
