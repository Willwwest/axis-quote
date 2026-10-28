import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Info, Loader2, MapPin, MapPinned, Route as RouteIcon, Sparkles } from "lucide-react";
import { RouteMap } from "../../components/RouteMap";
import { Badge, Button, Card, CardHeader, EmptyState, IconButton, Input, Kpi, Sheet, Toggle } from "../../components/ui";
import { REGIONS } from "../../data/config";
import { addDays, today } from "../../lib/format";
import {
  applyDayPlan, currentPlan, geocodeJobs, optimizeDay, roadPath, type DayPlan, type MemberRoute, type OptimizeOptions,
} from "../../lib/routing";
import { parseIso, prettyDate } from "../../lib/schedule";
import { useSession } from "../../lib/session";
import { appointments, contacts, leads, useSettings } from "../../lib/store";
import type { LatLng } from "../../lib/types";
import { RouteCard, type StopNotes } from "./RouteCard";
import { clock, dur, isApprox, looseStops, miles, routeKey, toMapRoutes } from "./util";

const NONE: DayPlan["unassigned"] = [];
const GEOCODER_NAME = { nominatim: "OpenStreetMap's Nominatim", photon: "Photon (OpenStreetMap data)", off: "" } as const;

/** One day across the crew: map, each person's route, and the optimizer. */
export function DayView({ date, setDate, manage }: { date: string; setDate: (d: string) => void; manage: boolean }) {
  const s = useSettings();
  const session = useSession();
  // Any change to the schedule, jobs or contacts re-plans the day.
  const appts = appointments.use();
  const allLeads = leads.use();
  const allContacts = contacts.use();

  const [current, setCurrent] = useState<DayPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<DayPlan | null>(null);
  const [optOpen, setOptOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [geo, setGeo] = useState<{ done: number; total: number; result?: string } | null>(null);
  const [paths, setPaths] = useState<Record<string, LatLng[] | null>>({});
  const asked = useRef(new Set<string>());

  useEffect(() => { setProposal(null); setSelected(null); }, [date]);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    currentPlan(date)
      .then((p) => live && setCurrent(p))
      .catch((e) => live && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [date, appts, allLeads, allContacts, s.routing]);
  useEffect(() => { if (notice) { const t = setTimeout(() => setNotice(null), 5000); return () => clearTimeout(t); } }, [notice]);

  const mine = (r: MemberRoute) => manage || r.member.id === session.user?.id;
  const shown = proposal ?? current;
  const routes = useMemo(() => (shown?.routes ?? []).filter(mine), [shown, manage, session.user?.id]);
  const unassigned = useMemo(() => (manage && shown?.unassigned) || NONE, [shown, manage]);
  const visiblePlan = shown ? { ...shown, routes, unassigned } : null;

  // Road shapes for the map, fetched once per route as drawn.
  useEffect(() => {
    for (const r of routes) {
      const key = routeKey(r);
      const pts = r.stops.map((p) => p.stop.point).filter((p): p is NonNullable<typeof p> => !!p);
      if (!pts.length || asked.current.has(key)) continue;
      asked.current.add(key);
      const line = [r.member.base, ...pts, ...(s.routing.returnToBase ? [r.member.base] : [])];
      roadPath(line).then((path) => setPaths((prev) => ({ ...prev, [key]: path }))).catch(() => {});
    }
  }, [routes, s.routing.returnToBase]);

  const mapRoutes = useMemo(() => toMapRoutes(visiblePlan, s.routing.returnToBase, paths), [visiblePlan?.routes, s.routing.returnToBase, paths]);
  const loose = useMemo(() => looseStops(visiblePlan), [visiblePlan?.unassigned]);
  const fitKey = `${date}:${proposal ? "p" : "c"}:${mapRoutes.reduce((n, r) => n + r.stops.length, 0) + loose.length}`;

  const pick = (id: string) => {
    setSelected(id);
    document.getElementById(`stop-${id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  // What changed for each stop between the booked day and the proposal.
  const notes = useMemo<StopNotes>(() => {
    if (!proposal || !current) return {};
    const before = new Map<string, { member: string; name: string; start: number }>();
    current.routes.forEach((r) => r.stops.forEach((p) => before.set(p.stop.id, { member: r.member.id, name: r.member.name, start: p.start })));
    const out: StopNotes = {};
    proposal.routes.forEach((r) => r.stops.forEach((p) => {
      const was = before.get(p.stop.id);
      const list: string[] = [];
      if (!was) list.push("Newly routed");
      else {
        if (was.member !== r.member.id) list.push(`From ${was.name}`);
        if (Math.abs(was.start - p.start) >= 5) list.push(`Was ${clock(was.start)}`);
      }
      if (list.length) out[p.stop.id] = list;
    }));
    return out;
  }, [proposal, current]);
  const changed = Object.keys(notes).length;

  const weekday = parseIso(date).getDay();
  const regions = REGIONS.filter((r) => s.regionDays[r.id]?.includes(weekday));
  const blocked = s.blockedDates.includes(date);
  const stopsCount = routes.reduce((n, r) => n + r.stops.length, 0) + unassigned.length;
  const approxLeads = [...new Set([...routes.flatMap((r) => r.stops.map((p) => p.stop)), ...unassigned.map((u) => u.stop)]
    .filter((st) => isApprox(st) && st.lead).map((st) => st.lead!.id))];
  const drive = (p: DayPlan | null) => (p ? p.routes.filter(mine).reduce((n, r) => n + r.driveMin + r.returnMin, 0) : 0);

  const findAddresses = async () => {
    setGeo({ done: 0, total: approxLeads.length });
    try {
      const r = await geocodeJobs(approxLeads, (done, total) => setGeo({ done, total }));
      setGeo({ done: approxLeads.length, total: approxLeads.length, result: `Found ${r.found} exact address${r.found === 1 ? "" : "es"}${r.missed ? ` · ${r.missed} still at the town center` : ""}` });
    } catch {
      setGeo({ done: 0, total: approxLeads.length, result: "Address lookup is unavailable right now. Jobs stay at their town center; try again later." });
    }
  };

  const apply = () => {
    if (!proposal) return;
    const n = applyDayPlan(proposal);
    setProposal(null);
    setNotice(n ? `Saved. ${n} appointment${n === 1 ? "" : "s"} updated on the calendar.` : "Nothing needed to change.");
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setDate(today())}>Today</Button>
        <IconButton label="Previous day" onClick={() => setDate(addDays(date, -1))}><ChevronLeft size={18} /></IconButton>
        <IconButton label="Next day" onClick={() => setDate(addDays(date, 1))}><ChevronRight size={18} /></IconButton>
        <Input type="date" aria-label="Route date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="!w-auto !py-1.5 text-sm" />
        <div className="flex flex-wrap gap-1.5">
          {blocked ? <Badge tone="danger">Blocked day</Badge> : regions.length ? regions.map((r) => <Badge key={r.id} tone="info" icon={<MapPinned size={11} />}>{r.label}</Badge>) : <Badge>No route day</Badge>}
        </div>
        {manage && (
          <div className="ml-auto flex flex-wrap gap-2">
            {proposal ? (
              <>
                <Button size="sm" variant="ghost" onClick={() => setProposal(null)}>Discard</Button>
                <Button size="sm" onClick={apply}>Apply plan</Button>
              </>
            ) : (
              <Button size="sm" onClick={() => setOptOpen(true)} disabled={loading || !stopsCount}><Sparkles size={14} /> Optimize day</Button>
            )}
          </div>
        )}
      </div>

      <h2 className="mb-3 font-display text-lg font-semibold">{prettyDate(date)}{proposal && <span className="ml-2 align-middle"><Badge tone="accent">Proposed plan</Badge></span>}</h2>

      {notice && <Card tone="success" className="mb-4 text-sm text-fg/80">{notice}</Card>}
      {error && <Quiet>Routes couldn't be worked out just now. The calendar is unchanged; try again in a minute.</Quiet>}

      {proposal && current && (
        <Card tone="accent" className="mb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-display text-base font-semibold tabular-nums">
                Driving {dur(drive(current))} → {dur(drive(proposal))}
                {drive(current) - drive(proposal) >= 1
                  ? <span className="text-success"> · saves {dur(drive(current) - drive(proposal))}</span>
                  : <span className="text-fg/50"> · no shorter plan found</span>}
              </div>
              <div className="mt-0.5 text-xs text-fg/50">
                {changed ? `${changed} stop${changed === 1 ? "" : "s"} change person or time.` : "Same people and times, new order."}
                {proposal.unassigned.length > 0 && ` ${proposal.unassigned.length} can't be routed.`}
                {" "}Nothing is saved until you apply.
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setProposal(null)}>Discard</Button>
              <Button size="sm" onClick={apply}>Apply plan</Button>
            </div>
          </div>
        </Card>
      )}

      {shown && shown.warnings.length > 0 && <Quiet>{shown.warnings.map((w) => <p key={w}>{w}</p>)}</Quiet>}

      {loading && !shown ? (
        <Card className="flex items-center gap-3 text-sm text-fg/55"><Loader2 size={16} className="animate-spin" /> Working out drive times…</Card>
      ) : !stopsCount ? (
        <EmptyState icon={<RouteIcon size={32} />} title={manage ? "Nothing to route this day" : "No stops for you this day"}
          actions={<Link to={`/admin/calendar?d=${date}`}><Button variant="outline" tabIndex={-1}>Open calendar</Button></Link>}>
          {manage ? "Book installs or consults on the calendar, or plan the week to fill route days." : "When the office routes you, your stops show up here."}
        </EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="lg:sticky lg:top-4 lg:self-start">
            <RouteMap routes={mapRoutes} loose={loose} selectedId={selected} onSelect={pick} fitKey={fitKey} className="h-72 sm:h-96 lg:h-[calc(100vh-11rem)]" />
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Kpi label="Stops" value={String(stopsCount)} />
              <Kpi label="Driving" value={dur(drive(shown))} />
              <Kpi label="Miles" value={miles(routes.reduce((n, r) => n + r.driveMiles, 0))} />
            </div>
            <p className="mt-2 text-xs text-fg/40">
              {shown?.travel === "estimate" ? (s.routing.travel === "estimate" ? "Drive times are distance estimates." : "Road times unavailable: using distance estimates.") : shown?.travel === "ors" ? "Drive times from OpenRouteService." : "Drive times from OSRM road routing."}
              {loading && " Updating…"}
            </p>
          </div>

          <div className="min-w-0 space-y-4">
            {manage && approxLeads.length > 0 && s.routing.geocoder !== "off" && (
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 text-sm">
                    <div className="flex items-center gap-2 font-medium"><MapPin size={15} className="text-warn" /> {approxLeads.length} job{approxLeads.length === 1 ? " is" : "s are"} placed at the town center</div>
                    <p className="mt-0.5 text-xs text-fg/45">Addresses are looked up with {GEOCODER_NAME[s.routing.geocoder]}, one per second.</p>
                    {geo && <p className="mt-1 text-xs text-fg/60 tabular-nums">{geo.result ?? `Looking up ${geo.done} of ${geo.total}…`}</p>}
                  </div>
                  <Button size="sm" variant="outline" onClick={findAddresses} disabled={!!geo && !geo.result}>
                    {geo && !geo.result ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />} Find exact addresses
                  </Button>
                </div>
              </Card>
            )}

            {routes.filter((r) => r.stops.length || !manage).map((r) => (
              <RouteCard key={r.member.id} route={r} manage={manage} notes={notes} selectedId={selected} onSelect={pick}
                returnToBase={s.routing.returnToBase} preview={!!proposal} />
            ))}
            {manage && routes.some((r) => !r.stops.length) && (
              <p className="px-1 text-xs text-fg/45">Free this day: {routes.filter((r) => !r.stops.length).map((r) => r.member.name).join(", ")}</p>
            )}

            {unassigned.length > 0 && (
              <Card tone="warn">
                <CardHeader title="Not routed" sub="Nobody can reach these in their hours, or they have no location yet." />
                <ul className="-mx-2 divide-y divide-fg/5">
                  {unassigned.map((u) => (
                    <li key={u.stop.id} id={`stop-${u.stop.id}`}>
                      <button type="button" onClick={() => pick(u.stop.id)} className="flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-fg/[.04]">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-fg/30 text-xs text-fg/60">?</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{u.stop.customer || u.stop.title} <span className="text-fg/45">· {clock(u.stop.booked)}</span></span>
                          <span className="block text-xs text-fg/50">{u.reason}</span>
                        </span>
                        {u.stop.lead && <Link to={`/admin/jobs/${u.stop.lead.id}`} onClick={(e) => e.stopPropagation()} className="shrink-0 text-xs text-fg/50 hover:text-fg">Job →</Link>}
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {optOpen && <OptimizeSheet date={date} onClose={() => setOptOpen(false)} onDone={(p) => { setProposal(p); setOptOpen(false); }} />}
      </AnimatePresence>
    </div>
  );
}

/** Low-key note: services falling back, estimates in use. Never an alarm. */
export function Quiet({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex items-start gap-2 rounded-xl bg-fg/[.04] px-3 py-2 text-xs text-fg/55">
      <Info size={14} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

function OptimizeSheet({ date, onClose, onDone }: { date: string; onClose: () => void; onDone: (p: DayPlan) => void }) {
  const s = useSettings();
  const [opts, setOpts] = useState<OptimizeOptions>({ keepAssignees: false, keepTimes: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      onDone(await optimizeDay(date, opts));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };
  return (
    <Sheet title="Optimize the day" onClose={onClose}>
      <p className="text-sm text-fg/55">
        Finds who should take each stop and in what order, so the crew drives less and stays inside each customer's window.
        Checked-in and finished stops stay put.
      </p>
      <div className="mt-4 divide-y divide-fg/5">
        <Toggle checked={!!opts.keepAssignees} onChange={(keepAssignees) => setOpts({ ...opts, keepAssignees })}
          label="Keep everyone's assigned jobs" hint="Only reorder and retime each person's own stops." />
        <Toggle checked={!!opts.keepTimes} onChange={(keepTimes) => setOpts({ ...opts, keepTimes })}
          label="Keep booked start times" hint="Customers were promised a time: only reassign and reorder." />
      </div>
      <p className="mt-3 text-xs text-fg/40">
        Solver: {s.routing.optimizer === "vroom" && s.routing.orsKey ? "VROOM via OpenRouteService" : "built in"} ·
        drive times: {s.routing.travel === "estimate" ? "straight-line estimate" : s.routing.travel === "ors" ? "OpenRouteService" : "OSRM"}.
        Change these in <Link to="/admin/settings/routing" className="underline underline-offset-2 hover:text-fg">Routing settings</Link>.
      </p>
      {error && <p className="mt-3 text-sm text-fg/55">Couldn't finish planning just now. Nothing changed; try again in a minute.</p>}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={run} disabled={busy}>{busy ? <><Loader2 size={16} className="animate-spin" /> Planning…</> : <><Sparkles size={16} /> Find the best plan</>}</Button>
      </div>
    </Sheet>
  );
}
