import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft, Briefcase, Mail, MessageSquare, Phone, Plus, Save, StickyNote, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, Kpi, PageHeader, Toggle } from "../../components/ui";
import { digits, money, relative, shortDate } from "../../lib/format";
import { paidOnLead } from "../../lib/money";
import { templateLabel } from "../../lib/outbox";
import { WON_STATUSES, jobKindLabel, jobTitle, jobValueLabel, jobsFor, statusMeta } from "../../lib/project";
import { useSession } from "../../lib/session";
import { contacts, leads, messages, notes, payments } from "../../lib/store";
import type { Contact } from "../../lib/types";
import { NoteComposer, NoteItem, sortNotes } from "../tasks/notes";
import { ContactFields, NewJobSheet } from "./ContactForm";
import { displayName } from "./lib";

const PREFS: { key: keyof Contact["prefs"]; label: string; hint: string }[] = [
  { key: "sms", label: "Text messages", hint: "Confirmations, links and updates by SMS." },
  { key: "email", label: "Email", hint: "Proposals, invoices and receipts by email." },
  { key: "reminders", label: "Appointment reminders", hint: "24-hour and 1-hour reminders." },
  { key: "followups", label: "Proposal follow-ups", hint: "Nudges when a proposal sits unopened or unapproved, plus review requests." },
];

