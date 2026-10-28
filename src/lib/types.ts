import type { BodyType, FilmTier, HomeFilm, HomeGoal, PaneSize, RegionId, Zone } from "../data/config";

/*
 * Domain model. A "Lead" is the job/project record (name kept for the customer quote flow, which creates them).
 * Every collection lives behind src/lib/store.ts, so swapping local storage for a server touches one file.
 */

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
  vin?: string;
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

/** Job pipeline, modelled on the industry-standard flow (consult → proposal → install → invoice → paid). */
export type LeadStatus =
  | "new" | "consult" | "proposal" | "approved" | "booked" | "installed" | "invoiced" | "paid" | "lost";

export interface Completion {
  date: string;
  certId: string;
  photos: string[];
  notes: string;
  reviewRequested: boolean;
}

/** Flat-glass measurement: one line on the work order, and one piece (×qty) for the cut optimizer. */
export interface Measurement {
  id: string;
  type: "window" | "door" | "transom" | "skylight" | "sidelight" | "wall" | "other";
  direction?: "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";
  qty: number;
  /** Inches. */
  w: number;
  h: number;
  filmTypeId?: string;
  price?: number;
  notes?: string;
  photo?: string;
}

export interface Room {
  id: string;
  name: string;
  filmTypeId?: string;
  /** Unapproved rooms stay on the sheet but are left out of pricing and cutting. */
  approved: boolean;
  items: Measurement[];
}

export interface ServiceLine {
  id: string;
  name: string;
  price: number;
  qty: number;
}

export interface Lead extends Omit<QuoteState, "vehicle" | "home"> {
  id: string;
  createdAt: string;
  status: LeadStatus;
  vehicle?: VehicleSpec;
  home?: HomeSpec;
  quote: Quote;
  completion?: Completion;
  contactId?: string;
  /** Optional name for the job, shown in lists and on proposals. */
  title?: string;
  tags?: string[];
  assigneeId?: string;
  /** Where the work happens when it isn't the contact's address. */
  address?: string;
  rooms?: Room[];
  services?: ServiceLine[];
  /** Price agreed on the approved proposal; falls back to the instant quote. */
  price?: number;
  attachments?: Attachment[];
  source?: string;
  lostReason?: string;
  statusChangedAt?: string;
  /** Where the work happens on the map (set by geocoding, or by hand). */
  geo?: GeoPoint;
}

export interface Attachment {
  id: string;
  name: string;
  dataUrl: string;
  tag?: string;
  at: string;
}

/* ---------- People ---------- */

export interface Contact {
  id: string;
  name: string;
  company?: string;
  phone: string;
  workPhone?: string;
  email: string;
  address?: string;
  city?: string;
  tags: string[];
  notes?: string;
  /** Per-contact opt-outs; all default on. */
  prefs: { sms: boolean; email: boolean; reminders: boolean; followups: boolean };
  taxExempt?: boolean;
  geo?: GeoPoint;
  source?: string;
  createdAt: string;
}

export type Role = "owner" | "admin" | "installer" | "technician";

export interface Staff {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  pin: string;
  color: string;
  active: boolean;
}

/* ---------- Scheduling ---------- */

export type AppointmentType = "consult" | "install" | "misc";
export type AppointmentStatus = "scheduled" | "checked_in" | "done" | "cancelled" | "no_show";

export interface Appointment {
  id: string;
  leadId?: string;
  contactId?: string;
  type: AppointmentType;
  title: string;
  /** ISO date and 24h start time, local. */
  date: string;
  start: string;
  durationMin: number;
  assigneeId?: string;
  notes?: string;
  notifyCustomer: boolean;
  status: AppointmentStatus;
  checkInAt?: string;
  checkOutAt?: string;
  /** Repeats every N weeks, `count` times in total (including this one). */
  recurrence?: { everyWeeks: number; count: number; seriesId: string };
  remindersSent?: { confirm?: string; day?: string; hour?: string; cancel?: string };
  history?: { at: string; text: string; by?: string }[];
}

/* ---------- Proposals ---------- */

export interface ProposalOption {
  id: string;
  title: string;
  description: string;
  filmTypeId?: string;
  lines: QuoteLine[];
  discountPct: number;
  /** Rooms this option covers (flat glass). Empty = whole job. */
  roomIds?: string[];
  recommended?: boolean;
}

export type ProposalStatus = "draft" | "sent" | "viewed" | "approved" | "declined" | "expired";

export interface Proposal {
  id: string;
  code: string;
  leadId: string;
  options: ProposalOption[];
  /** Optional extras the customer can tick on top of an option. */
  addons: ServiceLine[];
  /** Customer may pick more than one option together (e.g. tint + PPF). */
  selectTogether: boolean;
  notes: string;
  depositPct: number;
  expiresAt: string;
  status: ProposalStatus;
  createdAt: string;
  sentAt?: string;
  viewedAt?: string;
  approvedAt?: string;
  approvedName?: string;
  chosenOptionIds?: string[];
  chosenAddonIds?: string[];
  customerNotes?: string;
  followups?: { notViewed?: string; notApproved?: string };
}

export interface ProposalTemplate {
  id: string;
  name: string;
  options: ProposalOption[];
  addons: ServiceLine[];
  notes: string;
  depositPct: number;
  expiryDays: number;
  selectTogether?: boolean;
}

