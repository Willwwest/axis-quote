import { useMemo, useState } from "react";
import { Check, Printer, Puzzle, RotateCw, Scissors, TriangleAlert, Undo2 } from "lucide-react";
import { ROLL_WIDTHS } from "../../data/config";
import { Button, Card, Chip, Field, Segmented, Select, Toggle } from "../../components/ui";
import { DEFAULT_TRIM, dim, optimize, type CutPlan, type CutSheet, type Placement } from "../../lib/cutopt";
import { feet, inStock, roomGroups, rollTag, takeOff, typeLabel, type RoomGroup } from "../../lib/film";
import { filmLog, remnants } from "../../lib/store";
import type { FilmRoll, FilmType, Lead } from "../../lib/types";
import { fitsRemnant, remnantFilm } from "./RemnantsTab";
import { PrintPortal, UnitInput, printLight, useStock } from "./shared";

const sq = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ftOf = (inches: number) => (inches / 12).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Result { g: RoomGroup; type?: FilmType; plan: CutPlan; fromStock: boolean }

/**
 * Tint Wiz's Cut Optimizer for a flat-glass job: pick films and roll widths, get a to-scale cut sheet per film,
 * then take the used length off a real roll.
 */
export function CutOptimizer({ lead }: { lead: Lead }) {
  const { rolls, types, left, leftOf } = useStock();
  const groups = useMemo(() => roomGroups(lead), [lead]);
  const stocked = (filmTypeId: string) => rolls.filter((r) => inStock(r) && (left.get(r.id) ?? 0) > 0 && (!filmTypeId || r.filmTypeId === filmTypeId));
  const [off, setOff] = useState<Set<string>>(new Set());
  // Lay out on the rolls actually on the shelf when there are any; "Pick widths" is for planning an order.
  const [source, setSource] = useState<"standard" | "stock">(() => (groups.some((g) => g.filmTypeId && stocked(g.filmTypeId).length) ? "stock" : "standard"));
  const [widths, setWidths] = useState<number[]>([48, 60, 72]);
  const [trim, setTrim] = useState(String(DEFAULT_TRIM));
  const [maxFt, setMaxFt] = useState("");
  const [rotate, setRotate] = useState(true);
  const [multi, setMulti] = useState(false);

  const results: Result[] = useMemo(() => groups.filter((g) => !off.has(g.filmTypeId)).map((g) => {
    const stockWidths = [...new Set(stocked(g.filmTypeId).map((r) => r.widthIn))];
    const fromStock = source === "stock" && stockWidths.length > 0;
    const plan = optimize(g.pieces, {
      widths: fromStock ? stockWidths : widths, trim: Math.max(0, Number(trim) || 0), rotate, multi, maxLengthIn: (Number(maxFt) || 0) * 12,
    });
    return { g, type: types.find((t) => t.id === g.filmTypeId), plan, fromStock };
  }), [groups, off, rolls, left, source, widths, trim, rotate, multi, maxFt, types]);

  if (!groups.length) {
    return <p className="rounded-xl bg-fg/[.04] px-4 py-6 text-center text-sm text-fg/55">Add measurements to an approved room and the cut sheet lays them out here.</p>;
  }

  return (
    <div className="space-y-5">
      <Card className="!bg-sunken">
        <div className="space-y-4">
          {groups.length > 1 && (
            <Field label="Project film">
              <div className="flex flex-wrap gap-2">
                {groups.map((g) => {
                  const t = types.find((x) => x.id === g.filmTypeId);
                  return (
                    <Chip key={g.filmTypeId} size="sm" selected={!off.has(g.filmTypeId)} onClick={() => setOff((s) => { const n = new Set(s); n.has(g.filmTypeId) ? n.delete(g.filmTypeId) : n.add(g.filmTypeId); return n; })}>
                      {t ? typeLabel(t) : "Film not picked"}
                    </Chip>
                  );
                })}
              </div>
            </Field>
          )}
          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-fg/80">Roll widths</span>
              <Segmented size="sm" value={source} onChange={setSource} options={[{ value: "standard", label: "Pick widths" }, { value: "stock", label: "Rolls in stock" }]} />
            </div>
            {source === "standard" ? (
              <div className="flex flex-wrap gap-2">
                {ROLL_WIDTHS.map((w) => (
                  <Chip key={w} size="sm" selected={widths.includes(w)} onClick={() => setWidths((s) => (s.includes(w) ? s.filter((x) => x !== w) : [...s, w].sort((a, b) => a - b)))}>{w}"</Chip>
                ))}
              </div>
            ) : <p className="text-xs text-fg/45">Uses the widths of rolls of each film you have in stock.</p>}
          </div>
          <div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Trim margin"><UnitInput unit="in" step="0.125" value={trim} onChange={(e) => setTrim(e.target.value)} /></Field>
              <Field label="Max sheet length"><UnitInput unit="ft" value={maxFt} onChange={(e) => setMaxFt(e.target.value)} placeholder="No limit" /></Field>
            </div>
            <p className="mt-1.5 text-xs text-fg/45">Trim is added to each piece's width and height: 0.5 is ¼" on every edge.</p>
          </div>
          <div className="grid gap-x-6 sm:grid-cols-2">
            <Toggle checked={rotate} onChange={setRotate} label="Rotate windows" hint="Turn pieces 90° to fit. Off for films with a direction." />
            <Toggle checked={multi} onChange={setMulti} label="Use multiple roll widths" hint="Combine widths, or find the single best one." />
          </div>
        </div>
      </Card>

      {results.map((r) => <FilmResult key={r.g.filmTypeId} r={r} lead={lead} rolls={rolls} leftOf={leftOf} />)}

      {results.length > 0 && (
        <Button variant="outline" className="w-full" onClick={() => printLight("cutsheets")}><Printer size={16} /> Print cut sheets</Button>
      )}
      <PrintPortal name="cutsheets">
        <div className="p-2">
          <h1 className="mb-4 font-display text-xl font-semibold">Cut sheets · {lead.contact.name}</h1>
          {results.map((r) => (
            <div key={r.g.filmTypeId} className="mb-6 break-inside-avoid">
              <PlanSummary r={r} />
              <div className="mt-2 space-y-4">
                {r.plan.sheets.map((s, i) => <div key={i}><SheetTitle sheet={s} i={i} n={r.plan.sheets.length} /><CutDrawing sheet={s} /></div>)}
              </div>
            </div>
          ))}
        </div>
      </PrintPortal>
    </div>
  );
}

