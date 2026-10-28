import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  BellRing, Check, CheckCircle2, Copy, CopyPlus, ExternalLink, FileText, Layers, Pencil, Plus, Send, ThumbsDown, Trash2, Undo2,
} from "lucide-react";
import { Menu } from "../../admin/jobs/Menu";
import { SendSheet, copyText } from "../../admin/jobs/SendSheet";
import {
  STATUS_META, addonPrice, duplicateProposal, followupDue, liveStatus, markProposalSent, optionPrice, priceRange, proposalLink,
  proposalMessage, selectionTotal, sendFollowup, unapprove,
} from "../../admin/proposals/logic";
import { ApproveSheet, EditProposalSheet, NewProposalSheet, SaveTemplateSheet } from "../../admin/proposals/ProposalSheets";
import { relative, money } from "../../lib/format";
import { proposals } from "../../lib/store";
import type { Lead, Proposal } from "../../lib/types";
import { Badge, Button, Card, CardHeader, cx } from "../ui";

type Open =
  | { kind: "new" } | { kind: "edit"; id: string } | { kind: "send"; id: string } | { kind: "approve"; id: string } | { kind: "template"; id: string };

export function ProposalCard({ lead }: { lead: Lead }) {
  const list = proposals.use().filter((p) => p.leadId === lead.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const [open, setOpen] = useState<Open | null>(null);
  const byId = (id: string) => list.find((p) => p.id === id);
  const current = open && open.kind !== "new" ? byId(open.id) : undefined;

  return (
    <Card>
      <CardHeader title="Proposal" icon={<FileText size={16} />}
        sub={list.length > 1 ? `${list.length} proposals` : undefined}
        actions={list.length > 0 && <Button size="sm" variant="ghost" onClick={() => setOpen({ kind: "new" })}><Plus size={14} /> New</Button>} />

      {!list.length ? (
        <div className="rounded-xl border border-dashed border-fg/15 px-4 py-5 text-center">
          <p className="text-sm text-fg/55">Send options the customer can pick and approve from their phone.</p>
          <Button size="sm" className="mt-3" onClick={() => setOpen({ kind: "new" })}><Plus size={14} /> Create proposal</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((p) => <ProposalRow key={p.id} p={p} lead={lead} onOpen={(kind) => setOpen({ kind, id: p.id })} />)}
        </div>
      )}

      <AnimatePresence>
        {open?.kind === "new" && <NewProposalSheet lead={lead} onClose={() => setOpen(null)} onCreated={(p) => setOpen({ kind: "edit", id: p.id })} />}
        {open?.kind === "edit" && current && <EditProposalSheet proposal={current} lead={lead} onClose={() => setOpen(null)} />}
        {open?.kind === "approve" && current && <ApproveSheet proposal={current} lead={lead} onClose={() => setOpen(null)} />}
        {open?.kind === "template" && current && <SaveTemplateSheet proposal={current} lead={lead} onClose={() => setOpen(null)} />}
        {open?.kind === "send" && current && (
          <SendSheet title={`Send proposal #${current.code}`} lead={lead} kind="proposalSend" subject={`Your Axis Glass Tinting proposal #${current.code}`}
            link={proposalLink(current)} body={proposalMessage(lead, current, proposalLink(current))}
            onSent={() => markProposalSent(current)} onClose={() => setOpen(null)} />
        )}
      </AnimatePresence>
    </Card>
  );
}

