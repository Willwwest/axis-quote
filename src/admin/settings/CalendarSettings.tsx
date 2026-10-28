import { useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CalendarDays, Clock, Lock, MapPinned, Plus, X } from "lucide-react";
import { Button, Card, CardHeader, Field, Input, Segmented, Select, Toggle, cx } from "../../components/ui";
import { REGIONS, type RegionId, type Settings } from "../../data/config";
import { shortDate, time12, to24, today } from "../../lib/format";
import { isoDate, parseIso } from "../../lib/schedule";
import { patchSettings, useSettings } from "../../lib/store";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const hourLabel = (h: number) => time12(`${h}:00`);
const fmtDur = (m: number) => (m < 60 ? `${m} min` : `${m / 60}h`);

export function CalendarSettings() {
  const s = useSettings();
  const cal = (p: Partial<Settings["calendar"]>) => patchSettings((x) => ({ calendar: { ...x.calendar, ...p } }));

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold">Calendar & booking</h2>
        <p className="mt-1 text-sm text-fg/50">How the crew calendar looks, when customers can book, and which reminders go out.</p>
      </div>

      <Card>
        <CardHeader title="Calendar" icon={<CalendarDays size={16} />} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 text-sm font-medium text-fg/80">Week starts on</div>
            <Segmented value={s.calendar.weekStart} onChange={(weekStart) => cal({ weekStart })} options={[{ value: 0, label: "Sunday" }, { value: 1, label: "Monday" }]} />
          </div>
          <Field label="Time slots" hint="Grid and start-time steps">
            <Select value={s.calendar.slotMin} onChange={(e) => cal({ slotMin: Number(e.target.value) })}>
              {[15, 30, 60].map((m) => <option key={m} value={m}>{m} minutes</option>)}
            </Select>
          </Field>
          <Field label="Day starts">
            <Select value={s.calendar.startHour} onChange={(e) => cal({ startHour: Math.min(Number(e.target.value), s.calendar.endHour - 1) })}>
              {Array.from({ length: 13 }, (_, i) => i + 4).map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
            </Select>
          </Field>
          <Field label="Day ends">
            <Select value={s.calendar.endHour} onChange={(e) => cal({ endHour: Math.max(Number(e.target.value), s.calendar.startHour + 1) })}>
              {Array.from({ length: 12 }, (_, i) => i + 12).map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
            </Select>
          </Field>
          <Field label="Default appointment length">
            <Select value={s.calendar.defaultDurationMin} onChange={(e) => cal({ defaultDurationMin: Number(e.target.value) })}>
              {[30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 480].map((m) => <option key={m} value={m}>{fmtDur(m)}</option>)}
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Customer arrival windows" icon={<Clock size={16} />} sub="The start times customers can pick in the quote app. One booking per window per day." />
        <ArrivalWindows slots={s.slots} />
      </Card>

      <Card>
        <CardHeader title="Route days" icon={<MapPinned size={16} />} sub="Days the crew works each area. The quote app only offers these days for that region." />
        <div className="space-y-4">
          {REGIONS.map((r) => (
            <div key={r.id}>
              <div className="text-sm font-medium">{r.label}</div>
              <div className="mb-2 text-xs text-fg/45">{r.cities}</div>
              <div className="grid max-w-sm grid-cols-7 gap-1.5">
                {WEEKDAYS.map((d, i) => {
                  const on = s.regionDays[r.id].includes(i);
                  return (
                    <button key={d} type="button" aria-pressed={on}
                      onClick={() => patchSettings((x) => ({ regionDays: { ...x.regionDays, [r.id]: on ? x.regionDays[r.id].filter((n) => n !== i) : [...x.regionDays[r.id], i].sort() } as Record<RegionId, number[]> }))}
                      className={cx("h-9 min-w-0 rounded-lg border text-xs transition", on ? "border-accent bg-accent/20 text-fg" : "border-fg/10 text-fg/40 hover:text-fg")}>
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Blocked dates" icon={<Lock size={16} />} sub="Holidays, vacation, supply runs. Nobody can book these days. You can also block a day from the calendar." />
        <BlockedDates blocked={s.blockedDates} regionDays={s.regionDays} />
      </Card>

      <Card>
        <CardHeader title="Customer reminders" icon={<Bell size={16} />} sub={<>Each one lands in Messages → Outbox when it's due. Edit the wording in <Link to="/admin/settings/messages" className="text-accent-fg hover:underline">Message templates</Link>.</>} />
        <div className="divide-y divide-fg/5">
          {([
            ["confirm", "New appointment confirmation", "When an appointment is booked with Notify customer on."],
            ["day", "1 day reminder", "About 24 hours before the start."],
            ["hour", "1 hour reminder", "About an hour before. Not an \"on my way\" text."],
            ["cancel", "Cancellation notice", "When the crew cancels and chooses to tell the customer."],
          ] as const).map(([k, label, hint]) => (
            <Toggle key={k} checked={s.reminders[k]} onChange={(v) => patchSettings((x) => ({ reminders: { ...x.reminders, [k]: v } }))} label={label} hint={hint} />
          ))}
        </div>
      </Card>
    </div>
  );
}

function ArrivalWindows({ slots }: { slots: string[] }) {
  const [t, setT] = useState("10:00");
  const sorted = [...slots].sort((a, b) => to24(a).localeCompare(to24(b)));
  const add = () => {
    const label = time12(t);
    if (!slots.some((x) => to24(x) === t)) patchSettings({ slots: [...slots, label].sort((a, b) => to24(a).localeCompare(to24(b))) });
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {sorted.map((slot) => (
          <span key={slot} className="inline-flex items-center gap-1 rounded-full border border-fg/12 py-1 pl-3 pr-1 text-sm">
            {slot}
            <button type="button" aria-label={`Remove ${slot}`} onClick={() => patchSettings({ slots: slots.filter((x) => x !== slot) })} className="grid h-6 w-6 place-items-center rounded-full text-fg/40 hover:bg-fg/10 hover:text-fg"><X size={13} /></button>
          </span>
        ))}
        {!slots.length && <span className="text-sm text-warn">No windows: customers can't book online.</span>}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Input type="time" step={900} value={t} onChange={(e) => setT(e.target.value)} className="!w-36 !py-2" aria-label="New arrival window" />
        <Button size="sm" variant="outline" onClick={add}><Plus size={14} /> Add window</Button>
      </div>
    </div>
  );
}

function BlockedDates({ blocked, regionDays }: { blocked: string[]; regionDays: Record<RegionId, number[]> }) {
  const toggle = (d: string) => patchSettings((x) => ({ blockedDates: x.blockedDates.includes(d) ? x.blockedDates.filter((b) => b !== d) : [...x.blockedDates, d].sort() }));
  // Six weeks starting this Sunday, like a wall calendar.
  const start = parseIso(today());
  start.setDate(start.getDate() - start.getDay());
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  const later = blocked.filter((d) => d > isoDate(days[41]));
  const past = today();
  return (
    <div>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => <div key={w} className="pb-1 text-center text-[10px] uppercase tracking-wider text-fg/40">{w[0]}</div>)}
        {days.map((d) => {
          const iso = isoDate(d);
          const isBlocked = blocked.includes(iso);
          const tags = REGIONS.filter((r) => r.id !== "other" && regionDays[r.id].includes(d.getDay())).map((r) => (r.id === "quad" ? "PRE" : "PHX"));
          return (
            <button key={iso} type="button" disabled={iso < past} onClick={() => toggle(iso)} aria-pressed={isBlocked}
              className={cx("rounded-lg border p-1 text-center text-xs transition disabled:opacity-25",
                isBlocked ? "border-danger/50 bg-danger/15 text-danger line-through" : "border-fg/10 hover:border-fg/30",
                iso === past && !isBlocked && "border-accent/60")}>
              <div className="font-semibold tabular-nums">{d.getDate()}</div>
              <div className="h-3 text-[9px] leading-3 text-fg/40">{tags.join(" ")}</div>
            </button>
          );
        })}
      </div>
      {later.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <span className="text-fg/45">Later:</span>
          {later.map((d) => (
            <button key={d} type="button" onClick={() => toggle(d)} className="inline-flex items-center gap-1 rounded-full bg-danger/15 px-2.5 py-0.5 text-xs text-danger">{shortDate(d)} <X size={11} /></button>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-fg/40">Tap a day to block or unblock it. PRE / PHX show each area's route days.</p>
    </div>
  );
}
