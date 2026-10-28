import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { format, type Fmt, type ListItem } from "./segments";

/*
 * Hand-rolled SVG charts. Colors are tokens: the current period is the accent; the comparison period is a
 * de-emphasised gray line (emphasis form, one y-axis). Marks: ≤24px columns with 4px rounded tops, 2px lines,
 * hairline grid. Every value is also reachable without hover through the card's table view.
 */

const C = {
  bar: "rgb(var(--c-accent))",
  barHot: "rgb(var(--c-accent-bright))",
  prev: "rgb(var(--c-fg) / .45)",
  grid: "rgb(var(--c-fg) / .1)",
  tick: "rgb(var(--c-fg) / .5)",
  ring: "rgb(var(--c-surface))",
};

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Smallest of 1 / 2 / 5 × 10ⁿ at or above v, so the midline tick stays a round number too. */
function niceCeil(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 5, 10].find((m) => m * p >= v) ?? 10) * p;
}

/** Column with a 4px rounded data end and a square foot on the baseline. */
function colPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export function Columns({ title, labels, cur, prev, fmt, curLabel, prevLabel }: {
  title: string; labels: string[]; cur: (number | null)[]; prev?: (number | null)[]; fmt: Fmt; curLabel: string; prevLabel?: string;
}) {
  const [ref, width] = useWidth();
  const [active, setActive] = useState<number | null>(null);
  const n = labels.length;
  const PLOT = 120, TOP = 8, AXIS = 22;
  const top = niceCeil(Math.max(0, ...cur.map((v) => v ?? 0), ...(prev ?? []).map((v) => v ?? 0)));
  // Counts get whole-number ticks (0 / 1 / 2, not 0 / 0.5 / 1).
  const max = fmt === "count" ? Math.max(2, Math.ceil(top / 2) * 2) : top;
  const ticks = [0, max / 2, max];
  const left = Math.max(...ticks.map((t) => format(fmt, t, true).length)) * 6.2 + 8;
  const plotW = Math.max(0, width - left - 2);
  const slot = n ? plotW / n : 0;
  const barW = Math.max(2, Math.min(24, slot - 2));
  const cx = (i: number) => left + i * slot + slot / 2;
  const y = (v: number) => TOP + PLOT - (v / max) * PLOT;
  const step = Math.max(1, Math.ceil(n / (width < 360 ? 4 : 6)));

  const prevPath = prev?.reduce((d, v, i) => (v == null ? d : `${d}${d && prev[i - 1] != null ? "L" : "M"}${cx(i)},${y(v)}`), "") ?? "";
  const total = cur.reduce<number>((s, v) => s + (v ?? 0), 0);
  const peak = cur.reduce<number>((m, v, i) => ((v ?? -Infinity) > (cur[m] ?? -Infinity) ? i : m), 0);
  const aria = `${title}, ${curLabel}: ${n} ${n === 1 ? "bar" : "bars"}, highest ${format(fmt, cur[peak] ?? null)} on ${labels[peak] ?? ""}${fmt === "count" || fmt === "money" ? `, total ${format(fmt, total)}` : ""}.${prev ? ` Gray line: ${prevLabel}.` : ""}`;

  const key = (e: KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    setActive((a) => Math.max(0, Math.min(n - 1, (a ?? -1) + (e.key === "ArrowRight" ? 1 : -1))));
  };
  const tipX = active == null ? 0 : Math.max(0, Math.min(width - 168, cx(active) - 84));

  return (
    <div ref={ref} className="relative select-none">
      {width > 0 && (
        <svg width={width} height={TOP + PLOT + AXIS} role="img" aria-label={aria} tabIndex={0} onKeyDown={key} onFocus={() => setActive((a) => a ?? n - 1)} onBlur={() => setActive(null)}
          onPointerLeave={() => setActive(null)} className="block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent/50">
          <title>{aria}</title>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={left} x2={width} y1={y(t)} y2={y(t)} stroke={C.grid} strokeWidth={1} shapeRendering="crispEdges" />
              <text x={left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} fill={C.tick} className="tabular-nums">{format(fmt, t, true)}</text>
            </g>
          ))}
          {cur.map((v, i) => v != null && v > 0 && (
            <path key={i} d={colPath(cx(i) - barW / 2, y(v), barW, TOP + PLOT - y(v))} fill={active === i ? C.barHot : C.bar} />
          ))}
          {prevPath && <path d={prevPath} fill="none" stroke={C.prev} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
          {prev && active != null && prev[active] != null && <circle cx={cx(active)} cy={y(prev[active]!)} r={4} fill={C.prev} stroke={C.ring} strokeWidth={2} />}
          {labels.map((l, i) => i % step === 0 && (
            <text key={i} x={cx(i)} y={TOP + PLOT + 15} fontSize={10} fill={C.tick} textAnchor={cx(i) + 20 > width ? "end" : cx(i) - 20 < left ? "start" : "middle"}>{l}</text>
          ))}
          {labels.map((_, i) => (
            <rect key={i} x={left + i * slot} y={0} width={slot} height={TOP + PLOT + AXIS} fill="transparent" onPointerEnter={() => setActive(i)} onPointerDown={() => setActive(i)} />
          ))}
        </svg>
      )}
      {active != null && (
        <div role="status" className="pointer-events-none absolute top-0 z-10 w-[168px] rounded-xl border border-fg/10 bg-raised px-3 py-2 text-xs shadow-pop" style={{ left: tipX }}>
          <div className="mb-1 text-fg/50">{labels[active]}</div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: C.bar }} />
            <span className="font-display text-sm font-semibold tabular-nums text-fg">{format(fmt, cur[active])}</span>
          </div>
          {prev && (
            <div className="mt-0.5 flex items-center gap-2">
              <span className="h-0.5 w-2.5 shrink-0 rounded-full" style={{ background: C.prev }} />
              <span className="tabular-nums text-fg/80">{format(fmt, prev[active] ?? null)}</span>
              <span className="truncate text-fg/45">{prevLabel}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Legend for a two-series column chart: swatch for the bars, line key for the comparison. */
export function Legend({ cur, prev }: { cur: string; prev?: string }) {
  if (!prev) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-fg/55">
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: C.bar }} />{cur}</span>
      <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded-full" style={{ background: C.prev }} />{prev}</span>
    </div>
  );
}

/** Ranked horizontal bars, direct-labelled. The tail past `limit` folds into "Other". */
export function BarList({ items, fmt, limit = 7, title }: { items: ListItem[]; fmt: Fmt; limit?: number; title: string }) {
  if (!items.length) return <p className="py-6 text-center text-sm text-fg/40">Nothing in this range</p>;
  const shown = items.length > limit + 1 ? [...items.slice(0, limit), { label: `Other (${items.length - limit})`, value: items.slice(limit).reduce((s, x) => s + x.value, 0) }] : items;
  const max = Math.max(...shown.map((x) => x.value), 0) || 1;
  return (
    <ul aria-label={title} className="space-y-2.5">
      {shown.map((x) => (
        <li key={x.label} title={`${x.label}: ${format(fmt, x.value)}${"note" in x && x.note ? ` · ${x.note}` : ""}`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-fg/80">{x.label}</span>
            <span className="shrink-0 tabular-nums">
              {"note" in x && x.note && <span className="mr-2 text-xs text-fg/45">{x.note}</span>}
              <span className="font-medium text-fg">{format(fmt, x.value)}</span>
            </span>
          </div>
          <div className="mt-1 h-2">
            <div className="h-full rounded-r-[4px]" style={{ width: `${Math.max(1.5, (Math.max(0, x.value) / max) * 100)}%`, background: C.bar }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
