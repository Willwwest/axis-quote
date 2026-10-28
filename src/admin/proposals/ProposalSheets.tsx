import { useState } from "react";
import { Check, FilePlus2, Layers, Sparkles } from "lucide-react";
import { Badge, Button, Choice, Field, Input, Sheet, Textarea, cx } from "../../components/ui";
import { money } from "../../lib/format";
import { proposals, proposalTemplates, useSettings } from "../../lib/store";
import type { Lead, Proposal, ProposalTemplate } from "../../lib/types";
import { EditorSheet, ProposalEditor, draftSummary, type ProposalDraft } from "./ProposalEditor";
import {
  addonPrice, approveProposal, autoOptions, blankProposal, optionPrice, priceRange, proposalFromTemplate, selectionTotal,
  templateFromProposal, templatesSorted,
} from "./logic";

const pick = ({ options, addons, selectTogether, notes, depositPct }: ProposalDraft) => ({ options, addons, selectTogether, notes, depositPct });

const summaryText = (d: ProposalDraft) => {
  const s = draftSummary(d);
  if (!s.count) return "No options yet";
  return `${s.count} option${s.count > 1 ? "s" : ""} · ${s.lo === s.hi ? money(s.lo) : `${money(s.lo)} – ${money(s.hi)}`}${s.addons ? ` · ${money(s.addons)} add-ons` : ""}`;
};

export function EditProposalSheet({ proposal, lead, onClose }: { proposal: Proposal; lead: Lead; onClose: () => void }) {
  const [draft, setDraft] = useState<ProposalDraft>(() => pick(structuredClone(proposal)));
  const [expiresAt, setExpiresAt] = useState(proposal.expiresAt);
  const sent = proposal.status !== "draft";
  const save = () => {
    proposals.update(proposal.id, { ...pick(draft), expiresAt });
    onClose();
  };
  return (
    <EditorSheet title={`Proposal #${proposal.code}`} onClose={onClose} onSave={save} footer={summaryText(draft)}>
      {sent && <p className="mb-4 rounded-xl bg-info/10 px-4 py-3 text-sm text-info">Already sent. The customer's link holds a copy, so send it again after you change anything.</p>}
      <ProposalEditor draft={draft} onChange={setDraft} lead={lead} />
      <Field label="Valid through" className="mt-6 max-w-xs"><Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} /></Field>
    </EditorSheet>
  );
}

export function EditTemplateSheet({ template, onClose }: { template: ProposalTemplate; onClose: () => void }) {
  const [draft, setDraft] = useState<ProposalDraft>(() => ({ ...pick({ ...structuredClone(template), selectTogether: !!template.selectTogether }) }));
  const [name, setName] = useState(template.name);
  const [days, setDays] = useState(String(template.expiryDays));
  const save = () => {
    proposalTemplates.save({ ...template, ...pick(draft), name: name.trim() || "Untitled template", expiryDays: Math.max(1, Number(days) || 30) });
    onClose();
  };
  return (
    <EditorSheet title={template.name ? "Edit canned proposal" : "New canned proposal"} onClose={onClose} onSave={save} footer={summaryText(draft)}>
      <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_160px]">
        <Field label="Template name"><Input autoFocus={!template.name} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. SUV · Good / Better / Best" /></Field>
        <Field label="Expires after" hint="days"><Input type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} /></Field>
      </div>
      <ProposalEditor draft={draft} onChange={setDraft} />
      <p className="mt-4 text-xs text-fg/40">Canned proposals skip room scopes and customer details, so keep the text general.</p>
    </EditorSheet>
  );
}

/** Pick how to start: Good/Better/Best from the quote, a canned proposal, or blank. Returns the saved draft. */
export function NewProposalSheet({ lead, onCreated, onClose }: { lead: Lead; onCreated: (p: Proposal) => void; onClose: () => void }) {
  const settings = useSettings();
  const templates = proposalTemplates.use();
  const auto = autoOptions(lead, settings);
  const create = (p: Proposal) => { proposals.save(p); onCreated(p); };
  return (
    <Sheet title="New proposal" onClose={onClose}>
      <div className="space-y-2">
        <Choice selected={false} onClick={() => create({ ...blankProposal(lead, settings), options: auto })} className="w-full">
          <div className="flex items-start gap-3">
            <Sparkles size={20} className="mt-0.5 shrink-0 text-accent-fg" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{lead.kind === "vehicle" ? "Good · Better · Best" : "One option per film"}</div>
              <div className="text-xs text-fg/50">{lead.kind === "vehicle" ? "Carbon, ceramic, and ceramic + windshield, priced from your price sheet." : lead.rooms?.some((r) => r.items.length) ? "Priced from the measured rooms." : "Priced from the instant-quote window count. Add measurements for exact sq ft."}</div>
              {auto.length > 0 && <div className="mt-1 text-xs tabular-nums text-fg/70">{priceRange(auto)}</div>}
            </div>
          </div>
        </Choice>
        {templatesSorted().map((t) => (
          <Choice key={t.id} selected={false} onClick={() => create(proposalFromTemplate(lead, t))} className="w-full">
            <div className="flex items-start gap-3">
              <Layers size={20} className="mt-0.5 shrink-0 text-fg/45" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{t.name}</div>
                <div className="text-xs text-fg/50">{t.options.length} option{t.options.length === 1 ? "" : "s"} · {priceRange(t.options)}{t.addons.length ? ` · ${t.addons.length} add-on${t.addons.length > 1 ? "s" : ""}` : ""}</div>
              </div>
            </div>
          </Choice>
        ))}
        <Choice selected={false} onClick={() => create(blankProposal(lead, settings))} className="w-full">
          <div className="flex items-center gap-3"><FilePlus2 size={20} className="shrink-0 text-fg/45" /><div className="font-semibold">Blank proposal</div></div>
        </Choice>
      </div>
      {!templates.length && <p className="mt-4 text-xs text-fg/40">Tip: save any proposal as a canned proposal to reuse it in one tap.</p>}
    </Sheet>
  );
}

