import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Car, Check, Home, UserPlus } from "lucide-react";
import { Avatar, Button, Choice, Field, Input, SearchInput, Sheet, cx } from "../../components/ui";
import { digits } from "../../lib/format";
import { newJob } from "../../lib/project";
import { contacts, leads, newId } from "../../lib/store";
import type { Contact, JobKind } from "../../lib/types";

const KINDS: { id: JobKind; label: string; icon: typeof Car }[] = [
  { id: "vehicle", label: "Automotive", icon: Car },
  { id: "home", label: "Residential", icon: Home },
  { id: "business", label: "Commercial", icon: Building2 },
];

/** Start a job: find the customer (or add them inline), pick the kind, land on the job page. */
export function NewJobSheet({ onClose, presetContactId }: { onClose: () => void; presetContactId?: string }) {
  const nav = useNavigate();
  const all = contacts.use();
  const [picked, setPicked] = useState<Contact | null>(() => contacts.get(presetContactId) ?? null);
  const [mode, setMode] = useState<"find" | "new">(all.length ? "find" : "new");
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", email: "", city: "" });
  const [kind, setKind] = useState<JobKind>("vehicle");
  const [address, setAddress] = useState("");

  const needle = q.trim().toLowerCase();
  const results = useMemo(() => {
    if (!needle) return [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
    const d = digits(needle);
    return all.filter((c) => [c.name, c.email, c.company, c.city].some((s) => s?.toLowerCase().includes(needle)) || (d.length >= 3 && digits(c.phone).includes(d))).slice(0, 8);
  }, [all, needle]);

  const dupe = digits(form.phone).length >= 10 ? all.find((c) => digits(c.phone) === digits(form.phone)) : undefined;
  const formOk = form.name.trim().length > 1 && (digits(form.phone).length >= 10 || /\S+@\S+\.\S+/.test(form.email));
  const ready = mode === "find" ? !!picked : formOk;

  const create = () => {
    let c = picked;
    if (mode === "new") {
      c = {
        id: newId("CT"), name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim(), city: form.city.trim() || undefined,
        tags: [], prefs: { sms: true, email: true, reminders: true, followups: true }, source: "Added by crew", createdAt: new Date().toISOString(),
      };
      contacts.save(c);
    }
    if (!c) return;
    const lead = newJob(kind, c);
    const where = address.trim() || c.address;
    if (kind !== "vehicle" && where) leads.update(lead.id, { address: where });
    nav(`/admin/jobs/${lead.id}`);
  };

  const who = mode === "find" ? picked : null;

  return (
    <Sheet title="New job" onClose={onClose}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-fg/80">Customer</span>
        <button type="button" onClick={() => { setMode(mode === "find" ? "new" : "find"); setPicked(null); }} className="flex items-center gap-1 text-xs text-accent-fg hover:underline">
          {mode === "find" ? <><UserPlus size={13} /> New contact</> : "Find existing"}
        </button>
      </div>

      {mode === "find" ? (
        who ? (
          <div className="flex items-center gap-3 rounded-xl border border-accent/40 bg-accent/[.06] p-3">
            <Avatar name={who.name} size={36} />
            <div className="min-w-0 flex-1"><div className="truncate font-medium">{who.name}</div><div className="truncate text-xs text-fg/50">{[who.phone, who.city].filter(Boolean).join(" · ")}</div></div>
            <Button size="sm" variant="ghost" onClick={() => setPicked(null)}>Change</Button>
          </div>
        ) : (
          <>
            <SearchInput value={q} onChange={setQ} placeholder="Name, phone or email" />
            <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
              {results.map((c) => (
                <button key={c.id} type="button" onClick={() => setPicked(c)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-fg/[.05]">
                  <Avatar name={c.name} size={30} />
                  <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{c.name}</div><div className="truncate text-xs text-fg/45">{[c.phone, c.email, c.city].filter(Boolean).join(" · ")}</div></div>
                </button>
              ))}
              {!results.length && (
                <button type="button" onClick={() => { setMode("new"); setForm((f) => ({ ...f, ...(digits(q).length >= 7 ? { phone: q } : { name: q }) })); }}
                  className="w-full rounded-xl border border-dashed border-fg/15 px-3 py-4 text-sm text-fg/55 hover:border-fg/30 hover:text-fg">
                  No match. Add "{q}" as a new contact
                </button>
              )}
            </div>
          </>
        )
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" className="sm:col-span-2"><Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="off" /></Field>
          <Field label="Mobile"><Input type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(928) 555-0100" /></Field>
          <Field label="Email" hint="Optional"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="City" hint="Optional" className="sm:col-span-2"><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Prescott" /></Field>
          {dupe && (
            <button type="button" onClick={() => { setMode("find"); setPicked(dupe); }} className="rounded-xl bg-warn/10 px-3 py-2 text-left text-xs text-warn sm:col-span-2">
              {dupe.name} already has this number. <span className="font-semibold underline">Use that contact</span>
            </button>
          )}
        </div>
      )}

      <div className="mb-2 mt-6 text-sm font-medium text-fg/80">Kind of job</div>
      <div className="grid grid-cols-3 gap-2">
        {KINDS.map((k) => (
          <Choice key={k.id} selected={kind === k.id} onClick={() => setKind(k.id)} className="!p-3 text-center">
            <k.icon size={22} className={cx("mx-auto", kind === k.id ? "text-accent-fg" : "text-fg/45")} />
            <div className="mt-1.5 text-sm font-medium">{k.label}</div>
          </Choice>
        ))}
      </div>
      {kind !== "vehicle" && (
        <Field label="Job address" hint={who?.address ? "Blank = contact's address" : "Optional"} className="mt-4">
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={who?.address || "Street, city"} />
        </Field>
      )}

      <Button size="lg" className="mt-6 w-full" disabled={!ready} onClick={create}><Check size={18} /> Create job</Button>
    </Sheet>
  );
}
