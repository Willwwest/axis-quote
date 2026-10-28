import type { Tone } from "../../components/ui";
import { addDays, dayDate, time12 } from "../../lib/format";
import { notify } from "../../lib/notify";
import { setStatus } from "../../lib/project";
import { getSession, personName } from "../../lib/session";
import { appointments, leads, newId } from "../../lib/store";
import type { Appointment, AppointmentStatus, AppointmentType, LeadStatus } from "../../lib/types";

export const TYPES: { id: AppointmentType; label: string; tone: Tone }[] = [
  { id: "consult", label: "Consult", tone: "info" },
  { id: "install", label: "Install", tone: "accent" },
  { id: "misc", label: "Other", tone: "neutral" },
];
export const typeMeta = (t: AppointmentType) => TYPES.find((x) => x.id === t) ?? TYPES[2];

export const APPT_STATUSES: Record<AppointmentStatus, { label: string; tone: Tone }> = {
  scheduled: { label: "Scheduled", tone: "neutral" },
  checked_in: { label: "Checked in", tone: "warn" },
  done: { label: "Done", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  no_show: { label: "No-show", tone: "danger" },
};

/** Block styles per type, all from tokens. Cancelled events are dimmed by the caller. */
export const TYPE_BLOCK: Record<AppointmentType, string> = {
  consult: "border-info/50 bg-info/15 text-fg",
  install: "border-accent/60 bg-accent/20 text-fg",
  misc: "border-fg/20 bg-fg/10 text-fg",
};

const entry = (text: string) => ({ at: new Date().toISOString(), text, by: getSession().user?.id });
const withLog = (a: Appointment, text: string): Appointment => ({ ...a, history: [...(a.history ?? []), entry(text)] });

export const when = (a: Pick<Appointment, "date" | "start">) => `${dayDate(a.date)} ${time12(a.start)}`;
const href = (a: Appointment) => (a.leadId ? `/admin/jobs/${a.leadId}` : `/admin/calendar?d=${a.date}`);

const ORDER: LeadStatus[] = ["new", "consult", "proposal", "approved", "booked"];

/** Booking an install moves the job to "booked"; a consult moves a new lead to "consult". */
function advanceJob(a: Appointment) {
  const lead = leads.get(a.leadId);
  if (!lead) return;
  if (a.type === "install" && ORDER.indexOf(lead.status) >= 0 && ORDER.indexOf(lead.status) < ORDER.indexOf("booked")) setStatus(lead, "booked");
  else if (a.type === "consult" && lead.status === "new") setStatus(lead, "consult");
}

export function blankAppointment(p: Partial<Appointment> = {}): Appointment {
  return { id: newId("AP"), type: "install", title: "", date: "", start: "09:00", durationMin: 120, notifyCustomer: true, status: "scheduled", ...p };
}

/** Creates one appointment, or a weekly series sharing a seriesId. */
export function createAppointment(a: Appointment, repeat?: { everyWeeks: number; count: number }) {
  const count = repeat && repeat.count > 1 ? repeat.count : 1;
  const seriesId = count > 1 ? newId("SR") : undefined;
  const list = Array.from({ length: count }, (_, i) => withLog({
    ...a,
    id: i === 0 ? a.id : newId("AP"),
    date: addDays(a.date, i * 7 * (repeat?.everyWeeks ?? 1)),
    recurrence: seriesId ? { everyWeeks: repeat!.everyWeeks, count, seriesId } : undefined,
    remindersSent: {},
    history: [],
  }, count > 1 ? `Booked (${i + 1} of ${count})` : "Booked"));
  appointments.saveMany(list);
  advanceJob(a);
  notify("appointment", `${typeMeta(a.type).label} booked: ${a.title} · ${when(a)}${count > 1 ? ` (+${count - 1} repeats)` : ""}`, href(a));
  return list[0];
}

/** Plain-English list of what changed, for the history log. */
function describe(prev: Appointment, next: Appointment) {
  const out: string[] = [];
  if (prev.date !== next.date || prev.start !== next.start) out.push(`Moved to ${when(next)}`);
  if (prev.durationMin !== next.durationMin) out.push(`Duration ${next.durationMin / 60}h`);
  if (prev.assigneeId !== next.assigneeId) out.push(`Assigned to ${personName(next.assigneeId)}`);
  if (prev.type !== next.type) out.push(`Type ${typeMeta(next.type).label}`);
  if (prev.title !== next.title) out.push(`Title "${next.title}"`);
  if (prev.leadId !== next.leadId) out.push("Job changed");
  if ((prev.notes ?? "") !== (next.notes ?? "")) out.push("Notes edited");
  if (prev.notifyCustomer !== next.notifyCustomer) out.push(next.notifyCustomer ? "Customer messages on" : "Customer messages off");
  return out.join(" · ");
}

/** Saves edits to one appointment or every upcoming one in its series. */
export function updateAppointment(prev: Appointment, next: Appointment, scope: "one" | "series" = "one") {
  const moved = prev.date !== next.date || prev.start !== next.start;
  const fix = (a: Appointment, n: Appointment) => {
    const text = describe(a, n);
    // A new time needs a fresh confirmation and reminders.
    const reminders = a.date !== n.date || a.start !== n.start ? {} : n.remindersSent;
    return text ? withLog({ ...n, remindersSent: reminders }, text) : n;
  };
  if (scope === "series" && prev.recurrence) {
    const shift = Math.round((+new Date(next.date) - +new Date(prev.date)) / 86_400_000);
    const rest = appointments.all().filter((a) => a.recurrence?.seriesId === prev.recurrence!.seriesId && a.id !== prev.id && a.date >= prev.date && a.status === "scheduled");
    appointments.saveMany([fix(prev, next), ...rest.map((a) => fix(a, {
      ...a, title: next.title, type: next.type, start: next.start, durationMin: next.durationMin, assigneeId: next.assigneeId,
      notes: next.notes, notifyCustomer: next.notifyCustomer, leadId: next.leadId, contactId: next.contactId, date: addDays(a.date, shift),
    }))]);
  } else {
    appointments.save(fix(prev, next));
  }
  advanceJob(next);
  if (moved || prev.assigneeId !== next.assigneeId) notify("appointment", `Rescheduled: ${next.title} · ${when(next)}`, href(next));
}

export const seriesOf = (a: Appointment) =>
  a.recurrence ? appointments.all().filter((x) => x.recurrence?.seriesId === a.recurrence!.seriesId).sort((x, y) => (x.date + x.start).localeCompare(y.date + y.start)) : [a];

export function checkIn(a: Appointment) {
  appointments.save(withLog({ ...a, status: "checked_in", checkInAt: new Date().toISOString() }, "Checked in"));
  notify("appointment", `${personName(getSession().user?.id)} checked in · ${a.title}`, href(a));
}

export function checkOut(a: Appointment) {
  appointments.save(withLog({ ...a, status: "done", checkOutAt: new Date().toISOString() }, "Checked out"));
  notify("appointment", `${personName(getSession().user?.id)} checked out · ${a.title}`, href(a));
}

export const noShow = (a: Appointment) => appointments.save(withLog({ ...a, status: "no_show" }, "Marked no-show"));
export const reopen = (a: Appointment) => appointments.save(withLog({ ...a, status: "scheduled", checkInAt: undefined, checkOutAt: undefined }, "Reopened"));

/**
 * Cancels one or the rest of the series. With `tellCustomer` the cancellation notice is queued in the outbox;
 * without it customer messages are switched off so nothing goes out.
 */
export function cancelAppointment(a: Appointment, opts: { tellCustomer: boolean; scope?: "one" | "series"; by?: string; reason?: string }) {
  const list = opts.scope === "series" ? seriesOf(a).filter((x) => x.date >= a.date && x.status === "scheduled") : [a];
  const text = `Cancelled${opts.by ? ` by ${opts.by}` : ""}${opts.reason ? `: ${opts.reason}` : ""}`;
  appointments.saveMany(list.map((x) => withLog({ ...x, status: "cancelled", notifyCustomer: x.notifyCustomer && opts.tellCustomer }, text)));
  notify("appointment", `Cancelled${opts.by ? ` by ${opts.by}` : ""}: ${a.title} · ${when(a)}${list.length > 1 ? ` (+${list.length - 1} more)` : ""}`, href(a));
}

export function deleteAppointment(a: Appointment, scope: "one" | "series" = "one") {
  (scope === "series" ? seriesOf(a).filter((x) => x.date >= a.date) : [a]).forEach((x) => appointments.remove(x.id));
}
