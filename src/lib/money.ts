// Owned by invoices & payments. Keep these exports and signatures (other areas use them); extend freely.
import type { Tone } from "../components/ui";
import { addDays, money, today } from "./format";
import { publicUrl } from "./links";
import { notify } from "./notify";
import { ensureContact, jobPrice, jobTitle, setStatus } from "./project";
import { getSession } from "./session";
import { contacts, filmLog, getSettings, invoices, leads, newId, nextNumber, payments, proposals, rolls } from "./store";
import type { Invoice, InvoiceLine, InvoiceStatus, Lead, Payment, PaymentMethod, PaymentTerms, Proposal } from "./types";

/*
 * Money model: one live invoice per job. Payments (deposits included) hang off the job, so a deposit taken before the
 * invoice exists is credited automatically, and a voided-then-recreated invoice keeps what was paid.
 */

const cents = (n: number) => Math.round(n * 100) / 100;

export interface Totals { subtotal: number; taxable: number; tax: number; total: number }

export const taxRateFor = (inv: Pick<Invoice, "taxRateId">) => getSettings().invoices.taxRates.find((t) => t.id === inv.taxRateId);

export function invoiceTotals(inv: Invoice): Totals {
  const subtotal = cents(inv.lines.reduce((s, l) => s + l.rate * l.qty, 0));
  const taxable = cents(inv.lines.reduce((s, l) => s + (l.taxable ? l.rate * l.qty : 0), 0));
  const tax = Math.max(0, cents((taxable * (taxRateFor(inv)?.pct ?? 0)) / 100));
  return { subtotal, taxable, tax, total: cents(subtotal + tax) };
}

/** Signed amount a payment adds to what the customer has paid (refunds subtract; tips excluded). */
export const paymentValue = (p: Payment) => (p.kind === "refund" ? -p.amount : p.amount);

/** Everything the customer has paid on a job, deposits included. */
export function paidOnLead(leadId: string, list: Payment[] = payments.all()) {
  return cents(list.filter((p) => p.leadId === leadId).reduce((s, p) => s + paymentValue(p), 0));
}

export function invoiceForLead(leadId: string) {
  return invoices.all().find((i) => i.leadId === leadId && i.status !== "void");
}

/** What's still owed on a job: the live invoice total (or nothing yet) minus everything paid. */
export function balanceOnLead(leadId: string) {
  const inv = invoiceForLead(leadId);
  return inv ? Math.max(0, cents(invoiceTotals(inv).total - paidOnLead(leadId))) : 0;
}

/* ---------- Labels ---------- */

export const TERMS: { id: PaymentTerms; label: string; days: number }[] = [
  { id: "receipt", label: "Due on receipt", days: 0 },
  { id: "net7", label: "Net 7", days: 7 },
  { id: "net15", label: "Net 15", days: 15 },
  { id: "net21", label: "Net 21", days: 21 },
  { id: "net30", label: "Net 30", days: 30 },
];
export const termsLabel = (t: PaymentTerms) => TERMS.find((x) => x.id === t)?.label ?? t;
export const dueFor = (issuedAt: string, terms: PaymentTerms) => addDays(issuedAt, TERMS.find((t) => t.id === terms)?.days ?? 0);

export const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: "card", label: "Card" }, { id: "cash", label: "Cash" }, { id: "check", label: "Check" }, { id: "zelle", label: "Zelle" },
  { id: "venmo", label: "Venmo" }, { id: "financing", label: "Financing" }, { id: "other", label: "Other" },
];
export const methodLabel = (m: PaymentMethod) => METHODS.find((x) => x.id === m)?.label ?? m;
export const KIND_LABEL: Record<Payment["kind"], string> = { deposit: "Deposit", payment: "Payment", refund: "Refund" };

/** Stored status plus the derived "past due". */
export type InvoiceState = InvoiceStatus | "pastdue";
export const INVOICE_STATES: Record<InvoiceState, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  sent: { label: "Sent", tone: "info" },
  viewed: { label: "Viewed", tone: "info" },
  partial: { label: "Partial", tone: "warn" },
  paid: { label: "Paid", tone: "success" },
  void: { label: "Void", tone: "neutral" },
  pastdue: { label: "Past due", tone: "danger" },
};

/* ---------- Per-invoice figures ---------- */

const OPEN: InvoiceStatus[] = ["sent", "viewed", "partial"];

export const invoicePaid = (inv: Invoice, list: Payment[] = payments.all()) => (inv.status === "void" ? 0 : paidOnLead(inv.leadId, list));

export const invoiceBalance = (inv: Invoice, list: Payment[] = payments.all()) =>
  inv.status === "void" ? 0 : Math.max(0, cents(invoiceTotals(inv).total - paidOnLead(inv.leadId, list)));

