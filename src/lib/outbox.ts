import { useSyncExternalStore } from "react";
import { BUSINESS, TEMPLATE_LABELS } from "../data/config";
import { at, today } from "./format";
import { fill, leadContext, markSent, reach, sendEmail, sendSms, template } from "./messages";
import { balanceOnLead, invoiceLink } from "./money";
import { proposalLink } from "../admin/proposals/logic";
import { apptLink } from "./schedule";
import { appointments, getSettings, invoices, leads, messages, proposals, subscribe } from "./store";
import type { Appointment, Lead } from "./types";

/*
 * The outbox: customer messages that are due now. Nothing sends on its own (there's no SMS server yet), so the
 * crew taps Send and the phone's Messages app opens with the text filled in. Sending, marking sent or skipping
 * clears the item; "sent" is read from the messages log or the stamp on the appointment / proposal.
 */

export type OutboxKind =
  | "confirm" | "remind24" | "remind1" | "cancel" | "proposalFollow24" | "proposalFollow48" | "review" | "invoiceDue";

export interface OutboxItem {
  /** Stable id so "skip" can be remembered: `${kind}:${recordId}`. */
  id: string;
  kind: OutboxKind;
  lead?: Lead;
  name: string;
  channel: "sms" | "email";
  to: string;
  body: string;
  /** When it became due (ISO). */
  due: string;
  /** Both addresses, so the outbox can offer text or email whichever is allowed. */
  phone?: string;
  email?: string;
  appointmentId?: string;
  proposalId?: string;
  invoiceId?: string;
}

export const OUTBOX_LABELS: Record<OutboxKind, string> = {
  confirm: "Confirmation",
  remind24: "24h reminder",
  remind1: "1h reminder",
  cancel: "Cancellation",
  proposalFollow24: "Proposal not opened",
  proposalFollow48: "Proposal not approved",
  review: "Review request",
  invoiceDue: "Invoice past due",
};

/** There's no template key for past-due nudges yet, so the text lives here. */

const H = 3600_000;
const base = () => `${location.origin}${import.meta.env.BASE_URL}`;

/* ---------- Skipped ids (per device) ---------- */

const SKIP_KEY = "axis.outbox.skipped";
const local = new Set<() => void>();
let version = 0;
const bump = () => { version++; local.forEach((l) => l()); };
subscribe(() => { version++; });

function readSkipped(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(SKIP_KEY) || "[]") as string[]); } catch { return new Set(); }
}

export function skip(id: string) {
  const s = readSkipped();
  s.add(id);
  try { localStorage.setItem(SKIP_KEY, JSON.stringify([...s].slice(-500))); } catch { /* full */ }
  bump();
}

/* ---------- What's due ---------- */

/** A message of this kind went to this job at or after `since`. */
const sentSince = (leadId: string, kind: string, since: number) =>
  messages.all().some((m) => m.leadId === leadId && m.kind === kind && +new Date(m.at) >= since);

const createdAt = (a: Appointment) => (a.history?.[0]?.at ? +new Date(a.history[0].at) : 0);

function item(kind: OutboxKind, recordId: string, lead: Lead, body: string, due: number, extra: Partial<OutboxItem> = {}): OutboxItem | null {
  const r = reach(lead);
  const phone = r.smsOk && r.phone ? r.phone : undefined;
  const email = r.emailOk && r.email ? r.email : undefined;
  if (!phone && !email) return null;
  return {
    id: `${kind}:${recordId}`, kind, lead, name: lead.contact.name,
    channel: phone ? "sms" : "email", to: phone ?? email!, body, due: new Date(due).toISOString(), phone, email, ...extra,
  };
}

