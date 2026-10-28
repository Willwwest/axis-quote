import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarRange, Check, Info, Loader2, MapPinned, Sparkles } from "lucide-react";
import { Avatar, Badge, Button, Card, CardHeader, cx } from "../../components/ui";
import { REGIONS } from "../../data/config";
import { applyWeekPlan, crew, planWeek, unscheduledJobs, type WeekPlan, type WeekProposal } from "../../lib/routing";
import { jobTitle, statusMeta } from "../../lib/project";
import { prettyDate } from "../../lib/schedule";
import { appointments, leads, staff, useSettings } from "../../lib/store";
import { clock, dur } from "./util";

const regionLabel = (id?: string | null) => REGIONS.find((r) => r.id === id)?.label;

/** Puts won-but-unscheduled jobs onto route days with the person who adds the least driving. */
export function WeekView({ from, onApplied }: { from: string; onApplied: (firstDate: string, count: number) => void }) {
  const s = useSettings();
  const appts = appointments.use();
  const allLeads = leads.use();
  const people = staff.use();
  const waiting = useMemo(() => unscheduledJobs(), [appts, allLeads]);
  const team = useMemo(() => crew(), [people, s.routing, s.ownerName]);
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosen = waiting.filter((l) => !skip.has(l.id));
  const toggle = (id: string) => setSkip((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      setPlan(await planWeek(from, 7, { leadIds: chosen.map((l) => l.id) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (!plan) return;
    const made = applyWeekPlan(plan);
    const first = [...made].sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))[0];
    setPlan(null);
    onApplied(first?.date ?? from, made.length);
  };

  // Proposals grouped by day, then by person.
  const byDay = useMemo(() => {
    const days = new Map<string, Map<string, WeekProposal[]>>();
    for (const p of plan?.proposals ?? []) {
      if (!days.has(p.date)) days.set(p.date, new Map());
      const m = days.get(p.date)!;
      m.set(p.memberId, [...(m.get(p.memberId) ?? []), p].sort((a, b) => a.start - b.start));
    }
    return [...days.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [plan]);
  const member = (id: string) => team.find((m) => m.id === id);
  const dayInfo = (date: string) => plan?.days.find((d) => d.date === date);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Waiting for an install date" icon={<CalendarRange size={16} />}
          sub="Approved or booked jobs with no install on the calendar. Untick any you want to schedule by hand."
          actions={waiting.length > 0 && <Badge tone="warn">{waiting.length}</Badge>} />
        {!waiting.length ? (
          <p className="py-3 text-sm text-fg/45">Every won job is on the calendar. When a proposal is approved, the job shows up here to be placed on a route day.</p>
        ) : (
          <ul className="-mx-2 divide-y divide-fg/5">
            {waiting.map((l) => {
              const on = !skip.has(l.id);
              const st = statusMeta(l.status);
              return (
                <li key={l.id} className="flex items-center gap-3 px-2 py-2.5">
                  <button type="button" role="checkbox" aria-checked={on} aria-label={`Include ${l.contact.name}`} onClick={() => toggle(l.id)}
                    className={cx("grid h-6 w-6 shrink-0 place-items-center rounded-md border transition", on ? "border-accent bg-accent text-on-accent" : "border-fg/25 text-transparent")}>
                    <Check size={14} />
                  </button>
                  <Link to={`/admin/jobs/${l.id}`} className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{l.contact.name}</span>
                    <span className="block truncate text-xs text-fg/50">{jobTitle(l)}{l.city && ` · ${l.city}`}</span>
                  </Link>
                  <div className="hidden shrink-0 flex-wrap justify-end gap-1 sm:flex">
                    {regionLabel(l.region) && <Badge icon={<MapPinned size={11} />}>{regionLabel(l.region)}</Badge>}
                    <Badge tone={st.tone}>{st.short}</Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {waiting.length > 0 && <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={run} disabled={busy || !chosen.length}>
            {busy ? <><Loader2 size={16} className="animate-spin" /> Planning…</> : <><Sparkles size={16} /> Plan next 7 days</>}
          </Button>
          <span className="text-xs text-fg/45">Uses each region's route days, blocked dates, everyone's hours and up to {s.routing.maxJobsPerDay} installs per person a day.</span>
        </div>}
        {error && <p className="mt-3 text-sm text-fg/55">Couldn't finish planning just now. Nothing was booked; try again in a minute.</p>}
      </Card>

      {plan && (
        <>
          <Card tone="accent">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-display text-base font-semibold">
                  {plan.proposals.length ? `${plan.proposals.length} install${plan.proposals.length === 1 ? "" : "s"} over ${byDay.length} day${byDay.length === 1 ? "" : "s"}` : "No installs could be placed"}
                </div>
                <div className="mt-0.5 text-xs text-fg/50">
                  {plan.unplaced.length ? `${plan.unplaced.length} can't fit in the next 7 days. ` : ""}Nothing is booked until you apply.
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setPlan(null)}>Discard</Button>
                <Button size="sm" onClick={apply} disabled={!plan.proposals.length}>Book these</Button>
              </div>
            </div>
          </Card>


          {byDay.map(([date, people]) => {
            const info = dayInfo(date);
            return (
              <Card key={date}>
                <CardHeader title={prettyDate(date)}
                  sub={info ? `${info.plan.routes.reduce((n, r) => n + r.stops.length, 0)} stops · ${dur(info.plan.driveMin)} driving` : undefined}
                  actions={<div className="flex flex-wrap justify-end gap-1">{(info?.regions ?? []).map((r) => <Badge key={r} tone="info">{regionLabel(r)}</Badge>)}</div>} />
                {info && info.plan.warnings.length > 0 && (
                  <div className="mb-3 flex items-start gap-2 rounded-xl bg-fg/[.04] px-3 py-2 text-xs text-fg/55">
                    <Info size={14} className="mt-0.5 shrink-0" />
                    <div>{info.plan.warnings.map((x) => <p key={x}>{x}</p>)}</div>
                  </div>
                )}
                <div className="space-y-3">
                  {[...people.entries()].map(([memberId, list]) => {
                    const m = member(memberId);
                    const route = info?.plan.routes.find((r) => r.member.id === memberId);
                    const booked = route ? route.stops.length - list.length : 0;
                    return (
                      <div key={memberId}>
                        <div className="mb-1 flex items-center gap-2 text-sm">
                          <Avatar name={m?.name ?? "?"} color={m?.color} size={22} />
                          <span className="font-medium">{m?.name ?? "Unknown"}</span>
                          {booked > 0 && <span className="text-xs text-fg/45">+ {booked} already booked</span>}
                        </div>
                        <ul className="space-y-1.5 pl-8">
                          {list.map((p) => (
                            <li key={p.lead.id} className="rounded-xl border border-accent/30 bg-accent/[.06] px-3 py-2">
                              <div className="flex flex-wrap items-baseline gap-x-2">
                                <span className="font-display text-sm font-semibold tabular-nums">{clock(p.start)}–{clock(p.start + p.durationMin)}</span>
                                <span className="truncate text-sm">{p.lead.contact.name}</span>
                                <Badge tone="accent">New</Badge>
                              </div>
                              <div className="truncate text-xs text-fg/55">{jobTitle(p.lead)}{p.lead.city && ` · ${p.lead.city}`}</div>
                              <div className="mt-0.5 text-xs text-fg/45">{p.reason}</div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}

          {plan.unplaced.length > 0 && (
            <Card tone="warn">
              <CardHeader title="Couldn't place" sub="Book these by hand, or widen route days and hours in Settings." />
              <ul className="-mx-2 divide-y divide-fg/5">
                {plan.unplaced.map((u) => (
                  <li key={u.lead.id}>
                    <Link to={`/admin/jobs/${u.lead.id}`} className="block rounded-lg px-2 py-2.5 hover:bg-fg/[.04]">
                      <span className="block truncate text-sm">{u.lead.contact.name} <span className="text-fg/45">· {jobTitle(u.lead)}</span></span>
                      <span className="block text-xs text-fg/50">{u.reason}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

    </div>
  );
}