function ProposalRow({ p, lead, onOpen }: { p: Proposal; lead: Lead; onOpen: (k: "edit" | "send" | "approve" | "template") => void }) {
  const [copied, setCopied] = useState(false);
  const status = liveStatus(p);
  const meta = STATUS_META[status];
  const approved = status === "approved";
  const due = followupDue(p);
  const chosen = p.options.filter((o) => p.chosenOptionIds?.includes(o.id));
  const chosenAddons = p.addons.filter((a) => p.chosenAddonIds?.includes(a.id));
  const empty = !p.options.length;

  const times = [
    p.sentAt ? `sent ${relative(p.sentAt)}` : "never sent",
    p.viewedAt && `viewed ${relative(p.viewedAt)}`,
    status === "expired" && `expired ${p.expiresAt}`,
  ].filter(Boolean).join(" · ");

  return (
    <div className={cx("rounded-xl border p-3", approved ? "border-success/40 bg-success/[.04]" : "border-fg/10")}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display font-semibold">#{p.code}</span>
            <Badge tone={meta.tone}>{meta.label}</Badge>
          </div>
          <div className="mt-0.5 text-xs text-fg/45">{p.options.length} option{p.options.length === 1 ? "" : "s"} · {times}</div>
        </div>
        <div className="text-right font-display tabular-nums">{approved ? money(selectionTotal(p, p.chosenOptionIds ?? [], p.chosenAddonIds)) : priceRange(p.options)}</div>
        <Menu label="Proposal actions" items={[
          { label: "Edit", icon: <Pencil size={15} />, onSelect: () => onOpen("edit") },
          { label: "Preview as customer", icon: <ExternalLink size={15} />, onSelect: () => window.open(proposalLink(p).replace("#", "?preview=1#"), "_blank") },
          { label: copied ? "Copied" : "Copy link", icon: <Copy size={15} />, onSelect: async () => { await copyText(proposalLink(p)); markProposalSent(p); setCopied(true); } },
          !approved && { label: "Mark approved", icon: <CheckCircle2 size={15} />, onSelect: () => onOpen("approve"), divide: true, disabled: empty },
          !approved && status !== "declined" && { label: "Mark declined", icon: <ThumbsDown size={15} />, onSelect: () => proposals.update(p.id, { status: "declined" }) },
          approved && { label: "Undo approval", icon: <Undo2 size={15} />, onSelect: () => confirm("Undo this approval? The customer's choices and notes are cleared.") && unapprove(p), divide: true },
          { label: "Duplicate / revise", icon: <CopyPlus size={15} />, onSelect: () => proposals.save(duplicateProposal(p)), divide: true },
          { label: "Save as canned proposal", icon: <Layers size={15} />, onSelect: () => onOpen("template"), disabled: empty },
          { label: "Delete", icon: <Trash2 size={15} />, danger: true, divide: true, onSelect: () => confirm(`Delete proposal #${p.code}?`) && proposals.remove(p.id) },
        ]} />
      </div>

      {approved && (
        <div className="mt-2 space-y-1 text-sm">
          <div className="flex items-center gap-1.5 text-success"><Check size={14} /> Approved {p.approvedAt && relative(p.approvedAt)}{p.approvedName && ` by ${p.approvedName}`}</div>
          {chosen.map((o) => <div key={o.id} className="flex justify-between gap-2 text-fg/80"><span className="truncate">{o.title || "Option"}</span><span className="tabular-nums">{money(optionPrice(o))}</span></div>)}
          {chosenAddons.map((a) => <div key={a.id} className="flex justify-between gap-2 text-fg/60"><span className="truncate">+ {a.name}</span><span className="tabular-nums">{money(addonPrice(a))}</span></div>)}
        </div>
      )}
      {p.customerNotes && (
        <div className="mt-2 rounded-lg border-l-2 border-accent bg-accent/[.06] px-3 py-2 text-sm text-fg/85">
          <div className="text-[11px] uppercase tracking-wider text-fg/45">Customer notes</div>
          {p.customerNotes}
        </div>
      )}
      {due && (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-warn/10 px-3 py-2 text-xs text-warn">
          <BellRing size={13} className="shrink-0" />
          <span className="flex-1">{due === "proposalFollow24" ? "Not opened after a day." : "Opened 2+ days ago, no answer yet."}</span>
          <button type="button" onClick={() => sendFollowup(p, lead)} className="font-semibold underline">Send follow-up</button>
        </div>
      )}

      {!approved && (
        <div className="mt-3 flex flex-wrap gap-2">
          {empty ? (
            <Button size="sm" onClick={() => onOpen("edit")}><Plus size={14} /> Add options</Button>
          ) : (
            <>
              <Button size="sm" variant={p.sentAt ? "outline" : "primary"} onClick={() => onOpen("send")}><Send size={14} /> {p.sentAt ? "Resend" : "Send"}</Button>
              <Button size="sm" variant="outline" onClick={() => onOpen("edit")}><Pencil size={14} /> Edit</Button>
              <Button size="sm" variant="ghost" onClick={() => onOpen("approve")}><CheckCircle2 size={14} /> Approved by phone</Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

