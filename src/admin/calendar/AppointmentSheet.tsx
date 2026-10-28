import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CalendarPlus, ExternalLink, LogIn, LogOut, MapPin, RotateCcw, Trash2, UserX, X } from "lucide-react";
import { Badge, Button, Field, Input, SearchInput, Segmented, Select, Sheet, Textarea, Toggle } from "../../components/ui";
import { addDays, addMinutes, at, dayDate, digits, relative, time12, today } from "../../lib/format";
import { ensureContact, jobTitle, newJob } from "../../lib/project";
import { apptAddress, apptLink, appointmentIcs, mapsUrl } from "../../lib/schedule";
import { OWNER_ID, ownerUser, personName, useSession } from "../../lib/session";
import { appointments, contacts, leads, newId, staff, useSettings } from "../../lib/store";
import type { Appointment, Contact, JobKind, Lead } from "../../lib/types";
import {
  APPT_STATUSES, TYPES, blankAppointment, cancelAppointment, checkIn, checkOut, createAppointment, deleteAppointment, noShow, reopen,
  seriesOf, typeMeta, updateAppointment,
} from "./actions";

/** Everyone who can be assigned: the owner plus active staff. */
export function useTeam() {
  const list = staff.use();
  const owner = ownerUser();
  return [{ id: OWNER_ID, name: owner.name, color: owner.color }, ...list.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name, color: s.color }))];
}

