import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Car, Building2, Home, Plus, UserPlus, X } from "lucide-react";
import { Avatar, Button, Field, Input, SearchInput, Segmented, Sheet, Toggle, cx } from "../../components/ui";
import { digits } from "../../lib/format";
import { newJob } from "../../lib/project";
import { contacts } from "../../lib/store";
import type { Contact, JobKind } from "../../lib/types";
import { blankContact, cleanTag, displayName, uniq } from "./lib";

export const KINDS: { value: JobKind; label: string; icon: typeof Car }[] = [
  { value: "vehicle", label: "Vehicle", icon: Car },
  { value: "home", label: "Home", icon: Home },
  { value: "business", label: "Business", icon: Building2 },
];

/** Free-form tags: type and press Enter (or comma). Suggests tags already in use. */
export function TagInput({ value, onChange }: { value: string[]; onChange: (t: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const known = useMemo(() => uniq(contacts.all().flatMap((c) => c.tags)).sort(), []);
  const add = (t: string) => {
    const tag = cleanTag(t);
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setDraft("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-fg/12 bg-fg/[.04] px-2 py-2 focus-within:border-accent">
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-full bg-fg/10 py-0.5 pl-2.5 pr-1 text-xs text-fg/80">
          {t}
          <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((x) => x !== t))} className="rounded-full p-0.5 text-fg/45 hover:text-fg"><X size={12} /></button>
        </span>
      ))}
      <input list="axis-tags" value={draft} placeholder={value.length ? "" : "referral, fleet, repeat…"} aria-label="Add tag"
        onChange={(e) => (e.target.value.endsWith(",") ? add(e.target.value.slice(0, -1)) : setDraft(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); add(draft); }
          if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => draft && add(draft)}
        className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-sm text-fg outline-none placeholder:text-fg/30" />
      <datalist id="axis-tags">{known.filter((t) => !value.includes(t)).map((t) => <option key={t} value={t} />)}</datalist>
    </div>
  );
}