function appointmentItems(now: number): OutboxItem[] {
  const s = getSettings();
  const out: (OutboxItem | null)[] = [];
  for (const a of appointments.all()) {
    const lead = leads.get(a.leadId);
    if (!lead || !a.notifyCustomer || a.type === "misc" || !reach(lead).remindersOk) continue;
    const start = +at(a.date, a.start);
    const sent = a.remindersSent ?? {};
    const ctx = leadContext(lead, { appointment: a, link: apptLink(a) });
    const msg = (k: "confirm" | "remind24" | "remind1" | "cancel") => fill(s.templates[k], ctx);
    const extra = { appointmentId: a.id };

    if (a.status === "cancelled") {
      const cancelledAt = [...(a.history ?? [])].reverse().find((h) => h.text.startsWith("Cancelled"))?.at;
      const since = cancelledAt ? +new Date(cancelledAt) : createdAt(a);
      if (s.reminders.cancel && !sent.cancel && start > now - H && !sentSince(lead.id, "cancel", since)) {
        out.push(item("cancel", a.id, lead, msg("cancel"), since || now, extra));
      }
      continue;
    }
    if (a.status !== "scheduled" || start < now - H) continue;

    // A repeating series gets one confirmation, for its next upcoming visit.
    const series = a.recurrence ? appointments.all().filter((x) => x.id !== a.id && x.recurrence?.seriesId === a.recurrence!.seriesId) : [];
    const seriesDone = series.some((x) => x.remindersSent?.confirm || (x.status === "scheduled" && x.date + x.start < a.date + a.start && +at(x.date, x.start) > now - H));
    if (s.reminders.confirm && !sent.confirm && !seriesDone && !sentSince(lead.id, "confirm", createdAt(a))) {
      out.push(item("confirm", a.id, lead, msg("confirm"), createdAt(a) || now, extra));
    }
    // The 1h reminder supersedes the 24h one once both windows are open.
    if (s.reminders.hour && !sent.hour && start - now <= 1.5 * H) {
      if (!sentSince(lead.id, "remind1", start - 3 * H)) out.push(item("remind1", a.id, lead, msg("remind1"), start - H, extra));
    } else if (s.reminders.day && !sent.day && start - now <= 24 * H) {
      if (!sentSince(lead.id, "remind24", start - 30 * H)) out.push(item("remind24", a.id, lead, msg("remind24"), start - 24 * H, extra));
    }
  }
  return out.filter((x): x is OutboxItem => !!x);
}

function proposalItems(now: number): OutboxItem[] {
  const s = getSettings();
  if (!s.proposals.followups) return [];
  const out: (OutboxItem | null)[] = [];
  for (const p of proposals.all()) {
    const lead = leads.get(p.leadId);
    if (!lead || !p.sentAt || !reach(lead).followupsOk) continue;
    const link = proposalLink(p);
    const ctx = leadContext(lead, { link, code: p.code });
    const f = p.followups ?? {};
    const sentAt = +new Date(p.sentAt);
    if (p.status === "sent" && !f.notViewed && now - sentAt >= 24 * H && !sentSince(lead.id, "proposalFollow24", sentAt)) {
      out.push(item("proposalFollow24", p.id, lead, fill(s.templates.proposalFollow24, ctx), sentAt + 24 * H, { proposalId: p.id }));
    }
    const viewedAt = p.viewedAt ? +new Date(p.viewedAt) : 0;
    if (p.status === "viewed" && viewedAt && !f.notApproved && now - viewedAt >= 48 * H && !sentSince(lead.id, "proposalFollow48", viewedAt)) {
      out.push(item("proposalFollow48", p.id, lead, fill(s.templates.proposalFollow48, ctx), viewedAt + 48 * H, { proposalId: p.id }));
    }
  }
  return out.filter((x): x is OutboxItem => !!x);
}

export function reviewLink() {
  const s = getSettings();
  return s.reviews.sites.find((x) => x.url)?.url || s.googleReviewUrl || `${base()}reviews`;
}

function reviewItems(now: number): OutboxItem[] {
  const s = getSettings();
  const mode = s.reviews.autoRequest;
  if (mode === "off") return [];
  const ready = mode === "paid" ? ["paid"] : ["installed", "invoiced", "paid"];
  const out: (OutboxItem | null)[] = [];
  for (const l of leads.all()) {
    if (!ready.includes(l.status) || l.completion?.reviewRequested || !reach(l).followupsOk) continue;
    if (messages.all().some((m) => m.leadId === l.id && m.kind === "review")) continue;
    // Only recent jobs, so turning this on doesn't flood the outbox with years of history.
    const since = +new Date(l.statusChangedAt ?? l.completion?.date ?? l.createdAt);
    if (now - since > 30 * 24 * H) continue;
    out.push(item("review", l.id, l, fill(s.templates.review, leadContext(l, { link: reviewLink() })), since));
  }
  return out.filter((x): x is OutboxItem => !!x);
}

