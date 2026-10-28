import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { CalendarDays, Car, LogIn, LogOut, MapPin, Navigation, Pencil, Plus } from "lucide-react";
import { APPT_STATUSES, checkIn, checkOut, typeMeta } from "../../admin/calendar/actions";
import { AppointmentSheet } from "../../admin/calendar/AppointmentSheet";
import { addMinutes, at, dayDate, time12 } from "../../lib/format";
import { fill, leadContext, reach, sendSms } from "../../lib/messages";
import { apptAddress, mapsUrl } from "../../lib/schedule";
import { personName, useSession } from "../../lib/session";
import { appointments, useSettings } from "../../lib/store";
import type { Appointment, Lead } from "../../lib/types";
import { Badge, Button, Card, CardHeader, IconButton, cx } from "../ui";

/** The job's appointments, upcoming first, with quick check-in/out and the "on my way" / "ready" texts. */
export function AppointmentsCard({ lead }: { lead: Lead }) {
  const s = useSettings();
  const { can, user } = useSession();
  const all = appointments.use();
  const [editing, setEditing] = useState<{ appt?: Appointment } | null>(null);
  const now = Date.now();
  const mine = all.filter((a) => a.leadId === lead.id && (can("calendar.all") || a.assigneeId === user?.id));
  const end = (a: Appointment) => +at(a.date, a.start) + a.durationMin * 60_000;
  const upcoming = mine.filter((a) => end(a) >= now && a.status !== "cancelled").sort((x, y) => (x.date + x.start).localeCompare(y.date + y.start));
  const past = mine.filter((a) => !upcoming.includes(a)).sort((x, y) => (y.date + y.start).localeCompare(x.date + x.start));
  const next = upcoming[0];
  const r = reach(lead);
  const phone = r.smsOk ? r.phone : "";

  const text = (key: "onMyWay" | "vehicleReady") =>
    phone && sendSms(phone, fill(s.templates[key], leadContext(lead, next ? { appointment: next } : {})), key, lead.id);

  return (
    <Card>
      <CardHeader
        title="Appointments"
        icon={<CalendarDays size={16} />}
        sub={next ? `Next: ${dayDate(next.date)} at ${time12(next.start)}` : "Nothing scheduled"}
        actions={<Button size="sm" variant="outline" onClick={() => setEditing({})}><Plus size={14} /> New</Button>}
      />

      {phone && (
        <div className="mb-3 flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => text("onMyWay")}><Navigation size={14} /> On my way</Button>
          {lead.kind === "vehicle" && <Button size="sm" variant="ghost" onClick={() => text("vehicleReady")}><Car size={14} /> Vehicle ready</Button>}
        </div>
      )}

      {mine.length === 0 ? (
        <p className="rounded-xl border border-dashed border-fg/10 px-4 py-3 text-sm text-fg/45">No appointments yet. Book a consult or install.</p>
      ) : (
        <div className="divide-y divide-fg/5">
          {[...upcoming, ...past].map((a) => <Row key={a.id} a={a} past={!upcoming.includes(a)} onEdit={() => setEditing({ appt: a })} />)}
        </div>
      )}

      <AnimatePresence>
        {editing && (
          <AppointmentSheet key={editing.appt?.id ?? "new"} appt={editing.appt} onClose={() => setEditing(null)}
            initial={{ leadId: lead.id, contactId: lead.contactId, type: ["new", "consult"].includes(lead.status) && lead.kind !== "vehicle" ? "consult" : "install", assigneeId: lead.assigneeId }} />
        )}
      </AnimatePresence>
    </Card>
  );
}

function Row({ a, past, onEdit }: { a: Appointment; past: boolean; onEdit: () => void }) {
  const addr = apptAddress(a);
  const st = APPT_STATUSES[a.status];
  return (
    <div className={cx("flex items-start gap-3 py-2.5", past && "opacity-60")}>
      <div className="w-14 shrink-0 text-center">
        <div className="text-[11px] uppercase tracking-wider text-fg/45">{dayDate(a.date).split(",")[0]}</div>
        <div className="font-display text-sm font-semibold tabular-nums">{dayDate(a.date).split(", ")[1]}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cx("truncate text-sm font-medium", a.status === "cancelled" && "line-through")}>{a.title}</span>
          <Badge tone={typeMeta(a.type).tone}>{typeMeta(a.type).label}</Badge>
          {a.status !== "scheduled" && <Badge tone={st.tone}>{st.label}</Badge>}
        </div>
        <div className="mt-0.5 text-xs text-fg/50">{time12(a.start)}–{time12(addMinutes(a.start, a.durationMin))} · {personName(a.assigneeId)}</div>
        {addr && <a href={mapsUrl(addr)} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex max-w-full items-center gap-1 text-xs text-fg/45 hover:text-fg"><MapPin size={11} className="shrink-0" /><span className="truncate">{addr}</span></a>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {a.status === "scheduled" && !past && <Button size="sm" variant="outline" onClick={() => checkIn(a)}><LogIn size={13} /> In</Button>}
        {a.status === "checked_in" && <Button size="sm" onClick={() => checkOut(a)}><LogOut size={13} /> Out</Button>}
        <IconButton label="Edit appointment" onClick={onEdit}><Pencil size={15} /></IconButton>
      </div>
    </div>
  );
}
