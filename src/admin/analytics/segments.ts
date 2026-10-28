import { AUTO_SHADES, BODY_TYPES, FILMS, HOME_FILMS, REGIONS, ZONES } from "../../data/config";
import { sqft } from "../../lib/format";
import { invoiceTotals, methodLabel, paymentValue } from "../../lib/money";
import { WON_STATUSES, jobKindLabel, jobPrice } from "../../lib/project";
import { isoDate } from "../../lib/schedule";
import { personName } from "../../lib/session";
import type {
  Appointment, Contact, FilmRoll, FilmUse, Invoice, Lead, MessageLog, Note, Payment, Proposal, ProposalOption, Review,
} from "../../lib/types";

/*
 * Analytics segments, named after Tint Wiz's where one applies. A number segment is a function of a date range,
 * so the same definition gives the total, the comparison and each bar of its chart.
 */

export interface Raw {
  leads: Lead[]; appts: Appointment[]; proposals: Proposal[]; invoices: Invoice[]; payments: Payment[]; messages: MessageLog[];
  reviews: Review[]; contacts: Contact[]; filmLog: FilmUse[]; rolls: FilmRoll[]; notes: Note[];
}
/** Records narrowed to the project-type filter, plus the unfiltered set for segments that don't belong to a job. */
export interface Data extends Raw { raw: Raw }

export type TypeFilter = "all" | "vehicle" | "home" | "business";
export const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All projects" },
  { value: "vehicle", label: "Automotive" },
  { value: "home", label: "Residential" },
  { value: "business", label: "Commercial" },
];

export function scope(raw: Raw, kind: TypeFilter): Data {
  if (kind === "all") return { ...raw, raw };
  const leads = raw.leads.filter((l) => l.kind === kind);
  const ok = new Set(leads.map((l) => l.id));
  const by = <T extends { leadId?: string }>(xs: T[]) => xs.filter((x) => !!x.leadId && ok.has(x.leadId));
  return {
    ...raw, raw, leads, appts: by(raw.appts), proposals: by(raw.proposals), invoices: by(raw.invoices), payments: by(raw.payments),
    messages: by(raw.messages), reviews: by(raw.reviews), filmLog: by(raw.filmLog), notes: by(raw.notes),
  };
}

export type Fmt = "count" | "money" | "pct" | "days" | "ft" | "rating" | "sqft";

interface Base {
  id: string;
  name: string;
  desc: string;
  group: string;
  fmt: Fmt;
  /** False when the project-type filter doesn't apply. */
  typed?: boolean;
  /** False when a rise is bad news (cancellations, balances, costs). */
  upIsGood?: boolean;
}
export interface NumberSeg extends Base { type: "number"; value: (d: Data, from: string, to: string) => number | null }
export interface ListItem { label: string; value: number; note?: string }
export interface ListSeg extends Base { type: "list"; items: (d: Data, from: string, to: string) => ListItem[] }
export type Segment = NumberSeg | ListSeg;

/* ---------- Small helpers ---------- */

/** Local calendar day of a stored date or timestamp. */
const day = (d: string | undefined) => (!d ? "" : d.length <= 10 ? d : isoDate(new Date(d)));
const inR = (d: string | undefined, from: string, to: string) => { const x = day(d); return !!x && x >= from && x <= to; };
const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);
const avg = <T,>(xs: T[], f: (x: T) => number) => (xs.length ? sum(xs, f) / xs.length : null);
const pct = (a: number, b: number) => (b ? (a / b) * 100 : null);

