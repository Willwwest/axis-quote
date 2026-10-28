import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { BarChart3, Check, ListFilter, RotateCcw, Table2, X } from "lucide-react";
import { Button, Card, EmptyState, Field, IconButton, Input, PageHeader, Select, Sheet, cx } from "../../components/ui";
import { appointments, contacts, filmLog, invoices, leads, messages, notes, payments, proposals, reviews, rolls, useSettings } from "../../lib/store";
import { BarList, Columns, Legend } from "./charts";
import { PRESETS, buckets, clampRange, compareRange, grainFor, presetRange, rangeLabel, type Bucket, type Compare, type Preset, type Range } from "./range";
import {
  DEFAULT_SEGMENTS, GROUPS, MAX_SEGMENTS, SEGMENTS, TYPE_FILTERS, format, scope, segment, type Data, type ListItem, type Raw, type Segment, type TypeFilter,
} from "./segments";

const KEY = "axis.analytics.segments";

function loadIds(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (Array.isArray(v)) return v.filter((id) => segment(id)).slice(0, MAX_SEGMENTS);
  } catch { /* fall through */ }
  return DEFAULT_SEGMENTS;
}

function useRaw(): Raw {
  const r = {
    leads: leads.use(), appts: appointments.use(), proposals: proposals.use(), invoices: invoices.use(), payments: payments.use(), messages: messages.use(),
    reviews: reviews.use(), contacts: contacts.use(), filmLog: filmLog.use(), rolls: rolls.use(), notes: notes.use(),
  };
  return useMemo(() => r, Object.values(r));
}

