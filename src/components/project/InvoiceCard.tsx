import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { CreditCard, FilePlus2, HandCoins, MessageSquare, Receipt, RotateCcw, Send } from "lucide-react";
import { PaymentList, PaymentSheet, RequestDepositSheet } from "../../admin/invoices/payments";
import { SendInvoiceSheet } from "../../admin/invoices/SendInvoiceSheet";
import { money } from "../../lib/format";
import {
  INVOICE_STATES, createInvoiceFromLead, depositDue, depositPaid, invoiceBalance, invoiceForLead, invoiceState, invoiceTotals, paidOnLead,
} from "../../lib/money";
import { jobPrice } from "../../lib/project";
import { useSession } from "../../lib/session";
import { invoices, payments, proposals } from "../../lib/store";
import type { Lead, Payment } from "../../lib/types";
import { Badge, Button, Card, CardHeader, cx } from "../ui";

type SheetKind = Payment["kind"] | "request" | "send";

/** Job page: price, deposit, invoice and payments in one place. */
export function InvoiceCard({ lead }: { lead: Lead }) {
  invoices.use();
  proposals.use();
  const pays = payments.use();
  const { can } = useSession();
  const nav = useNavigate();
  const [sheet, setSheet] = useState<SheetKind | null>(null);
  const canPay = can("payments");
  const canInvoice = can("invoices");
  if (!canPay && !canInvoice) return null;

  const inv = invoiceForLead(lead.id);
  const price = jobPrice(lead);
  const due = depositDue(lead);
  const dPaid = depositPaid(lead.id, pays);
  const paid = paidOnLead(lead.id, pays);
  const total = inv ? invoiceTotals(inv).total : 0;
  const balance = inv ? invoiceBalance(inv, pays) : Math.max(0, price - paid);
  const state = inv ? invoiceState(inv, balance) : null;
  const settled = inv?.status === "paid";
  const wantDeposit = !settled && price > 0 && (due ? dPaid < due : dPaid === 0);
  const hasPayments = pays.some((p) => p.leadId === lead.id);

  const create = () => nav(`/admin/invoices/${createInvoiceFromLead(lead).id}`);

  return (
    <Card>
      <CardHeader
        title="Invoice & payments"
        icon={<Receipt size={16} />}
        actions={inv && state && (
          <Link to={`/admin/invoices/${inv.id}`} className="flex items-center gap-2 text-sm text-fg/60 hover:text-fg">
            #{inv.number} <Badge tone={INVOICE_STATES[state].tone}>{INVOICE_STATES[state].label}</Badge>
          </Link>
        )}
      />

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        <Fig k="Job price" v={money(price, true)} />
        {(due > 0 || dPaid > 0) && (
          <Fig k="Deposit" v={money(dPaid, true)} tone={due && dPaid < due ? "warn" : "success"}
            sub={due ? (dPaid >= due ? `Paid · ${money(due, true)} asked` : `${money(due - dPaid, true)} of ${money(due, true)} due`) : "Paid"} />
        )}
        <Fig k="Invoice" v={inv ? money(total, true) : "None yet"} sub={inv ? `#${inv.number}` : undefined} />
        <Fig k="Paid" v={money(paid, true)} />
        <Fig k={inv ? "Balance" : "Left to pay"} v={money(balance, true)} strong tone={inv && balance === 0 ? "success" : undefined} sub={inv ? undefined : "Before invoicing"} />
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        {canInvoice && (inv
          ? <Button size="sm" onClick={() => nav(`/admin/invoices/${inv.id}`)}><Receipt size={14} /> Open invoice</Button>
          : <Button size="sm" onClick={create}><FilePlus2 size={14} /> Create invoice</Button>)}
        {canInvoice && inv && !settled && <Button size="sm" variant="outline" onClick={() => setSheet("send")}><Send size={14} /> Send invoice</Button>}
        {canPay && !settled && <Button size="sm" variant="outline" onClick={() => setSheet("payment")}><CreditCard size={14} /> Record payment</Button>}
        {canPay && !settled && <Button size="sm" variant="outline" onClick={() => setSheet("deposit")}><HandCoins size={14} /> Record deposit</Button>}
        {wantDeposit && <Button size="sm" variant="ghost" onClick={() => setSheet("request")}><MessageSquare size={14} /> Request deposit</Button>}
        {canPay && paid > 0 && <Button size="sm" variant="ghost" onClick={() => setSheet("refund")}><RotateCcw size={14} /> Refund</Button>}
      </div>

      {hasPayments && <div className="mt-4 border-t border-fg/10 pt-1"><PaymentList leadId={lead.id} /></div>}

      <AnimatePresence>
        {(sheet === "payment" || sheet === "deposit" || sheet === "refund") && <PaymentSheet lead={lead} kind={sheet} onClose={() => setSheet(null)} />}
        {sheet === "request" && <RequestDepositSheet lead={lead} onClose={() => setSheet(null)} />}
        {sheet === "send" && inv && <SendInvoiceSheet invoice={inv} onClose={() => setSheet(null)} />}
      </AnimatePresence>
    </Card>
  );
}

function Fig({ k, v, sub, tone, strong }: { k: string; v: ReactNode; sub?: ReactNode; tone?: "success" | "warn"; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-fg/45">{k}</dt>
      <dd className={cx("font-display tabular-nums", strong ? "text-xl font-bold" : "text-base font-semibold", tone === "success" && "text-success", tone === "warn" && "text-warn")}>{v}</dd>
      {sub && <dd className="truncate text-[11px] text-fg/40">{sub}</dd>}
    </div>
  );
}
