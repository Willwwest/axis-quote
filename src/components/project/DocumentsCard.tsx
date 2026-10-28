import { useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ChevronRight, FileSignature, Plus, Send } from "lucide-react";
import { DOC_FIELDS, seedDocTemplates } from "../../admin/documents/docs";
import { DocStatus, SignedDocSheet, docLink } from "../../admin/documents/SignedDocSheet";
import { SendSheet } from "../../admin/jobs/SendSheet";
import { relative } from "../../lib/format";
import { Markdown, MD_HINT } from "../../lib/markdown";
import { fill, leadContext, template } from "../../lib/messages";
import { docTemplates, newId, signedDocs } from "../../lib/store";
import type { DocTemplate, Lead, SignedDoc } from "../../lib/types";
import { Button, Card, CardHeader, Choice, Field, Input, Segmented, Sheet, Textarea } from "../ui";

export function DocumentsCard({ lead }: { lead: Lead }) {
  const docs = signedDocs.use().filter((d) => d.leadId === lead.id).sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  const [picking, setPicking] = useState(false);
  const [pending, setPending] = useState<SignedDoc | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const open = docs.find((d) => d.id === viewing);

  return (
    <Card>
      <CardHeader title="Documents" icon={<FileSignature size={16} />} actions={<Button size="sm" variant="ghost" onClick={() => setPicking(true)}><Send size={14} /> Send</Button>} />
      {!docs.length ? (
        <p className="text-sm text-fg/45">Waivers, agreements and aftercare sheets the customer signs on their phone.</p>
      ) : (
        <div className="-mx-2 divide-y divide-fg/5">
          {docs.map((d) => (
            <button key={d.id} type="button" onClick={() => setViewing(d.id)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-fg/[.04]">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{d.title}</div>
                <div className="text-xs text-fg/45">{d.status === "signed" && d.signedAt ? `Signed by ${d.signedName || "customer"} ${relative(d.signedAt)}` : `Sent ${relative(d.sentAt)}`}</div>
              </div>
              <DocStatus d={d} />
              <ChevronRight size={16} className="text-fg/30" />
            </button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {picking && <PickDocSheet lead={lead} onClose={() => setPicking(false)} onNext={(d) => { setPicking(false); setPending(d); }} />}
        {pending && (
          <SendSheet title={`Send "${pending.title}"`} lead={lead} kind="docSign" subject={`${pending.title}: please review and sign`}
            link={docLink(pending)} body={fill(template("docSign"), leadContext(lead, { link: docLink(pending) }))}
            onSent={() => { if (!signedDocs.get(pending.id)) signedDocs.save({ ...pending, sentAt: new Date().toISOString() }); }}
            onClose={() => setPending(null)} />
        )}
        {open && <SignedDocSheet doc={open} onClose={() => setViewing(null)} />}
      </AnimatePresence>
    </Card>
  );
}

/** Pick a template, then tweak the wording for this customer only. The edited copy is what gets signed. */
function PickDocSheet({ lead, onClose, onNext }: { lead: Lead; onClose: () => void; onNext: (d: SignedDoc) => void }) {
  const templates = docTemplates.use();
  const [tpl, setTpl] = useState<DocTemplate | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tab, setTab] = useState<"edit" | "preview">("preview");
  const choose = (t: DocTemplate) => { setTpl(t); setTitle(t.title); setBody(fill(t.body, leadContext(lead))); };

  return (
    <Sheet title={tpl ? "Review before sending" : "Send a document"} onClose={onClose} wide={!!tpl}>
      {!tpl ? (
        templates.length ? (
          <div className="space-y-2">
            {templates.map((t) => (
              <Choice key={t.id} selected={false} onClick={() => choose(t)} className="flex w-full items-center gap-3 !py-3">
                <FileSignature size={18} className="shrink-0 text-fg/45" />
                <span className="min-w-0 flex-1 truncate font-medium">{t.title}</span>
                {t.requireName && <span className="text-xs text-fg/40">Name required</span>}
              </Choice>
            ))}
            <Link to="/admin/documents" className="mt-2 flex items-center gap-1.5 text-sm text-fg/50 hover:text-fg"><Plus size={14} /> Create or edit templates</Link>
          </div>
        ) : (
          <div className="py-4 text-center">
            <p className="text-sm text-fg/55">No document templates yet.</p>
            <Button className="mt-4" onClick={seedDocTemplates}>Add starter waiver, aftercare & agreement</Button>
          </div>
        )
      ) : (
        <>
          <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <div className="mb-2 mt-4 flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-fg/80">Document</span>
            <Segmented size="sm" value={tab} onChange={setTab} options={[{ value: "preview", label: "Preview" }, { value: "edit", label: "Edit for this customer" }]} />
          </div>
          {tab === "edit" ? (
            <>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={14} className="font-mono text-sm" />
              <p className="mt-1 text-[11px] text-fg/35">{MD_HINT}</p>
            </>
          ) : (
            <div className="max-h-[45vh] overflow-y-auto rounded-xl border border-fg/10 p-4"><Markdown text={body} /></div>
          )}
          <p className="mt-2 text-xs text-fg/40">Changes apply to this send only. {DOC_FIELDS}</p>
          <div className="mt-5 flex justify-between gap-2">
            <Button variant="ghost" onClick={() => setTpl(null)}>Back</Button>
            <Button disabled={!title.trim() || !body.trim()} onClick={() => onNext({ id: newId("D"), templateId: tpl.id, leadId: lead.id, title: title.trim(), body, status: "sent", sentAt: new Date().toISOString() })}>
              <Send size={16} /> Next: send
            </Button>
          </div>
        </>
      )}
    </Sheet>
  );
}
