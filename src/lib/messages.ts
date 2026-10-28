import { BODY_TYPES, BUSINESS, type TemplateKey } from "../data/config";
import { digits, firstName, money, time12 } from "./format";
import { prettyDate } from "./schedule";
import { getSession } from "./session";
import { contacts, getSettings, messages, newId } from "./store";
import type { Appointment, Lead } from "./types";

/*
 * Customer messages. There's no SMS server yet, so "sending" opens the crew phone's own Messages / Mail app
 * with the text filled in, and logs it here. A Twilio hook can replace `openSms` later without touching callers.
 */

export interface MergeContext {
  name?: string;
  vehicle?: string;
  appointment?: Pick<Appointment, "date" | "start">;
  link?: string;
  amount?: number;
  code?: string;
  approvedAt?: string;
}

export function fill(template: string, c: MergeContext) {
  const when = c.appointment ? `${prettyDate(c.appointment.date, { weekday: "short", month: "short", day: "numeric" })} at ${time12(c.appointment.start)}` : "";
  const vars: Record<string, string> = {
    ":first_name": firstName(c.name ?? "") || "there",
    ":customer_name": c.name ?? "",
    ":business": BUSINESS.name,
    ":phone": BUSINESS.phone,
    ":vehicle": c.vehicle || "vehicle",
    ":event_datetime": when,
    ":event_date": c.appointment ? prettyDate(c.appointment.date, { weekday: "long", month: "long", day: "numeric" }) : "",
    ":event_time": c.appointment ? time12(c.appointment.start) : "",
    ":link": c.link ?? "",
    ":amount": c.amount != null ? money(c.amount, true) : "",
    ":code": c.code ?? "",
    ":approved_at": c.approvedAt ? new Date(c.approvedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "",
  };
  // Longest names first so :event_date doesn't eat :event_datetime.
  return Object.keys(vars).sort((a, b) => b.length - a.length).reduce((t, k) => t.split(k).join(vars[k]), template).replace(/\s+([.,!])/g, "$1").trim();
}

export const template = (key: TemplateKey) => getSettings().templates[key];

/** Merge context for a job: customer name, vehicle. */
export function leadContext(lead: Lead, extra: MergeContext = {}): MergeContext {
  const vehicle = lead.vehicle ? lead.vehicle.ymm || BODY_TYPES.find((b) => b.id === lead.vehicle!.body)?.label : undefined;
  return { name: lead.contact.name, vehicle, ...extra };
}

/** Phone + email for a job, preferring the linked contact record. */
export function reach(lead: Lead) {
  const c = contacts.get(lead.contactId);
  return {
    phone: c?.phone || lead.contact.phone,
    email: c?.email || lead.contact.email,
    smsOk: c ? c.prefs.sms : lead.contact.sms,
    emailOk: c ? c.prefs.email : true,
    remindersOk: c ? c.prefs.reminders : true,
    followupsOk: c ? c.prefs.followups : true,
  };
}

export const smsHref = (phone: string, body: string) => `sms:${digits(phone)}?&body=${encodeURIComponent(body)}`;
export const mailHref = (email: string, subject: string, body: string) =>
  `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

function log(channel: "sms" | "email", to: string, body: string, kind: string, leadId?: string) {
  messages.save({ id: newId("M"), at: new Date().toISOString(), channel, to, body, kind, leadId, byId: getSession().user?.id });
}

/** Opens the device's texting app with the message and records it. */
export function sendSms(to: string, body: string, kind: string, leadId?: string) {
  log("sms", to, body, kind, leadId);
  window.location.href = smsHref(to, body);
}

export function sendEmail(to: string, subject: string, body: string, kind: string, leadId?: string) {
  log("email", to, body, kind, leadId);
  window.location.href = mailHref(to, subject, body);
}

/** Records a message sent some other way (copied, said on the phone) so the outbox stops nagging. */
export const markSent = (to: string, body: string, kind: string, leadId?: string) => log("sms", to, body, kind, leadId);

export const sentFor = (leadId: string, kind: string) => messages.all().some((m) => m.leadId === leadId && m.kind === kind);
