import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { BellRing, ChevronRight, Copy, FileText, Layers, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { Badge, Button, Card, EmptyState, Kpi, PageHeader, SearchInput, Segmented, Tabs } from "../../components/ui";
import { digits, money, relative } from "../../lib/format";
import { jobTitle } from "../../lib/project";
import { leads as leadStore, newId, proposalTemplates, proposals as proposalStore, useSettings } from "../../lib/store";
import type { Lead, Proposal, ProposalStatus, ProposalTemplate } from "../../lib/types";
import { Menu } from "../jobs/Menu";
import { STATUS_META, followupDue, liveStatus, priceRange, proposalValue, sendFollowup, starterTemplates } from "./logic";
import { EditTemplateSheet } from "./ProposalSheets";

type Tab = "all" | "follow" | "draft" | "sent" | "viewed" | "approved" | "closed";
const inTab = (t: Tab, s: ProposalStatus, due: boolean) =>
  t === "all" || (t === "follow" ? due : t === "closed" ? s === "declined" || s === "expired" : s === t);

export default function ProposalsPage() {
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "templates" ? "templates" : "list";
  const setView = (v: string) => setParams(v === "templates" ? { view: v } : {}, { replace: true });
  const templates = proposalTemplates.use();
  const settings = useSettings();
  const [editing, setEditing] = useState<ProposalTemplate | null>(null);
  const blank = (): ProposalTemplate => ({ id: newId("PT"), name: "", options: [], addons: [], notes: "", depositPct: settings.proposals.depositPct, expiryDays: settings.proposals.expiryDays, selectTogether: false });

  return (
    <div>
      <PageHeader title="Proposals" sub="Options customers pick and approve from their phone."
        actions={view === "templates" && <Button onClick={() => setEditing(blank())}><Plus size={16} /> New canned proposal</Button>} />
      <div className="mb-5">
        <Segmented value={view} onChange={setView} options={[{ value: "list", label: "Sent proposals" }, { value: "templates", label: <span className="flex items-center gap-1.5">Canned <span className="rounded-full bg-fg/10 px-1.5 text-[11px] tabular-nums">{templates.length}</span></span> }]} />
      </div>
      {view === "list" ? <ProposalList /> : <Templates templates={templates} onEdit={setEditing} />}
      <AnimatePresence>{editing && <EditTemplateSheet key={editing.id} template={editing} onClose={() => setEditing(null)} />}</AnimatePresence>
    </div>
  );
}

function ProposalList() {
  const all = proposalStore.use();
  const jobs = leadStore.use();
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const leadOf = useMemo(() => new Map(jobs.map((l) => [l.id, l])), [jobs]);

  const rows = useMemo(() => all
    .map((p) => ({ p, lead: leadOf.get(p.leadId), status: liveStatus(p), due: !!followupDue(p), value: proposalValue(p) }))
    .sort((a, b) => (b.p.sentAt ?? b.p.createdAt).localeCompare(a.p.sentAt ?? a.p.createdAt)), [all, leadOf]);

  const kpi = useMemo(() => {
    const sent = rows.filter((r) => r.p.sentAt);
    const approved = rows.filter((r) => r.status === "approved");
    const open = rows.filter((r) => r.status === "sent" || r.status === "viewed");
    return {
      sent: sent.length,
      rate: sent.length ? Math.round((approved.filter((r) => r.p.sentAt).length / sent.length) * 100) : null,
      avg: sent.length ? sent.reduce((s, r) => s + r.value, 0) / sent.length : 0,
      open: open.reduce((s, r) => s + r.value, 0),
      openCount: open.length,
    };
  }, [rows]);

  const needle = q.trim().toLowerCase();
  const matches = (p: Proposal, lead?: Lead) => !needle || [p.code, lead?.contact.name, lead && jobTitle(lead), lead?.id].some((s) => s?.toLowerCase().includes(needle))
    || (!!digits(needle) && !!lead && digits(lead.contact.phone).includes(digits(needle)));
  const shown = rows.filter((r) => inTab(tab, r.status, r.due) && matches(r.p, r.lead));
  const count = (t: Tab) => rows.filter((r) => inTab(t, r.status, r.due)).length;

  if (!all.length) {
    return (
      <EmptyState icon={<FileText size={36} />} title="No proposals yet" actions={<Link to="/admin/jobs"><Button>Open a job</Button></Link>}>
        Create one from any job's Proposal card: Good / Better / Best from the instant quote, or a canned proposal.
      </EmptyState>
    );
  }

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Sent" value={String(kpi.sent)} />
        <Kpi label="Approval rate" value={kpi.rate == null ? "—" : `${kpi.rate}%`} tone={kpi.rate != null && kpi.rate >= 50 ? "success" : undefined} />
        <Kpi label="Average value" value={money(kpi.avg)} />
        <Kpi label={`Open · ${kpi.openCount} waiting`} value={money(kpi.open)} />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={([
        ["all", "All"], ["follow", "Needs follow-up"], ["draft", "Draft"], ["sent", "Sent"], ["viewed", "Viewed"], ["approved", "Approved"], ["closed", "Expired & declined"],
      ] as [Tab, string][]).map(([id, label]) => ({ id, label, count: count(id) }))} />
      <SearchInput value={q} onChange={setQ} placeholder="Search name, phone, proposal #" className="mb-4 max-w-sm" />

      {shown.length ? (
        <Card className="!p-0">
          <div className="divide-y divide-fg/5">
            {shown.map(({ p, lead, status, due, value }) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <Link to={lead ? `/admin/jobs/${lead.id}` : "#"} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                  <div className="min-w-0 flex-1 basis-48">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{lead?.contact.name ?? "Deleted job"}</span>
                      <span className="shrink-0 text-xs text-fg/40">#{p.code}</span>
                    </div>
                    <div className="truncate text-xs text-fg/45">
                      {lead ? jobTitle(lead) : ""} · {p.options.length} option{p.options.length === 1 ? "" : "s"} · {p.sentAt ? `sent ${relative(p.sentAt)}` : `created ${relative(p.createdAt)}`}
                      {p.viewedAt && ` · viewed ${relative(p.viewedAt)}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {due && <Badge tone="warn" icon={<BellRing size={11} />}>{p.viewedAt ? "No answer 48h" : "Not opened 24h"}</Badge>}
                    <Badge tone={STATUS_META[status].tone}>{STATUS_META[status].label}</Badge>
                    <span className="w-24 text-right font-display tabular-nums">{status === "approved" ? money(value) : priceRange(p.options)}</span>
                  </div>
                </Link>
                {due && lead ? (
                  <Button size="sm" variant="outline" onClick={() => sendFollowup(p, lead)}>Nudge</Button>
                ) : <ChevronRight size={16} className="hidden text-fg/30 sm:block" />}
              </div>
            ))}
          </div>
        </Card>
      ) : <p className="py-10 text-center text-sm text-fg/45">Nothing here.</p>}
    </>
  );
}

function Templates({ templates, onEdit }: { templates: ProposalTemplate[]; onEdit: (t: ProposalTemplate) => void }) {
  const sorted = [...templates].sort((a, b) => a.name.localeCompare(b.name));
  if (!sorted.length) {
    return (
      <EmptyState icon={<Layers size={36} />} title="No canned proposals yet"
        actions={<Button onClick={() => proposalTemplates.saveMany(starterTemplates())}><Sparkles size={16} /> Add starter templates</Button>}>
        Save Good / Better / Best sets per body style and send a proposal in seconds. Starters are priced from your price sheet. You can also save any proposal from a job.
      </EmptyState>
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {sorted.map((t) => (
        <Card key={t.id}>
          <div className="flex items-start gap-2">
            <button type="button" onClick={() => onEdit(t)} className="min-w-0 flex-1 text-left">
              <h3 className="truncate font-display font-semibold">{t.name}</h3>
              <p className="mt-0.5 text-sm text-fg/50">{t.options.length} option{t.options.length === 1 ? "" : "s"} · {priceRange(t.options)}</p>
            </button>
            <Menu label="Template actions" items={[
              { label: "Edit", icon: <Pencil size={15} />, onSelect: () => onEdit(t) },
              { label: "Duplicate", icon: <Copy size={15} />, onSelect: () => proposalTemplates.save({ ...structuredClone(t), id: newId("PT"), name: `${t.name} (copy)` }) },
              { label: "Delete", icon: <Trash2 size={15} />, danger: true, divide: true, onSelect: () => confirm(`Delete "${t.name}"?`) && proposalTemplates.remove(t.id) },
            ]} />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {t.options.map((o) => <Badge key={o.id} tone={o.recommended ? "accent" : "neutral"}>{o.title || "Option"}</Badge>)}
            {t.addons.length > 0 && <Badge tone="info">+{t.addons.length} add-on{t.addons.length > 1 ? "s" : ""}</Badge>}
            {t.selectTogether && <Badge>Pick several</Badge>}
          </div>
          <p className="mt-3 text-xs text-fg/40">{t.depositPct ? `${t.depositPct}% deposit` : "No deposit"} · expires after {t.expiryDays} days</p>
        </Card>
      ))}
    </div>
  );
}