export default function ContactPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { can } = useSession();
  const contact = contacts.useOne(id);
  const allLeads = leads.use();
  const allNotes = notes.use();
  const allMsgs = messages.use();
  const pays = payments.use();
  const [draft, setDraft] = useState<Contact | null>(null);
  const [newJob, setNewJob] = useState(false);
  useEffect(() => setDraft(null), [id]);

  const jobs = useMemo(() => (contact ? jobsFor(contact, allLeads).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : []), [contact, allLeads]);
  const jobIds = useMemo(() => new Set(jobs.map((j) => j.id)), [jobs]);
  const list = useMemo(() => sortNotes(allNotes.filter((n) => (contact && n.contactId === contact.id) || (n.leadId && jobIds.has(n.leadId)))), [allNotes, contact, jobIds]);
  const history = useMemo(() => {
    const phone = digits(contact?.phone ?? "");
    return allMsgs.filter((m) => (m.leadId && jobIds.has(m.leadId)) || (!!phone && digits(m.to) === phone)).sort((a, b) => b.at.localeCompare(a.at));
  }, [allMsgs, jobIds, contact]);
  const value = useMemo(() => jobs.reduce((s, j) => s + paidOnLead(j.id, pays), 0), [jobs, pays]);

  if (!contact) {
    return <EmptyState icon={<Briefcase size={32} />} title="Contact not found" actions={<Button variant="outline" onClick={() => nav("/admin/contacts")}>All contacts</Button>}>It may have been merged or deleted.</EmptyState>;
  }
  const c = draft ?? contact;
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(contact);
  const set = (p: Partial<Contact>) => setDraft({ ...c, ...p });
  const save = () => { if (draft) contacts.save({ ...draft, name: draft.name.trim() || contact.name }); setDraft(null); };
  const remove = () => {
    if (!confirm(`Delete ${contact.name}? Their ${jobs.length} job${jobs.length === 1 ? "" : "s"} stay, with the customer details saved on each job.`)) return;
    contacts.remove(contact.id);
    nav("/admin/contacts");
  };
  const won = jobs.filter((j) => WON_STATUSES.includes(j.status)).length;

  return (
    <div>
      <Link to="/admin/contacts" className="mb-3 inline-flex items-center gap-1.5 text-sm text-fg/50 hover:text-fg"><ArrowLeft size={15} /> Contacts</Link>
      <PageHeader title={displayName(contact)} sub={[contact.city, contact.source && `Source: ${contact.source}`, `Since ${shortDate(contact.createdAt)}`].filter(Boolean).join(" · ")}
        actions={<>
          {contact.phone && <Button variant="outline" size="sm" onClick={() => (location.href = `tel:${digits(contact.phone)}`)}><Phone size={15} /> Call</Button>}
          {contact.phone && <Button variant="outline" size="sm" onClick={() => (location.href = `sms:${digits(contact.phone)}`)} title={contact.prefs.sms ? undefined : "Opted out of texts"}><MessageSquare size={15} /> Text</Button>}
          {contact.email && <Button variant="outline" size="sm" onClick={() => (location.href = `mailto:${contact.email}`)}><Mail size={15} /> Email</Button>}
          {can("jobs") && <Button size="sm" onClick={() => setNewJob(true)}><Plus size={15} /> New job</Button>}
        </>} />

      {contact.tags.length > 0 && <div className="-mt-3 mb-5 flex flex-wrap gap-1.5">{contact.tags.map((t) => <Link key={t} to={`/admin/contacts?tag=${encodeURIComponent(t)}`}><Badge tone="accent">{t}</Badge></Link>)}</div>}

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Kpi label="Jobs" value={String(jobs.length)} />
        <Kpi label="Won" value={String(won)} />
        <Kpi label="Lifetime paid" value={money(value)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Details" actions={dirty && <>
              <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>Discard</Button>
              <Button size="sm" onClick={save}><Save size={14} /> Save</Button>
            </>} />
            <ContactFields c={c} set={set} full />
            {dirty && <div className="mt-4 flex justify-end"><Button onClick={save}><Save size={16} /> Save changes</Button></div>}
          </Card>

          <Card>
            <CardHeader title="Communication" sub="What this customer has agreed to receive." />
            <div className="divide-y divide-fg/5">
              {PREFS.map((p) => (
                <Toggle key={p.key} checked={contact.prefs[p.key]} label={p.label} hint={p.hint}
                  onChange={(v) => contacts.update(contact.id, (x) => ({ prefs: { ...x.prefs, [p.key]: v } }))} />
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Message history" icon={<MessageSquare size={16} />} sub={history.length ? `${history.length} sent` : undefined} />
            {!history.length ? <p className="text-sm text-fg/45">Nothing sent yet.</p> : (
              <ul className="max-h-96 space-y-3 overflow-y-auto pr-1">
                {history.map((m) => (
                  <li key={m.id} className="rounded-xl bg-fg/[.03] px-3 py-2.5">
                    <div className="mb-1 flex items-center gap-2 text-xs text-fg/45">
                      <Badge tone={m.channel === "sms" ? "info" : "neutral"}>{m.channel === "sms" ? "Text" : "Email"}</Badge>
                      <span>{templateLabel(m.kind)}</span><span className="ml-auto">{relative(m.at)}</span>
                    </div>
                    <p className="text-sm text-fg/80">{m.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Jobs" icon={<Briefcase size={16} />} actions={can("jobs") && <Button size="sm" variant="ghost" onClick={() => setNewJob(true)}><Plus size={14} /> New</Button>} />
            {!jobs.length ? <p className="text-sm text-fg/45">No jobs yet.</p> : (
              <ul className="-mx-2 divide-y divide-fg/5">
                {jobs.map((j) => {
                  const st = statusMeta(j.status);
                  return (
                    <li key={j.id}>
                      <Link to={`/admin/jobs/${j.id}`} className="flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-fg/[.04]">
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{jobTitle(j)}</div>
                          <div className="text-xs text-fg/45">{jobKindLabel(j)} · {shortDate(j.createdAt)}</div>
                        </div>
                        <Badge tone={st.tone}>{st.short}</Badge>
                        <span className="w-20 text-right font-display text-sm tabular-nums">{jobValueLabel(j)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Notes" icon={<StickyNote size={16} />} sub="Contact notes plus notes on their jobs." />
            <NoteComposer contactId={contact.id} compact />
            {list.length > 0 && <div className="mt-3 space-y-2">{list.map((n) => <NoteItem key={n.id} note={n} />)}</div>}
          </Card>

          <Button variant="danger" onClick={remove} className="w-full"><Trash2 size={16} /> Delete contact</Button>
        </div>
      </div>

      <AnimatePresence>{newJob && <NewJobSheet onClose={() => setNewJob(false)} contact={contact} />}</AnimatePresence>
    </div>
  );
}