/* ---------- Money ---------- */

export interface InvoiceLine {
  id: string;
  description: string;
  rate: number;
  qty: number;
  taxable: boolean;
  /** Roll codes used for this line, printed for warranty tracing. */
  rollCodes?: string[];
}

export type InvoiceStatus = "draft" | "sent" | "viewed" | "partial" | "paid" | "void";
export type PaymentTerms = "receipt" | "net7" | "net15" | "net21" | "net30";

export interface Invoice {
  id: string;
  number: string;
  leadId: string;
  contactId?: string;
  lines: InvoiceLine[];
  taxRateId?: string;
  terms: PaymentTerms;
  issuedAt: string;
  dueAt: string;
  status: InvoiceStatus;
  notes: string;
  sentAt?: string;
  viewedAt?: string;
}

export type PaymentMethod = "card" | "cash" | "check" | "zelle" | "venmo" | "financing" | "other";

export interface Payment {
  id: string;
  leadId: string;
  invoiceId?: string;
  kind: "deposit" | "payment" | "refund";
  amount: number;
  tip?: number;
  method: PaymentMethod;
  date: string;
  notes?: string;
  byId?: string;
}

/* ---------- Notes, tasks, documents, reviews ---------- */

export interface Note {
  id: string;
  /** What the note hangs off; a bare note has neither. */
  leadId?: string;
  contactId?: string;
  rollId?: string;
  body: string;
  authorId?: string;
  createdAt: string;
  task?: { assigneeId: string | null; status: "open" | "done"; due?: string; doneAt?: string };
  replies: { id: string; body: string; authorId?: string; at: string; readBy: string[] }[];
}

export interface DocTemplate {
  id: string;
  title: string;
  /** Markdown-ish: blank-line paragraphs, # headings, - bullets, **bold**. */
  body: string;
  requireName: boolean;
  showCustomer: boolean;
}

export interface SignedDoc {
  id: string;
  templateId?: string;
  leadId: string;
  title: string;
  body: string;
  status: "sent" | "signed";
  sentAt: string;
  signedAt?: string;
  signedName?: string;
  /** PNG data URL of the drawn signature. */
  signature?: string;
}

export interface Review {
  id: string;
  name: string;
  rating: number;
  text: string;
  source: string;
  date: string;
  leadId?: string;
  published: boolean;
  featured: boolean;
}

/* ---------- Messaging & notifications ---------- */

export interface MessageLog {
  id: string;
  at: string;
  channel: "sms" | "email";
  to: string;
  body: string;
  /** Template key, e.g. "remind24". */
  kind: string;
  leadId?: string;
  byId?: string;
}

export interface Notification {
  id: string;
  at: string;
  kind: "lead" | "proposal" | "payment" | "document" | "task" | "stock" | "appointment" | "review";
  text: string;
  /** In-app route to open. */
  href?: string;
  /** Only these people see it (e.g. the assignee of a task); otherwise everyone whose role gets this kind. */
  forUserIds?: string[];
  readBy: string[];
}

/* ---------- Film inventory ---------- */

export interface FilmType {
  id: string;
  brand: string;
  series: string;
  name: string;
  vlt: number | null;
  category: "auto" | "flat" | "ppf" | "other";
  /** Retail price for flat-glass proposals, $ per sq ft. */
  pricePerSqft: number;
  description: string;
}

export type RollStatus = "in" | "out" | "lost";

export interface FilmRoll {
  id: string;
  /** What the crew calls it, e.g. "Ceramic 20%". */
  name: string;
  vlt: number | null;
  widthIn: number;
  lengthFt: number;
  /** Warn when this many feet or fewer are left. */
  lowFt: number;
  lot: string;
  addedAt: string;
  /** Scannable inventory code printed on the roll label, e.g. 10001. */
  code?: string;
  filmTypeId?: string;
  status?: RollStatus;
  /** What the roll cost, for $/sq ft and job margin. */
  cost?: number;
  /** Pounds; used to work out what's left by weighing the roll. */
  coreWeightLb?: number;
  fullWeightLb?: number;
  /** Job this roll is set aside for. */
  reservedLeadId?: string;
}

export type FilmUseSource = "vehicle" | "measure" | "manual" | "job" | "adjust" | "weigh" | "cutsheet";

/** Film pulled off a roll, in inches of roll length. Corrections can be negative. */
export interface FilmUse {
  id: string;
  rollId: string;
  date: string;
  inches: number;
  source: FilmUseSource;
  label: string;
  leadId?: string;
  byId?: string;
}

/** A usable offcut kept for small windows. */
export interface Remnant {
  id: string;
  rollId?: string;
  filmTypeId?: string;
  name: string;
  widthIn: number;
  lengthIn: number;
  location: string;
  createdAt: string;
  usedAt?: string;
  usedLeadId?: string;
}

/* ---------- Routing ---------- */

export interface LatLng { lat: number; lng: number }

/** A spot on the map and how sure we are of it. */
export interface GeoPoint extends LatLng {
  /** geocoded: street address matched · city: town center (approximate) · manual: set by hand · sample: demo data */
  source: "geocoded" | "city" | "manual" | "sample";
  label?: string;
  at?: string;
}

/** Cached geocoder answer, keyed by normalized address. A null point means "looked it up, no match". */
export interface GeocodeEntry { id: string; address: string; point: GeoPoint | null; at: string }
