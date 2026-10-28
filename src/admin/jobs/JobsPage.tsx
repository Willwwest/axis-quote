import { useMemo, useState, type DragEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AlertTriangle, Briefcase, Building2, CalendarDays, Car, Check, Columns3, ExternalLink, Home, List, MessageSquare, Phone, Plus, Warehouse } from "lucide-react";
import { Avatar, Badge, Button, Chip, Dot, EmptyState, PageHeader, SearchInput, Segmented, Select, Table, Td, cx } from "../../components/ui";
import { addMinutes, at, dayDate, digits, money, relative, time12, today } from "../../lib/format";
import { balanceOnLead, invoiceForLead } from "../../lib/money";
import { OPEN_STATUSES, STATUSES, jobPrice, jobTitle, jobValueLabel, setStatus, statusMeta } from "../../lib/project";
import { prettyDate } from "../../lib/schedule";
import { personName, useSession } from "../../lib/session";
import { appointments, leads, staff } from "../../lib/store";
import type { Appointment, Lead, LeadStatus } from "../../lib/types";
import { Menu } from "./Menu";
import { NewJobSheet } from "./NewJobSheet";
import { kindOf, nextAppointments, people, techCanSee, type KindFilter } from "./jobUtils";

const KIND_ICON = { vehicle: Car, home: Home, business: Building2 } as const;

/** Why a job needs attention now, if it does. */
function overdue(lead: Lead, appts: Appointment[]): string | null {
  if (lead.status === "lost" || lead.status === "paid") return null;
  const missed = appts.some((a) => a.leadId === lead.id && a.status === "scheduled" && +at(a.date, addMinutes(a.start, a.durationMin)) < Date.now());
  if (missed) return "Appointment passed without check-in";
  const inv = invoiceForLead(lead.id);
  if (inv && ["sent", "viewed", "partial"].includes(inv.status) && inv.dueAt < today() && balanceOnLead(lead.id) > 0) return "Invoice past due";
  return null;
}

type Next = { label: string; tone: "accent" | "info" };
function nextLabel(lead: Lead, next: Map<string, Appointment>): Next | null {
  const a = next.get(lead.id);
  if (a) return { label: `${dayDate(a.date)} · ${time12(a.start)}`, tone: a.type === "install" ? "accent" : "info" };
  // Bookings from the customer quote app, before they become calendar appointments.
  if (lead.appointment && lead.appointment.date >= today()) return { label: `${prettyDate(lead.appointment.date, { weekday: "short", month: "short", day: "numeric" })} · ${lead.appointment.slot}`, tone: "accent" };
  return null;
}