const fmtDur = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}`);
// Tint Wiz steps: 15 min up to 6h, then 30 min up to 12h.
const DURATIONS = [...Array.from({ length: 24 }, (_, i) => (i + 1) * 15), ...Array.from({ length: 12 }, (_, i) => 390 + i * 30)];

/** Default date + start for a new booking: the next slot today, or 9:00 tomorrow once today's hours are over. */
function nextStart(date: string, cal: { startHour: number; endHour: number; slotMin: number }) {
  if (date !== today()) return { date, start: "09:00" };
  const d = new Date();
  const m = Math.ceil((d.getHours() * 60 + d.getMinutes()) / cal.slotMin) * cal.slotMin;
  if (m > cal.endHour * 60 - cal.slotMin) return { date: addDays(date, 1), start: addMinutes("00:00", Math.max(cal.startHour * 60, 9 * 60)) };
  return { date, start: addMinutes("00:00", Math.max(cal.startHour * 60, m)) };
}

export function AppointmentSheet({ appt, initial, onClose }: { appt?: Appointment; initial?: Partial<Appointment>; onClose: () => void }) {
  const s = useSettings();
  const session = useSession();
  const team = useTeam();
  const live = appointments.useOne(appt?.id) ?? appt;
  const isNew = !appt;
  const [a, setA] = useState<Appointment>(() => appt ?? blankAppointment({
    durationMin: s.calendar.defaultDurationMin, notifyCustomer: s.reminders.confirm,
    assigneeId: session.can("calendar.all") ? undefined : session.user?.id, ...initial,
    // A clicked slot keeps its own time; otherwise pick the next sensible one.
    ...(initial?.start ? { date: initial.date ?? today() } : nextStart(initial?.date ?? today(), s.calendar)),
  }));
  const set = (p: Partial<Appointment>) => setA((x) => ({ ...x, ...p }));
  const [repeat, setRepeat] = useState({ on: false, everyWeeks: 1, count: 4 });
  const [scope, setScope] = useState<"one" | "series">("one");
  const [cancelling, setCancelling] = useState(false);
  const [newCust, setNewCust] = useState<null | { name: string; phone: string; email: string; address: string; kind: JobKind }>(null);
  const lead = leads.useOne(a.leadId);

  const starts = useMemo(() => {
    const out: string[] = [];
    for (let m = s.calendar.startHour * 60; m < s.calendar.endHour * 60; m += s.calendar.slotMin) out.push(addMinutes("00:00", m));
    if (!out.includes(a.start)) out.push(a.start);
    return out.sort();
  }, [s.calendar, a.start]);

  const conflicts = useMemo(() => {
    const s0 = +at(a.date, a.start), e0 = s0 + a.durationMin * 60_000;
    return appointments.all().filter((x) => x.id !== a.id && x.date === a.date && x.status !== "cancelled" && (x.assigneeId ?? "") === (a.assigneeId ?? "")
      && +at(x.date, x.start) < e0 && +at(x.date, x.start) + x.durationMin * 60_000 > s0);
  }, [a]);

  const past = +at(a.date, a.start) < Date.now();
  const blocked = s.blockedDates.includes(a.date);
  const canSave = !!a.date && (!!a.leadId || !!a.title.trim() || !!newCust?.name.trim());

  function save() {
    let next = { ...a };
    if (newCust?.name.trim()) {
      const c: Contact = {
        id: newId("CT"), name: newCust.name.trim(), phone: newCust.phone, email: newCust.email, address: newCust.address || undefined,
        tags: [], notes: "", prefs: { sms: true, email: true, reminders: true, followups: true }, source: "Added by crew", createdAt: new Date().toISOString(),
      };
      const dup = digits(c.phone) && contacts.all().find((x) => digits(x.phone) === digits(c.phone));
      if (!dup) contacts.save(c);
      const job = newJob(newCust.kind, dup || c);
      next = { ...next, leadId: job.id, contactId: job.contactId };
    } else if (lead) {
      next.contactId = ensureContact(lead).id;
    }
    const job = leads.get(next.leadId);
    if (!next.title.trim()) next.title = `${typeMeta(next.type).label}${job ? ` · ${jobTitle(job)}` : ""}`;
    if (isNew) createAppointment(next, repeat.on ? repeat : undefined);
    else updateAppointment(appt!, next, scope);
    onClose();
  }

  const status = live?.status ?? "scheduled";
  const addr = apptAddress(a);
  const inSeries = !!live?.recurrence && seriesOf(live).length > 1;

  return (
    <Sheet title={isNew ? "New appointment" : "Appointment"} onClose={onClose} wide>
      {!isNew && live && (
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-fg/10 bg-sunken p-3">
          <Badge tone={APPT_STATUSES[status].tone}>{APPT_STATUSES[status].label}</Badge>
          {live.checkInAt && <span className="text-xs text-fg/50">In {time12(new Date(live.checkInAt).toTimeString().slice(0, 5))}</span>}
          {live.checkOutAt && <span className="text-xs text-fg/50">· Out {time12(new Date(live.checkOutAt).toTimeString().slice(0, 5))}</span>}
          <div className="flex-1" />
          {status === "scheduled" && <Button size="sm" onClick={() => checkIn(live)}><LogIn size={14} /> Check in</Button>}
          {status === "checked_in" && <Button size="sm" onClick={() => { checkOut(live); onClose(); }}><LogOut size={14} /> Check out</Button>}
          {status === "scheduled" && <Button size="sm" variant="ghost" onClick={() => noShow(live)}><UserX size={14} /> No-show</Button>}
          {(status === "scheduled" || status === "checked_in") && <Button size="sm" variant="danger" onClick={() => setCancelling(true)}><X size={14} /> Cancel</Button>}
          {(status === "cancelled" || status === "no_show" || status === "done") && <Button size="sm" variant="outline" onClick={() => reopen(live)}><RotateCcw size={14} /> Reopen</Button>}
        </div>
      )}

      {cancelling && live && (
        <CancelPanel appt={live} inSeries={inSeries} onDone={() => { setCancelling(false); onClose(); }} onBack={() => setCancelling(false)} />
      )}

      <div className="grid gap-4">
        <JobPicker lead={lead} locked={!!initial?.leadId} onPick={(l) => { set({ leadId: l?.id, contactId: l?.contactId }); setNewCust(null); }} newCust={newCust} setNewCust={setNewCust} />

        <Group label="Type">
          <Segmented value={a.type} onChange={(type) => set({ type })} options={TYPES.map((t) => ({ value: t.id, label: t.label }))} />
        </Group>
        <Field label="Title" hint="Shown on the calendar">
          <Input value={a.title} onChange={(e) => set({ title: e.target.value })} placeholder={`${typeMeta(a.type).label}${lead ? ` · ${jobTitle(lead)}` : ""}`} />
        </Field>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Date" className="col-span-2 sm:col-span-1"><Input type="date" value={a.date} onChange={(e) => set({ date: e.target.value })} /></Field>
          <Field label="Start">
            <Select value={a.start} onChange={(e) => set({ start: e.target.value })}>{starts.map((t) => <option key={t} value={t}>{time12(t)}</option>)}</Select>
          </Field>
          <Field label="Duration">
            <Select value={a.durationMin} onChange={(e) => set({ durationMin: Number(e.target.value) })}>
              {[...new Set([...DURATIONS, a.durationMin])].sort((x, y) => x - y).map((m) => <option key={m} value={m}>{fmtDur(m)}</option>)}
            </Select>
          </Field>
        </div>
        {(past || blocked || conflicts.length > 0) && (
          <div className="space-y-1 text-xs text-warn">
            {past && <p className="flex items-center gap-1.5"><AlertTriangle size={13} /> This time is in the past.</p>}
            {blocked && <p className="flex items-center gap-1.5"><AlertTriangle size={13} /> {dayDate(a.date)} is blocked off.</p>}
            {conflicts.map((c) => <p key={c.id} className="flex items-center gap-1.5"><AlertTriangle size={13} /> Overlaps {c.title} ({time12(c.start)}) for {personName(c.assigneeId)}.</p>)}
          </div>
        )}

        <Field label="Assigned to">
          <Select value={a.assigneeId ?? ""} onChange={(e) => set({ assigneeId: e.target.value || undefined })} disabled={!session.can("calendar.all")}>
            <option value="">Unassigned</option>
            {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        </Field>
        <Field label="Notes for the assignee">
          <Textarea value={a.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} placeholder="Gate code, parking, what to bring…" className="!min-h-[72px]" />
        </Field>

        <div className="rounded-2xl border border-fg/10 px-4 py-1">
          <Toggle checked={a.notifyCustomer} onChange={(notifyCustomer) => set({ notifyCustomer })} label="Notify customer"
            hint={a.type === "misc" ? "Other events never message the customer." : "Queues the confirmation and reminders in Messages → Outbox."} />
          {isNew && (
            <>
              <Toggle checked={repeat.on} onChange={(on) => setRepeat({ ...repeat, on })} label="Repeat" hint="Weekly maintenance, multi-day commercial jobs" />
              {repeat.on && (
                <div className="flex flex-wrap items-center gap-2 pb-3 text-sm text-fg/70">
                  Every
                  <Select value={repeat.everyWeeks} onChange={(e) => setRepeat({ ...repeat, everyWeeks: Number(e.target.value) })} className="!w-auto !py-2">
                    {[1, 2, 3, 4, 6, 8, 12].map((n) => <option key={n} value={n}>{n === 1 ? "week" : `${n} weeks`}</option>)}
                  </Select>
                  ×
                  <Input type="number" min={2} max={52} value={repeat.count} onChange={(e) => setRepeat({ ...repeat, count: Math.max(2, Math.min(52, Number(e.target.value) || 2)) })} className="!w-20 !py-2 tabular-nums" />
                  times
                </div>
              )}
            </>
          )}
        </div>

        {inSeries && (
          <Group label="Apply changes to">
            <Segmented value={scope} onChange={setScope} options={[{ value: "one", label: "This one" }, { value: "series", label: `Whole series (${seriesOf(live!).length})` }]} />
          </Group>
        )}

        {!isNew && live && (
          <div className="flex flex-wrap gap-2 text-sm">
            {addr && <a href={mapsUrl(addr)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-fg/60 hover:bg-fg/[.05] hover:text-fg"><MapPin size={14} /> Open in Maps</a>}
            <a href={apptLink(live)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-fg/60 hover:bg-fg/[.05] hover:text-fg"><ExternalLink size={14} /> Customer page</a>
            <button type="button" onClick={() => appointmentIcs(live, addr, live.notes)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-fg/60 hover:bg-fg/[.05] hover:text-fg"><CalendarPlus size={14} /> .ics</button>
            {live.leadId && <Link to={`/admin/jobs/${live.leadId}`} onClick={onClose} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-fg/60 hover:bg-fg/[.05] hover:text-fg">Open job →</Link>}
          </div>
        )}

        {!!live?.history?.length && (
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-fg/45">History</div>
            <ol className="space-y-1.5 border-l border-fg/10 pl-3 text-xs">
              {[...live.history].reverse().map((h, i) => (
                <li key={i} className="text-fg/70"><span className="text-fg/85">{h.text}</span> <span className="text-fg/40">· {h.by ? personName(h.by) : "Customer"} · {relative(h.at)}</span></li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {!isNew && live && (
          <Button variant="ghost" size="sm" className="text-danger" onClick={() => { if (confirm(inSeries && scope === "series" ? "Delete this and the rest of the series?" : "Delete this appointment?")) { deleteAppointment(live, scope); onClose(); } }}>
            <Trash2 size={14} /> Delete
          </Button>
        )}
        <div className="flex-1" />
        <Button variant="ghost" onClick={onClose}>Close</Button>
        <Button onClick={save} disabled={!canSave}>{isNew ? (repeat.on ? `Book ${repeat.count}` : "Book it") : "Save"}</Button>
      </div>
    </Sheet>
  );
}

function CancelPanel({ appt, inSeries, onDone, onBack }: { appt: Appointment; inSeries: boolean; onDone: () => void; onBack: () => void }) {
  const s = useSettings();
  const [tell, setTell] = useState(appt.notifyCustomer && s.reminders.cancel && appt.type !== "misc");
  const [scope, setScope] = useState<"one" | "series">("one");
  const [reason, setReason] = useState("");
  return (
    <div className="mb-5 rounded-2xl border border-danger/40 bg-danger/[.06] p-4">
      <p className="font-display font-semibold">Cancel {appt.title}?</p>
      <div className="mt-2 grid gap-3">
        <Toggle checked={tell} onChange={setTell} label="Tell the customer" hint="Queues the cancellation text in Messages → Outbox" />
        {inSeries && <Segmented size="sm" value={scope} onChange={setScope} options={[{ value: "one", label: "This one" }, { value: "series", label: "This and the rest" }]} />}
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional, internal)" />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onBack}>Keep it</Button>
        <Button size="sm" variant="danger" onClick={() => { cancelAppointment(appt, { tellCustomer: tell, scope, reason: reason.trim() || undefined }); onDone(); }}>Cancel appointment</Button>
      </div>
    </div>
  );
}

/** Field-style label for groups of buttons (a <label> would forward clicks to the first button). */
function Group({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-medium text-fg/80">{label}{hint && <span className="text-xs font-normal text-fg/40">{hint}</span>}</div>
      {children}
    </div>
  );
}

type NewCust = { name: string; phone: string; email: string; address: string; kind: JobKind };

function JobPicker({ lead, locked, onPick, newCust, setNewCust }: {
  lead?: Lead; locked: boolean; onPick: (l?: Lead) => void; newCust: NewCust | null; setNewCust: (c: NewCust | null) => void;
}) {
  const all = leads.use();
  const [q, setQ] = useState("");
  const hits = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return all.filter((l) => l.status !== "lost" && [l.contact.name, l.contact.phone, jobTitle(l), l.id].join(" ").toLowerCase().includes(t)).slice(0, 6);
  }, [q, all]);

  if (lead) {
    return (
      <Group label="Job">
        <div className="flex items-center gap-3 rounded-xl border border-fg/12 bg-fg/[.04] px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{lead.contact.name}</div>
            <div className="truncate text-xs text-fg/50">{jobTitle(lead)} · {lead.contact.phone || lead.contact.email}</div>
          </div>
          {!locked && <Button size="sm" variant="ghost" onClick={() => onPick(undefined)}>Change</Button>}
        </div>
      </Group>
    );
  }
  if (newCust) {
    const set = (p: Partial<NewCust>) => setNewCust({ ...newCust, ...p });
    return (
      <div className="grid gap-3 rounded-2xl border border-fg/10 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-fg/80">New customer + job</span>
          <Button size="sm" variant="ghost" onClick={() => setNewCust(null)}>Pick existing</Button>
        </div>
        <Segmented size="sm" value={newCust.kind} onChange={(kind) => set({ kind })} options={[{ value: "vehicle", label: "Auto" }, { value: "home", label: "Home" }, { value: "business", label: "Business" }]} />
        <Input value={newCust.name} onChange={(e) => set({ name: e.target.value })} placeholder="Name" autoFocus />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input type="tel" value={newCust.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="Mobile" />
          <Input type="email" value={newCust.email} onChange={(e) => set({ email: e.target.value })} placeholder="Email" />
        </div>
        <Input value={newCust.address} onChange={(e) => set({ address: e.target.value })} placeholder="Address (for the route)" />
      </div>
    );
  }
  return (
    <Group label="Job" hint="Optional for internal events">
      <SearchInput value={q} onChange={setQ} placeholder="Search customer, phone or job" />
      {hits.length > 0 && (
        <div className="mt-2 divide-y divide-fg/5 overflow-hidden rounded-xl border border-fg/10">
          {hits.map((l) => (
            <button key={l.id} type="button" onClick={() => { onPick(l); setQ(""); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-fg/[.05]">
              <span className="min-w-0 flex-1"><span className="block truncate text-sm">{l.contact.name}</span><span className="block truncate text-xs text-fg/45">{jobTitle(l)}</span></span>
              <span className="text-xs text-fg/40">{l.id}</span>
            </button>
          ))}
        </div>
      )}
      <button type="button" onClick={() => setNewCust({ name: q, phone: "", email: "", address: "", kind: "vehicle" })}
        className="mt-2 text-sm text-accent-fg hover:underline">+ New customer</button>
    </Group>
  );
}
