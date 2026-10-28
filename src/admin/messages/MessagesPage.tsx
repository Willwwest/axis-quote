import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, Inbox, Mail, MessageSquare, Pencil, Send, SkipForward } from "lucide-react";
import { Badge, Button, Card, Chip, EmptyState, Field, Input, PageHeader, SearchInput, Segmented, Select, Tabs, Textarea, cx, type Tone } from "../../components/ui";
import { BUSINESS, TEMPLATE_LABELS, type TemplateKey } from "../../data/config";
import { at, relative } from "../../lib/format";
import { fill, leadContext, reach, sendEmail, sendSms } from "../../lib/messages";
import { balanceOnLead, invoiceLink } from "../../lib/money";
import { proposalLink } from "../proposals/logic";
import { OUTBOX_LABELS, reviewLink, sendItem, skip, templateLabel, useOutbox, type OutboxItem, type OutboxKind } from "../../lib/outbox";
import { jobTitle } from "../../lib/project";
import { apptLink } from "../../lib/schedule";
import { personName } from "../../lib/session";
import { appointments, contacts, invoices, leads, messages, proposals, useSettings } from "../../lib/store";
import type { Contact, Lead } from "../../lib/types";

type Tab = "outbox" | "sent" | "compose";

const KIND_TONE: Partial<Record<OutboxKind, Tone>> = {
  confirm: "info", remind24: "info", remind1: "accent", cancel: "danger", proposalFollow24: "warn", proposalFollow48: "warn", review: "success", invoiceDue: "danger",
};

export default function MessagesPage() {
  const due = useOutbox();
  const log = messages.use();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "outbox";
  const setTab = (t: Tab) => setParams((p) => { p.set("tab", t); return p; }, { replace: true });

  return (
    <div>
      <PageHeader
        title="Messages"
        sub={due.length ? `${due.length} message${due.length === 1 ? "" : "s"} due to send` : "Outbox is clear"}
        actions={<Button variant="outline" onClick={() => setTab("compose")}><Pencil size={15} /> Compose</Button>}
      />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: "outbox", label: "Outbox", count: due.length }, { id: "sent", label: "Sent", count: log.length }, { id: "compose", label: "Compose" }]} />
      {tab === "outbox" && <Outbox items={due} />}
      {tab === "sent" && <Sent />}
      {tab === "compose" && <Compose leadId={params.get("lead") ?? undefined} />}
    </div>
  );
}

/* ---------- Outbox ---------- */

function Outbox({ items }: { items: OutboxItem[] }) {
  const [kind, setKind] = useState<OutboxKind | "all">("all");
  const counts = items.reduce<Record<string, number>>((m, i) => ({ ...m, [i.kind]: (m[i.kind] ?? 0) + 1 }), {});
  const shown = kind === "all" ? items : items.filter((i) => i.kind === kind);

  if (!items.length) {
    return (
      <EmptyState icon={<Inbox size={40} />} title="Nothing to send">
        Confirmations, reminders, proposal follow-ups, review requests and past-due nudges show up here when they're due. Turn them on or off under Settings → Calendar and Proposals.
      </EmptyState>
    );
  }
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Chip size="sm" selected={kind === "all"} onClick={() => setKind("all")}>All · {items.length}</Chip>
        {(Object.keys(OUTBOX_LABELS) as OutboxKind[]).filter((k) => counts[k]).map((k) => (
          <Chip key={k} size="sm" selected={kind === k} onClick={() => setKind(k)}>{OUTBOX_LABELS[k]} · {counts[k]}</Chip>
        ))}
      </div>
      <div className="grid gap-3">
        {shown.map((i) => <OutboxRow key={i.id} item={i} />)}
      </div>
    </div>
  );
}

function OutboxRow({ item }: { item: OutboxItem }) {
  const [body, setBody] = useState(item.body);
  const [editing, setEditing] = useState(false);
  const late = Date.now() - +new Date(item.due) > 6 * 3600_000;
  return (
    <Card className="min-w-0 !p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={KIND_TONE[item.kind]}>{OUTBOX_LABELS[item.kind]}</Badge>
        <span className="font-medium">{item.name}</span>
        {item.lead && <Link to={`/admin/jobs/${item.lead.id}`} className="truncate text-sm text-fg/45 hover:text-fg">{jobTitle(item.lead)}</Link>}
        <span className={cx("ml-auto text-xs", late ? "text-warn" : "text-fg/40")}>Due {relative(item.due)}</span>
      </div>
      {editing ? (
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="mt-3 !min-h-[80px] text-sm" />
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="mt-2 block w-full rounded-xl bg-fg/[.04] px-3 py-2 text-left text-sm text-fg/75 [overflow-wrap:anywhere] hover:bg-fg/[.06]" title="Tap to edit">
          {body}
        </button>
      )}
      <div className="mt-1.5 text-xs text-fg/40 [overflow-wrap:anywhere]">{[item.phone, item.email].filter(Boolean).join(" · ")}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {item.phone && <Button size="sm" onClick={() => sendItem(item, "sms", body)}><MessageSquare size={14} /> Send text</Button>}
        {item.email && <Button size="sm" variant={item.phone ? "outline" : "primary"} onClick={() => sendItem(item, "email", body)}><Mail size={14} /> Send email</Button>}
        <Button size="sm" variant="ghost" onClick={() => sendItem(item, "mark", body)}><Check size={14} /> Mark sent</Button>
        <Button size="sm" variant="ghost" onClick={() => skip(item.id)}><SkipForward size={14} /> Skip</Button>
      </div>
    </Card>
  );
}

