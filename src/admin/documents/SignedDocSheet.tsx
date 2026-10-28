import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Copy, ExternalLink, Printer, Trash2 } from "lucide-react";
import { Badge, Button, Sheet } from "../../components/ui";
import { relative } from "../../lib/format";
import { publicUrl } from "../../lib/links";
import { leads, signedDocs } from "../../lib/store";
import type { SignedDoc } from "../../lib/types";
import { copyText } from "../jobs/SendSheet";
import { docSnap, docView } from "./docs";
import { DocBody, PrintOnly, printLight } from "./DocView";

export const docLink = (d: SignedDoc) => publicUrl("s", d.id, docSnap(d));

export const DocStatus = ({ d }: { d: SignedDoc }) =>
  d.status === "signed" ? <Badge tone="success">Signed</Badge> : <Badge tone="warn">Awaiting signature</Badge>;

/** One sent or signed document: read it, print or save it as PDF, copy the signing link. */
export function SignedDocSheet({ doc, onClose, showJob }: { doc: SignedDoc; onClose: () => void; showJob?: boolean }) {
  const [copied, setCopied] = useState(false);
  const view = docView(doc);
  const lead = leads.get(doc.leadId);
  return (
    <Sheet title={doc.title} onClose={onClose} wide>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-fg/50">
        <DocStatus d={doc} />
        <span>Sent {relative(doc.sentAt)}</span>
        {doc.signedAt && <span>· signed {relative(doc.signedAt)}</span>}
        {showJob && lead && <Link to={`/admin/jobs/${lead.id}`} className="text-accent-fg hover:underline">· {lead.contact.name}</Link>}
      </div>
      <div className="rounded-2xl border border-fg/10 p-4 sm:p-6"><DocBody view={view} /></div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button onClick={printLight}><Printer size={16} /> Print / save PDF</Button>
        {doc.status !== "signed" && (
          <>
            <Button variant="outline" onClick={async () => { await copyText(docLink(doc)); setCopied(true); }}>{copied ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy signing link</>}</Button>
            <a href={docLink(doc)} target="_blank" rel="noreferrer"><Button variant="ghost"><ExternalLink size={16} /> Open</Button></a>
          </>
        )}
        <div className="flex-1" />
        <Button variant="ghost" className="text-danger" onClick={() => { if (confirm(`Delete "${doc.title}"${doc.status === "signed" ? " and its signature" : ""}?`)) { signedDocs.remove(doc.id); onClose(); } }}><Trash2 size={16} /> Delete</Button>
      </div>
      <PrintOnly><DocBody view={view} /></PrintOnly>
    </Sheet>
  );
}
