import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Download, HelpCircle, Plus, Receipt } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, Kpi, PageHeader, SearchInput, Sheet, Table, Tabs, Td } from "../../components/ui";
import { downloadFile, money, shortDate, today } from "../../lib/format";
import {
  INVOICE_STATES, collectedBetween, createInvoiceFromLead, depositsHeld, invoiceBalance, invoiceForLead, invoiceState, invoiceTotals,
  leadName, receivables, type InvoiceState,
} from "../../lib/money";
import { jobTitle, jobValueLabel, statusMeta } from "../../lib/project";
import { contacts, invoices, leads, payments } from "../../lib/store";
import { exportable, paymentsCsv, quickbooksInvoicesCsv } from "./quickbooks";

type Tab = "all" | "draft" | "sent" | "partial" | "paid" | "pastdue" | "void";

const TABS: { id: Tab; label: string; match: (s: InvoiceState) => boolean }[] = [
  { id: "all", label: "All", match: (s) => s !== "void" },
  { id: "draft", label: "Draft", match: (s) => s === "draft" },
  { id: "sent", label: "Sent / Viewed", match: (s) => s === "sent" || s === "viewed" },
  { id: "partial", label: "Partial", match: (s) => s === "partial" },
  { id: "paid", label: "Paid", match: (s) => s === "paid" },
  { id: "pastdue", label: "Past due", match: (s) => s === "pastdue" },
  { id: "void", label: "Void", match: (s) => s === "void" },
];

export default function InvoicesPage() {
  const list = invoices.use();
  const pays = payments.use();
  const allLeads = leads.use();
  const people = contacts.use();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [help, setHelp] = useState(false);
  const [picking, setPicking] = useState(false);

  const rows = useMemo(() => list.map((inv) => {
    const lead = allLeads.find((l) => l.id === inv.leadId);
    const balance = invoiceBalance(inv, pays);
    return { inv, customer: leadName(inv.leadId), job: lead ? jobTitle(lead) : "", total: invoiceTotals(inv).total, balance, state: invoiceState(inv, balance) };
  }).sort((a, b) => Number(b.inv.number) - Number(a.inv.number)), [list, pays, allLeads, people]);

  const needle = q.trim().toLowerCase();
  const shown = rows.filter((r) => TABS.find((t) => t.id === tab)!.match(r.state) &&
    (!needle || `${r.inv.number} ${r.customer} ${r.job}`.toLowerCase().includes(needle)));

  const ar = receivables(list, pays);
  const monthStart = `${today().slice(0, 8)}01`;
  const toExport = exportable(shown.map((r) => r.inv));

  return (
    <div>
      <PageHeader
        title="Invoices"
        sub={`${rows.filter((r) => r.state !== "void").length} invoices · ${money(ar.awaiting)} outstanding`}
        actions={<Button onClick={() => setPicking(true)}><Plus size={16} /> New invoice</Button>}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Awaiting payment" value={money(ar.awaiting)} sub={`${ar.open} open`} />
        <Kpi label="Past due" value={money(ar.pastDue)} tone={ar.pastDue > 0 ? "danger" : undefined} sub={`${ar.late} late`} />
        <Kpi label="Collected this month" value={money(collectedBetween(monthStart, today(), pays))} tone="success" sub="Payments + deposits − refunds" />
        <Kpi label="Deposits held" value={money(depositsHeld(pays))} sub="On jobs not paid off yet" />
      </div>

      {!rows.length ? (
        <EmptyState icon={<Receipt size={40} />} title="No invoices yet" actions={<Button onClick={() => setPicking(true)}><Plus size={16} /> New invoice</Button>}>
          Create one from a job's Invoice card, or start one here. Deposits already taken are credited automatically.
        </EmptyState>
      ) : (
        <>
          <Tabs value={tab} onChange={setTab} tabs={TABS.map((t) => ({ id: t.id, label: t.label, count: rows.filter((r) => t.match(r.state)).length }))} />
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <SearchInput value={q} onChange={setQ} placeholder="Number, customer or job" className="min-w-0 flex-1 basis-60" />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={!toExport.length} onClick={() => downloadFile(`axis-invoices-quickbooks-${today()}.csv`, quickbooksInvoicesCsv(toExport), "text/csv")}>
                <Download size={14} /> QuickBooks CSV
              </Button>
              <Button variant="outline" size="sm" disabled={!pays.length} onClick={() => downloadFile(`axis-payments-${today()}.csv`, paymentsCsv(pays), "text/csv")}>
                <Download size={14} /> Payments CSV
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setHelp(!help)}><HelpCircle size={14} /> QuickBooks help</Button>
            </div>
          </div>

          {help && <QuickBooksHelp count={toExport.length} />}

          {/* Phone: stacked rows. Larger screens: the table. */}
          <div className="space-y-2 sm:hidden">
            {shown.map((r) => (
              <Link key={r.inv.id} to={`/admin/invoices/${r.inv.id}`} className="flex items-center gap-3 rounded-2xl border border-fg/10 bg-surface px-4 py-3 transition hover:border-fg/25">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-semibold tabular-nums">#{r.inv.number}</span>
                    <Badge tone={INVOICE_STATES[r.state].tone}>{INVOICE_STATES[r.state].label}</Badge>
                  </div>
                  <div className="mt-0.5 truncate text-sm text-fg/70">{r.customer}{r.job && ` · ${r.job}`}</div>
                  <div className="text-xs text-fg/40">Issued {shortDate(r.inv.issuedAt)} · due {shortDate(r.inv.dueAt)}</div>
                </div>
                <div className="text-right">
                  <div className="font-display font-semibold tabular-nums">{money(r.balance, true)}</div>
                  <div className="text-xs tabular-nums text-fg/40">of {money(r.total, true)}</div>
                </div>
              </Link>
            ))}
          </div>
          <div className="hidden sm:block">
            <Table head={["Number", "Customer", "Job", "Issued", "Due", <span key="t" className="block text-right">Total</span>, <span key="b" className="block text-right">Balance</span>, "Status"]}>
              {shown.map((r) => (
                <tr key={r.inv.id} onClick={() => nav(`/admin/invoices/${r.inv.id}`)} className="cursor-pointer transition hover:bg-fg/[.03]">
                  <Td><Link to={`/admin/invoices/${r.inv.id}`} className="font-display font-semibold tabular-nums hover:text-accent-fg">#{r.inv.number}</Link></Td>
                  <Td className="max-w-[180px] truncate">{r.customer}</Td>
                  <Td className="max-w-[200px] truncate text-fg/60">{r.job}</Td>
                  <Td className="whitespace-nowrap text-fg/60">{shortDate(r.inv.issuedAt)}</Td>
                  <Td className={r.state === "pastdue" ? "whitespace-nowrap text-danger" : "whitespace-nowrap text-fg/60"}>{shortDate(r.inv.dueAt)}</Td>
                  <Td className="text-right font-display tabular-nums">{money(r.total, true)}</Td>
                  <Td className="text-right font-display tabular-nums">{money(r.balance, true)}</Td>
                  <Td><Badge tone={INVOICE_STATES[r.state].tone}>{INVOICE_STATES[r.state].label}</Badge></Td>
                </tr>
              ))}
            </Table>
          </div>
          {!shown.length && <p className="py-10 text-center text-sm text-fg/45">Nothing here{needle ? ` matching "${q}"` : ""}.</p>}
        </>
      )}

      <AnimatePresence>
        {picking && <NewInvoiceSheet onClose={() => setPicking(false)} onPick={(id) => nav(`/admin/invoices/${id}`)} />}
      </AnimatePresence>
    </div>
  );
}