export default function JobsPage() {
  const all = leads.use();
  const appts = appointments.use();
  staff.use();
  const session = useSession();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<"board" | "list">("board");
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"" | KindFilter>("");
  const [who, setWho] = useState("");
  const [tag, setTag] = useState("");
  const [showLost, setShowLost] = useState(false);
  const creating = params.has("new");
  const showMoney = session.can("proposals") || session.can("invoices");

  const mine = useMemo(() => (session.can("jobs.all") ? all : all.filter((l) => techCanSee(l, session.user?.id, appts))), [all, appts, session]);
  const next = useMemo(() => nextAppointments(appts), [appts]);
  const tags = useMemo(() => [...new Set(mine.flatMap((l) => l.tags ?? []))].sort(), [mine]);

  const needle = q.trim().toLowerCase();
  const phoneNeedle = digits(q);
  const shown = mine.filter((l) => {
    if (kind && kindOf(l) !== kind) return false;
    if (who && (who === "none" ? !!l.assigneeId : l.assigneeId !== who)) return false;
    if (tag && !l.tags?.includes(tag)) return false;
    if (!needle) return true;
    const hay = [l.contact.name, l.contact.email, l.id, l.title, l.city, l.address, l.vehicle?.ymm, l.vehicle?.vin, jobTitle(l)].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(needle) || (phoneNeedle.length >= 3 && digits(l.contact.phone).includes(phoneNeedle));
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const open = mine.filter((l) => OPEN_STATUSES.includes(l.status));
  const lostCount = shown.filter((l) => l.status === "lost").length;
  const cols = STATUSES.filter((s) => showLost || s.id !== "lost");
  const openJob = (l: Lead) => nav(`/admin/jobs/${l.id}`);
  const toggleNew = (on: boolean) => {
    const p = new URLSearchParams(params);
    if (on) p.set("new", "1"); else { p.delete("new"); p.delete("contact"); }
    setParams(p, { replace: true });
  };

  return (
    <div>
      <PageHeader title="Jobs"
        sub={showMoney ? `${open.length} open · ${money(open.reduce((s, l) => s + jobPrice(l), 0))} in the pipeline` : `${open.length} open`}
        actions={session.can("jobs.all") && <Button onClick={() => toggleNew(true)}><Plus size={16} /> New job</Button>} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Name, phone, vehicle, VIN or job #" className="w-full sm:w-72" />
        <Select value={kind} onChange={(e) => setKind(e.target.value as KindFilter | "")} className="!w-auto !py-2.5 text-sm" aria-label="Kind">
          <option value="">All kinds</option>
          <option value="vehicle">Automotive</option>
          <option value="home">Residential</option>
          <option value="business">Commercial</option>
        </Select>
        {session.can("jobs.all") && (
          <Select value={who} onChange={(e) => setWho(e.target.value)} className="!w-auto !py-2.5 text-sm" aria-label="Assignee">
            <option value="">Anyone</option>
            <option value="none">Unassigned</option>
            {people().map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        )}
        {tags.length > 0 && (
          <Select value={tag} onChange={(e) => setTag(e.target.value)} className="!w-auto !py-2.5 text-sm" aria-label="Tag">
            <option value="">Any tag</option>
            {tags.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        )}
        <div className="flex-1" />
        <Chip size="sm" selected={showLost} onClick={() => setShowLost(!showLost)}>Lost{lostCount ? ` · ${lostCount}` : ""}</Chip>
        <Segmented size="sm" value={view} onChange={setView} options={[
          { value: "board", label: <span className="flex items-center gap-1.5"><Columns3 size={14} /> Board</span> },
          { value: "list", label: <span className="flex items-center gap-1.5"><List size={14} /> List</span> },
        ]} />
      </div>

      {!mine.length ? (
        <EmptyState icon={<Briefcase size={36} />} title={session.can("jobs.all") ? "No jobs yet" : "No jobs assigned to you"}
          actions={session.can("jobs.all") && <Button onClick={() => toggleNew(true)}><Plus size={16} /> New job</Button>}>
          {session.can("jobs.all") ? "Quotes from the customer app land here instantly. Add walk-ins and phone calls with New job." : "Jobs show up here once you're assigned or booked on them."}
        </EmptyState>
      ) : view === "board" ? (
        <Board cols={cols} jobs={shown.filter((l) => showLost || l.status !== "lost")} next={next} appts={appts} showMoney={showMoney} onOpen={openJob} />
      ) : (
        <Table head={["Customer", "Job", "Status", "Next", "Assigned", showMoney ? "Value" : "", "Created"]}
          empty={!shown.length && <p className="py-10 text-center text-sm text-fg/45">No jobs match.</p>}>
          {shown.filter((l) => showLost || l.status !== "lost").map((l) => {
            const s = statusMeta(l.status);
            const n = nextLabel(l, next);
            return (
              <tr key={l.id} onClick={() => openJob(l)} className="cursor-pointer hover:bg-fg/[.03]">
                <Td><div className="font-medium">{l.contact.name}</div><div className="text-xs text-fg/40">{l.contact.phone}</div></Td>
                <Td><div className="max-w-[220px] truncate">{jobTitle(l)}</div><div className="font-mono text-[11px] text-fg/35">{l.id}</div></Td>
                <Td><span className="flex items-center gap-2 whitespace-nowrap"><Dot tone={s.tone} /> {s.short}</span></Td>
                <Td className="whitespace-nowrap text-fg/70">{n?.label ?? <span className="text-fg/30">—</span>}</Td>
                <Td className="whitespace-nowrap text-fg/70">{l.assigneeId ? personName(l.assigneeId) : <span className="text-fg/30">—</span>}</Td>
                <Td className="whitespace-nowrap font-display tabular-nums">{showMoney && jobValueLabel(l)}</Td>
                <Td className="whitespace-nowrap text-fg/50">{relative(l.createdAt)}</Td>
              </tr>
            );
          })}
        </Table>
      )}

      <AnimatePresence>{creating && <NewJobSheet presetContactId={params.get("contact") ?? undefined} onClose={() => toggleNew(false)} />}</AnimatePresence>
    </div>
  );
}

function Board({ cols, jobs, next, appts, showMoney, onOpen }: {
  cols: typeof STATUSES; jobs: Lead[]; next: Map<string, Appointment>; appts: Appointment[]; showMoney: boolean; onOpen: (l: Lead) => void;
}) {
  const [over, setOver] = useState<LeadStatus | null>(null);
  const drop = (e: DragEvent, status: LeadStatus) => {
    e.preventDefault();
    setOver(null);
    const lead = leads.get(e.dataTransfer.getData("text/plain"));
    if (lead) setStatus(lead, status);
  };
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
      {cols.map((s) => {
        const list = jobs.filter((l) => l.status === s.id);
        return (
          <section key={s.id} className="w-[82vw] max-w-[300px] shrink-0 snap-start sm:w-72"
            onDragOver={(e) => { e.preventDefault(); setOver(s.id); }} onDragLeave={() => setOver(null)} onDrop={(e) => drop(e, s.id)}>
            <h3 className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold">
              <Dot tone={s.tone} /> <span className="truncate">{s.short}</span>
              <span className="text-xs font-normal text-fg/40">{list.length}</span>
              {showMoney && list.length > 0 && <span className="ml-auto text-xs font-normal tabular-nums text-fg/40">{money(list.reduce((t, l) => t + jobPrice(l), 0))}</span>}
            </h3>
            <div className={cx("min-h-[140px] space-y-2 rounded-2xl p-2 transition", over === s.id ? "bg-accent/10 ring-1 ring-accent/40" : "bg-fg/[.025]")}>
              {list.map((l) => <JobCard key={l.id} lead={l} next={nextLabel(l, next)} late={overdue(l, appts)} showMoney={showMoney} onOpen={() => onOpen(l)} />)}
              {!list.length && <p className="px-2 py-6 text-center text-xs text-fg/30">{s.label}</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function JobCard({ lead, next, late, showMoney, onOpen }: { lead: Lead; next: Next | null; late: string | null; showMoney: boolean; onOpen: () => void }) {
  const Icon = KIND_ICON[kindOf(lead)];
  const phone = digits(lead.contact.phone);
  return (
    <div role="button" tabIndex={0} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", lead.id)}
      onClick={onOpen} onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className="block w-full cursor-pointer rounded-xl border border-fg/10 bg-surface p-3 text-left transition hover:border-fg/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{lead.contact.name || "No name"}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-fg/50"><Icon size={12} className="shrink-0" /> <span className="truncate">{jobTitle(lead)}</span></div>
        </div>
        {showMoney && <span className="shrink-0 font-display text-sm font-semibold tabular-nums">{jobValueLabel(lead)}</span>}
        <Menu label="Job actions" className="-mr-1.5 -mt-1" items={[
          { label: "Open job", icon: <ExternalLink size={15} />, onSelect: onOpen },
          !!phone && { label: "Call", icon: <Phone size={15} />, onSelect: () => { window.location.href = `tel:${phone}`; } },
          !!phone && { label: "Text", icon: <MessageSquare size={15} />, onSelect: () => { window.location.href = `sms:${phone}`; } },
          ...STATUSES.map((s, i) => ({
            label: <span className="flex items-center gap-2"><Dot tone={s.tone} /> {s.label}</span>,
            icon: lead.status === s.id ? <Check size={15} /> : <span className="inline-block w-[15px]" />,
            onSelect: () => setStatus(lead, s.id),
            divide: i === 0,
          })),
        ]} />
      </div>
      {(next || late || lead.garage === "no" || lead.assigneeId || lead.tags?.length) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {next && <Badge tone={next.tone} icon={<CalendarDays size={11} />}>{next.label}</Badge>}
          {late && <Badge tone="danger" icon={<AlertTriangle size={11} />} className="cursor-help"><span title={late}>Overdue</span></Badge>}
          {lead.kind === "vehicle" && lead.garage === "no" && <Badge tone="warn" icon={<Warehouse size={11} />}>No garage</Badge>}
          {lead.tags?.slice(0, 2).map((t) => <Badge key={t}>{t}</Badge>)}
          {lead.assigneeId && <span className="ml-auto" title={personName(lead.assigneeId)}><Avatar name={personName(lead.assigneeId)} color={people().find((p) => p.id === lead.assigneeId)?.color} size={20} /></span>}
        </div>
      )}
    </div>
  );
}