/** For approvals given on the phone or in person. */
export function ApproveSheet({ proposal, lead, onClose }: { proposal: Proposal; lead: Lead; onClose: () => void }) {
  const rec = proposal.options.find((o) => o.recommended) ?? proposal.options[0];
  const [opts, setOpts] = useState<string[]>(proposal.chosenOptionIds ?? (rec ? [rec.id] : []));
  const [adds, setAdds] = useState<string[]>(proposal.chosenAddonIds ?? []);
  const [name, setName] = useState(lead.contact.name);
  const [notes, setNotes] = useState(proposal.customerNotes ?? "");
  const total = selectionTotal(proposal, opts, adds);
  const toggle = (id: string) => setOpts((cur) => (proposal.selectTogether ? (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]) : [id]));
  return (
    <Sheet title="Mark approved" onClose={onClose}>
      <p className="mb-3 text-sm text-fg/55">Which option did {lead.contact.name.split(" ")[0] || "they"} pick?</p>
      <div className="space-y-2">
        {proposal.options.map((o) => (
          <Choice key={o.id} selected={opts.includes(o.id)} onClick={() => toggle(o.id)} className="flex w-full items-center gap-3 !py-3">
            <span className={cx("grid h-5 w-5 shrink-0 place-items-center rounded-full border", opts.includes(o.id) ? "border-accent bg-accent text-on-accent" : "border-fg/25")}>{opts.includes(o.id) && <Check size={12} strokeWidth={3} />}</span>
            <span className="min-w-0 flex-1 truncate font-medium">{o.title || "Untitled option"}</span>
            {o.recommended && <Badge tone="accent">Recommended</Badge>}
            <span className="font-display tabular-nums">{money(optionPrice(o))}</span>
          </Choice>
        ))}
      </div>
      {proposal.addons.length > 0 && (
        <div className="mt-4 space-y-1">
          <div className="text-sm font-medium text-fg/80">Add-ons</div>
          {proposal.addons.map((a) => (
            <label key={a.id} className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-fg/[.04]">
              <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--c-accent))]" checked={adds.includes(a.id)} onChange={() => setAdds((c) => (c.includes(a.id) ? c.filter((x) => x !== a.id) : [...c, a.id]))} />
              <span className="flex-1 text-sm">{a.name}</span>
              <span className="text-sm tabular-nums text-fg/70">{money(addonPrice(a))}</span>
            </label>
          ))}
        </div>
      )}
      <div className="mt-4 grid gap-3">
        <Field label="Approved by"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Notes" hint="Preferred date, special requests"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></Field>
      </div>
      <div className="mt-5 flex items-center justify-between gap-3">
        <div><div className="text-xs text-fg/45">Agreed price</div><div className="font-display text-2xl font-semibold tabular-nums">{money(total)}</div></div>
        <Button disabled={!opts.length} onClick={() => { approveProposal(proposal, { optionIds: opts, addonIds: adds, name, notes }, "crew"); onClose(); }}><Check size={16} /> Approve</Button>
      </div>
    </Sheet>
  );
}

export function SaveTemplateSheet({ proposal, lead, onClose }: { proposal: Proposal; lead: Lead; onClose: () => void }) {
  const [name, setName] = useState(lead.vehicle ? `${lead.vehicle.ymm || "Vehicle"} options` : `${lead.kind === "business" ? "Commercial" : "Residential"} options`);
  const [saved, setSaved] = useState(false);
  return (
    <Sheet title="Save as canned proposal" onClose={onClose}>
      {saved ? (
        <div className="py-4 text-center">
          <Check className="mx-auto text-success" size={32} />
          <p className="mt-2 font-display text-lg">Saved "{name}"</p>
          <p className="text-sm text-fg/50">It's now one tap away on any job's New proposal menu.</p>
          <Button className="mt-5" onClick={onClose}>Done</Button>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-fg/55">Saves the options, add-ons, notes and deposit. Room scopes are left out.</p>
          <Field label="Name"><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Button className="mt-5 w-full" disabled={!name.trim()} onClick={() => { proposalTemplates.save(templateFromProposal(proposal, name.trim())); setSaved(true); }}>Save template</Button>
        </>
      )}
    </Sheet>
  );
}