function invoiceItems(now: number): OutboxItem[] {
  const out: (OutboxItem | null)[] = [];
  const t = today();
  for (const inv of invoices.all()) {
    if (!["sent", "viewed", "partial"].includes(inv.status) || !inv.dueAt || inv.dueAt.slice(0, 10) >= t) continue;
    const lead = leads.get(inv.leadId);
    if (!lead || !reach(lead).followupsOk) continue;
    const owed = balanceOnLead(lead.id);
    if (owed <= 0) continue;
    const due = +at(inv.dueAt.slice(0, 10), "09:00") + 24 * H;
    // One nudge a week while it stays unpaid.
    const week = Math.floor((now - due) / (7 * 24 * H));
    if (week < 0 || sentSince(lead.id, "invoiceDue", now - 6 * 24 * H)) continue;
    const ctx = leadContext(lead, { amount: owed, link: invoiceLink(inv) });
    out.push(item("invoiceDue", `${inv.id}:${week}`, lead, fill(template("invoiceDue"), ctx), due + week * 7 * 24 * H, { invoiceId: inv.id }));
  }
  return out.filter((x): x is OutboxItem => !!x);
}

/** Customer messages that are due now and haven't been sent or skipped. */
export function dueMessages(): OutboxItem[] {
  const now = Date.now();
  const skipped = readSkipped();
  return [...appointmentItems(now), ...proposalItems(now), ...reviewItems(now), ...invoiceItems(now)]
    .filter((i) => !skipped.has(i.id))
    .sort((a, b) => a.due.localeCompare(b.due));
}

/* ---------- Clearing items ---------- */

const STAMP: Partial<Record<OutboxKind, keyof NonNullable<Appointment["remindersSent"]>>> = { confirm: "confirm", remind24: "day", remind1: "hour", cancel: "cancel" };

function stamp(i: OutboxItem) {
  const now = new Date().toISOString();
  const key = STAMP[i.kind];
  if (key && i.appointmentId) appointments.update(i.appointmentId, (a) => ({ remindersSent: { ...a.remindersSent, [key]: now } }));
  if (i.proposalId && (i.kind === "proposalFollow24" || i.kind === "proposalFollow48")) {
    proposals.update(i.proposalId, (p) => ({ followups: { ...p.followups, [i.kind === "proposalFollow24" ? "notViewed" : "notApproved"]: now } }));
  }
  if (i.kind === "review" && i.lead?.completion) leads.update(i.lead.id, (l) => ({ completion: l.completion && { ...l.completion, reviewRequested: true } }));
}

/** Sends (opens the phone's app), or just records it as sent. Body can be edited first. */
export function sendItem(i: OutboxItem, via: "sms" | "email" | "mark", body = i.body) {
  stamp(i);
  if (via === "sms" && i.phone) sendSms(i.phone, body, i.kind, i.lead?.id);
  else if (via === "email" && i.email) sendEmail(i.email, `${BUSINESS.name}: ${OUTBOX_LABELS[i.kind]}`, body, i.kind, i.lead?.id);
  else markSent(i.to, body, i.kind, i.lead?.id);
}

export const templateLabel = (kind: string) => OUTBOX_LABELS[kind as OutboxKind] ?? TEMPLATE_LABELS[kind as keyof typeof TEMPLATE_LABELS] ?? kind;

/* ---------- Hook ---------- */

let cached: OutboxItem[] = [];
let cachedKey = "";
const snap = () => {
  // Store writes and skips bump `version`; the minute makes time-based reminders appear without a write.
  const key = `${version}|${Math.floor(Date.now() / 60_000)}`;
  if (key !== cachedKey) { cachedKey = key; cached = dueMessages(); }
  return cached;
};

const sub = (l: () => void) => {
  local.add(l);
  const off = subscribe(l);
  const t = setInterval(l, 60_000);
  return () => { local.delete(l); off(); clearInterval(t); };
};

export function useOutbox(): OutboxItem[] {
  return useSyncExternalStore(sub, snap);
}
