import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { CalendarDays, Check, ChevronRight, DollarSign, Hand, Layers, Plus, Send, UserPlus } from "lucide-react";
import { Avatar, Badge, Button, Card, CardHeader, Kpi, PageHeader, Tabs, cx } from "../components/ui";
import { feet, inchesLeft, rollHealth } from "../lib/film";
import { addDays, dayDate, firstName, money, relative, time12, today } from "../lib/format";
import { collectedBetween, receivables } from "../lib/money";
import { OUTBOX_LABELS, useOutbox } from "../lib/outbox";
import { jobTitle, jobValueLabel } from "../lib/project";
import { personName, useSession } from "../lib/session";
import {
  appointments, contacts, filmLog, invoices, leads, messages, notes, payments, proposals, reviews, rolls, useSettings,
} from "../lib/store";
import type { Appointment } from "../lib/types";
import { monthRange, weekRange, type Range } from "./analytics/range";
import { scope, segment, type NumberSeg } from "./analytics/segments";
import { AddContactSheet, NewJobSheet } from "./contacts/ContactForm";
import { assignTask, colorOf, excerpt, isOpenTask, noteHref, setTaskDone, unreadReplies } from "./tasks/notes";

type Widget = "leads" | "mine" | "pending" | "replies";

const TYPE_TONE: Record<Appointment["type"], "info" | "accent" | "neutral"> = { consult: "info", install: "accent", misc: "neutral" };
const TYPE_LABEL: Record<Appointment["type"], string> = { consult: "Consult", install: "Install", misc: "Other" };

