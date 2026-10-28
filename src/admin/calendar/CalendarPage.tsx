import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight, Lock, MapPin, Navigation, Plus, Route as RouteIcon, SlidersHorizontal, Unlock } from "lucide-react";
import { Avatar, Badge, Button, Card, Chip, EmptyState, IconButton, Input, PageHeader, Segmented, Toggle, cx } from "../../components/ui";
import { REGIONS } from "../../data/config";
import { addDays, addMinutes, dayDate, shortDate, time12, today } from "../../lib/format";
import { apptAddress, mapsUrl, parseIso, prettyDate, routeUrl, weekOf } from "../../lib/schedule";
import { personName, useSession } from "../../lib/session";
import { appointments, contacts, leads, patchSettings, useSettings } from "../../lib/store";
import type { Appointment, AppointmentType, Lead } from "../../lib/types";
import { APPT_STATUSES, TYPES, TYPE_BLOCK, typeMeta } from "./actions";
import { AppointmentSheet, useTeam } from "./AppointmentSheet";

type View = "agenda" | "day" | "week";
type KindF = "auto" | "flat" | "mobile";

const KINDS: { id: KindF; label: string; match: (l: Lead) => boolean }[] = [
  { id: "auto", label: "Auto", match: (l) => l.kind === "vehicle" },
  { id: "flat", label: "Flat glass", match: (l) => l.kind !== "vehicle" },
  { id: "mobile", label: "Auto · mobile", match: (l) => l.kind === "vehicle" && (!!l.address || !!l.region) },
];

const HOUR = 56;
const PREFS = "axis.calendar.prefs";
function readPrefs(): { view?: View; cancelled?: boolean } {
  try { return JSON.parse(localStorage.getItem(PREFS) || "{}"); } catch { return {}; }
}
function savePrefs(p: { view?: View; cancelled?: boolean }) {
  try { localStorage.setItem(PREFS, JSON.stringify({ ...readPrefs(), ...p })); } catch { /* private mode */ }
}

const byTime = (a: Appointment, b: Appointment) => (a.date + a.start).localeCompare(b.date + b.start);
const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
const customer = (a: Appointment) => leads.get(a.leadId)?.contact.name ?? contacts.get(a.contactId)?.name ?? "";
const regionTags = (date: string, days: Record<string, number[]>) =>
  REGIONS.filter((r) => r.id !== "other" && days[r.id]?.includes(parseIso(date).getDay())).map((r) => (r.id === "quad" ? "PRE" : "PHX"));

