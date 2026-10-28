import { useState, type ReactNode } from "react";
import { Copy, MessageSquare, Trash2 } from "lucide-react";
import { Button, Chip, Dot, Field, IconButton, Input, MoneyInput, Select, Sheet, Textarea, Toggle, cx, type Tone } from "../../components/ui";
import { dayDate, money, today } from "../../lib/format";
import { fill, leadContext, markSent, reach, sendSms, template } from "../../lib/messages";
import {
  KIND_LABEL, METHODS, deletePayment, depositOwed, invoiceBalance, invoiceForLead, methodLabel, paidOnLead, recordPayment,
} from "../../lib/money";
import { jobPrice } from "../../lib/project";
import { personName, useSession } from "../../lib/session";
import { payments, useSettings } from "../../lib/store";
import type { Lead, Payment, PaymentMethod } from "../../lib/types";

const TITLE: Record<Payment["kind"], string> = { payment: "Record payment", deposit: "Record deposit", refund: "Refund" };
const TONE: Record<Payment["kind"], Tone> = { deposit: "info", payment: "success", refund: "danger" };
const round = (n: number) => Math.round(n * 100) / 100;

/** Amount, method, date, tip and notes for a deposit, payment or refund on a job. Wrap in <AnimatePresence>. */
export function PaymentSheet({ lead, kind, onClose }: { lead: Lead; kind: Payment["kind"]; onClose: () => void }) {
  const settings = useSettings();
  const inv = invoiceForLead(lead.id);
  const paid = paidOnLead(lead.id);
  const price = jobPrice(lead);
  const balance = inv ? invoiceBalance(inv) : Math.max(0, round(price - paid));
  const owed = depositOwed(lead);
  const quick =
    kind === "payment" ? [{ label: `Full balance ${money(balance, true)}`, amount: balance }]
    : kind === "deposit" ? [
      ...(owed ? [{ label: `Deposit due ${money(owed, true)}`, amount: owed }] : []),
      ...settings.proposals.depositOptions.filter((p) => p > 0 && p < 100).map((p) => ({ label: `${p}% · ${money(round((price * p) / 100), true)}`, amount: round((price * p) / 100) })),
    ]
    : [{ label: `Everything paid ${money(paid, true)}`, amount: paid }];
  const [amount, setAmount] = useState(kind === "deposit" && owed ? String(owed) : "");
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [date, setDate] = useState(today());
  const [tip, setTip] = useState("");
  const [notes, setNotes] = useState("");
  const r = reach(lead);
  const [thank, setThank] = useState(false);
  const n = Number(amount) || 0;
  const t = kind === "payment" ? Number(tip) || 0 : 0;
  const tooMuch = kind === "refund" && n > paid;

  const save = () => {
    recordPayment({ leadId: lead.id, invoiceId: inv?.id, kind, amount: n, tip: t || undefined, method, date, notes: notes.trim() || undefined });
    if (thank && r.phone) sendSms(r.phone, fill(template("paymentThanks"), leadContext(lead, { amount: n + t })), "paymentThanks", lead.id);
    onClose();
  };

  return (
    <Sheet title={TITLE[kind]} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Amount" hint={kind === "payment" && n > balance && balance > 0 ? "More than the balance" : tooMuch ? "More than they've paid" : undefined}>
          <MoneyInput value={amount === "" ? null : Number(amount)} onChange={setAmount} placeholder="0.00" />
        </Field>
        {quick.some((q) => q.amount > 0) && (
          <div className="-mt-1 flex flex-wrap gap-2">
            {quick.filter((q) => q.amount > 0).map((q) => (
              <Chip key={q.label} size="sm" selected={n === q.amount} onClick={() => setAmount(String(q.amount))}>{q.label}</Chip>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Method">
            <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className="!py-2">
              {METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </Select>
          </Field>
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value || today())} className="!py-2" />
          </Field>
        </div>
        {kind === "payment" && (
          <Field label="Tip" hint="Kept apart from the invoice">
            <MoneyInput value={tip === "" ? null : Number(tip)} onChange={setTip} placeholder="0.00" />
          </Field>
        )}
        <Field label="Notes" hint={kind === "refund" ? "Why, and how it went back" : "Check #, last 4, reference"}>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="!py-2" />
        </Field>
        {kind !== "refund" && r.phone && r.smsOk && (
          <Toggle checked={thank} onChange={setThank} label="Text a thank-you" hint={fill(template("paymentThanks"), leadContext(lead, { amount: n + t }))} />
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant={kind === "refund" ? "danger" : "primary"} disabled={n <= 0 || tooMuch} onClick={save}>
            {kind === "refund" ? `Refund ${money(n, true)}` : `Save ${KIND_LABEL[kind].toLowerCase()}`}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

/** Texts the customer how much deposit is due and where to pay it. */
export function RequestDepositSheet({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const s = useSettings();
  const owed = depositOwed(lead);
  const [amount, setAmount] = useState(() => String(owed || round((jobPrice(lead) * s.proposals.depositPct) / 100) || ""));
  const [custom, setCustom] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const r = reach(lead);
  const n = Number(amount) || 0;
  const pay = s.invoices.payUrl;
  const body = custom ?? fill(
    `Hi :first_name, to lock in your install with :business the deposit is :amount.${pay ? " Pay securely here: :link (enter :amount at checkout)." : " Reply here or call :phone to pay by card, Zelle or cash."}`,
    leadContext(lead, { amount: n, link: pay }),
  );
  const copy = async () => {
    try { await navigator.clipboard.writeText(body); setCopied(true); markSent(r.phone || r.email, body, "depositRequest", lead.id); } catch { /* clipboard blocked */ }
  };
  return (
    <Sheet title="Request deposit" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Deposit" hint={owed ? `${money(owed, true)} still due on the proposal` : `${s.proposals.depositPct}% of ${money(jobPrice(lead))}`}>
          <MoneyInput value={amount === "" ? null : Number(amount)} onChange={(v) => { setAmount(v); setCustom(null); }} />
        </Field>
        <Field label="Message" hint={r.phone ? `To ${r.phone}` : "No phone on file"}>
          <Textarea value={body} onChange={(e) => setCustom(e.target.value)} />
        </Field>
        {!pay && <p className="text-xs text-fg/45">Add a pay link under Settings → Invoices & tax so customers can pay by card from the text.</p>}
        {!r.smsOk && <p className="text-xs text-warn">This customer opted out of texts.</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={copy}><Copy size={15} /> {copied ? "Copied" : "Copy"}</Button>
          <Button disabled={!r.phone || n <= 0} onClick={() => { sendSms(r.phone, body, "depositRequest", lead.id); onClose(); }}>
            <MessageSquare size={16} /> Text {money(n, true)} request
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

/** Every payment, deposit and refund on a job, newest first. */
export function PaymentList({ leadId, empty }: { leadId: string; empty?: ReactNode }) {
  const all = payments.use();
  const { can } = useSession();
  const list = all.filter((p) => p.leadId === leadId).sort((a, b) => b.date.localeCompare(a.date));
  if (!list.length) return <>{empty ?? <p className="py-2 text-sm text-fg/45">No payments yet.</p>}</>;
  return (
    <ul className="divide-y divide-fg/5">
      {list.map((p) => (
        <li key={p.id} className="flex items-center gap-3 py-2.5">
          <Dot tone={TONE[p.kind]} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-fg/90">{KIND_LABEL[p.kind]} · {methodLabel(p.method)}</div>
            <div className="truncate text-xs text-fg/45">{dayDate(p.date)}{p.byId ? ` · ${personName(p.byId)}` : ""}{p.notes ? ` · ${p.notes}` : ""}</div>
          </div>
          <div className="text-right">
            <div className={cx("font-display tabular-nums", p.kind === "refund" && "text-danger")}>{p.kind === "refund" ? "−" : ""}{money(p.amount, true)}</div>
            {!!p.tip && <div className="text-xs tabular-nums text-fg/45">+{money(p.tip, true)} tip</div>}
          </div>
          {can("payments") && (
            <IconButton label="Delete payment" onClick={() => confirm(`Delete this ${KIND_LABEL[p.kind].toLowerCase()} of ${money(p.amount, true)}?`) && deletePayment(p.id)}>
              <Trash2 size={15} />
            </IconButton>
          )}
        </li>
      ))}
    </ul>
  );
}