function rank(pairs: [string, number][], note?: (label: string) => string | undefined): ListItem[] {
  const m = new Map<string, number>();
  for (const [k, v] of pairs) m.set(k, (m.get(k) ?? 0) + v);
  return [...m].map(([label, value]) => ({ label, value, note: note?.(label) })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}
const countBy = <T,>(xs: T[], key: (x: T) => string | undefined) => rank(xs.map((x) => [key(x) || "Not set", 1]));

const live = (a: Appointment) => a.status !== "cancelled";
const leadsIn = (d: Data, f: string, t: string) => d.leads.filter((l) => inR(l.createdAt, f, t));
const apptsIn = (d: Data, f: string, t: string, type?: Appointment["type"]) => d.appts.filter((a) => (!type || a.type === type) && inR(a.date, f, t));
const installsDone = (d: Data, f: string, t: string) => apptsIn(d, f, t, "install").filter((a) => a.status === "done");
const uniqLeads = (d: Data, as: Appointment[]) => { const ids = new Set(as.map((a) => a.leadId)); return d.leads.filter((l) => ids.has(l.id)); };
const billed = (d: Data, f: string, t: string) => d.invoices.filter((i) => i.status !== "draft" && i.status !== "void" && inR(i.issuedAt, f, t));
const paysIn = (d: Data, f: string, t: string) => d.payments.filter((p) => inR(p.date, f, t));
const usage = (u: FilmUse) => u.source !== "adjust" && u.source !== "weigh";

const optPrice = (o: ProposalOption) => o.lines.reduce((s, l) => s + l.amount, 0) * (1 - (o.discountPct || 0) / 100);
const sentAmount = (p: Proposal) => { const o = p.options.find((x) => x.recommended) ?? p.options[0]; return o ? optPrice(o) : 0; };
const approvedAmount = (p: Proposal) =>
  sum(p.options.filter((o) => p.chosenOptionIds?.includes(o.id)), optPrice) + sum(p.addons.filter((a) => p.chosenAddonIds?.includes(a.id)), (a) => a.price * (a.qty || 1));

function filmCost(d: Data, f: string, t: string) {
  const rolls = new Map(d.rolls.map((r) => [r.id, r]));
  return sum(d.filmLog.filter((u) => usage(u) && inR(u.date, f, t)), (u) => {
    const r = rolls.get(u.rollId);
    return r?.cost && r.lengthFt ? (u.inches * r.cost) / (r.lengthFt * 12) : 0;
  });
}
const installedValue = (d: Data, f: string, t: string) => sum(uniqLeads(d, installsDone(d, f, t)), jobPrice);
const shade = (vlt: number) => `${vlt}% ${AUTO_SHADES.find((s) => s.vlt === vlt)?.name ?? ""}`.trim();
const make = (ymm: string) => ymm.replace(/^\d{4}\s+/, "").trim() || "Not set";

/* ---------- Catalog ---------- */

const num = (s: Omit<NumberSeg, "type">): NumberSeg => ({ type: "number", ...s });
const list = (s: Omit<ListSeg, "type">): ListSeg => ({ type: "list", ...s });

const F = "Lead & sales funnel", O = "Scheduling & operations", M = "Revenue & cash", J = "Job mix", K = "Marketing & reviews", T = "Team", I = "Film & inventory";

export const SEGMENTS: Segment[] = [
  num({ id: "newLeads", group: F, name: "New Leads", desc: "Jobs added, from the quote app or by the crew", fmt: "count", value: (d, f, t) => leadsIn(d, f, t).length }),
  list({ id: "leadsBySource", group: F, name: "Leads by Source", desc: "Where new jobs came from", fmt: "count", items: (d, f, t) => countBy(leadsIn(d, f, t), (l) => l.source || (l.referral ? "Referral" : "Quote app")) }),
  list({ id: "leadsByType", group: F, name: "Leads by Type", desc: "New jobs by project type", fmt: "count", items: (d, f, t) => countBy(leadsIn(d, f, t), jobKindLabel) }),
  num({ id: "referralLeads", group: F, name: "Referral Leads", desc: "New jobs that came with a referral code or from a referral", fmt: "count",
    value: (d, f, t) => leadsIn(d, f, t).filter((l) => l.referral || /referr/i.test(l.source ?? "") || d.raw.contacts.find((c) => c.id === l.contactId)?.tags.includes("referral")).length }),
  num({ id: "newContacts", group: F, name: "New Contacts", desc: "People and businesses added to Contacts", fmt: "count", typed: false, value: (d, f, t) => d.raw.contacts.filter((c) => inR(c.createdAt, f, t)).length }),
  num({ id: "proposalsSent", group: F, name: "Proposals Sent", desc: "Proposals sent to customers", fmt: "count", value: (d, f, t) => d.proposals.filter((p) => inR(p.sentAt, f, t)).length }),
  num({ id: "proposalsSentAmount", group: F, name: "Proposals Sent Amount", desc: "Value of sent proposals (recommended option)", fmt: "money", value: (d, f, t) => sum(d.proposals.filter((p) => inR(p.sentAt, f, t)), sentAmount) }),
  num({ id: "proposalsApproved", group: F, name: "Proposals Approved", desc: "Proposals the customer approved", fmt: "count", value: (d, f, t) => d.proposals.filter((p) => inR(p.approvedAt, f, t)).length }),
  num({ id: "proposalsApprovedAmount", group: F, name: "Proposals Approved Amount", desc: "Chosen options plus add-ons on approved proposals", fmt: "money", value: (d, f, t) => sum(d.proposals.filter((p) => inR(p.approvedAt, f, t)), approvedAmount) }),
  num({ id: "approvalRate", group: F, name: "Approval Rate", desc: "Share of proposals sent in the range that are approved", fmt: "pct",
    value: (d, f, t) => { const s = d.proposals.filter((p) => inR(p.sentAt, f, t)); return pct(s.filter((p) => p.status === "approved").length, s.length); } }),
  num({ id: "avgProposal", group: F, name: "Average Proposal Value", desc: "Average recommended-option price on sent proposals", fmt: "money", value: (d, f, t) => avg(d.proposals.filter((p) => inR(p.sentAt, f, t)), sentAmount) }),
  num({ id: "closeRate", group: F, name: "Close Rate", desc: "Share of jobs added in the range that were won (approved through paid)", fmt: "pct",
    value: (d, f, t) => { const l = leadsIn(d, f, t); return pct(l.filter((x) => WON_STATUSES.includes(x.status)).length, l.length); } }),
  num({ id: "leadToInstall", group: F, name: "Lead → Install Days", desc: "Average days from a job being added to its install", fmt: "days", upIsGood: false,
    value: (d, f, t) => {
      const byLead = new Map(d.leads.map((l) => [l.id, l]));
      const xs = apptsIn(d, f, t, "install").filter(live).map((a) => { const l = byLead.get(a.leadId ?? ""); return l ? (+new Date(`${a.date}T12:00`) - +new Date(l.createdAt)) / 864e5 : null; }).filter((x): x is number => x != null && x >= 0);
      return avg(xs, (x) => x);
    } }),

  num({ id: "consultsScheduled", group: O, name: "Consultations Scheduled", desc: "Consult appointments in the range (not cancelled)", fmt: "count", value: (d, f, t) => apptsIn(d, f, t, "consult").filter(live).length }),
  num({ id: "installsScheduled", group: O, name: "Installations Scheduled", desc: "Install appointments in the range (not cancelled)", fmt: "count", value: (d, f, t) => apptsIn(d, f, t, "install").filter(live).length }),
  num({ id: "installsCompleted", group: O, name: "Installations", desc: "Install appointments checked out as done", fmt: "count", value: (d, f, t) => installsDone(d, f, t).length }),
  num({ id: "amountScheduled", group: O, name: "Amount Scheduled", desc: "Price of jobs with an install in the range", fmt: "money", value: (d, f, t) => sum(uniqLeads(d, apptsIn(d, f, t, "install").filter(live)), jobPrice) }),
  list({ id: "apptsByType", group: O, name: "Appointments by Type", desc: "Consults, installs and other appointments", fmt: "count",
    items: (d, f, t) => countBy(d.appts.filter((a) => live(a) && inR(a.date, f, t)), (a) => ({ consult: "Consultation", install: "Installation", misc: "Other" })[a.type]) }),
  num({ id: "noShows", group: O, name: "No-shows", desc: "Appointments marked no-show", fmt: "count", upIsGood: false, value: (d, f, t) => d.appts.filter((a) => a.status === "no_show" && inR(a.date, f, t)).length }),
  num({ id: "cancellations", group: O, name: "Cancellations", desc: "Consults and installs cancelled", fmt: "count", upIsGood: false, value: (d, f, t) => d.appts.filter((a) => a.status === "cancelled" && inR(a.date, f, t)).length }),

  num({ id: "invoicedTotal", group: M, name: "Invoiced Total", desc: "Invoices issued (drafts and voids left out)", fmt: "money", value: (d, f, t) => sum(billed(d, f, t), (i) => invoiceTotals(i).total) }),
  num({ id: "paymentsAmount", group: M, name: "Payments Amount", desc: "Revenue collected: payments and deposits, less refunds", fmt: "money", value: (d, f, t) => sum(paysIn(d, f, t), paymentValue) }),
  num({ id: "deposits", group: M, name: "Deposits Collected", desc: "Deposits taken on approved proposals", fmt: "money", value: (d, f, t) => sum(paysIn(d, f, t).filter((p) => p.kind === "deposit"), (p) => p.amount) }),
  num({ id: "avgTicket", group: M, name: "Average Project Price", desc: "Average invoice total (the average ticket)", fmt: "money", value: (d, f, t) => avg(billed(d, f, t), (i) => invoiceTotals(i).total) }),
  num({ id: "installedTotal", group: M, name: "Projects Installed Total", desc: "Price of jobs installed in the range", fmt: "money", value: installedValue }),
  num({ id: "outstanding", group: M, name: "Outstanding Balance", desc: "What customers owed on sent invoices at the end of the range", fmt: "money", upIsGood: false,
    value: (d, _f, t) => sum(d.invoices.filter((i) => i.status !== "draft" && i.status !== "void" && day(i.issuedAt) <= t), (i) =>
      Math.max(0, invoiceTotals(i).total - sum(d.payments.filter((p) => p.leadId === i.leadId && day(p.date) <= t), paymentValue))) }),
  num({ id: "salesTax", group: M, name: "Sales Tax", desc: "Tax on invoices issued", fmt: "money", value: (d, f, t) => sum(billed(d, f, t), (i) => invoiceTotals(i).tax) }),
  num({ id: "tips", group: M, name: "Tips", desc: "Tips added to payments", fmt: "money", value: (d, f, t) => sum(paysIn(d, f, t), (p) => p.tip ?? 0) }),
  list({ id: "paymentTypes", group: M, name: "Payment Types", desc: "Money collected by method", fmt: "money", items: (d, f, t) => rank(paysIn(d, f, t).map((p) => [methodLabel(p.method), paymentValue(p)])) }),

  list({ id: "jobsByBody", group: J, name: "Jobs by Vehicle Body", desc: "New vehicle jobs by body type", fmt: "count", items: (d, f, t) => countBy(leadsIn(d, f, t).filter((l) => l.vehicle), (l) => BODY_TYPES.find((b) => b.id === l.vehicle!.body)?.label) }),
  list({ id: "jobsByShade", group: J, name: "Jobs by Shade", desc: "Rear shade on vehicles; film shade on homes and businesses", fmt: "count",
    items: (d, f, t) => countBy(leadsIn(d, f, t), (l) => (l.vehicle ? shade(l.vehicle.rearVlt) : l.home?.shade)) }),
  list({ id: "jobsByFilm", group: J, name: "Jobs by Film", desc: "New jobs by film line", fmt: "count", items: (d, f, t) => countBy(leadsIn(d, f, t), (l) => (l.vehicle ? FILMS[l.vehicle.film].name : l.home ? HOME_FILMS[l.home.film].name : undefined)) }),
  list({ id: "applicationAreas", group: J, name: "Application Areas", desc: "Windows tinted on new vehicle jobs", fmt: "count", items: (d, f, t) => rank(leadsIn(d, f, t).flatMap((l) => (l.vehicle ? l.vehicle.zones.map((z) => [ZONES.find((x) => x.id === z)?.label ?? z, 1] as [string, number]) : []))) }),
  list({ id: "topVehicles", group: J, name: "Top Vehicles Installed", desc: "Make and model of installs done", fmt: "count", items: (d, f, t) => countBy(uniqLeads(d, installsDone(d, f, t)).filter((l) => l.vehicle), (l) => make(l.vehicle!.ymm)) }),
  list({ id: "jobsByRegion", group: J, name: "Jobs by Region", desc: "New jobs by service area", fmt: "count", items: (d, f, t) => countBy(leadsIn(d, f, t), (l) => REGIONS.find((r) => r.id === l.region)?.label) }),
  list({ id: "jobsByCity", group: J, name: "Top Project Cities", desc: "New jobs by city", fmt: "count", items: (d, f, t) => countBy(leadsIn(d, f, t), (l) => l.city) }),
  num({ id: "measuredSqft", group: J, name: "Measured SqFt", desc: "Glass measured on new flat-glass jobs", fmt: "sqft", value: (d, f, t) => sum(leadsIn(d, f, t), (l) => sum(l.rooms ?? [], (r) => sum(r.items, (m) => sqft(m.w, m.h, m.qty)))) }),

  num({ id: "reviewRequests", group: K, name: "Review Requests Sent", desc: "Review request texts and emails", fmt: "count", value: (d, f, t) => d.messages.filter((m) => m.kind === "review" && inR(m.at, f, t)).length }),
  num({ id: "reviewsReceived", group: K, name: "Reviews Received", desc: "Reviews logged in Reviews", fmt: "count", typed: false, value: (d, f, t) => d.raw.reviews.filter((r) => inR(r.date, f, t)).length }),
  num({ id: "avgRating", group: K, name: "Average Rating", desc: "Average stars on reviews logged", fmt: "rating", typed: false, value: (d, f, t) => avg(d.raw.reviews.filter((r) => inR(r.date, f, t)), (r) => r.rating) }),
  list({ id: "contactTags", group: K, name: "Contact Tags", desc: "New contacts by tag, with how many of their jobs were won", fmt: "count", typed: false,
    items: (d, f, t) => {
      const cs = d.raw.contacts.filter((c) => inR(c.createdAt, f, t));
      const conv = (tag: string) => {
        const ids = new Set(d.raw.contacts.filter((c) => c.tags.includes(tag)).map((c) => c.id));
        const jobs = d.raw.leads.filter((l) => l.contactId && ids.has(l.contactId));
        return jobs.length ? `${Math.round((jobs.filter((l) => WON_STATUSES.includes(l.status)).length / jobs.length) * 100)}% won` : undefined;
      };
      return rank(cs.flatMap((c) => c.tags.map((tg) => [tg, 1] as [string, number])), conv);
    } }),

  list({ id: "jobsByAssignee", group: T, name: "Jobs by Assignee", desc: "Install appointments by who's assigned", fmt: "count", items: (d, f, t) => countBy(apptsIn(d, f, t, "install").filter(live), (a) => personName(a.assigneeId)) }),
  num({ id: "tasksCompleted", group: T, name: "Tasks Completed", desc: "Tasks closed", fmt: "count", typed: false, value: (d, f, t) => d.raw.notes.filter((n) => n.task?.status === "done" && inR(n.task.doneAt, f, t)).length }),
  list({ id: "taskAssignments", group: T, name: "Task Assignments", desc: "Tasks created, by assignee", fmt: "count", typed: false, items: (d, f, t) => countBy(d.raw.notes.filter((n) => n.task && inR(n.createdAt, f, t)), (n) => personName(n.task!.assigneeId)) }),

  num({ id: "filmUsed", group: I, name: "Film Used", desc: "Feet pulled off rolls (corrections left out)", fmt: "ft", value: (d, f, t) => sum(d.filmLog.filter((u) => usage(u) && inR(u.date, f, t)), (u) => u.inches) / 12 }),
  num({ id: "filmCost", group: I, name: "Film Cost", desc: "What the film used cost, from each roll's price", fmt: "money", upIsGood: false, value: filmCost }),
  num({ id: "filmCostPct", group: I, name: "Film Cost % of Revenue", desc: "Film cost as a share of the value of jobs installed", fmt: "pct", upIsGood: false, value: (d, f, t) => pct(filmCost(d, f, t), installedValue(d, f, t)) }),
];

export const segment = (id: string) => SEGMENTS.find((s) => s.id === id);

export const DEFAULT_SEGMENTS = ["newLeads", "consultsScheduled", "installsScheduled", "amountScheduled", "paymentsAmount", "closeRate", "leadsBySource", "jobsByBody"];
export const MAX_SEGMENTS = 12;

export const GROUPS = [...new Set(SEGMENTS.map((s) => s.group))];

/* ---------- Formatting ---------- */

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export function format(fmt: Fmt, v: number | null, short = false): string {
  if (v == null || !Number.isFinite(v)) return "—";
  switch (fmt) {
    case "money": return short && Math.abs(v) >= 1000 ? `$${compact.format(v)}` : v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
    case "pct": return `${Math.round(v)}%`;
    case "days": return short ? `${Math.round(v)}d` : `${v.toFixed(1)} days`;
    case "ft": return `${short ? compact.format(v) : Math.round(v).toLocaleString()} ft`;
    case "sqft": return `${short ? compact.format(v) : Math.round(v).toLocaleString()} sq ft`;
    case "rating": return `${v.toFixed(1)}★`;
    default: return short ? compact.format(v) : Math.round(v * 10) % 10 ? v.toFixed(1) : Math.round(v).toLocaleString();
  }
}
