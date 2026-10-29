import { useState } from "react";
import { Database, Download, FileUp, RotateCcw, Sparkles, TriangleAlert } from "lucide-react";
import { Button, Card, CardHeader, Field, Input } from "../../components/ui";
import { downloadFile, toCsv, today } from "../../lib/format";
import { paidOnLead } from "../../lib/money";
import { jobKindLabel, jobPrice, jobTitle, statusMeta } from "../../lib/project";
import { loadDemoData } from "../../lib/samples";
import { personName } from "../../lib/session";
import { activeBusiness, businessKeys, leads, resetAll } from "../../lib/store";

// Backups use the "axis.*" names, so one business's backup can be restored into another.
function backup() {
  const data: Record<string, unknown> = {};
  for (const [k, name] of businessKeys()) {
    const raw = localStorage.getItem(k);
    try { data[name] = raw == null ? null : JSON.parse(raw); } catch { data[name] = raw; }
  }
  return JSON.stringify({ app: "axis", version: 1, exportedAt: new Date().toISOString(), data }, null, 2);
}

function leadsCsv() {
  return toCsv([
    ["Job", "Created", "Status", "Type", "Title", "Customer", "Phone", "Email", "City", "Vehicle", "VIN", "Price", "Paid", "Source", "Referral", "Assigned"],
    ...leads.all().map((l) => [
      l.id, l.createdAt.slice(0, 10), statusMeta(l.status).label, jobKindLabel(l), jobTitle(l), l.contact.name, l.contact.phone, l.contact.email, l.city,
      l.vehicle?.ymm, l.vehicle?.vin, jobPrice(l), paidOnLead(l.id), l.source, l.referral, l.assigneeId ? personName(l.assigneeId) : "",
    ]),
  ]);
}

export function DataSettings() {
  const [msg, setMsg] = useState("");
  const [typed, setTyped] = useState("");
  const used = businessKeys().reduce((s, [k]) => s + (localStorage.getItem(k)?.length ?? 0), 0);

  const restore = async (f: File | undefined) => {
    if (!f) return;
    try {
      const parsed = JSON.parse(await f.text());
      const data: Record<string, unknown> = parsed?.app === "axis" ? parsed.data : parsed;
      const keys = Object.keys(data ?? {}).filter((k) => k.startsWith("axis."));
      if (!keys.length) { setMsg("That file isn't an Axis backup."); return; }
      if (!confirm(`Replace everything on this device with the backup from ${parsed.exportedAt ? new Date(parsed.exportedAt).toLocaleString() : "this file"} (${keys.length} sets of records)?`)) return;
      businessKeys().forEach(([k]) => localStorage.removeItem(k));
      const into = activeBusiness().id === "main" ? "axis." : `axis~${activeBusiness().id}.`;
      keys.forEach((k) => localStorage.setItem(into + k.slice(5), typeof data[k] === "string" ? (data[k] as string) : JSON.stringify(data[k])));
      location.reload();
    } catch {
      setMsg("Couldn't read that file. Pick a .json backup made here.");
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start gap-3 rounded-2xl border border-info/30 bg-info/[.06] p-4 text-sm text-fg/70">
        <Database size={18} className="mt-0.5 shrink-0 text-info" />
        <p>Everything is saved in this browser, on this device ({Math.max(1, Math.round(used / 1024))} KB). Other phones and computers don't see it until a server is connected (see “Before launch” in the README). Download a backup regularly.</p>
      </div>
      {msg && <p className="rounded-xl bg-fg/[.05] px-4 py-3 text-sm text-fg/80">{msg}</p>}

      <Card>
        <CardHeader title="Backup & restore" sub="One JSON file with every job, contact, invoice, roll and setting." />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => downloadFile(`axis-backup-${today()}.json`, backup(), "application/json")}><Download size={16} /> Download backup</Button>
          <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-fg/15 bg-fg/[.03] px-5 font-display text-sm font-semibold hover:border-fg/30">
            <FileUp size={16} /> Restore from file
            <input type="file" accept=".json,application/json" className="sr-only" onChange={(e) => { restore(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        </div>
      </Card>

      <Card>
        <CardHeader title="Exports" sub="Spreadsheets for your accountant or another CRM." />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => downloadFile(`axis-jobs-${today()}.csv`, leadsCsv(), "text/csv")}><Download size={16} /> Jobs & leads CSV</Button>
        </div>
        <p className="mt-2 text-xs text-fg/40">Contacts export from the Contacts page, with its search and tag filter applied.</p>
      </Card>

      <Card>
        <CardHeader title="Demo data" icon={<Sparkles size={16} />} sub="Sample contacts, jobs in every stage, appointments, proposals, invoices, film rolls, tasks and reviews, dated around today." />
        <Button variant="outline" onClick={() => {
          if (!confirm("Add the demo data? Your own records stay. Everything sample is marked “Sample” and uses 555 numbers, and loading it again refreshes it.")) return;
          loadDemoData();
          setMsg("Demo data loaded. Sample staff sign in with PIN 2222 (installer) and 3333 (technician).");
        }}><Sparkles size={16} /> Load demo data</Button>
      </Card>

      <Card tone="danger">
        <CardHeader title="Reset everything" icon={<TriangleAlert size={16} />} sub="Deletes every record and setting on this device, including the owner PIN (back to 1234). Download a backup first." />
        <Field label="Type RESET to confirm">
          <div className="flex gap-2">
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Type RESET" className="min-w-0 !py-2 uppercase" />
            <Button variant="danger" className="!h-[42px]" disabled={typed.trim().toUpperCase() !== "RESET"} onClick={() => { resetAll(); setTyped(""); setMsg("Everything was reset."); }}><RotateCcw size={16} /> Reset</Button>
          </div>
        </Field>
      </Card>
    </div>
  );
}