export const isPastDue = (inv: Invoice, balance = invoiceBalance(inv)) => OPEN.includes(inv.status) && balance > 0 && inv.dueAt < today();

export const invoiceState = (inv: Invoice, balance = invoiceBalance(inv)): InvoiceState => (isPastDue(inv, balance) ? "pastdue" : inv.status);

export const leadName = (leadId: string) => {
  const lead = leads.get(leadId);
  return contacts.get(lead?.contactId)?.name || lead?.contact.name || "Customer";
};

/* ---------- Creating invoices ---------- */

export function approvedProposal(leadId: string): Proposal | undefined {
  return proposals.all()
    .filter((p) => p.leadId === leadId && p.status === "approved")
    .sort((a, b) => (b.approvedAt ?? "").localeCompare(a.approvedAt ?? ""))[0];
}

/** Codes of the rolls cut for this job, for warranty tracing on the invoice. */
export function rollCodesFor(leadId: string) {
  const ids = new Set(filmLog.all().filter((u) => u.leadId === leadId && u.inches > 0).map((u) => u.rollId));
  return [...ids].map((id) => rolls.get(id)?.code).filter((c): c is string => !!c);
}

export const newLine = (description = "", rate = 0, qty = 1): InvoiceLine => ({ id: newId("IL"), description, rate: cents(rate), qty, taxable: true });

const mainDescription = (lead: Lead) => `Film installation: ${jobTitle(lead)}`;

function proposalLines(p: Proposal): InvoiceLine[] {
  const ids = p.chosenOptionIds?.length ? p.chosenOptionIds : p.options.length === 1 ? [p.options[0].id] : [];
  const out: InvoiceLine[] = [];
  for (const o of p.options.filter((x) => ids.includes(x.id))) {
    out.push(...o.lines.map((l) => newLine(l.note ? `${l.label} · ${l.note}` : l.label, l.amount)));
    const sum = o.lines.reduce((s, l) => s + l.amount, 0);
    if (o.discountPct > 0 && sum > 0) out.push(newLine(`Discount · ${o.title} (${o.discountPct}%)`, -(sum * o.discountPct) / 100));
  }
  for (const a of p.addons.filter((x) => p.chosenAddonIds?.includes(x.id))) out.push(newLine(a.name, a.price, a.qty || 1));
  return out;
}

function quoteLines(lead: Lead): InvoiceLine[] {
  const quoted = cents(lead.quote.lines.reduce((s, l) => s + l.amount, 0));
  // An agreed price that differs from the instant quote replaces the quote lines (they'd no longer add up).
  const main = lead.price != null && lead.price !== quoted
    ? [newLine([mainDescription(lead), lead.quote.lines.filter((l) => l.amount > 0).map((l) => l.label).join(", ")].filter(Boolean).join("\n"), lead.price)]
    : lead.quote.lines.map((l) => newLine(l.note ? `${l.label} · ${l.note}` : l.label, l.amount));
  return [...main, ...(lead.services ?? []).map((s) => newLine(s.name, s.price, s.qty || 1))];
}

/**
 * Drafts the job's invoice: approved proposal (chosen options + add-ons, less discounts), else the quote lines plus
 * services, else one line at the job price. Returns the existing live invoice instead if the job already has one.
 */
export function createInvoiceFromLead(lead: Lead): Invoice {
  const existing = invoiceForLead(lead.id);
  if (existing) return existing;
  const s = getSettings().invoices;
  const contact = ensureContact(lead);
  const p = approvedProposal(lead.id);
  let lines = p ? proposalLines(p) : [];
  if (!lines.some((l) => l.rate)) lines = quoteLines(lead);
  if (!lines.some((l) => l.rate)) lines = [newLine(mainDescription(lead), jobPrice(lead))];
  const codes = s.showRollCodes ? rollCodesFor(lead.id) : [];
  if (codes.length) {
    const i = Math.max(0, lines.findIndex((l) => l.rate > 0));
    lines[i] = { ...lines[i], rollCodes: codes };
  }
  const issuedAt = today();
  const taxOk = s.taxRates.some((t) => t.id === s.defaultTaxRateId);
  const inv: Invoice = {
    id: newId("INV"),
    number: nextNumber("invoice"),
    leadId: lead.id,
    contactId: contact.id,
    lines,
    taxRateId: contact.taxExempt || !taxOk ? undefined : s.defaultTaxRateId,
    terms: s.terms,
    issuedAt,
    dueAt: dueFor(issuedAt, s.terms),
    status: "draft",
    notes: s.notes,
  };
  invoices.save(inv);
  return syncInvoice(inv.id) ?? inv;
}