export default function CalendarPage() {
  const s = useSettings();
  const session = useSession();
  const all = appointments.use();
  const allLeads = leads.use();
  const team = useTeam();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<View>(() => readPrefs().view ?? (window.innerWidth < 768 ? "agenda" : "week"));
  const [showCancelled, setShowCancelled] = useState(() => readPrefs().cancelled ?? true);
  const [types, setTypes] = useState<AppointmentType[]>([]);
  const [kinds, setKinds] = useState<KindF[]>([]);
  const [members, setMembers] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editing, setEditing] = useState<{ appt?: Appointment; initial?: Partial<Appointment> } | null>(null);
  useEffect(() => savePrefs({ view, cancelled: showCancelled }), [view, showCancelled]);

  const date = params.get("d") || today();
  const setDate = (d: string) => setParams((p) => { p.set("d", d); return p; }, { replace: true });
  const mineOnly = !session.can("calendar.all");
  const canBlock = session.can("settings");

  const visible = useMemo(() => {
    const byId = new Map(allLeads.map((l) => [l.id, l]));
    return all.filter((a) => {
      if (mineOnly && a.assigneeId !== session.user?.id) return false;
      if (!showCancelled && a.status === "cancelled") return false;
      if (types.length && !types.includes(a.type)) return false;
      if (members.length && !members.includes(a.assigneeId ?? "")) return false;
      if (kinds.length) {
        const l = byId.get(a.leadId ?? "");
        if (!l || !KINDS.some((k) => kinds.includes(k.id) && k.match(l))) return false;
      }
      return true;
    }).sort(byTime);
  }, [all, allLeads, mineOnly, session.user?.id, showCancelled, types, members, kinds]);

  const range = view === "day" ? [date] : view === "week" ? weekOf(date, s.calendar.weekStart) : Array.from({ length: 14 }, (_, i) => addDays(date, i));
  const step = view === "day" ? 1 : 7;
  const inRange = visible.filter((a) => a.date >= range[0] && a.date <= range[range.length - 1]);
  const label = view === "day" ? prettyDate(date) : view === "week" ? `${shortDate(range[0])} – ${shortDate(range[6])}` : `${dayDate(range[0])} onward`;
  const filterCount = types.length + kinds.length + members.length + (showCancelled ? 0 : 1);

  const toggleBlock = (d: string) => patchSettings((x) => ({ blockedDates: x.blockedDates.includes(d) ? x.blockedDates.filter((b) => b !== d) : [...x.blockedDates, d].sort() }));
  const openNew = (initial: Partial<Appointment> = {}) => setEditing({ initial: { date, ...initial } });
  const open = (a: Appointment) => setEditing({ appt: a });

  const dayStops = (d: string) => [...new Set(visible.filter((a) => a.date === d && a.status !== "cancelled").map(apptAddress).filter(Boolean))];

  return (
    <div>
      <PageHeader
        title="Calendar"
        sub={`${inRange.filter((a) => a.status !== "cancelled").length} appointments · ${label}${mineOnly ? " · just yours" : ""}`}
        actions={<>
          <Link to={`/admin/routes?d=${date}`}><Button variant="outline" tabIndex={-1}><RouteIcon size={16} /> Routes</Button></Link>
          <Button onClick={() => openNew()}><Plus size={16} /> New appointment</Button>
        </>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented value={view} onChange={setView} options={[{ value: "agenda", label: "Agenda" }, { value: "day", label: "Day" }, { value: "week", label: "Week" }]} />
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => setDate(today())}>Today</Button>
          <IconButton label="Previous" onClick={() => setDate(addDays(date, -step))}><ChevronLeft size={18} /></IconButton>
          <IconButton label="Next" onClick={() => setDate(addDays(date, step))}><ChevronRight size={18} /></IconButton>
          <Input type="date" aria-label="Go to date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="!w-auto !py-1.5 text-sm" />
        </div>
        <div className="flex-1" />
        {view === "day" && dayStops(date).length > 0 && (
          <Button size="sm" variant="outline" onClick={() => window.open(routeUrl(dayStops(date)), "_blank")}><Navigation size={14} /> Route ({dayStops(date).length})</Button>
        )}
        <Button size="sm" variant={filterCount ? "primary" : "outline"} onClick={() => setFiltersOpen(!filtersOpen)}>
          <SlidersHorizontal size={14} /> Filters{filterCount ? ` · ${filterCount}` : ""}
        </Button>
      </div>

      {filtersOpen && (
        <Card className="mb-4 space-y-3">
          <FilterRow label="Type">
            {TYPES.map((t) => <Chip key={t.id} size="sm" selected={types.includes(t.id)} onClick={() => setTypes(toggle(types, t.id))}>{t.label}</Chip>)}
          </FilterRow>
          <FilterRow label="Job">
            {KINDS.map((k) => <Chip key={k.id} size="sm" selected={kinds.includes(k.id)} onClick={() => setKinds(toggle(kinds, k.id))}>{k.label}</Chip>)}
          </FilterRow>
          {!mineOnly && (
            <FilterRow label="Team">
              {team.map((m) => <Chip key={m.id} size="sm" selected={members.includes(m.id)} onClick={() => setMembers(toggle(members, m.id))}>{m.name}</Chip>)}
              <Chip size="sm" selected={members.includes("")} onClick={() => setMembers(toggle(members, ""))}>Unassigned</Chip>
            </FilterRow>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-fg/10 pt-2">
            <div className="w-full max-w-xs"><Toggle checked={showCancelled} onChange={setShowCancelled} label="Show cancelled" /></div>
            {filterCount > 0 && <Button size="sm" variant="ghost" onClick={() => { setTypes([]); setKinds([]); setMembers([]); setShowCancelled(true); }}>Clear filters</Button>}
          </div>
        </Card>
      )}

      {view === "agenda" ? (
        <Agenda days={range} list={inRange} blocked={s.blockedDates} regionDays={s.regionDays} canBlock={canBlock} onBlock={toggleBlock} onOpen={open} onNew={(d) => openNew({ date: d })} stops={dayStops} />
      ) : (
        <TimeGrid
          startHour={s.calendar.startHour} endHour={s.calendar.endHour} slotMin={s.calendar.slotMin}
          columns={view === "week"
            ? range.map((d) => ({ key: d, date: d, title: parseIso(d).toLocaleDateString("en-US", { weekday: "short" }), sub: String(parseIso(d).getDate()), items: inRange.filter((a) => a.date === d), tags: regionTags(d, s.regionDays) }))
            : [
              ...(mineOnly ? team.filter((m) => m.id === session.user?.id) : team.filter((m) => !members.length || members.includes(m.id))).map((m) => ({
                key: m.id, date, assigneeId: m.id, title: m.name, color: m.color, items: inRange.filter((a) => a.assigneeId === m.id),
              })),
              ...(!mineOnly && (!members.length || members.includes("")) ? [{ key: "none", date, title: "Unassigned", items: inRange.filter((a) => !a.assigneeId || !team.some((m) => m.id === a.assigneeId)) }] : []),
            ]}
          blocked={s.blockedDates} canBlock={canBlock} onBlock={toggleBlock} week={view === "week"}
          onOpen={open} onSlot={(d, start, assigneeId) => openNew({ date: d, start, assigneeId: assigneeId ?? (mineOnly ? session.user?.id : undefined) })}
          onDay={(d) => { setDate(d); setView("day"); }}
        />
      )}

      <AnimatePresence>
        {editing && <AppointmentSheet key={editing.appt?.id ?? "new"} appt={editing.appt} initial={editing.initial} onClose={() => setEditing(null)} />}
      </AnimatePresence>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-12 shrink-0 text-xs font-medium uppercase tracking-wider text-fg/45">{label}</span>
      {children}
    </div>
  );
}

/* ---------- Agenda (phone default) ---------- */

function Agenda({ days, list, blocked, regionDays, canBlock, onBlock, onOpen, onNew, stops }: {
  days: string[]; list: Appointment[]; blocked: string[]; regionDays: Record<string, number[]>; canBlock: boolean;
  onBlock: (d: string) => void; onOpen: (a: Appointment) => void; onNew: (d: string) => void; stops: (d: string) => string[];
}) {
  const shown = days.filter((d) => d === today() || blocked.includes(d) || list.some((a) => a.date === d));
  if (!list.length && shown.length <= 1 && !blocked.includes(days[0])) {
    return <EmptyState icon={<CalendarDays size={40} />} title="Nothing booked" actions={<Button onClick={() => onNew(days[0])}><Plus size={16} /> New appointment</Button>}>No appointments in the next two weeks for these filters.</EmptyState>;
  }
  return (
    <div className="space-y-5">
      {shown.map((d) => {
        const items = list.filter((a) => a.date === d);
        const isBlocked = blocked.includes(d);
        const route = stops(d);
        return (
          <section key={d}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h2 className="font-display text-base font-semibold">{prettyDate(d, { weekday: "long", month: "short", day: "numeric" })}</h2>
              {d === today() && <Badge tone="accent">Today</Badge>}
              {regionTags(d, regionDays).map((t) => <Badge key={t}>{t}</Badge>)}
              {isBlocked && <Badge tone="danger" icon={<Lock size={11} />}>Blocked</Badge>}
              <div className="flex-1" />
              {route.length > 0 && <Button size="sm" variant="ghost" onClick={() => window.open(routeUrl(route), "_blank")}><Navigation size={14} /> Route</Button>}
              {canBlock && <IconButton label={isBlocked ? "Unblock day" : "Block day"} onClick={() => onBlock(d)}>{isBlocked ? <Unlock size={15} /> : <Lock size={15} />}</IconButton>}
              <IconButton label="New appointment this day" onClick={() => onNew(d)}><Plus size={16} /></IconButton>
            </div>
            {items.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-fg/10 px-4 py-3 text-sm text-fg/40">{isBlocked ? "Blocked off. No bookings." : "Nothing booked."}</p>
            ) : (
              <div className="divide-y divide-fg/5 overflow-hidden rounded-2xl border border-fg/10 bg-surface">
                {items.map((a) => <AgendaRow key={a.id} a={a} onOpen={() => onOpen(a)} />)}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function AgendaRow({ a, onOpen }: { a: Appointment; onOpen: () => void }) {
  const addr = apptAddress(a);
  const off = a.status === "cancelled";
  return (
    <div className={cx("flex gap-3 px-4 py-3 transition hover:bg-fg/[.03]", off && "opacity-50")}>
      <button type="button" onClick={onOpen} className="w-16 shrink-0 text-left">
        <div className="font-display text-sm font-semibold tabular-nums">{time12(a.start)}</div>
        <div className="text-xs tabular-nums text-fg/40">{time12(addMinutes(a.start, a.durationMin))}</div>
      </button>
      <span className={cx("w-1 shrink-0 rounded-full border", TYPE_BLOCK[a.type])} />
      <div className="min-w-0 flex-1">
        <button type="button" onClick={onOpen} className="block w-full text-left">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cx("truncate font-medium", off && "line-through")}>{a.title}</span>
            <Badge tone={typeMeta(a.type).tone}>{typeMeta(a.type).label}</Badge>
            {a.status !== "scheduled" && <Badge tone={APPT_STATUSES[a.status].tone}>{APPT_STATUSES[a.status].label}</Badge>}
            {a.recurrence && <span className="text-xs text-fg/40">↻ every {a.recurrence.everyWeeks > 1 ? `${a.recurrence.everyWeeks} wks` : "week"}</span>}
          </div>
          <div className="mt-0.5 truncate text-sm text-fg/55">{[customer(a), personName(a.assigneeId)].filter(Boolean).join(" · ")}</div>
        </button>
        {addr && (
          <a href={mapsUrl(addr)} target="_blank" rel="noreferrer" className="mt-1 inline-flex max-w-full items-center gap-1 text-xs text-fg/45 hover:text-fg">
            <MapPin size={12} className="shrink-0" /> <span className="truncate">{addr}</span> <span className="shrink-0 text-accent-fg">Open in Maps</span>
          </a>
        )}
      </div>
    </div>
  );
}

/* ---------- Day / week time grid ---------- */

interface Col { key: string; date: string; title: string; sub?: string; color?: string; assigneeId?: string; items: Appointment[]; tags?: string[] }

/** Side-by-side lanes for overlapping events in one column. */
function lanes(items: Appointment[]) {
  const mins = (a: Appointment) => { const [h, m] = a.start.split(":").map(Number); return h * 60 + m; };
  const sorted = [...items].sort((x, y) => mins(x) - mins(y));
  const out = new Map<string, { lane: number; of: number }>();
  let cluster: Appointment[] = [];
  let ends: number[] = [];
  let clusterEnd = -1;
  const flush = () => { cluster.forEach((a) => out.set(a.id, { ...out.get(a.id)!, of: ends.length })); cluster = []; ends = []; };
  for (const a of sorted) {
    const st = mins(a);
    if (st >= clusterEnd) flush();
    let lane = ends.findIndex((e) => e <= st);
    if (lane < 0) { lane = ends.length; ends.push(0); }
    ends[lane] = st + a.durationMin;
    clusterEnd = Math.max(clusterEnd, st + a.durationMin);
    out.set(a.id, { lane, of: 1 });
    cluster.push(a);
  }
  flush();
  return out;
}

function TimeGrid({ columns, startHour, endHour, slotMin, blocked, canBlock, onBlock, onOpen, onSlot, onDay, week }: {
  columns: Col[]; startHour: number; endHour: number; slotMin: number; blocked: string[]; canBlock: boolean; week: boolean;
  onBlock: (d: string) => void; onOpen: (a: Appointment) => void; onSlot: (date: string, start: string, assigneeId?: string) => void; onDay: (d: string) => void;
}) {
  const hours = Math.max(1, endHour - startHour);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t); }, []);
  const nowTop = ((now.getHours() - startHour) * 60 + now.getMinutes()) / 60 * HOUR;

  const clickSlot = (e: MouseEvent<HTMLDivElement>, c: Col) => {
    if (e.target !== e.currentTarget) return;
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const min = startHour * 60 + Math.floor((y / HOUR) * 60 / slotMin) * slotMin;
    onSlot(c.date, addMinutes("00:00", Math.min(min, endHour * 60 - slotMin)), c.assigneeId);
  };

  return (
    <div className="overflow-x-auto rounded-2xl border border-fg/10 bg-surface">
      <div style={{ minWidth: 48 + columns.length * (week ? 104 : 150) }}>
        <div className="flex border-b border-fg/10 bg-sunken">
          <div className="w-12 shrink-0" />
          {columns.map((c) => {
            const isBlocked = blocked.includes(c.date);
            const isToday = c.date === today();
            return (
              <div key={c.key} className="flex min-w-0 flex-1 items-center gap-1.5 border-l border-fg/10 px-2 py-2">
                {week ? (
                  <button type="button" onClick={() => onDay(c.date)} className="min-w-0 flex-1 text-left">
                    <div className={cx("text-[11px] uppercase tracking-wider", isToday ? "text-accent-fg" : "text-fg/45")}>{c.title}</div>
                    <div className={cx("font-display text-lg font-semibold tabular-nums leading-tight", isToday && "text-accent-fg")}>{c.sub}</div>
                    <div className="h-4 text-[10px] text-fg/40">{isBlocked ? "Blocked" : c.tags?.join(" ")}</div>
                  </button>
                ) : (
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Avatar name={c.title} color={c.color} size={24} />
                    <span className="truncate text-sm font-medium">{c.title}</span>
                    <span className="text-xs tabular-nums text-fg/40">{c.items.filter((a) => a.status !== "cancelled").length || ""}</span>
                  </div>
                )}
                {week && canBlock && (
                  <IconButton label={isBlocked ? "Unblock day" : "Block day"} onClick={() => onBlock(c.date)} className="!h-7 !w-7">{isBlocked ? <Unlock size={13} /> : <Lock size={13} />}</IconButton>
                )}
              </div>
            );
          })}
        </div>
        {!week && blocked.includes(columns[0]?.date) && (
          <div className="flex items-center gap-2 border-b border-fg/10 bg-danger/10 px-4 py-2 text-sm text-danger">
            <Lock size={14} /> This day is blocked off.
            {canBlock && <button type="button" className="ml-auto underline" onClick={() => onBlock(columns[0].date)}>Unblock</button>}
          </div>
        )}
        {!week && !blocked.includes(columns[0]?.date) && canBlock && columns[0] && (
          <div className="flex justify-end border-b border-fg/10 px-3 py-1">
            <button type="button" className="inline-flex items-center gap-1 text-xs text-fg/45 hover:text-fg" onClick={() => onBlock(columns[0].date)}><Lock size={12} /> Block this day</button>
          </div>
        )}
        <div className="relative flex" style={{ height: hours * HOUR }}>
          <div className="relative w-12 shrink-0">
            {Array.from({ length: hours }, (_, i) => (
              <div key={i} className="absolute right-1.5 -translate-y-1/2 text-[10px] tabular-nums text-fg/40" style={{ top: i * HOUR }}>{i === 0 ? "" : time12(`${startHour + i}:00`).replace(":00", "")}</div>
            ))}
          </div>
          {columns.map((c) => {
            const l = lanes(c.items);
            const isBlocked = blocked.includes(c.date);
            return (
              <div key={c.key} onClick={(e) => clickSlot(e, c)} className={cx("relative min-w-0 flex-1 cursor-pointer border-l border-fg/10", isBlocked && "bg-danger/[.06]")}>
                {Array.from({ length: hours }, (_, i) => (
                  <div key={i} className="pointer-events-none absolute inset-x-0 border-t border-fg/5" style={{ top: i * HOUR }} />
                ))}
                {c.date === today() && nowTop >= 0 && nowTop <= hours * HOUR && (
                  <div className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-accent-bright" style={{ top: nowTop }} />
                )}
                {c.items.map((a) => {
                  const [h, m] = a.start.split(":").map(Number);
                  const top = Math.max(0, Math.min(hours * HOUR - 22, ((h - startHour) * 60 + m) / 60 * HOUR));
                  const height = Math.max(22, Math.min(hours * HOUR - top, (a.durationMin / 60) * HOUR - 2));
                  const pos = l.get(a.id) ?? { lane: 0, of: 1 };
                  const off = a.status === "cancelled";
                  return (
                    <button key={a.id} type="button" onClick={() => onOpen(a)} title={`${a.title} · ${time12(a.start)}`}
                      className={cx("absolute overflow-hidden rounded-lg border border-l-[3px] px-1.5 py-1 text-left text-[11px] leading-tight shadow-sm transition hover:z-20 hover:brightness-125", TYPE_BLOCK[a.type], off && "opacity-40", a.status === "done" && "opacity-70")}
                      style={{ top, height, left: `calc(${(pos.lane / pos.of) * 100}% + 2px)`, width: `calc(${100 / pos.of}% - 4px)` }}>
                      <div className="flex items-center gap-1 whitespace-nowrap tabular-nums text-fg/60">
                        {week ? time12(a.start).replace(" ", "").toLowerCase() : time12(a.start)}
                        {a.status === "checked_in" && <span className="h-1.5 w-1.5 rounded-full bg-warn" />}
                        {a.status === "done" && <span className="text-success">✓</span>}
                      </div>
                      <div className={cx("truncate font-semibold", off && "line-through")}>{a.title}</div>
                      {height > 44 && <div className="truncate text-fg/55">{customer(a)}</div>}
                      {week && height > 60 && a.assigneeId && <div className="truncate text-fg/45">{personName(a.assigneeId)}</div>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
