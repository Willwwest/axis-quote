import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Settings2 } from "lucide-react";
import { Card, PageHeader, Tabs } from "../../components/ui";
import { today } from "../../lib/format";
import { unscheduledJobs } from "../../lib/routing";
import { useSession } from "../../lib/session";
import { appointments, leads } from "../../lib/store";
import { DayView } from "./DayView";
import { WeekView } from "./WeekView";

type Tab = "day" | "week";

/** Route planning: the day's routes for the whole crew, the optimizer, and week planning. Crew see only their own route. */
export default function RoutesPage() {
  const session = useSession();
  const manage = session.can("calendar.all");
  const [params, setParams] = useSearchParams();
  const [notice, setNotice] = useState<string | null>(null);
  appointments.use();
  leads.use();
  const waiting = manage ? unscheduledJobs().length : 0;

  // A hand-edited or stale ?d= falls back to today instead of breaking the page.
  const raw = params.get("d");
  const date = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : today();
  const tab: Tab = manage && params.get("tab") === "week" ? "week" : "day";
  const setDate = (d: string) => setParams((p) => { p.set("d", d); return p; }, { replace: true });
  const setTab = (t: Tab) => setParams((p) => { if (t === "week") p.set("tab", "week"); else p.delete("tab"); return p; });

  return (
    <div>
      <PageHeader
        title={manage ? "Routes" : "My route"}
        sub={manage ? "Who goes where, in what order, on which day." : "Your stops, in order, with directions."}
        actions={manage && session.can("settings") && (
          <Link to="/admin/settings/routing" className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm text-fg/55 hover:bg-fg/[.05] hover:text-fg">
            <Settings2 size={15} /> Routing settings
          </Link>
        )}
      />
      {manage && <Tabs value={tab} onChange={setTab} tabs={[{ id: "day", label: "Day" }, { id: "week", label: "Plan the week", count: waiting || undefined }]} />}
      {notice && tab === "day" && <Card tone="success" className="mb-4 text-sm text-fg/80">{notice}</Card>}
      {tab === "day" ? (
        <DayView date={date} setDate={(d) => { setNotice(null); setDate(d); }} manage={manage} />
      ) : (
        <WeekView from={today()} onApplied={(first, count) => {
          setNotice(`Booked ${count} install${count === 1 ? "" : "s"}. Here's the first day; optimize it to tighten the routes.`);
          setParams({ d: first });
        }} />
      )}
    </div>
  );
}