/* ---------- Status ---------- */

/**
 * Re-derives paid / partial from payments. Becoming paid moves the job to "paid" and notifies the office;
 * losing paid (refund, deleted payment, edited lines) moves the job back.
 */
export function syncInvoice(id: string): Invoice | undefined {
  const inv = invoices.get(id);
  if (!inv || inv.status === "void") return inv;
  const { total } = invoiceTotals(inv);
  const paid = paidOnLead(inv.leadId);
  const base: InvoiceStatus = inv.viewedAt ? "viewed" : inv.sentAt ? "sent" : "draft";
  const status: InvoiceStatus = total > 0 && paid >= total ? "paid" : paid > 0 && base !== "draft" ? "partial" : base;
  if (status === inv.status) return inv;
  const next = invoices.update(id, { status });
  const lead = leads.get(inv.leadId);
  if (status === "paid") {
    if (lead) setStatus(lead, "paid");
    notify("payment", `${leadName(inv.leadId)} paid invoice #${inv.number} in full (${money(total, true)})`, `/admin/invoices/${id}`);
  } else if (inv.status === "paid" && lead?.status === "paid") {
    setStatus(lead, inv.sentAt ? "invoiced" : "installed");
  }
  return next;
}

export function updateInvoice(id: string, patch: Partial<Invoice> | ((i: Invoice) => Partial<Invoice>)) {
  invoices.update(id, patch);
  return syncInvoice(id);
}

/** Marks an invoice sent (texted, emailed or link shared) and moves the job to "invoiced". */
export function markInvoiceSent(id: string) {
  const inv = invoices.update(id, (i) => ({ sentAt: new Date().toISOString(), status: i.status === "draft" ? "sent" : i.status }));
  if (!inv) return;
  const lead = leads.get(inv.leadId);
  if (lead && lead.status !== "paid" && lead.status !== "lost") setStatus(lead, "invoiced");
  return syncInvoice(id);
}

export const voidInvoice = (id: string) => invoices.update(id, { status: "void" });

/** Un-voids, unless the job already has another live invoice. */
export function restoreInvoice(id: string) {
  const inv = invoices.get(id);
  if (!inv || invoiceForLead(inv.leadId)) return false;
  invoices.update(id, { status: inv.viewedAt ? "viewed" : inv.sentAt ? "sent" : "draft" });
  syncInvoice(id);
  return true;
}

/* ---------- Payments ---------- */

export function recordPayment(input: Omit<Payment, "id" | "byId">): Payment {
  const p = payments.save({ ...input, amount: cents(input.amount), tip: input.tip ? cents(input.tip) : undefined, id: newId("PAY"), byId: getSession().user?.id });
  const inv = invoiceForLead(p.leadId);
  const was = inv?.status;
  const now = inv ? syncInvoice(inv.id)?.status : undefined;
  // Paying in full already sent the "paid in full" notification.
  if (now !== "paid" || was === "paid") {
    notify("payment", `${KIND_LABEL[p.kind]} ${p.kind === "refund" ? "to" : "from"} ${leadName(p.leadId)}: ${money(p.amount, true)}${p.tip ? ` + ${money(p.tip, true)} tip` : ""}`, `/admin/jobs/${p.leadId}`);
  }
  return p;
}

export function deletePayment(id: string) {
  const p = payments.get(id);
  if (!p) return;
  payments.remove(id);
  const inv = invoiceForLead(p.leadId);
  if (inv) syncInvoice(inv.id);
}

/* ---------- Deposits ---------- */

/** Deposit asked for on the approved proposal: its depositPct of the job price. 0 when none was asked. */
export function depositDue(lead: Lead) {
  const p = approvedProposal(lead.id);
  return p && p.depositPct > 0 ? cents((jobPrice(lead) * p.depositPct) / 100) : 0;
}

export const depositPaid = (leadId: string, list: Payment[] = payments.all()) =>
  cents(list.filter((p) => p.leadId === leadId && p.kind === "deposit").reduce((s, p) => s + p.amount, 0));

/** Deposit still to collect. */
export const depositOwed = (lead: Lead) => Math.max(0, cents(depositDue(lead) - depositPaid(lead.id)));

/** Deposits taken on jobs whose invoice isn't paid yet (money held against work not finished). */
export function depositsHeld(list: Payment[] = payments.all()) {
  const all = invoices.all();
  const done = new Set(all.filter((i) => i.status === "paid").map((i) => i.leadId));
  return cents(list.filter((p) => p.kind === "deposit" && !done.has(p.leadId)).reduce((s, p) => s + p.amount, 0));
}

/* ---------- Totals for dashboards and analytics ---------- */

