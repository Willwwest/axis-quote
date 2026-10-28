import { useState } from "react";
import { AlertTriangle, Check, Copy, ExternalLink, Mail, MessageSquare } from "lucide-react";
import { Button, Field, Segmented, Sheet, Textarea } from "../../components/ui";
import { markSent, reach, sendEmail, sendSms } from "../../lib/messages";
import type { Lead } from "../../lib/types";

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt("Copy this:", text);
    return false;
  }
}

/** Text, email or copy-link for anything customer-facing (proposal, document…). `onSent` runs before the app switch. */
export function SendSheet({ title, lead, body, subject, kind, link, onSent, onClose }: {
  title: string; lead: Lead; body: string; subject: string; kind: string; link: string;
  onSent: (via: "sms" | "email" | "copy") => void; onClose: () => void;
}) {
  const r = reach(lead);
  const [via, setVia] = useState<"sms" | "email">(r.phone && r.smsOk ? "sms" : r.email ? "email" : "sms");
  const [text, setText] = useState(body);
  const [copied, setCopied] = useState(false);
  const to = via === "sms" ? r.phone : r.email;
  const optedOut = via === "sms" ? !r.smsOk : !r.emailOk;

  const send = () => {
    onSent(via);
    if (via === "sms") sendSms(r.phone, text, kind, lead.id);
    else sendEmail(r.email, subject, text, kind, lead.id);
    onClose();
  };
  const copy = async () => {
    await copyText(link);
    markSent(r.phone || r.email, text, kind, lead.id);
    onSent("copy");
    setCopied(true);
  };

  return (
    <Sheet title={title} onClose={onClose}>
      <Segmented value={via} onChange={setVia} options={[{ value: "sms", label: <span className="flex items-center gap-1.5"><MessageSquare size={14} /> Text</span> }, { value: "email", label: <span className="flex items-center gap-1.5"><Mail size={14} /> Email</span> }]} />
      <div className="mt-4 text-sm">
        <span className="text-fg/45">To </span>
        {to ? <span className="font-medium">{lead.contact.name} · {to}</span> : <span className="text-warn">No {via === "sms" ? "phone number" : "email"} on file</span>}
      </div>
      {optedOut && to && (
        <p className="mt-2 flex items-center gap-1.5 rounded-xl bg-warn/10 px-3 py-2 text-xs text-warn"><AlertTriangle size={13} /> This customer opted out of {via === "sms" ? "texts" : "email"}. Send only if they asked for it.</p>
      )}
      <Field label="Message" className="mt-4">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} />
      </Field>
      <p className="mt-1 text-xs text-fg/40">Opens your phone's {via === "sms" ? "Messages" : "Mail"} app with this filled in.</p>
      <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <Button onClick={send} disabled={!to}>{via === "sms" ? <MessageSquare size={16} /> : <Mail size={16} />} Send {via === "sms" ? "text" : "email"}</Button>
        <Button variant="outline" onClick={copy}>{copied ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy link</>}</Button>
        <a href={link.replace("#", "?preview=1#")} target="_blank" rel="noreferrer"><Button variant="ghost" className="w-full"><ExternalLink size={16} /> Preview</Button></a>
      </div>
    </Sheet>
  );
}
