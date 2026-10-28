import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, Copy, CreditCard, ExternalLink, Film, Plus, Printer, Receipt, RotateCcw, Send, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardHeader, Chip, EmptyState, Field, IconButton, Input, MoneyInput, PageHeader, Select, Textarea, cx } from "../../components/ui";
import { money, relative } from "../../lib/format";
import {
  INVOICE_STATES, TERMS, dueFor, invoiceBalance, invoiceLink, invoicePaid, invoiceState, invoiceTotals, invoiceView, newLine,
  restoreInvoice, rollCodesFor, taxRateFor, updateInvoice, voidInvoice,
} from "../../lib/money";
import { jobTitle } from "../../lib/project";
import { useSession } from "../../lib/session";
import { contacts, invoices, leads, payments, useSettings } from "../../lib/store";
import type { Invoice, InvoiceLine, PaymentTerms } from "../../lib/types";
import { InvoiceDocument, usePrintLight } from "./InvoiceDocument";
import { PaymentList, PaymentSheet } from "./payments";
import { SendInvoiceSheet } from "./SendInvoiceSheet";

/** Writes a typed number unless it's mid-entry ("", "-", "."), so a minus sign for discounts survives. */
const num = (v: string, set: (n: number) => void) => {
  if (v === "" || v === "-" || v === ".") return;
  const n = Number(v);
  if (Number.isFinite(n)) set(n);
};

const Tiny = ({ children, className }: { children: ReactNode; className?: string }) => <span className={cx("mb-1 block text-[11px] font-medium uppercase tracking-wider text-fg/40", className)}>{children}</span>;

const LINE_COLS = "md:grid-cols-[minmax(0,1fr)_7rem_3.75rem_3.5rem_6.5rem_2.25rem]";

