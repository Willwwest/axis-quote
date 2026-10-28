import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Check, Copy, CopyPlus, RotateCcw, Settings2, Trash2, XCircle } from "lucide-react";
import { Button, Card, CardHeader, Chip, Field, KeyValue, Sheet, Textarea } from "../../components/ui";
import { setStatus } from "../../lib/project";
import { leads, newId, proposals, signedDocs } from "../../lib/store";
import type { Lead } from "../../lib/types";
import { copyText } from "./SendSheet";

const REASONS = ["Price", "Went with another shop", "No response", "Timing / not ready", "Just shopping", "Outside service area"];

export function LostSheet({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const [reason, setReason] = useState(REASONS.includes(lead.lostReason ?? "") ? lead.lostReason! : "");
  const [note, setNote] = useState(REASONS.includes(lead.lostReason ?? "") ? "" : lead.lostReason ?? "");
  const save = () => {
    const text = [reason, note.trim()].filter(Boolean).join(": ");
    leads.update(lead.id, { lostReason: text || undefined });
    setStatus(leads.get(lead.id)!, "lost");
    onClose();
  };
  return (
    <Sheet title="Mark as lost" onClose={onClose}>
      <p className="mb-3 text-sm text-fg/55">Why didn't it close? Shows up in analytics so you can spot patterns.</p>
      <div className="flex flex-wrap gap-2">
        {REASONS.map((r) => <Chip key={r} size="sm" selected={reason === r} onClick={() => setReason(reason === r ? "" : r)}>{r}</Chip>)}
      </div>
      <Field label="Details" hint="Optional" className="mt-4"><Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="e.g. Quoted $180 by a shop in Prescott Valley" /></Field>
      <Button className="mt-5 w-full" onClick={save}><XCircle size={16} /> Mark lost</Button>
    </Sheet>
  );
}

/** Copies the job's details (not its history) into a fresh job: repeat customers, phased work. */
function duplicateJob(lead: Lead): Lead {
  const copy: Lead = {
    ...structuredClone(lead),
    id: newId("AX"),
    createdAt: new Date().toISOString(),
    status: "new",
    statusChangedAt: undefined,
    appointment: null,
    completion: undefined,
    attachments: undefined,
    price: undefined,
    lostReason: undefined,
    source: "Duplicated job",
    rooms: lead.rooms?.map((r) => ({ ...structuredClone(r), id: newId("R"), items: r.items.map((m) => ({ ...m, id: newId("M") })) })),
    services: lead.services?.map((s) => ({ ...s, id: newId("S") })),
  };
  leads.save(copy);
  return copy;
}

export function OptionsCard({ lead }: { lead: Lead }) {
  const nav = useNavigate();
  const [lost, setLost] = useState(false);
  const [copied, setCopied] = useState(false);
  const remove = () => {
    if (!confirm(`Delete ${lead.contact.name}'s job ${lead.id}? Its proposals and documents go too. This can't be undone.`)) return;
    proposals.all().filter((p) => p.leadId === lead.id).forEach((p) => proposals.remove(p.id));
    signedDocs.all().filter((d) => d.leadId === lead.id).forEach((d) => signedDocs.remove(d.id));
    leads.remove(lead.id);
    nav("/admin/jobs");
  };
  return (
    <Card>
      <CardHeader title="Info & options" icon={<Settings2 size={16} />} />
      <dl className="-mt-1 divide-y divide-fg/5">
        <KeyValue k="Job #"><span className="font-mono text-xs">{lead.id}</span></KeyValue>
        <KeyValue k="Created">{new Date(lead.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</KeyValue>
        {lead.source && <KeyValue k="Source">{lead.source}</KeyValue>}
        {lead.referral && <KeyValue k="Referred by">{lead.referral}</KeyValue>}
        {lead.status === "lost" && lead.lostReason && <KeyValue k="Lost because">{lead.lostReason}</KeyValue>}
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => nav(`/admin/jobs/${duplicateJob(lead).id}`)}><CopyPlus size={14} /> Duplicate</Button>
        <Button size="sm" variant="outline" onClick={async () => { await copyText(window.location.href.split("#")[0]); setCopied(true); }}>{copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Staff link</>}</Button>
        {lead.status === "lost"
          ? <Button size="sm" variant="outline" onClick={() => { leads.update(lead.id, { lostReason: undefined }); setStatus(leads.get(lead.id)!, "new"); }}><RotateCcw size={14} /> Reopen</Button>
          : <Button size="sm" variant="outline" onClick={() => setLost(true)}><XCircle size={14} /> Mark lost</Button>}
        <Button size="sm" variant="danger" onClick={remove}><Trash2 size={14} /> Delete</Button>
      </div>
      <AnimatePresence>{lost && <LostSheet lead={lead} onClose={() => setLost(false)} />}</AnimatePresence>
    </Card>
  );
}