function PlanSummary({ r }: { r: Result }) {
  const { plan } = r;
  const widths = [...new Set(plan.sheets.map((s) => s.widthIn))];
  return (
    <div>
      <div className="font-display text-lg font-semibold">{r.type ? typeLabel(r.type) : "Film not picked"}</div>
      {plan.sheets.length > 0 && (
        <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm text-fg/70 sm:grid-cols-4">
          <span>W: <b className="font-display tabular-nums text-fg">{widths.map((w) => `${w}"`).join(" + ")}</b></span>
          <span>L: <b className="font-display tabular-nums text-fg">{ftOf(plan.lengthIn)} ft</b></span>
          <span>Area: <b className="font-display tabular-nums text-fg">{sq(plan.filmSqft)}</b> ({sq(plan.piecesSqft)}) sq ft</span>
          <span>Waste: <b className="font-display tabular-nums text-fg">{sq(plan.wasteSqft)} sq ft</b> {plan.wastePct.toFixed(2)}%</span>
        </div>
      )}
    </div>
  );
}

const SheetTitle = ({ sheet, i, n }: { sheet: CutSheet; i: number; n: number }) => (
  <div className="mb-2 text-sm font-medium">
    {n > 1 ? `Sheet ${i + 1} · ` : ""}{sheet.widthIn}" roll · {ftOf(sheet.lengthIn)} ft · {sheet.placements.length} cut{sheet.placements.length === 1 ? "" : "s"}
    <span className="text-fg/45"> · {sheet.wastePct.toFixed(1)}% waste</span>
  </div>
);

