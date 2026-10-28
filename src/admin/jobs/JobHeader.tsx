import { useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, MessageSquare, Pencil, Phone, Plus, X } from "lucide-react";
import { Badge, Button, Dot, IconButton, Input, Select, cx } from "../../components/ui";
import { digits, relative } from "../../lib/format";
import { STATUSES, jobKindLabel, jobTitle, jobValueLabel, setStatus, statusMeta } from "../../lib/project";
import { useSession } from "../../lib/session";
import { leads } from "../../lib/store";
import type { Lead, LeadStatus } from "../../lib/types";
import { LostSheet } from "./OptionsCard";
import { people } from "./jobUtils";

export function TagEditor({ tags, onChange, suggestions }: { tags: string[]; onChange: (t: string[]) => void; suggestions: string[] }) {
  const [adding, setAdding] = useState(false);
  const [v, setV] = useState("");
  const add = () => {
    const t = v.trim().replace(/,$/, "");
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setV("");
  };
  const key = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
    if (e.key === "Escape") { setAdding(false); setV(""); }
    if (e.key === "Backspace" && !v && tags.length) onChange(tags.slice(0, -1));
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-full bg-fg/10 py-0.5 pl-2.5 pr-1 text-xs text-fg/75">
          {t}
          <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} className="rounded-full p-0.5 text-fg/40 hover:bg-fg/10 hover:text-fg" aria-label={`Remove ${t}`}><X size={11} /></button>
        </span>
      ))}
      {adding ? (
        <>
          <input autoFocus list="job-tags" value={v} onChange={(e) => setV(e.target.value)} onKeyDown={key} onBlur={() => { add(); setAdding(false); }}
            placeholder="Tag…" className="h-6 w-28 rounded-full border border-fg/20 bg-transparent px-2.5 text-xs text-fg outline-none focus:border-accent" />
          <datalist id="job-tags">{suggestions.filter((s) => !tags.includes(s)).map((s) => <option key={s} value={s} />)}</datalist>
        </>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-fg/20 px-2.5 py-0.5 text-xs text-fg/50 hover:border-fg/40 hover:text-fg"><Plus size={11} /> Tag</button>
      )}
    </div>
  );
}

export function JobHeader({ lead, showMoney }: { lead: Lead; showMoney: boolean }) {
  const { can } = useSession();
  const all = leads.use();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(lead.title ?? "");
  const [losing, setLosing] = useState(false);
  const meta = statusMeta(lead.status);
  const phone = digits(lead.contact.phone);
  const suggestions = [...new Set(all.flatMap((l) => l.tags ?? []))].sort();

  const saveTitle = () => { leads.update(lead.id, { title: title.trim() || undefined }); setEditing(false); };
  const changeStatus = (s: LeadStatus) => (s === "lost" ? setLosing(true) : setStatus(lead, s));

  return (
    <div className="mb-6">
      <Link to="/admin/jobs" className="mb-3 inline-flex items-center gap-1.5 text-sm text-fg/50 hover:text-fg"><ArrowLeft size={15} /> Jobs</Link>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2 font-display text-xs font-semibold uppercase tracking-[.2em] text-accent-fg">
            {jobKindLabel(lead)} <span className="font-mono font-normal tracking-normal text-fg/35">{lead.id}</span>
          </div>
          {editing ? (
            <div className="flex max-w-xl items-center gap-2">
              <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditing(false); }}
                placeholder={jobTitle({ ...lead, title: undefined })} className="!py-2 font-display text-xl font-semibold" />
              <IconButton label="Save title" onClick={saveTitle}><Check size={18} /></IconButton>
            </div>
          ) : (
            <button type="button" onClick={() => { setTitle(lead.title ?? ""); setEditing(true); }} className="group flex max-w-full items-center gap-2 text-left">
              <h1 className="font-display text-2xl font-semibold tracking-tight sm:truncate sm:text-3xl">{jobTitle(lead)}</h1>
              <Pencil size={15} className="shrink-0 text-fg/25 transition group-hover:text-fg/60" />
            </button>
          )}
          <p className="mt-1 text-sm text-fg/50">{lead.contact.name} · created {relative(lead.createdAt)}{lead.statusChangedAt && ` · ${meta.short.toLowerCase()} ${relative(lead.statusChangedAt)}`}</p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          {showMoney && <div className="mr-auto sm:mr-2 sm:text-right"><div className="text-xs text-fg/45">{lead.price != null ? "Agreed" : "Quote"}</div><div className="font-display text-2xl font-bold tabular-nums">{jobValueLabel(lead)}</div></div>}
          {phone && <a href={`tel:${phone}`}><Button variant="outline" size="md" className="!px-3.5" aria-label="Call"><Phone size={16} /><span className="hidden sm:inline">Call</span></Button></a>}
          {phone && <a href={`sms:${phone}`}><Button variant="outline" size="md" className="!px-3.5" aria-label="Text"><MessageSquare size={16} /><span className="hidden sm:inline">Text</span></Button></a>}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2"><Dot tone={meta.tone} /></span>
          <Select value={lead.status} onChange={(e) => changeStatus(e.target.value as LeadStatus)} className={cx("!w-auto !py-2 pl-8 pr-8 text-sm font-medium")} aria-label="Status">
            {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </Select>
        </div>
        {can("jobs.all") ? (
          <Select value={lead.assigneeId ?? ""} onChange={(e) => leads.update(lead.id, { assigneeId: e.target.value || undefined })} className="!w-auto !py-2 text-sm" aria-label="Assigned to">
            <option value="">Unassigned</option>
            {people().map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        ) : lead.assigneeId && <Badge>{people().find((p) => p.id === lead.assigneeId)?.name}</Badge>}
        <TagEditor tags={lead.tags ?? []} suggestions={suggestions} onChange={(tags) => leads.update(lead.id, { tags })} />
      </div>
      <AnimatePresence>{losing && <LostSheet lead={lead} onClose={() => setLosing(false)} />}</AnimatePresence>
    </div>
  );
}