export default function AnalyticsPage() {
  const { calendar } = useSettings();
  const [preset, setPreset] = useState<Preset>("thisMonth");
  const [custom, setCustom] = useState<Range>(() => presetRange("custom", calendar.weekStart));
  const [cmp, setCmp] = useState<Compare>("previous");
  const [kind, setKind] = useState<TypeFilter>("all");
  const [ids, setIds] = useState<string[]>(loadIds);
  const [picker, setPicker] = useState(false);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* private mode */ } }, [ids]);

  const raw = useRaw();
  const data = useMemo(() => scope(raw, kind), [raw, kind]);
  const range = preset === "custom" ? clampRange(custom) : presetRange(preset, calendar.weekStart);
  const prev = compareRange(range, preset, cmp);
  const grain = grainFor(range);
  const bks = useMemo(() => buckets(range, grain), [range.from, range.to, grain]);
  const pbks = useMemo(() => (prev ? buckets(prev, grain) : []), [prev?.from, prev?.to, grain]);
  const segs = ids.map(segment).filter((s): s is Segment => !!s);
  const clamped = preset === "custom" && clampRange(custom).from !== (custom.from <= custom.to ? custom.from : custom.to);

  return (
    <div>
      <PageHeader title="Analytics" sub={<>{rangeLabel(range)}{prev && <span className="text-fg/35"> vs {rangeLabel(prev)}</span>}</>} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select value={preset} onChange={(e) => setPreset(e.target.value as Preset)} aria-label="Date range" className="!w-auto !py-2 text-sm">
          {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </Select>
        <Select value={cmp} onChange={(e) => setCmp(e.target.value as Compare)} aria-label="Compare with" className="!w-auto !py-2 text-sm">
          <option value="previous">vs previous period</option>
          <option value="lastYear">vs same period last year</option>
          <option value="none">No comparison</option>
        </Select>
        <Select value={kind} onChange={(e) => setKind(e.target.value as TypeFilter)} aria-label="Project type" className="!w-auto !py-2 text-sm">
          {TYPE_FILTERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </Select>
        <Button variant="outline" size="sm" className="!h-[42px]" onClick={() => setPicker(true)}><ListFilter size={15} /> Segments ({segs.length})</Button>
      </div>
      {preset === "custom" && (
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <Field label="From"><Input type="date" value={custom.from} onChange={(e) => e.target.value && setCustom({ ...custom, from: e.target.value })} className="!py-2 text-sm" /></Field>
          <Field label="To"><Input type="date" value={custom.to} onChange={(e) => e.target.value && setCustom({ ...custom, to: e.target.value })} className="!py-2 text-sm" /></Field>
          {clamped && <p className="pb-2 text-xs text-warn">Ranges are capped at one year, so this starts {rangeLabel({ from: range.from, to: range.from })}.</p>}
        </div>
      )}
      <p className="mb-5 text-xs text-fg/40">Bars by {grain}. {prev ? "The gray line is the comparison period, lined up bar for bar." : ""}</p>

      {!segs.length ? (
        <EmptyState icon={<BarChart3 size={32} />} title="No segments picked" actions={<Button onClick={() => setPicker(true)}>Pick segments</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {segs.map((s) => (
            <SegmentCard key={s.id} seg={s} data={data} range={range} prev={prev} bks={bks} pbks={pbks} filtered={kind !== "all"}
              onRemove={() => setIds(ids.filter((x) => x !== s.id))} />
          ))}
        </div>
      )}

      <AnimatePresence>{picker && <SegmentPicker ids={ids} setIds={setIds} onClose={() => setPicker(false)} />}</AnimatePresence>
    </div>
  );
}

function Delta({ seg, cur, prev }: { seg: Segment; cur: number | null; prev: number | null }) {
  if (cur == null || prev == null) return null;
  const pts = seg.fmt === "pct";
  const d = pts ? cur - prev : prev ? ((cur - prev) / Math.abs(prev)) * 100 : null;
  if (d == null || !Number.isFinite(d)) return <span className="text-xs text-fg/40">new</span>;
  const good = d === 0 ? null : (d > 0) === (seg.upIsGood !== false);
  return (
    <span className={cx("text-xs font-medium tabular-nums", good == null ? "text-fg/40" : good ? "text-success" : "text-danger")}>
      {d > 0 ? "▲" : d < 0 ? "▼" : "•"} {Math.abs(Math.round(d))}{pts ? " pts" : "%"}
    </span>
  );
}

interface Calc { total: number | null; prevTotal: number | null; series?: (number | null)[]; prevSeries?: (number | null)[]; items?: ListItem[] }

function SegmentCard({ seg, data, range, prev, bks, pbks, filtered, onRemove }: {
  seg: Segment; data: Data; range: Range; prev: Range | null; bks: Bucket[]; pbks: Bucket[]; filtered: boolean; onRemove: () => void;
}) {
  const [table, setTable] = useState(false);
  const curLabel = rangeLabel(range), prevLabel = prev ? rangeLabel(prev) : undefined;
  const calc = useMemo((): Calc => {
    if (seg.type === "number") {
      return {
        total: seg.value(data, range.from, range.to),
        prevTotal: prev ? seg.value(data, prev.from, prev.to) : null,
        series: bks.map((b) => seg.value(data, b.from, b.to)),
        prevSeries: prev ? bks.map((_, i) => (pbks[i] ? seg.value(data, pbks[i].from, pbks[i].to) : null)) : undefined,
      };
    }
    const items = seg.items(data, range.from, range.to);
    const summable = seg.fmt === "money" || (seg.fmt === "count" && seg.id !== "contactTags");
    const tot = (xs: { value: number }[]) => (summable ? xs.reduce((s, x) => s + x.value, 0) : null);
    return { items, total: tot(items), prevTotal: prev ? tot(seg.items(data, prev.from, prev.to)) : null };
  }, [seg, data, range.from, range.to, prev, bks, pbks]);

  return (
    <Card className="flex min-w-0 flex-col">
      <div className="mb-2 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-semibold">{seg.name}</h2>
          <p className="text-xs text-fg/45">{seg.desc}{filtered && seg.typed === false && " · all project types"}</p>
        </div>
        {seg.type === "number" && <IconButton label={table ? "Show chart" : "Show table"} onClick={() => setTable(!table)} className={cx(table && "text-fg")}>{table ? <BarChart3 size={16} /> : <Table2 size={16} />}</IconButton>}
        <IconButton label={`Remove ${seg.name}`} onClick={onRemove}><X size={16} /></IconButton>
      </div>

      {calc.total != null && (
        <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-display text-3xl font-semibold">{format(seg.fmt, calc.total)}</span>
          <Delta seg={seg} cur={calc.total} prev={calc.prevTotal} />
          {prev && <span className="text-xs text-fg/40">vs {format(seg.fmt, calc.prevTotal)}</span>}
        </div>
      )}

      <div className={cx(!calc.items && "mt-auto")}>
        {calc.items ? (
          <BarList items={calc.items} fmt={seg.fmt} title={`${seg.name}, ${curLabel}`} />
        ) : table ? (
          <div className="max-h-64 overflow-y-auto rounded-xl border border-fg/10">
            <table className="w-full text-sm">
              <caption className="sr-only">{seg.name} by bucket</caption>
              <thead className="sticky top-0 bg-surface text-left text-xs text-fg/45">
                <tr><th className="px-3 py-2 font-medium">Period</th><th className="px-3 py-2 text-right font-medium">Value</th>{prev && <th className="px-3 py-2 text-right font-medium">Compare</th>}</tr>
              </thead>
              <tbody className="divide-y divide-fg/5 tabular-nums">
                {bks.map((b, i) => (
                  <tr key={b.from}><td className="px-3 py-1.5 text-fg/70">{b.label}</td><td className="px-3 py-1.5 text-right">{format(seg.fmt, calc.series![i])}</td>
                    {prev && <td className="px-3 py-1.5 text-right text-fg/50">{format(seg.fmt, calc.prevSeries?.[i] ?? null)}</td>}</tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <Columns title={seg.name} labels={bks.map((b) => b.label)} cur={calc.series!} prev={calc.prevSeries} fmt={seg.fmt} curLabel={curLabel} prevLabel={prevLabel} />
            <Legend cur={curLabel} prev={prevLabel} />
          </>
        )}
      </div>
    </Card>
  );
}

function SegmentPicker({ ids, setIds, onClose }: { ids: string[]; setIds: (ids: string[]) => void; onClose: () => void }) {
  const full = ids.length >= MAX_SEGMENTS;
  const toggle = (id: string) => setIds(ids.includes(id) ? ids.filter((x) => x !== id) : full ? ids : [...ids, id]);
  return (
    <Sheet title="Segments" onClose={onClose} wide>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-fg/55">Show up to {MAX_SEGMENTS} at once. <span className={cx("font-medium tabular-nums", full ? "text-warn" : "text-fg/80")}>{ids.length} of {MAX_SEGMENTS}</span></p>
        <Button size="sm" variant="ghost" onClick={() => setIds(DEFAULT_SEGMENTS)}><RotateCcw size={14} /> Default</Button>
      </div>
      <div className="space-y-5">
        {GROUPS.map((g) => (
          <section key={g}>
            <h3 className="mb-2 font-display text-xs font-semibold uppercase tracking-widest text-fg/45">{g}</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {SEGMENTS.filter((s) => s.group === g).map((s) => {
                const on = ids.includes(s.id);
                return (
                  <button key={s.id} type="button" onClick={() => toggle(s.id)} aria-pressed={on} disabled={!on && full}
                    className={cx("flex items-start gap-3 rounded-xl border p-3 text-left transition disabled:opacity-40", on ? "border-accent bg-accent/10" : "border-fg/10 hover:border-fg/25")}>
                    <span className={cx("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border", on ? "border-accent bg-accent text-on-accent" : "border-fg/25")}>{on && <Check size={13} />}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{s.name}</span>
                      <span className="block text-xs text-fg/45">{s.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <div className="mt-6 flex justify-end"><Button onClick={onClose}>Done</Button></div>
    </Sheet>
  );
}
