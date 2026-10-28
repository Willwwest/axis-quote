import { useState } from "react";
import { Check, Copy, Mail, MessageSquare } from "lucide-react";
import { BUSINESS } from "../../data/config";
import { Button, Field, Sheet, Textarea } from "../../components/ui";
import { fill, leadContext, reach, sendEmail, sendSms, template } from "../../lib/messages";
import { invoiceLink, invoiceView, markInvoiceSent } from "../../lib/money";
import { leads } from "../../lib/store";
import type { Invoice } from "../../lib/types";

/** Text or email the invoice link (Settings → Message templates → Send invoice), or copy it. Wrap in <AnimatePresence>. */
export function SendInvoiceSheet({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const lead = leads.get(invoice.leadId);
  const r = lead ? reach(lead) : { phone: "", email: "", smsOk: true, emailOk: true };
  const view = invoiceView(invoice);
  // The link carries a snapshot and is long, so the editable message shows `:link` and swaps it in on send.
  const [body, setBody] = useState(() => {
    const t = template("invoiceSend");
    return fill(t.includes(":link") ? t : `${t} :link`, { ...(lead ? leadContext(lead) : {}), link: ":link", amount: view.balance || view.totals.total });
  });
  const [copied, setCopied] = useState(false);
  // Marks it sent first so the snapshot in the link says "sent", not "draft".
  const final = () => {
    const link = invoiceLink(markInvoiceSent(invoice.id) ?? invoice);
    return body.includes(":link") ? body.split(":link").join(link) : `${body} ${link}`;
  };

  const text = () => { sendSms(r.phone, final(), "invoiceSend", invoice.leadId); onClose(); };
  const email = () => { sendEmail(r.email, `Invoice #${invoice.number} from ${BUSINESS.name}`, final(), "invoiceSend", invoice.leadId); onClose(); };
  const copy = async () => {
    try { await navigator.clipboard.writeText(invoiceLink(invoice)); setCopied(true); } catch { /* clipboard blocked */ }
  };

  return (
    <Sheet title={`Send invoice #${invoice.number}`} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Message" hint=":link becomes the invoice link">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <div className="space-y-1 text-xs text-fg/45">
          <div>Text: {r.phone || "no phone on file"}{r.phone && !r.smsOk && <span className="text-warn"> · opted out of texts</span>}</div>
          <div>Email: {r.email || "no email on file"}{r.email && !r.emailOk && <span className="text-warn"> · opted out of email</span>}</div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button disabled={!r.phone} onClick={text}><MessageSquare size={16} /> Text it</Button>
          <Button variant="outline" disabled={!r.email} onClick={email}><Mail size={16} /> Email it</Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-fg/10 pt-4">
          <Button variant="ghost" size="sm" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Link copied" : "Copy link"}</Button>
          {invoice.status === "draft" && (
            <Button variant="ghost" size="sm" onClick={() => { markInvoiceSent(invoice.id); onClose(); }}>Sent it another way? Mark sent</Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
