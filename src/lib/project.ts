import { BODY_TYPES, PAINTS } from "../data/config";
import type { Tone } from "../components/ui";
import { digits, money } from "./format";
import { notify } from "./notify";
import { contacts, leads, newId } from "./store";
import type { Contact, Lead, LeadStatus } from "./types";

/** The job pipeline, in order. `lost` sits outside the flow. */
export const STATUSES: { id: LeadStatus; label: string; short: string; tone: Tone }[] = [
  { id: "new", label: "New lead", short: "New", tone: "info" },
  { id: "consult", label: "Consult scheduled", short: "Consult", tone: "info" },
  { id: "proposal", label: "Proposal sent", short: "Proposal", tone: "warn" },
  { id: "approved", label: "Approved · needs install date", short: "Approved", tone: "warn" },
  { id: "booked", label: "Install scheduled", short: "Booked", tone: "accent" },
  { id: "installed", label: "Installed · invoice due", short: "Installed", tone: "success" },
  { id: "invoiced", label: "Invoice sent", short: "Invoiced", tone: "success" },
  { id: "paid", label: "Paid in full", short: "Paid", tone: "success" },
  { id: "lost", label: "Lost", short: "Lost", tone: "neutral" },
];

export const statusMeta = (s: LeadStatus) => STATUSES.find((x) => x.id === s) ?? STATUSES[0];

export const OPEN_STATUSES: LeadStatus[] = ["new", "consult", "proposal", "approved", "booked"];
export const WON_STATUSES: LeadStatus[] = ["approved", "booked", "installed", "invoiced", "paid"];

/** Agreed price, else the instant quote (low end of a range). */
export const jobPrice = (l: Lead) => l.price ?? (l.quote.range ? l.quote.range[0] : l.quote.total);

export const jobValueLabel = (l: Lead) => (l.price == null && l.quote.range ? `${money(l.quote.range[0])}+` : money(jobPrice(l)));

export const jobTitle = (l: Lead) =>
  l.title || (l.vehicle ? l.vehicle.ymm || BODY_TYPES.find((b) => b.id === l.vehicle!.body)!.label : `${l.kind === "business" ? "Business" : "Home"}${l.city ? ` · ${l.city}` : ""}`);

export const jobKindLabel = (l: Lead) => (l.kind === "vehicle" ? "Automotive" : l.kind === "business" ? "Commercial" : "Residential");

export function setStatus(lead: Lead, status: LeadStatus) {
  if (lead.status === status) return lead;
  const next = leads.update(lead.id, { status, statusChangedAt: new Date().toISOString() })!;
  return next;
}

/** Finds the contact for a job by id, else by phone, creating and linking one if needed. */
export function ensureContact(lead: Lead): Contact {
  const linked = contacts.get(lead.contactId);
  if (linked) return linked;
  const phone = digits(lead.contact.phone);
  const match = phone ? contacts.all().find((c) => digits(c.phone) === phone) : undefined;
  const c: Contact = match ?? {
    id: newId("CT"),
    name: lead.contact.name,
    phone: lead.contact.phone,
    email: lead.contact.email,
    city: lead.city,
    tags: lead.referral ? ["referral"] : [],
    notes: "",
    prefs: { sms: lead.contact.sms, email: true, reminders: true, followups: true },
    source: lead.source ?? (lead.referral ? `Referral ${lead.referral}` : "Quote app"),
    createdAt: lead.createdAt,
  };
  if (!match) contacts.save(c);
  leads.update(lead.id, { contactId: c.id });
  return c;
}

/** Every job for a contact (matched by link or phone). */
export function jobsFor(contact: Contact, all: Lead[]) {
  const phone = digits(contact.phone);
  return all.filter((l) => l.contactId === contact.id || (!!phone && digits(l.contact.phone) === phone));
}

/** A blank job the crew creates by hand (walk-in, phone call). */
export function newJob(kind: Lead["kind"], contact: Contact): Lead {
  const lead: Lead = {
    id: newId("AX"),
    createdAt: new Date().toISOString(),
    status: "new",
    kind,
    region: null,
    city: contact.city ?? "",
    garage: null,
    appointment: null,
    contact: { name: contact.name, phone: contact.phone, email: contact.email, notes: "", sms: contact.prefs.sms },
    referral: "",
    quote: { lines: [], total: 0 },
    contactId: contact.id,
    source: "Added by crew",
    ...(kind === "vehicle"
      ? { vehicle: { body: "sedan", ymm: "", paint: PAINTS[0].hex, zones: ["frontSides", "rearSides", "rearWindshield"], film: "ceramic", frontVlt: 35, rearVlt: 20, removal: false } }
      : { rooms: [] }),
  };
  leads.save(lead);
  notify("lead", `New job for ${contact.name}`, `/admin/jobs/${lead.id}`);
  return lead;
}