const inRange = (d: string, from: string, to: string) => {
  const x = d.slice(0, 10);
  return x >= from.slice(0, 10) && x <= to.slice(0, 10);
};

/** Money in (payments + deposits − refunds, tips excluded) dated within [from, to], inclusive ISO dates. */
export const collectedBetween = (fromIso: string, toIso: string, list: Payment[] = payments.all()) =>
  cents(list.filter((p) => inRange(p.date, fromIso, toIso)).reduce((s, p) => s + paymentValue(p), 0));

export const tipsBetween = (fromIso: string, toIso: string, list: Payment[] = payments.all()) =>
  cents(list.filter((p) => p.kind !== "refund" && inRange(p.date, fromIso, toIso)).reduce((s, p) => s + (p.tip ?? 0), 0));

/** Totals of invoices issued within [from, to]. Drafts and voids don't count. */
export const invoicedBetween = (fromIso: string, toIso: string, list: Invoice[] = invoices.all()) =>
  cents(list.filter((i) => i.status !== "void" && i.status !== "draft" && inRange(i.issuedAt, fromIso, toIso)).reduce((s, i) => s + invoiceTotals(i).total, 0));

/** Open balances on sent invoices, and how much of that is past due. */
export function receivables(list: Invoice[] = invoices.all(), pays: Payment[] = payments.all()) {
  let awaiting = 0, pastDue = 0, open = 0, late = 0;
  for (const inv of list) {
    if (!OPEN.includes(inv.status)) continue;
    const bal = invoiceBalance(inv, pays);
    if (bal <= 0) continue;
    awaiting += bal;
    open++;
    if (isPastDue(inv, bal)) { pastDue += bal; late++; }
  }
  return { awaiting: cents(awaiting), pastDue: cents(pastDue), open, late };
}

/* ---------- Customer-facing view ---------- */

/** Everything the customer invoice page needs. Built live on the shop's device, or carried in the link's hash. */
export interface InvoiceView {
  id: string;
  number: string;
  status: InvoiceStatus;
  issuedAt: string;
  dueAt: string;
  terms: PaymentTerms;
  customer: { name: string; company?: string; phone?: string; email?: string; address?: string };
  job: string;
  site?: string;
  lines: Pick<InvoiceLine, "description" | "rate" | "qty" | "taxable" | "rollCodes">[];
  tax?: { name: string; pct: number };
  taxExempt?: boolean;
  totals: Totals;
  paid: number;
  balance: number;
  notes: string;
  payUrl: string;
  address: string;
}

export function invoiceView(inv: Invoice): InvoiceView {
  const s = getSettings();
  const lead = leads.get(inv.leadId);
  const c = contacts.get(inv.contactId ?? lead?.contactId);
  const rate = taxRateFor(inv);
  const totals = invoiceTotals(inv);
  const paid = invoicePaid(inv);
  const billing = [c?.address, c?.city].filter(Boolean).join(", ") || lead?.address;
  return {
    id: inv.id,
    number: inv.number,
    status: inv.status,
    issuedAt: inv.issuedAt,
    dueAt: inv.dueAt,
    terms: inv.terms,
    customer: { name: c?.name || lead?.contact.name || "Customer", company: c?.company || undefined, phone: c?.phone || lead?.contact.phone || undefined, email: c?.email || lead?.contact.email || undefined, address: billing || undefined },
    job: lead ? jobTitle(lead) : "",
    site: lead?.address && lead.address !== billing ? lead.address : undefined,
    lines: inv.lines.map(({ description, rate, qty, taxable, rollCodes }) => ({ description, rate, qty, taxable, rollCodes: s.invoices.showRollCodes && rollCodes?.length ? rollCodes : undefined })),
    tax: rate ? { name: rate.name, pct: rate.pct } : undefined,
    taxExempt: c?.taxExempt || undefined,
    totals,
    paid,
    balance: Math.max(0, cents(totals.total - paid)),
    notes: inv.notes,
    payUrl: s.invoices.payUrl,
    address: s.businessAddress,
  };
}

/** Public link for the customer, with a snapshot so it opens on their phone. */
export const invoiceLink = (inv: Invoice) => publicUrl("i", inv.id, invoiceView(inv));

/** Pay link with the invoice reference attached where the processor supports it (Stripe Payment Links do). */
export function payHref(url: string, view: Pick<InvoiceView, "number" | "customer">) {
  if (!/stripe\.com/.test(url)) return url;
  try {
    const u = new URL(url);
    u.searchParams.set("client_reference_id", `invoice-${view.number}`);
    if (view.customer.email) u.searchParams.set("prefilled_email", view.customer.email);
    return u.toString();
  } catch {
    return url;
  }
}
