import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, CreditCard, MessageSquare, Phone, Printer, Receipt } from "lucide-react";
import { BUSINESS } from "../data/config";
import { InvoiceDocument, usePrintLight } from "../admin/invoices/InvoiceDocument";
import { Badge, Button, Card, EmptyState, Logo, MoneyInput, Segmented } from "../components/ui";
import { money, today } from "../lib/format";
import { decodeSnap } from "../lib/links";
import { INVOICE_STATES, invoiceView, payHref, type InvoiceView } from "../lib/money";
import { prettyDate } from "../lib/schedule";
import { getSession } from "../lib/session";
import { invoices, payments, useSettings } from "../lib/store";

type Tip = "0" | "10" | "15" | "20" | "custom";
const TIPS: { value: Tip; label: string }[] = [
  { value: "0", label: "None" }, { value: "10", label: "10%" }, { value: "15", label: "15%" }, { value: "20", label: "20%" }, { value: "custom", label: "Custom" },
];

/** Customer invoice at /i/:id. Reads the live record when it's on this device, else the snapshot in the link. Always dark. */
export default function InvoicePage() {
  const { id } = useParams();
  const local = invoices.useOne(id);
  payments.use();
  useSettings();
  const snap = useMemo(() => decodeSnap<InvoiceView>(window.location.hash), []);
  const view = local ? invoiceView(local) : snap?.id === id ? snap : null;
  usePrintLight();

  // First open of a sent invoice counts as viewed, unless it's the crew previewing it on a signed-in device.
  useEffect(() => {
    if (local && !local.viewedAt && local.status !== "draft" && local.status !== "void" && !getSession().user) {
      invoices.update(local.id, { viewedAt: new Date().toISOString(), ...(local.status === "sent" ? { status: "viewed" as const } : {}) });
    }
  }, [local]);

  useEffect(() => {
    if (view) document.title = `Invoice #${view.number} · ${BUSINESS.name}`;
  }, [view?.number]);

  if (!view) {
    return (
      <div className="min-h-screen bg-bg px-4 py-16 text-fg">
        <div className="mx-auto max-w-md">
          <Logo className="mx-auto mb-8 h-12" />
          <EmptyState icon={<Receipt size={40} />} title="Invoice not found" actions={<Button variant="outline" onClick={() => (window.location.href = BUSINESS.smsHref)}><MessageSquare size={16} /> Text us</Button>}>
            This link looks incomplete. Ask {BUSINESS.name} to send it again.
          </EmptyState>
        </div>
      </div>
    );
  }

  const pastDue = ["sent", "viewed", "partial"].includes(view.status) && view.balance > 0 && view.dueAt < today();

  return (
    <div className="min-h-screen bg-bg text-fg">
      <div className="mx-auto max-w-2xl px-4 pb-16 pt-5 sm:pt-10 print:max-w-none print:p-0">
        <div className="no-print mb-5 flex items-center justify-between gap-3">
          <Logo flat className="h-8" />
          <Button variant="ghost" size="sm" onClick={() => window.print()}><Printer size={14} /> Print</Button>
        </div>

        <div className="no-print mb-5">
          {view.status === "void" ? (
            <Card className="text-sm text-fg/70">This invoice was voided. Nothing is owed on it. Questions? Call {BUSINESS.phone}.</Card>
          ) : view.balance <= 0 ? (
            <Card tone="success" className="flex items-center gap-3">
              <CheckCircle2 className="shrink-0 text-success" size={28} />
              <div>
                <div className="font-display text-lg font-semibold">Paid in full. Thank you!</div>
                <div className="text-sm text-fg/55">Invoice #{view.number} · {money(view.totals.total, true)}</div>
              </div>
            </Card>
          ) : (
            <PayBox view={view} pastDue={pastDue} />
          )}
        </div>

        <InvoiceDocument view={view} />

        <p className="no-print mt-6 text-center text-xs text-fg/35">
          {BUSINESS.name} · {BUSINESS.phone} · <a href={BUSINESS.site} className="hover:text-fg/60">axisglasstinting.com</a>
        </p>
      </div>
    </div>
  );
}

function PayBox({ view, pastDue }: { view: InvoiceView; pastDue: boolean }) {
  const [tip, setTip] = useState<Tip>("0");
  const [custom, setCustom] = useState("");
  const tipAmt = tip === "custom" ? Math.max(0, Number(custom) || 0) : Math.round(view.balance * Number(tip)) / 100;
  const amount = Math.round((view.balance + tipAmt) * 100) / 100;
  const textBody = `Hi! I'd like to pay invoice #${view.number} (${money(amount, true)}${tipAmt ? `, incl. ${money(tipAmt, true)} tip` : ""}).`;

  return (
    <Card tone="accent" className="!p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm text-fg/55">Amount due</div>
          <div className="font-display text-4xl font-bold tabular-nums">{money(view.balance, true)}</div>
          <div className="mt-1 text-sm text-fg/50">
            Invoice #{view.number} · {view.terms === "receipt" ? "due on receipt" : `due ${prettyDate(view.dueAt, { month: "short", day: "numeric" })}`}
          </div>
        </div>
        <Badge tone={pastDue ? "danger" : INVOICE_STATES[view.status].tone}>{pastDue ? "Past due" : view.paid > 0 ? "Partly paid" : "Open"}</Badge>
      </div>

      <div className="mt-5">
        <div className="mb-2 text-sm font-medium text-fg/80">Add a tip for the crew?</div>
        <Segmented value={tip} onChange={setTip} options={TIPS} size="sm" />
        {tip === "custom" && <MoneyInput className="mt-2 max-w-[160px]" value={custom === "" ? null : Number(custom)} onChange={setCustom} placeholder="Tip" />}
      </div>

      <div className="mt-5 flex items-baseline justify-between gap-3 border-t border-fg/10 pt-4">
        <span className="text-sm text-fg/60">Amount to pay{tipAmt > 0 && <span className="block text-xs text-fg/40">incl. {money(tipAmt, true)} tip</span>}</span>
        <span className="font-display text-2xl font-bold tabular-nums">{money(amount, true)}</span>
      </div>

      {view.payUrl ? (
        <>
          <Button size="lg" className="mt-4 w-full" onClick={() => window.open(payHref(view.payUrl, view), "_blank", "noopener")}>
            <CreditCard size={18} /> Pay {money(amount, true)} now
          </Button>
          <p className="mt-2 text-center text-xs text-fg/45">
            Opens our secure checkout. Enter <b className="tabular-nums text-fg/80">{money(amount, true)}</b> at checkout and add invoice #{view.number} in the note.
          </p>
        </>
      ) : (
        <>
          <p className="mt-4 text-sm text-fg/55">Pay by card over the phone, or by Zelle, Venmo, check or cash. Call or text us:</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button size="lg" className="!px-3" onClick={() => (window.location.href = `${BUSINESS.smsHref}?&body=${encodeURIComponent(textBody)}`)}><MessageSquare size={18} /> Text to pay</Button>
            <Button size="lg" variant="outline" className="!px-3" onClick={() => (window.location.href = BUSINESS.phoneHref)}><Phone size={18} /> Call</Button>
          </div>
        </>
      )}
    </Card>
  );
}