/* ---------- Sent log ---------- */

function Sent() {
  const log = messages.use();
  const [q, setQ] = useState("");
  const [channel, setChannel] = useState<"all" | "sms" | "email">("all");
  const [kind, setKind] = useState("");
  const kinds = useMemo(() => [...new Set(log.map((m) => m.kind))].sort(), [log]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return [...log]
      .filter((m) => (channel === "all" || m.channel === channel) && (!kind || m.kind === kind))
      .filter((m) => !t || [m.to, m.body, leads.get(m.leadId)?.contact.name ?? ""].join(" ").toLowerCase().includes(t))
      .sort((a, b) => b.at.localeCompare(a.at));
  }, [log, q, channel, kind]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search name, number or text" className="w-full sm:w-72" />
        <Segmented size="sm" value={channel} onChange={setChannel} options={[{ value: "all", label: "All" }, { value: "sms", label: "Text" }, { value: "email", label: "Email" }]} />
        <Select value={kind} onChange={(e) => setKind(e.target.value)} className="!w-auto !py-2 text-sm" aria-label="Message type">
          <option value="">Every type</option>
          {kinds.map((k) => <option key={k} value={k}>{templateLabel(k)}</option>)}
        </Select>
      </div>
      {shown.length === 0 ? (
        <EmptyState icon={<Send size={40} />} title={log.length ? "No matches" : "Nothing sent yet"}>Every text and email the crew sends from Axis is logged here.</EmptyState>
      ) : (
        <div className="divide-y divide-fg/5 overflow-hidden rounded-2xl border border-fg/10 bg-surface">
          {shown.slice(0, 200).map((m) => {
            const lead = leads.get(m.leadId);
            return (
              <div key={m.id} className="flex gap-3 px-4 py-3">
                <span className="mt-0.5 text-fg/40">{m.channel === "sms" ? <MessageSquare size={16} /> : <Mail size={16} />}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <span className="font-medium">{lead?.contact.name ?? m.to}</span>
                    <Badge>{templateLabel(m.kind)}</Badge>
                    {lead && <Link to={`/admin/jobs/${lead.id}`} className="text-xs text-fg/45 hover:text-fg">{jobTitle(lead)}</Link>}
                    <span className="ml-auto text-xs text-fg/40" title={new Date(m.at).toLocaleString()}>{relative(m.at)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm text-fg/65 [overflow-wrap:anywhere]">{m.body}</p>
                  <div className="mt-1 text-xs text-fg/35">{m.to}{m.byId ? ` · by ${personName(m.byId)}` : ""}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Compose ---------- */


/** Best link for a template on this job: next appointment, latest proposal or invoice, or the review page. */
function linkFor(key: TemplateKey | "", lead: Lead) {
  if (["confirm", "remind24", "remind1", "cancel", "onMyWay"].includes(key)) {
    const next = appointments.all().filter((a) => a.leadId === lead.id && a.status !== "cancelled" && +at(a.date, a.start) > Date.now() - 3600_000).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))[0];
    return { link: next ? apptLink(next) : "", appointment: next };
  }
  if (key.startsWith("proposal")) {
    const p = proposals.all().filter((x) => x.leadId === lead.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return { link: p ? proposalLink(p) : "", code: p?.code };
  }
  if (key === "invoiceSend" || key === "paymentThanks") {
    const inv = invoices.all().find((i) => i.leadId === lead.id && i.status !== "void");
    return { link: inv ? invoiceLink(inv) : "", amount: balanceOnLead(lead.id) || undefined };
  }
  if (key === "review") return { link: reviewLink() };
  return {};
}

function Compose({ leadId }: { leadId?: string }) {
  const s = useSettings();
  const allLeads = leads.use();
  const allContacts = contacts.use();
  const [lead, setLead] = useState<Lead | undefined>(() => leads.get(leadId));
  const [contact, setContact] = useState<Contact | undefined>();
  const [q, setQ] = useState("");
  const [key, setKey] = useState<TemplateKey | "">("");
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState<"sms" | "email">("sms");
  const [sent, setSent] = useState(false);

  const r = lead ? reach(lead) : contact ? { phone: contact.phone, email: contact.email, smsOk: contact.prefs.sms, emailOk: contact.prefs.email } : null;
  const [to, setTo] = useState(() => { const l = leads.get(leadId); return l ? reach(l).phone : ""; });
  const name = lead?.contact.name ?? contact?.name ?? "";

  const pick = (l?: Lead, c?: Contact) => {
    setLead(l); setContact(c); setQ(""); setSent(false);
    const rr = l ? reach(l) : c ? { phone: c.phone, email: c.email } : null;
    setTo(channel === "sms" ? rr?.phone ?? "" : rr?.email ?? "");
    if (key) applyTemplate(key, l, c);
  };
  const applyTemplate = (k: TemplateKey | "", l = lead, c = contact) => {
    setKey(k);
    if (!k) return;
    const ctx = l ? leadContext(l, linkFor(k, l)) : { name: c?.name };
    setBody(fill(s.templates[k], ctx));
  };
  const switchChannel = (ch: "sms" | "email") => { setChannel(ch); setTo(ch === "sms" ? r?.phone ?? "" : r?.email ?? ""); };

  const hits = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    const jobs = allLeads.filter((l) => [l.contact.name, l.contact.phone, l.contact.email, jobTitle(l)].join(" ").toLowerCase().includes(t)).slice(0, 6);
    const linked = new Set(allLeads.map((l) => l.contactId));
    const people = allContacts.filter((c) => !linked.has(c.id) && [c.name, c.phone, c.email].join(" ").toLowerCase().includes(t)).slice(0, 4);
    return [...jobs.map((l) => ({ key: l.id, title: l.contact.name, sub: jobTitle(l), lead: l })), ...people.map((c) => ({ key: c.id, title: c.name, sub: "Contact", contact: c }))];
  }, [q, allLeads, allContacts]);

  const optedOut = r && (channel === "sms" ? !r.smsOk : !r.emailOk);
  const send = () => {
    const kind = key || "custom";
    if (channel === "sms") sendSms(to, body, kind, lead?.id);
    else sendEmail(to, `${BUSINESS.name}${key ? `: ${TEMPLATE_LABELS[key]}` : ""}`, body, kind, lead?.id);
    setSent(true);
  };

  return (
    <div className="grid max-w-2xl gap-4">
      <Field label="To">
        {name ? (
          <div className="flex items-center gap-3 rounded-xl border border-fg/12 bg-fg/[.04] px-4 py-2.5">
            <span className="min-w-0 flex-1"><span className="block truncate font-medium">{name}</span><span className="block truncate text-xs text-fg/45">{lead ? jobTitle(lead) : "Contact"}</span></span>
            <Button size="sm" variant="ghost" onClick={() => { setLead(undefined); setContact(undefined); setTo(""); }}>Change</Button>
          </div>
        ) : (
          <SearchInput value={q} onChange={setQ} placeholder="Search a customer or job" />
        )}
      </Field>
      {!name && hits.length > 0 && (
        <div className="-mt-2 divide-y divide-fg/5 overflow-hidden rounded-xl border border-fg/10">
          {hits.map((h) => (
            <button key={h.key} type="button" onClick={() => pick("lead" in h ? h.lead : undefined, "contact" in h ? h.contact : undefined)} className="block w-full px-4 py-2.5 text-left hover:bg-fg/[.05]">
              <span className="block text-sm">{h.title}</span><span className="block text-xs text-fg/45">{h.sub}</span>
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
        <div>
          <div className="mb-1.5 text-sm font-medium text-fg/80">Send by</div>
          <Segmented value={channel} onChange={switchChannel} options={[{ value: "sms", label: "Text" }, { value: "email", label: "Email" }]} />
        </div>
        <Field label={channel === "sms" ? "Mobile number" : "Email address"}>
          <Input value={to} onChange={(e) => setTo(e.target.value)} type={channel === "sms" ? "tel" : "email"} />
        </Field>
      </div>
      {optedOut && <p className="-mt-2 text-xs text-warn">This customer opted out of {channel === "sms" ? "texts" : "email"}.</p>}

      <Field label="Template">
        <Select value={key} onChange={(e) => applyTemplate(e.target.value as TemplateKey | "")}>
          <option value="">Write my own</option>
          {(Object.keys(TEMPLATE_LABELS) as TemplateKey[]).map((k) => <option key={k} value={k}>{TEMPLATE_LABELS[k]}</option>)}
        </Select>
      </Field>
      <Field label="Message" hint={`${body.length} chars${channel === "sms" && body.length > 160 ? ` · ${Math.ceil(body.length / 153)} texts` : ""}`}>
        <Textarea value={body} onChange={(e) => { setBody(e.target.value); setSent(false); }} placeholder="Type a message…" className="!min-h-[140px]" />
      </Field>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {sent && <span className="inline-flex items-center gap-1 text-sm text-success"><Check size={15} /> Logged. Finish sending in your {channel === "sms" ? "Messages" : "Mail"} app.</span>}
        <Button onClick={send} disabled={!to.trim() || !body.trim()}>{channel === "sms" ? <MessageSquare size={16} /> : <Mail size={16} />} Send {channel === "sms" ? "text" : "email"}</Button>
      </div>
    </div>
  );
}