export default function InvoiceEditor() {
  const { id } = useParams();
  const inv = invoices.useOne(id);
  const pays = payments.use();
  const settings = useSettings();
  const lead = leads.useOne(inv?.leadId);
  const contact = contacts.useOne(inv?.contactId ?? lead?.contactId);
  const { can } = useSession();
  const nav = useNavigate();
  const [sheet, setSheet] = useState<null | "send" | "payment" | "refund">(null);
  const [copied, setCopied] = useState(false);
  usePrintLight();

  if (!inv) {
    return (
      <EmptyState icon={<Receipt size={40} />} title="Invoice not found" actions={<Button variant="outline" onClick={() => nav("/admin/invoices")}>Back to invoices</Button>}>
        It may have been deleted.
      </EmptyState>
    );
  }

  const locked = inv.status === "void";
  const totals = invoiceTotals(inv);
  const paid = invoicePaid(inv, pays);
  const balance = invoiceBalance(inv, pays);
  const state = invoiceState(inv, balance);
  const rate = taxRateFor(inv);
  const patch = (p: Partial<Invoice> | ((i: Invoice) => Partial<Invoice>)) => { if (!locked) updateInvoice(inv.id, p); };
  const setLine = (lineId: string, p: Partial<InvoiceLine>) => patch((i) => ({ lines: i.lines.map((l) => (l.id === lineId ? { ...l, ...p } : l)) }));
  const codes = rollCodesFor(inv.leadId).filter((c) => !inv.lines.some((l) => l.rollCodes?.includes(c)));
  const customer = contact?.name || lead?.contact.name || "Customer";

  const copy = async () => {
    try { await navigator.clipboard.writeText(invoiceLink(inv)); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
  };
  const attachCodes = () => patch((i) => {
    const at = Math.max(0, i.lines.findIndex((l) => l.rate > 0));
    return { lines: i.lines.map((l, n) => (n === at ? { ...l, rollCodes: [...(l.rollCodes ?? []), ...codes] } : l)) };
  });

  return (
    <>
      <div className="no-print">
        <Link to="/admin/invoices" className="mb-3 inline-flex items-center gap-1 text-sm text-fg/50 hover:text-fg"><ArrowLeft size={14} /> Invoices</Link>
        <PageHeader
          eyebrow="Invoice"
          title={<span className="flex flex-wrap items-center gap-3">#{inv.number} <Badge tone={INVOICE_STATES[state].tone}>{INVOICE_STATES[state].label}</Badge></span>}
          sub={<>
            {customer} · {lead ? <Link to={`/admin/jobs/${lead.id}`} className="text-accent-fg hover:underline">{jobTitle(lead)}</Link> : "job removed"}
            {inv.viewedAt ? ` · viewed ${relative(inv.viewedAt)}` : inv.sentAt ? ` · sent ${relative(inv.sentAt)}` : ""}
          </>}
          actions={!locked && (
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider text-fg/45">Balance due</div>
              <div className={cx("font-display text-3xl font-bold tabular-nums", balance === 0 && "text-success")}>{money(balance, true)}</div>
            </div>
          )}
        />

        <div className="mb-6 flex flex-wrap gap-2">
          {!locked && <Button onClick={() => setSheet("send")}><Send size={16} /> {inv.sentAt ? "Send again" : "Send"}</Button>}
          {can("payments") && !locked && <Button variant="outline" onClick={() => setSheet("payment")}><CreditCard size={16} /> Record payment</Button>}
          <Button variant="outline" size="sm" className="!h-11" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy link"}</Button>
          <Button variant="outline" size="sm" className="!h-11" onClick={() => window.print()}><Printer size={14} /> Print / PDF</Button>
          <Button variant="ghost" size="sm" className="!h-11" onClick={() => window.open(invoiceLink(inv), "_blank")}><ExternalLink size={14} /> Customer view</Button>
          <div className="hidden flex-1 sm:block" />
          {can("payments") && paid > 0 && <Button variant="ghost" size="sm" className="!h-11" onClick={() => setSheet("refund")}><RotateCcw size={14} /> Refund</Button>}
          {locked ? (
            <Button variant="outline" size="sm" className="!h-11" onClick={() => restoreInvoice(inv.id) || alert("This job already has another live invoice.")}>Restore invoice</Button>
          ) : (
            <Button variant="ghost" size="sm" className="!h-11" onClick={() => confirm(`Void invoice #${inv.number}? It stays on record but stops counting.`) && voidInvoice(inv.id)}>Void</Button>
          )}
          {inv.status === "draft" && (
            <Button variant="danger" size="sm" className="!h-11" onClick={() => { if (confirm(`Delete draft #${inv.number}?`)) { invoices.remove(inv.id); nav("/admin/invoices"); } }}>
              <Trash2 size={14} /> Delete
            </Button>
          )}
        </div>

        {locked && <Card tone="warn" className="mb-6 text-sm text-fg/70">This invoice is void. It's kept for the record and left out of totals and exports. Restore it to edit.</Card>}

        <div className="space-y-6">
          <Card>
            <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] xl:grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)]">
              <div className="text-sm">
                <Tiny>Bill to</Tiny>
                {contact ? <Link to={`/admin/contacts/${contact.id}`} className="font-medium hover:text-accent-fg">{customer}</Link> : <span className="font-medium">{customer}</span>}
                {contact?.company && <div className="text-fg/60">{contact.company}</div>}
                <div className="text-fg/55">{contact?.phone || lead?.contact.phone}</div>
                <div className="break-all text-fg/55">{contact?.email || lead?.contact.email}</div>
                {contact?.taxExempt && <Badge tone="info" className="mt-2">Tax exempt</Badge>}
              </div>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <Field label="Issued">
                  <Input type="date" value={inv.issuedAt} disabled={locked} className="!px-3 !py-2"
                    onChange={(e) => e.target.value && patch({ issuedAt: e.target.value, dueAt: dueFor(e.target.value, inv.terms) })} />
                </Field>
                <Field label="Terms">
                  <Select value={inv.terms} disabled={locked} className="!px-3 !py-2"
                    onChange={(e) => { const terms = e.target.value as PaymentTerms; patch({ terms, dueAt: dueFor(inv.issuedAt, terms) }); }}>
                    {TERMS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </Select>
                </Field>
                <Field label="Due">
                  <Input type="date" value={inv.dueAt} disabled={locked} className="!px-3 !py-2" onChange={(e) => e.target.value && patch({ dueAt: e.target.value })} />
                </Field>
                <Field label="Sales tax">
                  <Select value={inv.taxRateId ?? ""} disabled={locked} className="!px-3 !py-2" onChange={(e) => patch({ taxRateId: e.target.value || undefined })}>
                    <option value="">No tax</option>
                    {settings.invoices.taxRates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.pct}%)</option>)}
                  </Select>
                </Field>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Lines"
              sub="A negative rate makes a discount line."
              actions={!locked && codes.length > 0 && (
                <Button variant="ghost" size="sm" onClick={attachCodes}><Film size={14} /> Add roll {codes.join(", ")}</Button>
              )}
            />
            {/* Phone: description + trash, then rate / qty / tax / amount. Wider: one row per line under column heads. */}
            <div className={cx("mb-2 hidden gap-2 px-3 text-[11px] font-medium uppercase tracking-wider text-fg/40", inv.lines.length > 0 && "md:grid", LINE_COLS)}>
              <span>Description</span><span>Rate</span><span className="text-center">Qty</span><span>Tax</span><span className="text-right">Amount</span><span />
            </div>
            <div className="space-y-2">
              {inv.lines.map((l) => (
                <div key={l.id} className="rounded-xl border border-fg/10 bg-fg/[.02] p-3">
                  <div className={cx("grid grid-cols-[minmax(0,1fr)_3.75rem_auto_auto] items-end gap-2 md:items-start", LINE_COLS)}>
                    <Textarea rows={Math.min(4, l.description.split("\n").length + Math.floor(l.description.length / 50))} value={l.description} disabled={locked}
                      placeholder="Description" className="col-span-3 !min-h-0 !px-3 !py-2 text-sm [field-sizing:content] md:col-span-1"
                      onChange={(e) => setLine(l.id, { description: e.target.value })} />
                    <IconButton label="Remove line" disabled={locked} className="self-start justify-self-end md:order-last"
                      onClick={() => patch((x) => ({ lines: x.lines.filter((y) => y.id !== l.id) }))}><Trash2 size={15} /></IconButton>
                    <label><Tiny className="md:hidden">Rate</Tiny><MoneyInput value={l.rate} onChange={(v) => num(v, (rate) => setLine(l.id, { rate }))} /></label>
                    <label><Tiny className="md:hidden">Qty</Tiny>
                      <Input type="number" inputMode="decimal" value={l.qty} disabled={locked} className="!px-2 !py-2 text-center tabular-nums"
                        onChange={(e) => num(e.target.value, (qty) => setLine(l.id, { qty }))} />
                    </label>
                    <div className="pb-1.5 md:pb-0 md:pt-2"><Chip size="sm" selected={l.taxable} onClick={() => !locked && setLine(l.id, { taxable: !l.taxable })}>Tax</Chip></div>
                    <div className="pb-2 text-right md:pb-0 md:pt-2.5">
                      <Tiny className="md:hidden">Amount</Tiny>
                      <span className={cx("font-display tabular-nums", l.rate < 0 && "text-success")}>{money(l.rate * l.qty, true)}</span>
                    </div>
                  </div>
                  {!!l.rollCodes?.length && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-fg/45">
                      <Film size={12} /> Film roll {l.rollCodes.join(", ")}
                      {!settings.invoices.showRollCodes && <span>(hidden on invoices, see Settings)</span>}
                      {!locked && <button type="button" className="underline hover:text-fg" onClick={() => setLine(l.id, { rollCodes: undefined })}>remove</button>}
                    </div>
                  )}
                </div>
              ))}
              {!inv.lines.length && <p className="py-4 text-center text-sm text-fg/45">No lines yet.</p>}
            </div>
            {!locked && <Button variant="outline" size="sm" className="mt-3" onClick={() => patch((x) => ({ lines: [...x.lines, newLine()] }))}><Plus size={14} /> Add line</Button>}

            <dl className="ml-auto mt-5 max-w-xs space-y-1.5 border-t border-fg/10 pt-4 text-sm">
              <Total k="Subtotal" v={totals.subtotal} />
              <Total k="Taxable" v={totals.taxable} muted />
              <Total k={rate ? `${rate.name} ${rate.pct}%` : "No tax"} v={totals.tax} />
              <div className="border-t border-fg/10 pt-1.5"><Total k="Total" v={totals.total} strong /></div>
              <Total k="Paid" v={paid ? -paid : 0} muted />
              <Total k="Balance due" v={balance} strong />
              {paid > totals.total && <p className="text-right text-xs text-warn">Overpaid by {money(paid - totals.total, true)}</p>}
            </dl>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Payments"
                sub={`${money(paid, true)} paid of ${money(totals.total, true)}`}
                actions={can("payments") && !locked && <Button variant="ghost" size="sm" onClick={() => setSheet("payment")}><Plus size={14} /> Add</Button>}
              />
              <PaymentList leadId={inv.leadId} empty={<p className="py-2 text-sm text-fg/45">No payments yet. Deposits on this job show here too.</p>} />
            </Card>
            <Card>
              <CardHeader title="Notes" sub="Printed at the bottom of the invoice." />
              <Textarea value={inv.notes} disabled={locked} onChange={(e) => patch({ notes: e.target.value })} placeholder="Thank you for your business!" />
            </Card>
          </div>
        </div>
      </div>

      <div className="hidden print:block">
        <InvoiceDocument view={invoiceView(inv)} />
      </div>

      <AnimatePresence>
        {sheet === "send" && <SendInvoiceSheet invoice={inv} onClose={() => setSheet(null)} />}
        {(sheet === "payment" || sheet === "refund") && lead && <PaymentSheet lead={lead} kind={sheet} onClose={() => setSheet(null)} />}
      </AnimatePresence>
    </>
  );
}

function Total({ k, v, strong, muted }: { k: string; v: number; strong?: boolean; muted?: boolean }) {
  return (
    <div className={cx("flex items-baseline justify-between gap-4", strong ? "font-semibold text-fg" : muted ? "text-fg/45" : "text-fg/70")}>
      <dt>{k}</dt>
      <dd className={cx("font-display tabular-nums", strong && "text-lg")}>{v < 0 ? `−${money(-v, true)}` : money(v, true)}</dd>
    </div>
  );
}