function FilmResult({ r, lead, rolls, leftOf }: { r: Result; lead: Lead; rolls: FilmRoll[]; leftOf: (r: FilmRoll) => number }) {
  const { plan, g } = r;
  const spare = remnants.use().filter((x) => !x.usedAt && (!g.filmTypeId || x.filmTypeId === g.filmTypeId));
  const { types } = useStock();
  // Each pane size an offcut on the shelf could cover instead of the roll (smallest offcut that fits).
  const fits = g.pieces.flatMap((p) => {
    const m = spare.filter((x) => fitsRemnant(x, p.w + DEFAULT_TRIM, p.h + DEFAULT_TRIM)).sort((a, b) => a.widthIn * a.lengthIn - b.widthIn * b.lengthIn)[0];
    return m ? [{ p, m }] : [];
  });

  return (
    <Card>
      <PlanSummary r={r} />
      {r.fromStock && <p className="mt-1 text-xs text-fg/45">Widths from rolls in stock.</p>}
      {plan.warnings.length > 0 && (
        <div className="mt-3 space-y-1 rounded-xl bg-warn/10 px-3 py-2 text-xs text-warn">
          {plan.warnings.map((w) => <div key={w} className="flex gap-2"><TriangleAlert size={13} className="mt-px shrink-0" />{w}</div>)}
        </div>
      )}
      {plan.sheets.length > 0 && (
        <div className="mt-3 flex gap-2 rounded-xl bg-success/10 px-3 py-2 text-sm text-success">
          <Check size={16} className="mt-0.5 shrink-0" />
          <span>All {plan.pieceCount} panes ({sq(plan.piecesSqft)} sq ft) cut from {sq(plan.filmSqft)} sq ft of film, leaving {sq(plan.wasteSqft)} sq ft ({plan.wastePct.toFixed(2)}%) waste.</span>
        </div>
      )}

      <div className="mt-4 space-y-6">
        {plan.sheets.map((s, i) => (
          <div key={`${s.widthIn}-${i}`} className="min-w-0">
            <SheetTitle sheet={s} i={i} n={plan.sheets.length} />
            <CutDrawing sheet={s} />
            <TakeOff sheet={s} lead={lead} filmTypeId={g.filmTypeId} rolls={rolls} leftOf={leftOf} />
          </div>
        ))}
      </div>

      {fits.length > 0 && (
        <div className="mt-4 rounded-xl border border-fg/10 px-3 py-2 text-xs text-fg/60">
          <div className="mb-1 flex items-center gap-1.5 font-medium text-fg/80"><Puzzle size={13} /> Remnants that fit</div>
          {fits.map(({ p, m }, i) => (
            <div key={i}>{p.prefix} {dim(p.w)}×{dim(p.h)} ×{p.qty} fits {remnantFilm(m, types)} {m.widthIn}"×{m.lengthIn}" ({m.location || "no location"})</div>
          ))}
        </div>
      )}
    </Card>
  );
}