/** The editable fields of a contact. */
export function ContactFields({ c, set, full }: { c: Contact; set: (p: Partial<Contact>) => void; full?: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Name"><Input value={c.name} onChange={(e) => set({ name: e.target.value })} autoComplete="off" /></Field>
      <Field label="Company" hint="Optional"><Input value={c.company ?? ""} onChange={(e) => set({ company: e.target.value || undefined })} /></Field>
      <Field label="Mobile"><Input type="tel" inputMode="tel" value={c.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
      {full && <Field label="Work phone"><Input type="tel" inputMode="tel" value={c.workPhone ?? ""} onChange={(e) => set({ workPhone: e.target.value || undefined })} /></Field>}
      <Field label="Email"><Input type="email" inputMode="email" value={c.email} onChange={(e) => set({ email: e.target.value })} /></Field>
      {full && <Field label="Address"><Input value={c.address ?? ""} onChange={(e) => set({ address: e.target.value || undefined })} /></Field>}
      <Field label="City"><Input value={c.city ?? ""} onChange={(e) => set({ city: e.target.value || undefined })} /></Field>
      {full && <Field label="Source" hint="How they found you"><Input value={c.source ?? ""} onChange={(e) => set({ source: e.target.value || undefined })} placeholder="Google, referral, walk-in…" /></Field>}
      <Field label="Tags" className="sm:col-span-2"><TagInput value={c.tags} onChange={(tags) => set({ tags })} /></Field>
      {full && <div className="sm:col-span-2"><Toggle checked={!!c.taxExempt} onChange={(taxExempt) => set({ taxExempt })} label="Tax exempt" hint="New invoices for this contact skip sales tax." /></div>}
    </div>
  );
}

/** Quick add from the dashboard or contacts list. Optionally starts a job right away. */
export function AddContactSheet({ onClose, startJob = "vehicle" }: { onClose: () => void; startJob?: JobKind | "none" }) {
  const nav = useNavigate();
  const [c, setC] = useState(() => blankContact({ source: "Added by crew" }));
  const [kind, setKind] = useState<JobKind | "none">(startJob);
  const dup = digits(c.phone).length >= 7 ? contacts.all().find((x) => digits(x.phone).slice(-10) === digits(c.phone).slice(-10)) : undefined;
  const save = () => {
    contacts.save({ ...c, name: c.name.trim() });
    onClose();
    if (kind === "none") nav(`/admin/contacts/${c.id}`);
    else nav(`/admin/jobs/${newJob(kind, c).id}`);
  };
  return (
    <Sheet title="Add contact (lead)" onClose={onClose}>
      <ContactFields c={c} set={(p) => setC((x) => ({ ...x, ...p }))} />
      {dup && (
        <button type="button" onClick={() => { onClose(); nav(`/admin/contacts/${dup.id}`); }} className="mt-4 w-full rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-left text-sm text-warn">
          {displayName(dup)} already has this number. Open their contact instead →
        </button>
      )}
      <div className="mt-5">
        <div className="mb-2 text-sm font-medium text-fg/80">Start a job</div>
        <Segmented value={kind} onChange={setKind} options={[{ value: "none", label: "Not yet" }, ...KINDS.map((k) => ({ value: k.value, label: k.label }))]} />
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={!c.name.trim() || !(c.phone.trim() || c.email.trim())}><UserPlus size={16} /> {kind === "none" ? "Save contact" : "Save & open job"}</Button>
      </div>
    </Sheet>
  );
}

/** New job for an existing contact (search) or a new one. */
export function NewJobSheet({ onClose, contact }: { onClose: () => void; contact?: Contact }) {
  const nav = useNavigate();
  const all = contacts.use();
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Contact | undefined>(contact);
  const [fresh, setFresh] = useState(false);
  const [kind, setKind] = useState<JobKind>("vehicle");
  const matches = useMemo(() => {
    const n = q.trim().toLowerCase(), d = digits(q);
    return all.filter((c) => !n || c.name.toLowerCase().includes(n) || (c.company ?? "").toLowerCase().includes(n) || (d.length >= 3 && digits(c.phone).includes(d))).slice(0, 6);
  }, [all, q]);
  if (fresh) return <AddContactSheet onClose={onClose} startJob={kind} />;
  return (
    <Sheet title="New job" onClose={onClose}>
      <div className="mb-2 text-sm font-medium text-fg/80">Type of job</div>
      <div className="mb-5 grid grid-cols-3 gap-2">
        {KINDS.map((k) => (
          <button key={k.value} type="button" onClick={() => setKind(k.value)} aria-pressed={kind === k.value}
            className={cx("flex flex-col items-center gap-1.5 rounded-xl border py-3 text-sm transition", kind === k.value ? "border-accent bg-accent/10 text-fg" : "border-fg/10 text-fg/60 hover:border-fg/25")}>
            <k.icon size={18} /> {k.label}
          </button>
        ))}
      </div>
      <div className="mb-2 text-sm font-medium text-fg/80">Customer</div>
      {picked ? (
        <div className="flex items-center gap-3 rounded-xl border border-accent/40 bg-accent/[.06] p-3">
          <Avatar name={picked.name} />
          <div className="min-w-0 flex-1"><div className="truncate font-medium">{displayName(picked)}</div><div className="text-xs text-fg/50">{picked.phone || picked.email}</div></div>
          {!contact && <Button size="sm" variant="ghost" onClick={() => setPicked(undefined)}>Change</Button>}
        </div>
      ) : (
        <>
          <SearchInput value={q} onChange={setQ} placeholder="Search contacts by name or phone" />
          <div className="mt-2 divide-y divide-fg/5 rounded-xl border border-fg/10">
            {matches.map((c) => (
              <button key={c.id} type="button" onClick={() => setPicked(c)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-fg/[.04]">
                <Avatar name={c.name} size={26} />
                <span className="min-w-0 flex-1 truncate text-sm">{displayName(c)}</span>
                <span className="text-xs text-fg/45">{c.phone}</span>
              </button>
            ))}
            <button type="button" onClick={() => setFresh(true)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-accent-fg hover:bg-fg/[.04]"><Plus size={16} /> New contact</button>
          </div>
        </>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button disabled={!picked} onClick={() => { onClose(); nav(`/admin/jobs/${newJob(kind, picked!).id}`); }}>Create job</Button>
      </div>
    </Sheet>
  );
}