export default function DashboardPage() {
  const session = useSession();
  const me = session.user?.id ?? "";
  const { calendar } = useSettings();
  const all = {
    leads: leads.use(), appts: appointments.use(), proposals: proposals.use(), invoices: invoices.use(), payments: payments.use(), messages: messages.use(),
    reviews: reviews.use(), contacts: contacts.use(), filmLog: filmLog.use(), rolls: rolls.use(), notes: notes.use(),
  };
  const outbox = useOutbox();
  const [sheet, setSheet] = useState<"contact" | "job" | null>(null);
  const [tab, setTab] = useState<Widget>("leads");
  const money$ = session.can("invoices") || session.can("payments");
  const t = today();

  const kpis = useMemo(() => {
    const data = scope(all, "all");
    const week = weekRange(t, calendar.weekStart);
    const last: Range = { from: addDays(week.from, -7), to: addDays(week.to, -7) };
    const month = monthRange(t);
    const mtd: Range = { from: month.from, to: t };
    const calc = (id: string, monthly: Range) => {
      const s = segment(id) as NumberSeg;
      const v = (r: Range) => s.value(data, r.from, r.to) ?? 0;
      return { now: v(week), last: v(last), month: v(monthly), fmt: s.fmt };
    };
    return [
      { label: "Leads added", ...calc("newLeads", mtd), monthLabel: "Month to date" },
      { label: "Consults scheduled", ...calc("consultsScheduled", mtd), monthLabel: "Month to date" },
      { label: "Installs scheduled", ...calc("installsScheduled", mtd), monthLabel: "Month to date" },
      ...(money$ ? [{ label: "Amount scheduled", ...calc("amountScheduled", month), monthLabel: "This month" }] : []),
    ];
  }, [all.leads, all.appts, t, calendar.weekStart, money$]);

  const fresh = useMemo(() => all.leads.filter((l) => l.status === "new").sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [all.leads]);
  const mine = useMemo(() => all.notes.filter((n) => isOpenTask(n) && n.task!.assigneeId === me).sort((a, b) => (a.task!.due ?? "9").localeCompare(b.task!.due ?? "9")), [all.notes, me]);
  const pending = useMemo(() => all.notes.filter((n) => isOpenTask(n) && !n.task!.assigneeId), [all.notes]);
  const replies = useMemo(() => all.notes.filter((n) => unreadReplies(n, me) > 0), [all.notes, me]);
  const todays = useMemo(() => all.appts.filter((a) => a.date === t).sort((a, b) => a.start.localeCompare(b.start)), [all.appts, t]);
  const low = useMemo(() => all.rolls.filter((r) => r.status !== "lost").map((r) => ({ r, left: inchesLeft(r, all.filmLog) })).filter(({ r, left }) => rollHealth(r, left) !== "ok").sort((a, b) => a.left - b.left), [all.rolls, all.filmLog]);
  const cash = useMemo(() => ({ ...receivables(all.invoices, all.payments), collected: collectedBetween(monthRange(t).from, t, all.payments) }), [all.invoices, all.payments, t]);

  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div>
      <PageHeader eyebrow={dayDate(t).replace(",", "")} title={`${hello}, ${firstName(session.user?.name ?? "") || "crew"}`}
        actions={<>
          {session.can("contacts") && <Button variant="outline" onClick={() => setSheet("contact")}><UserPlus size={16} /> Add contact (lead)</Button>}
          {session.can("jobs") && <Button onClick={() => setSheet("job")}><Plus size={16} /> New job</Button>}
        </>} />

      <div className={cx("mb-6 grid grid-cols-2 gap-3", kpis.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
        {kpis.map((k) => {
          const f = (n: number) => (k.fmt === "money" ? money(n) : String(n));
          return <Kpi key={k.label} label={`${k.label} · this week`} value={f(k.now)} delta={k.last ? ((k.now - k.last) / k.last) * 100 : null}
            sub={<>Last week {f(k.last)}<br className="sm:hidden" /><span className="hidden sm:inline"> · </span>{k.monthLabel} {f(k.month)}</>} />;
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card>
            <Tabs value={tab} onChange={setTab} tabs={[
              { id: "leads", label: "New leads", count: fresh.length },
              { id: "mine", label: "Your tasks", count: mine.length },
              { id: "pending", label: "Pending tasks", count: pending.length },
              { id: "replies", label: "Unread replies", count: replies.length },
            ]} />
            {tab === "leads" && (
              <Rows empty="No new leads waiting." more={fresh.length > 6 ? { to: "/admin/jobs", label: `All ${fresh.length} new leads` } : undefined}>
                {fresh.slice(0, 6).map((l) => (
                  <Row key={l.id} to={`/admin/jobs/${l.id}`} lead={<Avatar name={l.contact.name} size={32} />} title={l.contact.name} sub={`${jobTitle(l)} · ${relative(l.createdAt)}`}
                    end={money$ ? <span className="font-display text-sm tabular-nums text-fg/70">{jobValueLabel(l)}</span> : undefined} />
                ))}
              </Rows>
            )}
            {tab === "mine" && (
              <Rows empty="Nothing assigned to you." more={{ to: "/admin/tasks", label: "All tasks" }}>
                {mine.slice(0, 6).map((n) => (
                  <Row key={n.id} to={noteHref(n)} title={excerpt(n.body, 80)} sub={taskSub(n.leadId, n.task!.due)}
                    lead={<button type="button" aria-label="Close task" onClick={() => setTaskDone(n, true)} className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-fg/20 text-transparent transition hover:border-success hover:text-success"><Check size={14} /></button>} />
                ))}
              </Rows>
            )}
            {tab === "pending" && (
              <Rows empty="No unassigned tasks." more={{ to: "/admin/tasks?tab=pending", label: "Pending pool" }}>
                {pending.slice(0, 6).map((n) => (
                  <Row key={n.id} to={noteHref(n)} title={excerpt(n.body, 80)} sub={`From ${personName(n.authorId)} · ${taskSub(n.leadId, n.task!.due)}`}
                    end={<Button size="sm" variant="outline" onClick={() => assignTask(n, me, me)}><Hand size={14} /> Take</Button>} />
                ))}
              </Rows>
            )}
            {tab === "replies" && (
              <Rows empty="You're all caught up.">
                {replies.slice(0, 6).map((n) => {
                  const unread = n.replies.filter((x) => x.authorId !== me && !x.readBy.includes(me));
                  const r = unread[unread.length - 1];
                  return <Row key={n.id} to={n.leadId ? noteHref(n) : `/admin/tasks?tab=notes&note=${n.id}`} lead={<Avatar name={personName(r.authorId)} color={colorOf(r.authorId)} size={32} />}
                    title={`${personName(r.authorId)}: ${excerpt(r.body, 70)}`} sub={`On “${excerpt(n.body, 40)}” · ${relative(r.at)}`} end={<Badge tone="accent">{unreadReplies(n, me)}</Badge>} />;
                })}
              </Rows>
            )}
          </Card>

          <Card>
            <CardHeader title="Today's schedule" icon={<CalendarDays size={16} />} sub={`${todays.filter((a) => a.status !== "cancelled").length} appointment${todays.length === 1 ? "" : "s"}`}
              actions={session.can("calendar") && <Link to="/admin/calendar" className="text-sm text-fg/50 hover:text-fg">Calendar →</Link>} />
            {!todays.length ? <p className="py-4 text-sm text-fg/45">Nothing booked today.</p> : (
              <ul className="-mx-2 divide-y divide-fg/5">
                {todays.map((a) => (
                  <li key={a.id}>
                    <Link to={a.leadId ? `/admin/jobs/${a.leadId}` : "/admin/calendar"} className={cx("flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-fg/[.04]", a.status === "cancelled" && "opacity-50")}>
                      <span className="w-16 shrink-0 font-display text-sm tabular-nums text-fg/70">{time12(a.start)}</span>
                      <Badge tone={TYPE_TONE[a.type]}>{TYPE_LABEL[a.type]}</Badge>
                      <span className={cx("min-w-0 flex-1 truncate text-sm", a.status === "cancelled" && "line-through")}>{a.title}</span>
                      {a.status === "checked_in" && <Badge tone="success">On site</Badge>}
                      {a.status === "done" && <Badge tone="neutral">Done</Badge>}
                      <Avatar name={personName(a.assigneeId)} color={colorOf(a.assigneeId)} size={24} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          {session.can("messages") && (
            <Card tone={outbox.length ? "accent" : undefined}>
              <CardHeader title="Outbox" icon={<Send size={16} />} actions={<Link to="/admin/messages" className="text-sm text-fg/50 hover:text-fg">Open →</Link>} />
              <Link to="/admin/messages" className="block">
                <div className="font-display text-3xl font-semibold">{outbox.length}</div>
                <div className="text-sm text-fg/55">{outbox.length === 1 ? "message" : "messages"} to send</div>
              </Link>
              {outbox.length > 0 && (
                <ul className="mt-3 space-y-1.5 text-sm">
                  {outbox.slice(0, 3).map((i) => <li key={i.id} className="flex justify-between gap-3"><span className="truncate text-fg/75">{i.name}</span><span className="shrink-0 text-xs text-fg/45">{OUTBOX_LABELS[i.kind]}</span></li>)}
                </ul>
              )}
            </Card>
          )}

          {money$ && (
            <Card>
              <CardHeader title="Money" icon={<DollarSign size={16} />} actions={session.can("invoices") && <Link to="/admin/invoices" className="text-sm text-fg/50 hover:text-fg">Invoices →</Link>} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="font-display text-2xl font-semibold">{money(cash.awaiting)}</div>
                  <div className="text-xs text-fg/50">Awaiting payment · {cash.open} invoice{cash.open === 1 ? "" : "s"}</div>
                  {cash.late > 0 && <div className="mt-1 text-xs font-medium text-danger">{money(cash.pastDue)} past due ({cash.late})</div>}
                </div>
                <div>
                  <div className="font-display text-2xl font-semibold">{money(cash.collected)}</div>
                  <div className="text-xs text-fg/50">Collected this month</div>
                </div>
              </div>
            </Card>
          )}

          {session.can("inventory") && (
            <Card tone={low.length ? "warn" : undefined}>
              <CardHeader title="Film stock" icon={<Layers size={16} />} actions={<Link to="/admin/inventory" className="text-sm text-fg/50 hover:text-fg">Inventory →</Link>} />
              {!all.rolls.length ? <p className="text-sm text-fg/45">No rolls added yet.</p> : !low.length ? <p className="text-sm text-fg/55">Every roll is above its low-stock line.</p> : (
                <ul className="space-y-2">
                  {low.map(({ r, left }) => (
                    <li key={r.id}>
                      <Link to="/admin/inventory" className="flex items-center justify-between gap-3 text-sm hover:text-fg">
                        <span className="min-w-0 truncate"><span className="text-fg/45 tabular-nums">{r.code ?? ""}</span> {r.name}</span>
                        <Badge tone={left <= 0 ? "danger" : "warn"}>{left <= 0 ? "Empty" : `${feet(left)} left`}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      </div>

      <AnimatePresence>
        {sheet === "contact" && <AddContactSheet key="c" onClose={() => setSheet(null)} />}
        {sheet === "job" && <NewJobSheet key="j" onClose={() => setSheet(null)} />}
      </AnimatePresence>
    </div>
  );
}

function taskSub(leadId: string | undefined, due: string | undefined) {
  const l = leads.get(leadId);
  return [l ? `${l.contact.name} · ${jobTitle(l)}` : "No job", due && (due < today() ? `Overdue ${dayDate(due)}` : due === today() ? "Due today" : `Due ${dayDate(due)}`)].filter(Boolean).join(" · ");
}

function Rows({ children, empty, more }: { children: ReactNode[]; empty: string; more?: { to: string; label: string } }) {
  if (!children.length) return <p className="py-6 text-center text-sm text-fg/45">{empty}</p>;
  return (
    <>
      <ul className="-mx-2 divide-y divide-fg/5">{children}</ul>
      {more && <Link to={more.to} className="mt-2 block text-center text-sm text-fg/50 hover:text-fg">{more.label} →</Link>}
    </>
  );
}

/** One list row: the middle opens the record; leading/trailing controls sit outside the link. */
function Row({ to, lead, title, sub, end }: { to: string; lead?: ReactNode; title: ReactNode; sub: ReactNode; end?: ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-lg px-2 py-1 hover:bg-fg/[.04]">
      {lead}
      <Link to={to} className="flex min-w-0 flex-1 items-center gap-3 py-1.5">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{title}</div>
          <div className="truncate text-xs text-fg/45">{sub}</div>
        </div>
        {!end && <ChevronRight size={16} className="shrink-0 text-fg/25" />}
      </Link>
      {end}
    </li>
  );
}