function QuickBooksHelp({ count }: { count: number }) {
  return (
    <Card className="mb-4">
      <CardHeader title="Importing into QuickBooks Online" sub={`The invoice CSV holds the ${count} invoice${count === 1 ? "" : "s"} listed below (drafts and voids are left out).`} />
      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-fg/70">
        <li>In QuickBooks, add products/services named <b>Automotive</b>, <b>Residential</b> and <b>Commercial</b> (or rename the Item column to yours).</li>
        <li>Make your tax rate names match the ones in Settings → Invoices & tax. Add <b>Net 7</b> / <b>Net 21</b> terms if you use them.</li>
        <li>To keep Axis invoice numbers, turn on <b>Custom transaction numbers</b> (Account and settings → Sales).</li>
        <li>Open the gear menu → <b>Import data</b> → <b>Invoices</b>, upload the file, check the field mapping, then import. QuickBooks takes up to 100 invoices per file and creates customers it doesn't know.</li>
        <li>QuickBooks' importer doesn't take payments. Use the payments CSV to <b>Receive payment</b> against each invoice (deposits show without an invoice number), or load it with an import add-on.</li>
      </ol>
    </Card>
  );
}

function NewInvoiceSheet({ onClose, onPick }: { onClose: () => void; onPick: (invoiceId: string) => void }) {
  const all = leads.use();
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const open = all
    .filter((l) => l.status !== "lost" && !invoiceForLead(l.id))
    .filter((l) => !needle || `${l.contact.name} ${jobTitle(l)} ${l.contact.phone}`.toLowerCase().includes(needle))
    .sort((a, b) => (b.statusChangedAt ?? b.createdAt).localeCompare(a.statusChangedAt ?? a.createdAt))
    .slice(0, 12);
  return (
    <Sheet title="New invoice" onClose={onClose}>
      <p className="mb-3 text-sm text-fg/50">Pick the job. Lines come from its approved proposal or quote, and deposits paid are credited.</p>
      <SearchInput value={q} onChange={setQ} placeholder="Customer or job" />
      <ul className="mt-3 divide-y divide-fg/5">
        {open.map((l) => (
          <li key={l.id}>
            <button type="button" onClick={() => { onPick(createInvoiceFromLead(l).id); onClose(); }}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition hover:bg-fg/[.05]">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{l.contact.name || "No name"}</div>
                <div className="truncate text-xs text-fg/45">{jobTitle(l)} · {statusMeta(l.status).short}</div>
              </div>
              <span className="font-display text-sm tabular-nums text-fg/70">{jobValueLabel(l)}</span>
            </button>
          </li>
        ))}
        {!open.length && <li className="py-6 text-center text-sm text-fg/45">No jobs without an invoice{needle ? " match" : ""}.</li>}
      </ul>
    </Sheet>
  );
}
