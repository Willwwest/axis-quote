import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Copy, FileSignature, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Segmented, Sheet, Tabs, Textarea, Toggle } from "../../components/ui";
import { relative } from "../../lib/format";
import { Markdown, MD_HINT, stripMarkdown } from "../../lib/markdown";
import { docTemplates, leads, newId, signedDocs } from "../../lib/store";
import type { DocTemplate } from "../../lib/types";
import { Menu } from "../jobs/Menu";
import { useIsDesktop } from "../jobs/jobUtils";
import { DOC_FIELDS, seedDocTemplates } from "./docs";
import { DocStatus, SignedDocSheet } from "./SignedDocSheet";

type Tab = "templates" | "sent";

export default function DocumentsPage() {
  const templates = docTemplates.use();
  const docs = signedDocs.use();
  const [tab, setTab] = useState<Tab>("templates");
  const [editing, setEditing] = useState<DocTemplate | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const open = docs.find((d) => d.id === viewing);

  // A new shop starts with the three documents tint shops use most.
  useEffect(() => { if (!docTemplates.all().length) seedDocTemplates(); }, []);

  const sorted = [...docs].sort((a, b) => (b.signedAt ?? b.sentAt).localeCompare(a.signedAt ?? a.sentAt));

  return (
    <div>
      <PageHeader title="Documents" sub="Waivers, agreements and care sheets customers sign on their phone."
        actions={<Button onClick={() => setEditing({ id: newId("DT"), title: "", body: "", requireName: true, showCustomer: true })}><Plus size={16} /> New document</Button>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: "templates", label: "Templates", count: templates.length }, { id: "sent", label: "Sent & signed", count: docs.length }]} />

      {tab === "templates" ? (
        templates.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {templates.map((t) => (
              <Card key={t.id} className="flex flex-col">
                <div className="flex items-start gap-2">
                  <button type="button" onClick={() => setEditing(t)} className="min-w-0 flex-1 text-left">
                    <h3 className="truncate font-display font-semibold">{t.title || "Untitled"}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-fg/50">{stripMarkdown(t.body).replace(new RegExp(`^${escapeRe(t.title)}\\s*`), "")}</p>
                  </button>
                  <Menu label="Document actions" items={[
                    { label: "Edit", icon: <Pencil size={15} />, onSelect: () => setEditing(t) },
                    { label: "Duplicate", icon: <Copy size={15} />, onSelect: () => docTemplates.save({ ...t, id: newId("DT"), title: `${t.title} (copy)` }) },
                    { label: "Delete", icon: <Trash2 size={15} />, danger: true, divide: true, onSelect: () => confirm(`Delete "${t.title}"? Documents already sent keep their copy.`) && docTemplates.remove(t.id) },
                  ]} />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {t.requireName && <Badge>Full name required</Badge>}
                  {t.showCustomer && <Badge>Shows customer details</Badge>}
                  <Badge tone="info">{docs.filter((d) => d.templateId === t.id && d.status === "signed").length} signed</Badge>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState icon={<FileSignature size={36} />} title="No documents yet" actions={<Button onClick={seedDocTemplates}>Add starter documents</Button>}>
            Start with a dark-tint waiver, aftercare sheet and residential agreement, then edit them to fit.
          </EmptyState>
        )
      ) : sorted.length ? (
        <Card className="!p-0">
          <div className="divide-y divide-fg/5">
            {sorted.map((d) => {
              const lead = leads.get(d.leadId);
              return (
                <button key={d.id} type="button" onClick={() => setViewing(d.id)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left hover:bg-fg/[.03]">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{d.title}</div>
                    <div className="truncate text-xs text-fg/45">{lead?.contact.name ?? "Deleted job"} · sent {relative(d.sentAt)}{d.signedAt && ` · signed ${relative(d.signedAt)}`}</div>
                  </div>
                  <DocStatus d={d} />
                </button>
              );
            })}
          </div>
        </Card>
      ) : (
        <EmptyState icon={<FileSignature size={36} />} title="Nothing sent yet" actions={<Link to="/admin/jobs"><Button variant="outline">Open jobs</Button></Link>}>Send a document from any job's Documents card.</EmptyState>
      )}

      <AnimatePresence>
        {editing && <TemplateEditor key={editing.id} template={editing} onClose={() => setEditing(null)} />}
        {open && <SignedDocSheet doc={open} onClose={() => setViewing(null)} showJob />}
      </AnimatePresence>
    </div>
  );
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function TemplateEditor({ template, onClose }: { template: DocTemplate; onClose: () => void }) {
  const [t, setT] = useState(template);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const wide = useIsDesktop("(min-width: 768px)");
  const set = (p: Partial<DocTemplate>) => setT((cur) => ({ ...cur, ...p }));
  const save = () => { docTemplates.save({ ...t, title: t.title.trim() || "Untitled document" }); onClose(); };
  const editor = (
    <div>
      <Textarea value={t.body} onChange={(e) => set({ body: e.target.value })} rows={18} className="font-mono text-sm" placeholder={"# Title\n\nParagraph text…\n\n- A bullet"} />
      <p className="mt-1 text-[11px] text-fg/35">{MD_HINT}</p>
    </div>
  );
  const preview = <div className="max-h-[440px] min-h-[200px] overflow-y-auto rounded-xl border border-fg/10 bg-fg/[.02] p-4">{t.body.trim() ? <Markdown text={t.body} /> : <span className="text-sm text-fg/30">Preview appears here</span>}</div>;

  return (
    <Sheet title={template.title ? "Edit document" : "New document"} onClose={onClose} wide>
      <Field label="Title"><Input autoFocus={!template.title} value={t.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Dark tint waiver" /></Field>
      <div className="mt-4">
        {wide ? (
          <div className="grid grid-cols-2 gap-4">{editor}<div><div className="mb-2 text-xs uppercase tracking-wider text-fg/40">Live preview</div>{preview}</div></div>
        ) : (
          <>
            <div className="mb-2"><Segmented size="sm" value={tab} onChange={setTab} options={[{ value: "write", label: "Write" }, { value: "preview", label: "Preview" }]} /></div>
            {tab === "write" ? editor : preview}
          </>
        )}
      </div>
      <p className="mt-2 text-xs text-fg/40">{DOC_FIELDS}</p>
      <div className="mt-4 divide-y divide-fg/5">
        <Toggle checked={t.requireName} onChange={(requireName) => set({ requireName })} label="Require full name" hint="Customer types first and last name before signing." />
        <Toggle checked={t.showCustomer} onChange={(showCustomer) => set({ showCustomer })} label="Show customer details" hint="Name, phone, email and address at the top." />
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={!t.body.trim()}>Save</Button>
      </div>
    </Sheet>
  );
}
