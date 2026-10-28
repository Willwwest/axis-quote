import { useMemo, useState } from "react";
import { Check, Download, FileUp, GitMerge, Pencil, Upload } from "lucide-react";
import { Badge, Button, Input, Progress, Sheet, Table, Td, Textarea, Toggle, cx } from "../../components/ui";
import { downloadFile, shortDate } from "../../lib/format";
import { contacts, leads } from "../../lib/store";
import type { Contact } from "../../lib/types";
import { displayName, duplicateGroups, importTemplate, mergeContacts, readImport, renameTag, runImport, tagStats, type ImportRow } from "./lib";

/* ---------- Import ---------- */

export function ImportSheet({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");
  const [withJobs, setWithJobs] = useState(true);
  const [done, setDone] = useState<{ contacts: number; jobs: number } | null>(null);
  const parsed = useMemo(() => (text.trim() ? readImport(text, contacts.all()) : null), [text]);
  const ok = parsed?.rows.filter((r) => r.status === "ok") ?? [];
  const hasVehicles = ok.some((r) => r.ymm);

  const load = (f: File | undefined) => f && f.text().then(setText);

  if (done) {
    return (
      <Sheet title="Import finished" onClose={onClose}>
        <p className="text-sm text-fg/70">Added {done.contacts} contact{done.contacts === 1 ? "" : "s"}{done.jobs ? ` and ${done.jobs} vehicle job${done.jobs === 1 ? "" : "s"}` : ""}.</p>
        <div className="mt-6 flex justify-end"><Button onClick={onClose}>Done</Button></div>
      </Sheet>
    );
  }

  return (
    <Sheet title="Import contacts" onClose={onClose} wide>
      <p className="text-sm text-fg/55">
        CSV with these headers: Name, Company, Mobile, Work Phone, Email, Address, City, Tags (separated by ;), Notes, Vehicle Year, Vehicle Make, Vehicle Model.
        Only Name is required. Rows whose mobile number is already a contact are skipped.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-fg/15 bg-fg/[.03] px-5 font-display text-sm font-semibold hover:border-fg/30">
          <FileUp size={16} /> Choose CSV
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => load(e.target.files?.[0])} />
        </label>
        <Button variant="ghost" onClick={() => downloadFile("axis-contacts-template.csv", importTemplate(), "text/csv")}><Download size={16} /> Template</Button>
      </div>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="…or paste the CSV here" aria-label="CSV text" className="mt-3 font-mono text-xs" />

      {parsed?.error && <p className="mt-3 text-sm text-danger">{parsed.error}</p>}
      {parsed && !parsed.error && (
        <>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <Badge tone="success">{ok.length} ready</Badge>
            <Badge tone="warn">{parsed.rows.filter((r) => r.status === "dup").length} duplicates</Badge>
            <Badge tone="neutral">{parsed.rows.filter((r) => r.status === "skip").length} skipped</Badge>
            {parsed.ignored.length > 0 && <Badge tone="info">Ignoring columns: {parsed.ignored.join(", ")}</Badge>}
          </div>
          <div className="mt-3 max-h-72 overflow-y-auto">
            <Table head={["Row", "Name", "Mobile", "City", "Tags", "Vehicle", ""]}>
              {parsed.rows.map((r) => <PreviewRow key={r.line} r={r} />)}
            </Table>
          </div>
          {hasVehicles && <div className="mt-3"><Toggle checked={withJobs} onChange={setWithJobs} label="Create a vehicle job for rows with a vehicle" hint="Each one opens as a new lead with the year / make / model filled in." /></div>}
        </>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button disabled={!ok.length} onClick={() => setDone(runImport(parsed!.rows, withJobs && hasVehicles))}><Upload size={16} /> Import {ok.length || ""}</Button>
      </div>
    </Sheet>
  );
}

function PreviewRow({ r }: { r: ImportRow }) {
  return (
    <tr className={cx(r.status !== "ok" && "text-fg/40")}>
      <Td className="tabular-nums">{r.line}</Td>
      <Td>{r.contact.name || "—"}{r.contact.company && <span className="text-fg/45"> · {r.contact.company}</span>}</Td>
      <Td className="whitespace-nowrap">{r.contact.phone}</Td>
      <Td>{r.contact.city}</Td>
      <Td>{r.contact.tags.join(", ")}</Td>
      <Td>{r.ymm}</Td>
      <Td className="whitespace-nowrap">
        {r.status === "ok" ? (r.warn ? <Badge tone="warn">{r.warn}</Badge> : <Badge tone="success" icon={<Check size={11} />}>OK</Badge>) : <Badge tone={r.status === "dup" ? "warn" : "neutral"}>{r.reason}</Badge>}
      </Td>
    </tr>
  );
}

/* ---------- Tags ---------- */

export function TagsSheet({ onClose, onPick }: { onClose: () => void; onPick: (tag: string) => void }) {
  const all = contacts.use();
  const jobs = leads.use();
  const stats = useMemo(() => tagStats(all, jobs), [all, jobs]);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  return (
    <Sheet title="Contact tags" onClose={onClose}>
      <p className="mb-4 text-sm text-fg/55">Conversion is won jobs (approved through paid) out of every job for contacts with that tag. Rename a tag to fix typos everywhere; clear it to remove.</p>
      {!stats.length && <p className="text-sm text-fg/45">No tags yet. Add them on a contact.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {stats.map((t) => (
          <div key={t.tag} className="rounded-xl border border-fg/10 p-3">
            {editing === t.tag ? (
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); renameTag(t.tag, name); setEditing(null); }}>
                <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-label="Tag name" className="!py-1.5 text-sm" />
                <Button size="sm" type="submit">Save</Button>
              </form>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <button type="button" onClick={() => { onPick(t.tag); onClose(); }} className="truncate font-display font-semibold hover:text-accent-fg">{t.tag}</button>
                <div className="flex items-center gap-1">
                  <span className="font-display text-lg font-semibold tabular-nums">{t.contacts}</span>
                  <button type="button" aria-label={`Rename ${t.tag}`} onClick={() => { setEditing(t.tag); setName(t.tag); }} className="rounded-lg p-1.5 text-fg/35 hover:bg-fg/10 hover:text-fg"><Pencil size={13} /></button>
                </div>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between text-xs text-fg/50">
              <span>{t.won} of {t.jobs} job{t.jobs === 1 ? "" : "s"} won</span>
              <span className="font-medium tabular-nums text-fg/80">{t.pct}%</span>
            </div>
            <Progress value={t.pct} tone="success" className="mt-1.5" />
          </div>
        ))}
      </div>
    </Sheet>
  );
}

/* ---------- Merge duplicates ---------- */

export function MergeSheet({ onClose }: { onClose: () => void }) {
  const all = contacts.use();
  const jobs = leads.use();
  const groups = useMemo(() => duplicateGroups(all), [all]);
  const [primary, setPrimary] = useState<Record<string, string>>({});
  const jobCount = (c: Contact) => jobs.filter((l) => l.contactId === c.id).length;
  // Default keeper: the one with the most jobs, then the oldest.
  const keeper = (g: Contact[]) => primary[g[0].id] ?? [...g].sort((a, b) => jobCount(b) - jobCount(a) || a.createdAt.localeCompare(b.createdAt))[0].id;

  return (
    <Sheet title="Merge duplicates" onClose={onClose} wide>
      <p className="mb-4 text-sm text-fg/55">These contacts share a phone number or email. Pick the one to keep: jobs, appointments, invoices and notes move to it, tags and missing details are combined, and the others are deleted.</p>
      {!groups.length && <p className="rounded-xl border border-dashed border-fg/15 px-4 py-8 text-center text-sm text-fg/45">No duplicates found.</p>}
      <div className="space-y-4">
        {groups.map((g) => {
          const keep = keeper(g);
          return (
            <div key={g[0].id} className="rounded-xl border border-fg/10 p-3">
              <div className="space-y-1.5">
                {g.map((c) => (
                  <label key={c.id} className={cx("flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition", keep === c.id ? "bg-accent/10" : "hover:bg-fg/[.04]")}>
                    <input type="radio" name={`keep-${g[0].id}`} checked={keep === c.id} onChange={() => setPrimary({ ...primary, [g[0].id]: c.id })} className="accent-[rgb(var(--c-accent))]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{displayName(c)}</span>
                      <span className="block truncate text-xs text-fg/50">{[c.phone, c.email, c.city].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span className="shrink-0 text-right text-xs text-fg/45">{jobCount(c)} job{jobCount(c) === 1 ? "" : "s"}<br />since {shortDate(c.createdAt)}</span>
                  </label>
                ))}
              </div>
              <div className="mt-3 flex justify-end">
                <Button size="sm" onClick={() => {
                  const p = g.find((c) => c.id === keep)!;
                  if (confirm(`Merge ${g.length - 1} contact${g.length > 2 ? "s" : ""} into ${p.name}? This can't be undone.`)) mergeContacts(p, g.filter((c) => c.id !== keep));
                }}><GitMerge size={14} /> Merge into {g.find((c) => c.id === keep)!.name}</Button>
              </div>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}
