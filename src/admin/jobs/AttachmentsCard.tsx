import { useState, type DragEvent } from "react";
import { AnimatePresence } from "framer-motion";
import { Download, FileText, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { Button, Card, CardHeader, Chip, Field, Input, Select, Sheet, cx } from "../../components/ui";
import { relative } from "../../lib/format";
import { leads, newId } from "../../lib/store";
import type { Attachment, Lead } from "../../lib/types";
import { fileToDataUrl } from "./jobUtils";

export const ATTACH_TAGS = ["Before", "After", "Damage", "Measurements", "Paperwork", "Other"];
export const isImage = (a: Attachment) => a.dataUrl.startsWith("data:image/");

/** Adds files to a job, compressing photos. Returns false when local storage is full. */
export async function addAttachments(leadId: string, files: FileList | File[], tag?: string) {
  const list = [...files];
  const added: Attachment[] = await Promise.all(list.map(async (f) => ({ id: newId("F"), name: f.name || "Photo", dataUrl: await fileToDataUrl(f), tag, at: new Date().toISOString() })));
  try {
    leads.update(leadId, (l) => ({ attachments: [...(l.attachments ?? []), ...added] }));
    return true;
  } catch {
    alert("This device's storage is full. Remove a few photos or files and try again.");
    return false;
  }
}

export const removeAttachment = (leadId: string, id: string) => leads.update(leadId, (l) => ({ attachments: (l.attachments ?? []).filter((a) => a.id !== id) }));

export function Thumb({ a, onClick, className }: { a: Attachment; onClick?: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={cx("group relative aspect-square overflow-hidden rounded-xl border border-fg/10 bg-fg/[.04] text-left", className)}>
      {isImage(a) ? <img src={a.dataUrl} alt={a.name} className="h-full w-full object-cover transition group-hover:scale-105" />
        : <span className="grid h-full place-items-center p-2 text-center text-[11px] text-fg/55"><span><FileText className="mx-auto mb-1 text-fg/40" size={22} /><span className="line-clamp-2 break-all">{a.name}</span></span></span>}
      {a.tag && <span className="absolute bottom-1 left-1 rounded-full bg-scrim/70 px-1.5 py-0.5 text-[10px] font-medium text-on-accent">{a.tag}</span>}
    </button>
  );
}

export function AttachmentsCard({ lead }: { lead: Lead }) {
  const files = lead.attachments ?? [];
  const [filter, setFilter] = useState("");
  const [tag, setTag] = useState("");
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const shown = filter ? files.filter((a) => a.tag === filter) : files;
  const used = ATTACH_TAGS.filter((t) => files.some((a) => a.tag === t));
  const current = files.find((a) => a.id === open);

  const upload = async (list: FileList | File[] | null) => {
    if (!list || !list.length) return;
    setBusy(true);
    await addAttachments(lead.id, list, tag || undefined);
    setBusy(false);
  };
  const drop = (e: DragEvent) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files); };

  return (
    <Card>
      <div onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop}>
        <CardHeader title="Photos & files" icon={<Paperclip size={16} />} sub={files.length ? `${files.length} file${files.length > 1 ? "s" : ""}` : undefined}
          actions={
            <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-xs font-display font-semibold text-fg/70 transition hover:bg-fg/[.05] hover:text-fg">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Upload
              <input type="file" multiple accept="image/*,application/pdf,.doc,.docx,.txt" className="hidden" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
            </label>
          } />
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs text-fg/45">Tag uploads as</span>
          <Select value={tag} onChange={(e) => setTag(e.target.value)} className="!w-auto !px-3 !py-1.5 text-xs" aria-label="Tag for new uploads">
            <option value="">No tag</option>
            {ATTACH_TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </div>
        {used.length > 1 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            <Chip size="sm" selected={!filter} onClick={() => setFilter("")}>All</Chip>
            {used.map((t) => <Chip key={t} size="sm" selected={filter === t} onClick={() => setFilter(filter === t ? "" : t)}>{t}</Chip>)}
          </div>
        )}
        {shown.length ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{shown.map((a) => <Thumb key={a.id} a={a} onClick={() => setOpen(a.id)} />)}</div>
        ) : (
          <label className={cx("block cursor-pointer rounded-xl border border-dashed px-4 py-6 text-center text-sm transition", over ? "border-accent bg-accent/10 text-fg" : "border-fg/15 text-fg/45 hover:border-fg/30")}>
            Tap or drop photos and files here
            <input type="file" multiple accept="image/*,application/pdf,.doc,.docx,.txt" className="hidden" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
          </label>
        )}
      </div>
      <AnimatePresence>{current && <AttachmentSheet lead={lead} a={current} onClose={() => setOpen(null)} />}</AnimatePresence>
    </Card>
  );
}

function AttachmentSheet({ lead, a, onClose }: { lead: Lead; a: Attachment; onClose: () => void }) {
  const set = (p: Partial<Attachment>) => leads.update(lead.id, (l) => ({ attachments: (l.attachments ?? []).map((x) => (x.id === a.id ? { ...x, ...p } : x)) }));
  return (
    <Sheet title={a.name} onClose={onClose} wide={isImage(a)}>
      {isImage(a) ? <img src={a.dataUrl} alt={a.name} className="max-h-[60vh] w-full rounded-xl object-contain" />
        : <div className="grid place-items-center rounded-xl bg-fg/[.04] py-10"><FileText size={40} className="text-fg/35" /></div>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Name"><Input value={a.name} onChange={(e) => set({ name: e.target.value })} className="!py-2.5" /></Field>
        <Field label="Tag">
          <Select value={a.tag ?? ""} onChange={(e) => set({ tag: e.target.value || undefined })} className="!py-2.5">
            <option value="">No tag</option>
            {ATTACH_TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <span className="flex-1 text-xs text-fg/40">Added {relative(a.at)}</span>
        <a href={a.dataUrl} download={a.name}><Button variant="outline" size="sm"><Download size={14} /> Download</Button></a>
        <Button variant="danger" size="sm" onClick={() => { if (confirm(`Remove ${a.name}?`)) { removeAttachment(lead.id, a.id); onClose(); } }}><Trash2 size={14} /> Remove</Button>
      </div>
    </Sheet>
  );
}
