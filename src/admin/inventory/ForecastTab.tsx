import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, ChevronDown, PackageCheck, TriangleAlert } from "lucide-react";
import { Badge, Card, EmptyState, Kpi, Progress, cx } from "../../components/ui";
import { forecast, forecastJobs, sqftLabel } from "../../lib/film";
import { dayDate } from "../../lib/format";
import { jobTitle } from "../../lib/project";
import { appointments, leads } from "../../lib/store";
import { useStock } from "./shared";

const ftAt = (sqft: number, widthIn: number) => (sqft * 144) / widthIn / 12;
const ft = (n: number) => `${Math.ceil(n).toLocaleString()} ft`;

/** What the next N days of booked installs will pull, against what's on the shelf. */
export function ForecastTab() {
  const { rolls, log, types, settings } = useStock();
  const allLeads = leads.use();
  const appts = appointments.use();
  const days = settings.inventory.forecastDays;
  const [open, setOpen] = useState<string | null>(null);

  const jobs = useMemo(() => forecastJobs(allLeads, appts, days), [allLeads, appts, days]);
  const rows = useMemo(() => forecast(jobs, rolls, log, types, settings.filmWastePct), [jobs, rolls, log, types, settings.filmWastePct]);
  const unscheduled = allLeads.filter((l) => l.status === "approved" && !jobs.some((j) => j.lead.id === l.id)).length;
  const short = rows.filter((r) => r.shortSqft > 0);

  if (!jobs.length) {
    return (
      <EmptyState icon={<CalendarClock size={32} />} title={`No installs in the next ${days} days`}>
        Approved and booked jobs with an install date show up here with the film they'll need.
        {unscheduled > 0 && ` ${unscheduled} approved job${unscheduled === 1 ? " is" : "s are"} waiting for a date.`}
      </EmptyState>
    );
  }

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={`Installs · next ${days} days`} value={String(jobs.length)} sub={unscheduled ? `${unscheduled} approved, not scheduled` : undefined} />
        <Kpi label="Films needed" value={String(rows.length)} />
        <Kpi label="Short" value={String(short.length)} tone={short.length ? "danger" : "success"} />
        <Kpi label="Film needed" value={sqftLabel(rows.reduce((s, r) => s + r.needSqft, 0))} />
      </div>

      {short.length > 0 && (
        <Card tone="danger" className="mb-4">
          <div className="flex items-start gap-3">
            <TriangleAlert size={18} className="mt-0.5 shrink-0 text-danger" />
            <div className="min-w-0 text-sm">
              <div className="font-semibold">Order before these jobs</div>
              <ul className="mt-1 space-y-1 text-fg/75">
                {short.map((r) => {
                  const need = ftAt(r.shortSqft, r.refWidth);
                  const rollsToOrder = Math.max(1, Math.ceil(need / 100));
                  return (
                    <li key={r.key}>
                      Short {ft(need)} of <b>{r.film}</b> ({r.refWidth}" wide). Order {rollsToOrder} × {r.refWidth}" × 100 ft roll{rollsToOrder === 1 ? "" : "s"}, needed by {dayDate(r.jobs[0].date)}.
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {rows.map((r) => {
          const pct = r.needSqft ? Math.min(100, (r.stockSqft / r.needSqft) * 100) : 100;
          const isOpen = open === r.key;
          return (
            <Card key={r.key} tone={r.shortSqft > 0 ? "danger" : undefined} className="!p-0">
              <button type="button" onClick={() => setOpen(isOpen ? null : r.key)} className="w-full p-4 text-left sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{r.film}</div>
                    <div className="text-xs text-fg/45">{r.jobs.length} job{r.jobs.length === 1 ? "" : "s"} · {r.rolls.length} roll{r.rolls.length === 1 ? "" : "s"} in stock</div>
                  </div>
                  {r.shortSqft > 0
                    ? <Badge tone="danger">Short {ft(ftAt(r.shortSqft, r.refWidth))}</Badge>
                    : <Badge tone="success" icon={<PackageCheck size={12} />}>Covered</Badge>}
                  <ChevronDown size={16} className={cx("mt-0.5 shrink-0 text-fg/35 transition", isOpen && "rotate-180")} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div><span className="font-display font-semibold tabular-nums">{ft(ftAt(r.needSqft, r.refWidth))}</span> <span className="text-fg/45">needed</span></div>
                  <div className="text-right"><span className="font-display font-semibold tabular-nums">{ft(ftAt(r.stockSqft, r.refWidth))}</span> <span className="text-fg/45">on hand</span></div>
                </div>
                <Progress value={pct} tone={r.shortSqft > 0 ? "danger" : "success"} className="mt-2" />
                <div className="mt-1 text-xs text-fg/35">Feet at {r.refWidth}" wide · {sqftLabel(r.needSqft)} needed, {sqftLabel(r.stockSqft)} on hand</div>
              </button>
              {isOpen && (
                <div className="divide-y divide-fg/5 border-t border-fg/10">
                  {r.jobs.map(({ lead, date, need, sqft }) => (
                    <Link key={`${lead.id}-${need.key}`} to={`/admin/jobs/${lead.id}`} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-fg/[.03] sm:px-5">
                      <span className="w-24 shrink-0 text-xs text-fg/50">{dayDate(date)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{lead.contact.name} · {jobTitle(lead)}</span>
                        <span className="block truncate text-xs text-fg/40">{need.label}</span>
                      </span>
                      <span className="shrink-0 font-display tabular-nums">{ft(ftAt(sqft, r.refWidth))}</span>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-fg/40">
        Auto jobs use typical cut sizes plus {settings.filmWastePct}% waste; measured flat-glass jobs use the cut layout. Rolls reserved for jobs outside this window aren't counted. Window: {days} days (Settings → Inventory).
      </p>
    </div>
  );
}