/** "Take this off roll ___": deducts the sheet's used length from a real roll, linked to the job. */
function TakeOff({ sheet, lead, filmTypeId, rolls, leftOf }: { sheet: CutSheet; lead: Lead; filmTypeId: string; rolls: FilmRoll[]; leftOf: (r: FilmRoll) => number }) {
  const inches = Math.ceil(sheet.lengthIn);
  const options = rolls
    .filter((r) => inStock(r) && r.widthIn >= sheet.widthIn && leftOf(r) > 0)
    .sort((a, b) => Number(b.filmTypeId === filmTypeId) - Number(a.filmTypeId === filmTypeId) || a.widthIn - b.widthIn || Number(leftOf(b) >= inches) - Number(leftOf(a) >= inches));
  const same = (r: FilmRoll) => !filmTypeId || r.filmTypeId === filmTypeId;
  // Never preselect another film's roll: deducting from the wrong roll throws both counts off.
  const [rollId, setRollId] = useState(() => options.find(same)?.id ?? "");
  const [done, setDone] = useState<{ id: string; roll: FilmRoll } | null>(null);
  const roll = rolls.find((r) => r.id === rollId);
  const noMatch = !options.some(same);

  if (done) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2 text-sm text-success">
        <Check size={15} /> <span className="min-w-0 flex-1 truncate">{feet(inches)} taken off {rollTag(done.roll)}</span>
        <button type="button" onClick={() => { filmLog.remove(done.id); setDone(null); }} className="flex items-center gap-1 text-xs text-fg/60 hover:text-fg"><Undo2 size={13} /> Undo</button>
      </div>
    );
  }
  if (!options.length) return <p className="mt-3 text-xs text-fg/45">No roll {sheet.widthIn}" or wider in stock to take this from.</p>;
  return (
    <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
      <Select value={rollId} onChange={(e) => setRollId(e.target.value)} className="!py-2 text-sm" aria-label="Roll to take it off">
        <option value="">Take this off roll…</option>
        {options.map((r) => <option key={r.id} value={r.id}>{rollTag(r)} · {r.widthIn}" · {feet(leftOf(r))}{same(r) ? "" : " · other film"}</option>)}
      </Select>
      <Button size="sm" className="!h-auto" disabled={!roll} onClick={() => {
        const [use] = takeOff({ rollId, inches, source: "cutsheet", leadId: lead.id, label: `${lead.contact.name} · cut sheet, ${sheet.placements.length} cuts on ${sheet.widthIn}"` });
        setDone({ id: use.id, roll: roll! });
      }}>
        <Scissors size={14} /> Take {feet(inches)}
      </Button>
      {roll && leftOf(roll) < inches && <p className="col-span-2 text-xs text-warn">That roll only has {feet(leftOf(roll))} left.</p>}
      {noMatch && <p className="col-span-2 text-xs text-fg/45">No roll of this film {sheet.widthIn}" or wider in stock. Try "Rolls in stock" above, or order one.</p>}
      {roll && !same(roll) && <p className="col-span-2 text-xs text-warn">That roll is a different film.</p>}
    </div>
  );
}

/** Long sheets lie down on wide screens (length left to right); phones always unroll top to bottom. */
export function CutDrawing({ sheet }: { sheet: CutSheet }) {
  const long = sheet.lengthIn > sheet.widthIn * 1.6;
  return (
    <>
      <div className={long ? "sm:hidden" : undefined}><CutSheetSvg sheet={sheet} /></div>
      {long && <div className="hidden sm:block"><CutSheetSvg sheet={sheet} horizontal /></div>}
    </>
  );
}

/** The roll to scale with every cut labelled. Vertical: roll width across, length down, foot marks on the left. */
export function CutSheetSvg({ sheet, horizontal = false }: { sheet: CutSheet; horizontal?: boolean }) {
  const W = sheet.widthIn;
  const L = Math.max(sheet.lengthIn, 1);
  // Screen axes: A across, B down. Vertical sheets render narrower when long so they stay about a screen tall.
  const A = horizontal ? L : W, B = horizontal ? W : L;
  const maxPx = horizontal ? undefined : Math.max(200, (720 * W) / L);
  const fs = (10 * A) / (horizontal ? 660 : Math.min(340, maxPx!)); // ~10px text at the expected width
  const [ml, mt, mr, mb] = horizontal ? [fs * 0.3, fs * 1.8, fs * 0.6, fs * 1.8] : [fs * 2.4, fs * 1.8, fs * 0.3, fs * 0.3];
  const marks = Array.from({ length: Math.floor(L / 12) }, (_, i) => (i + 1) * 12);
  const pos = (p: Placement) => (horizontal ? { x: p.y, y: p.x, w: p.h, h: p.w } : p);
  return (
    <svg viewBox={`${-ml} ${-mt} ${A + ml + mr} ${B + mt + mb}`} className="mx-auto block h-auto w-full font-display" style={maxPx ? { maxWidth: maxPx } : undefined}
      role="img" aria-label={`Cut sheet, ${W} inch roll, ${ftOf(L)} feet`}>
      <text x={horizontal ? 0 : W / 2} y={-mt * 0.4} fontSize={fs} textAnchor={horizontal ? "start" : "middle"} className="fill-fg/50">{W}" roll · {ftOf(L)} ft</text>
      <rect x={0} y={0} width={A} height={B} className="fill-fg/[.04] stroke-fg/30" strokeWidth={1} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
      {marks.map((m) => (horizontal ? (
        <g key={m}>
          <line x1={m} x2={m} y1={0} y2={W + fs * 0.5} className="stroke-fg/10" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <text x={m} y={W + fs * 1.2} fontSize={fs * 0.85} textAnchor="middle" dominantBaseline="middle" className="fill-fg/40">{m / 12}'</text>
        </g>
      ) : (
        <g key={m}>
          <line x1={-fs * 0.6} x2={W} y1={m} y2={m} className="stroke-fg/10" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <text x={-fs * 0.8} y={m} fontSize={fs * 0.85} textAnchor="end" dominantBaseline="middle" className="fill-fg/40">{m / 12}'</text>
        </g>
      )))}
      {sheet.placements.map((p, i) => {
        const r = pos(p);
        const label = p.part ? `${p.label} ${p.part[0]}/${p.part[1]}` : p.label;
        const need = label.length * fs * 0.58;
        const flat = r.w >= need + fs * 0.4;
        const tall = !flat && r.h >= need + fs * 0.4;
        const text = flat || tall ? label : p.label.split("_").slice(-2).join("_");
        const size = flat || tall ? fs : Math.min(fs, (r.w / Math.max(text.length, 1)) * 1.6);
        const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
        const room = (tall ? r.w : r.h) > size * 2.8;
        return (
          <g key={i}>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} className={p.part ? "fill-warn/15 stroke-warn" : "fill-info/15 stroke-info"} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <g transform={tall ? `rotate(-90 ${cx} ${cy})` : undefined}>
              <text x={cx} y={room ? cy - size * 0.45 : cy} fontSize={size} textAnchor="middle" dominantBaseline="middle" className="fill-fg font-semibold">{text}</text>
              {room && <text x={cx} y={cy + size * 0.75} fontSize={size * 0.8} textAnchor="middle" dominantBaseline="middle" className="fill-fg/55">{dim(p.w)} × {dim(p.h)}</text>}
            </g>
            {p.rotated && r.w > fs * 2 && r.h > fs * 2 && <RotateCw x={r.x + r.w - fs * 1.3} y={r.y + fs * 0.3} width={fs} height={fs} className="text-fg/40" />}
          </g>
        );
      })}
    </svg>
  );
}
