import { Link } from "react-router-dom";
import { ChevronRight, Layers, MessageSquare } from "lucide-react";
import { Card, Field, Input, Segmented, Textarea, Toggle } from "../../components/ui";
import { fill } from "../../lib/messages";
import { patchSettings, proposalTemplates, useSettings } from "../../lib/store";
import type { Settings } from "../../data/config";

type P = Settings["proposals"];

export function ProposalSettings() {
  const { proposals: p } = useSettings();
  const templates = proposalTemplates.use();
  const set = (patch: Partial<P>) => patchSettings((s) => ({ proposals: { ...s.proposals, ...patch } }));
  const setDepositOptions = (raw: string) => {
    const list = [...new Set(raw.split(/[,\s]+/).map(Number).filter((n) => Number.isFinite(n) && n >= 0 && n <= 100))].sort((a, b) => a - b);
    if (list.length) set({ depositOptions: list, depositPct: list.includes(p.depositPct) ? p.depositPct : list[0] });
  };

  return (
    <div className="max-w-2xl space-y-8">
      <p className="text-sm text-fg/50">Defaults for new proposals. Each proposal (and canned proposal) can override the deposit and expiry.</p>

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Proposals expire after" hint="days">
          <Input type="number" min={1} max={365} value={p.expiryDays} onChange={(e) => set({ expiryDays: Math.max(1, Math.min(365, Number(e.target.value) || 1)) })} />
        </Field>
        <Field label="Deposit choices" hint="% · comma separated">
          <Input key={p.depositOptions.join()} defaultValue={p.depositOptions.join(", ")} onBlur={(e) => setDepositOptions(e.target.value)} placeholder="0, 25, 50, 100" />
        </Field>
        <div className="sm:col-span-2">
          <div className="mb-1.5 text-sm font-medium text-fg/80">Default deposit</div>
          <Segmented value={p.depositPct} onChange={(depositPct) => set({ depositPct })} options={p.depositOptions.map((d) => ({ value: d, label: d ? `${d}%` : "None" }))} />
          <p className="mt-1.5 text-xs text-fg/40">Taken from the approved total. The pay button appears once a payment link is set under Invoices & tax.</p>
        </div>
      </section>

      <section className="divide-y divide-fg/5">
        <Toggle checked={p.requireName} onChange={(requireName) => set({ requireName })} label="Ask for the customer's full name on approval" hint="Saved with the approval. Not a legal signature; use Documents for that." />
        <Toggle checked={p.followups} onChange={(followups) => set({ followups })} label="Follow-up reminders" hint="Not opened 24 hours after sending, or opened but not approved after 48 hours." />
      </section>

      <section className="space-y-4">
        <Field label="Approval message" hint=":approved_at = date and time of approval">
          <Textarea value={p.approvalMessage} onChange={(e) => set({ approvalMessage: e.target.value })} rows={3} />
        </Field>
        <div className="rounded-xl bg-success/10 px-4 py-3 text-sm text-fg/75">
          <div className="mb-0.5 text-[11px] uppercase tracking-wider text-success">Customer sees</div>
          {fill(p.approvalMessage, { name: "Jane Doe", approvedAt: new Date().toISOString() })}
        </div>
        <Field label="Fine print" hint="Bottom of every proposal">
          <Textarea value={p.finePrint} onChange={(e) => set({ finePrint: e.target.value })} rows={3} />
        </Field>
      </section>

      <Card className="!p-0">
        <Link to="/admin/proposals?view=templates" className="flex items-center gap-3 px-4 py-3.5 hover:bg-fg/[.03]">
          <Layers size={18} className="text-fg/45" />
          <span className="flex-1"><span className="block text-sm font-medium">Canned proposals</span><span className="text-xs text-fg/45">{templates.length} saved · reusable options for one-tap quotes</span></span>
          <ChevronRight size={16} className="text-fg/30" />
        </Link>
        <Link to="/admin/settings/messages" className="flex items-center gap-3 border-t border-fg/5 px-4 py-3.5 hover:bg-fg/[.03]">
          <MessageSquare size={18} className="text-fg/45" />
          <span className="flex-1"><span className="block text-sm font-medium">Proposal texts</span><span className="text-xs text-fg/45">Send and follow-up message templates</span></span>
          <ChevronRight size={16} className="text-fg/30" />
        </Link>
      </Card>
    </div>
  );
}
