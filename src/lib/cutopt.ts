/*
 * Cut optimizer: lays a job's window pieces onto roll widths so the crew pulls as little film as possible.
 * It is strip packing (fixed roll width, shortest length) with guillotine splits, because every cut on a film
 * table runs edge to edge. Several deterministic orderings are tried and the least film wins, so the same
 * measurements always give the same sheet.
 */

export interface CutPiece {
  /** Label prefix, usually the room's initials ("LR"). */
  prefix: string;
  /** Inches, as measured (trim is added by the optimizer). */
  w: number;
  h: number;
  qty: number;
}

export interface CutOptions {
  widths: number[];
  /** Extra film per dimension for trimming, in inches: 0.5 is ¼" on each edge. */
  trim: number;
  /** Lets a piece turn 90° on the roll. Off for films with a direction. */
  rotate: boolean;
  /** Combine roll widths, or find the single best width. */
  multi: boolean;
  /** Longest one sheet may run, in inches; 0 means no limit. */
  maxLengthIn: number;
}

export const DEFAULT_TRIM = 0.5;

export interface Placement {
  label: string;
  /** Cut size with trim; x runs across the roll, y along it. */
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
  /** Glass area this cut covers, sq in. */
  area: number;
  /** Strip i of n when a piece is wider than the roll and gets seamed. */
  part?: [number, number];
}

export interface CutSheet {
  widthIn: number;
  lengthIn: number;
  placements: Placement[];
  filmSqft: number;
  piecesSqft: number;
  wasteSqft: number;
  wastePct: number;
}

export interface CutPlan {
  sheets: CutSheet[];
  lengthIn: number;
  filmSqft: number;
  piecesSqft: number;
  wasteSqft: number;
  wastePct: number;
  pieceCount: number;
  warnings: string[];
}

const EPS = 1e-6;

/** 36.5 → "36.5", 36 → "36". */
export const dim = (n: number) => String(Math.round(n * 100) / 100);

/** "Living Room" → "LR", "Kitchen" → "KI". */
export function roomPrefix(name: string) {
  const words = name.trim().split(/[\s/_-]+/).filter(Boolean);
  if (!words.length) return "RM";
  const p = words.length === 1 ? words[0].slice(0, 2) : words.slice(0, 3).map((w) => w[0]).join("");
  return p.toUpperCase().replace(/[^A-Z0-9]/g, "") || "RM";
}

interface Inst { label: string; w: number; h: number }

/** One instance per pane, labelled like Tint Wiz's sheets: LR_36×60_1, LR_36×60_2… */
function instances(pieces: CutPiece[]): Inst[] {
  const seen = new Map<string, number>();
  const out: Inst[] = [];
  for (const p of pieces) {
    if (!(p.w > 0 && p.h > 0 && p.qty > 0)) continue;
    const key = `${p.prefix}_${dim(p.w)}×${dim(p.h)}`;
    for (let i = 0; i < Math.floor(p.qty); i++) {
      const n = (seen.get(key) ?? 0) + 1;
      seen.set(key, n);
      out.push({ label: `${key}_${n}`, w: p.w, h: p.h });
    }
  }
  return out;
}

/** a = across the roll and b = along it, unrotated (window width across). */
interface Item { label: string; a: number; b: number; rot: boolean; area: number; part?: [number, number]; flip?: boolean }

/** A piece as it goes on a roll of width W: whole, or seamed from strips when it is wider than the roll both ways. */
function expand(inst: Inst, W: number, o: CutOptions): Item[] {
  const a = inst.w + o.trim, b = inst.h + o.trim;
  if (a <= W + EPS || (o.rotate && b <= W + EPS)) return [{ label: inst.label, a, b, rot: o.rotate, area: inst.w * inst.h }];
  const usable = Math.max(W - o.trim, 1);
  const ways = [{ across: inst.w, along: inst.h, flip: false }];
  if (o.rotate) ways.push({ across: inst.h, along: inst.w, flip: true });
  const pull = (x: (typeof ways)[number]) => Math.ceil(x.across / usable - EPS) * (x.along + o.trim);
  const best = ways.reduce((m, x) => (pull(x) < pull(m) ? x : m));
  const n = Math.ceil(best.across / usable - EPS);
  return Array.from({ length: n }, (_, i) => ({
    label: inst.label, a: best.across / n + o.trim, b: best.along + o.trim, rot: false,
    area: (best.across / n) * best.along, part: [i + 1, n] as [number, number], flip: best.flip,
  }));
}

interface Rect { x: number; y: number; w: number; h: number }
type Split = "across" | "short" | "long";

const SORTS: ((x: Item) => number[])[] = [
  (x) => [-Math.max(x.a, x.b), -Math.min(x.a, x.b)],
  (x) => [-(x.a * x.b)],
  (x) => [-x.b, -x.a],
  (x) => [-Math.min(x.a, x.b), -Math.max(x.a, x.b)],
];
const SPLITS: Split[] = ["across", "short", "long"];

function orientations(it: Item, W: number, narrow: boolean): [number, number, boolean][] {
  const o: [number, number, boolean][] = [];
  if (it.a <= W + EPS) o.push([it.a, it.b, false]);
  if (it.rot && it.b <= W + EPS && Math.abs(it.a - it.b) > EPS) o.push([it.b, it.a, true]);
  // "Narrow" keeps pieces standing up so more of them sit side by side across the roll.
  if (narrow && o.length === 2) return [o[0][0] <= o[1][0] ? o[0] : o[1]];
  return o;
}

/** Bottom-left placement: the spot that ends nearest the start of the roll, then the snuggest fit. */
function fit(free: Rect[], orients: [number, number, boolean][]) {
  let best: { i: number; pw: number; ph: number; rot: boolean; s: number[] } | null = null;
  free.forEach((f, i) => {
    for (const [pw, ph, rot] of orients) {
      if (pw > f.w + EPS || ph > f.h + EPS) continue;
      const s = [f.y + ph, Math.min(f.w - pw, f.h - ph), f.x];
      if (!best || less(s, best.s)) best = { i, pw, ph, rot, s };
    }
  });
  return best as { i: number; pw: number; ph: number; rot: boolean } | null;
}

function less(a: number[], b: number[]) {
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > EPS) return a[i] < b[i];
  return false;
}

function packOnce(items: Item[], W: number, maxL: number, split: Split, narrow: boolean): Placement[][] {
  const sheets: Placement[][] = [];
  let free: Rect[] = [];
  let limit = maxL > 0 ? maxL : Infinity;
  const open = (len: number) => { sheets.push([]); free = [{ x: 0, y: 0, w: W, h: len }]; limit = len; };

  for (const it of items) {
    const orients = orientations(it, W, narrow);
    const cur = sheets[sheets.length - 1];
    let spot = cur ? fit(free, orients) : null;
    if (!spot && cur) {
      // Nothing fits in the gaps: cut straight across below everything so far and carry on down the roll.
      const y = cur.reduce((m, p) => Math.max(m, p.y + p.h), 0);
      if (limit - y > EPS) {
        free = free.flatMap((r) => { const h = Math.min(r.h, y - r.y); return h > EPS ? [{ ...r, h }] : []; });
        free.push({ x: 0, y, w: W, h: limit - y });
        spot = fit(free, orients);
      }
    }
    if (!spot) {
      open(maxL > 0 ? maxL : Infinity);
      spot = fit(free, orients);
      // Longer than the sheet limit every way it fits: it gets a sheet of its own length.
      if (!spot) {
        sheets.pop();
        open(Math.min(...orients.map((o) => o[1])));
        spot = fit(free, orients)!;
      }
    }
    const f = free.splice(spot.i, 1)[0];
    sheets[sheets.length - 1].push({ label: it.label, x: f.x, y: f.y, w: spot.pw, h: spot.ph, rotated: it.part ? !!it.flip : spot.rot, area: it.area, part: it.part });
    const rw = f.w - spot.pw, bh = f.h - spot.ph;
    const across = split === "across" || (split === "short" ? rw <= bh : rw > bh);
    const right = { x: f.x + spot.pw, y: f.y, w: rw, h: across ? spot.ph : f.h };
    const below = { x: f.x, y: f.y + spot.ph, w: across ? f.w : spot.pw, h: bh };
    for (const r of [right, below]) if (r.w > EPS && r.h > EPS) free.push(r);
  }
  return sheets;
}

function toSheet(W: number, placements: Placement[]): CutSheet {
  const lengthIn = placements.reduce((m, p) => Math.max(m, p.y + p.h), 0);
  const filmSqft = (W * lengthIn) / 144;
  const piecesSqft = placements.reduce((s, p) => s + p.area, 0) / 144;
  const wasteSqft = Math.max(0, filmSqft - piecesSqft);
  return { widthIn: W, lengthIn, placements, filmSqft, piecesSqft, wasteSqft, wastePct: filmSqft ? (wasteSqft / filmSqft) * 100 : 0 };
}

const filmOf = (sheets: CutSheet[]) => sheets.reduce((s, x) => s + x.filmSqft, 0);
const seamsOf = (sheets: CutSheet[]) => new Set(sheets.flatMap((s) => s.placements.filter((p) => p.part).map((p) => p.label))).size;
/** Fewer seamed windows beats less film: a seam across a picture window is a callback. */
const better = (a: CutSheet[], b: CutSheet[]) => less([seamsOf(a), filmOf(a), a.length], [seamsOf(b), filmOf(b), b.length]);

/** Best layout of these panes on one roll width. `quick` tries fewer orderings (used inside the width mixer). */
function packWidth(insts: Inst[], W: number, o: CutOptions, quick = false): CutSheet[] {
  if (!insts.length) return [];
  const items = insts.flatMap((i) => expand(i, W, o));
  let best: CutSheet[] | null = null;
  for (const key of quick ? SORTS.slice(0, 2) : SORTS) {
    const sorted = [...items].sort((x, y) => { const a = key(x), b = key(y); return less(a, b) ? -1 : less(b, a) ? 1 : 0; });
    for (const split of quick ? (["across", "long"] as Split[]) : SPLITS) {
      for (const narrow of [false, true]) {
        const sheets = packOnce(sorted, W, o.maxLengthIn, split, narrow).map((p) => toSheet(W, p));
        if (!best || better(sheets, best)) best = sheets;
      }
    }
  }
  return best!;
}

/** Film one pane needs alone on width W: what decides which roll it "belongs" on before mixing. */
function soloCost(inst: Inst, W: number, o: CutOptions) {
  const items = expand(inst, W, o);
  const seams = items.length > 1 ? 1e9 : 0;
  return seams + items.reduce((s, it) => s + W * Math.min(...orientations(it, W, false).map((x) => x[1])), 0);
}

/** Mixed widths: start each pane on the width it wastes least on, then move panes while the total film drops. */
function mix(insts: Inst[], widths: number[], o: CutOptions): CutSheet[] {
  const assign = insts.map((inst) => widths.reduce((m, W) => (soloCost(inst, W, o) < soloCost(inst, m, o) ? W : m)));
  const groupOf = (W: number) => insts.filter((_, i) => assign[i] === W);
  const packed = new Map(widths.map((W) => [W, packWidth(groupOf(W), W, o, true)]));
  const all = () => [...packed.values()].flat();

  if (insts.length <= 60) {
    for (let pass = 0; pass < 2; pass++) {
      let moved = false;
      for (let i = 0; i < insts.length; i++) {
        for (const W of widths) {
          const from = assign[i];
          if (W === from) continue;
          const before = all();
          assign[i] = W;
          const a = packWidth(groupOf(from), from, o, true), b = packWidth(groupOf(W), W, o, true);
          const after = [...before.filter((s) => s.widthIn !== from && s.widthIn !== W), ...a, ...b];
          if (better(after, before)) { packed.set(from, a); packed.set(W, b); moved = true; } else assign[i] = from;
        }
      }
      if (!moved) break;
    }
  }
  return widths.flatMap((W) => packWidth(groupOf(W), W, o));
}

function plan(sheets: CutSheet[], pieceCount: number, warnings: string[]): CutPlan {
  const filmSqft = filmOf(sheets);
  const piecesSqft = sheets.reduce((s, x) => s + x.piecesSqft, 0);
  const wasteSqft = Math.max(0, filmSqft - piecesSqft);
  return {
    sheets, pieceCount, warnings, filmSqft, piecesSqft, wasteSqft,
    lengthIn: sheets.reduce((s, x) => s + x.lengthIn, 0),
    wastePct: filmSqft ? (wasteSqft / filmSqft) * 100 : 0,
  };
}

export function optimize(pieces: CutPiece[], o: CutOptions): CutPlan {
  const insts = instances(pieces);
  if (!insts.length) return plan([], 0, []);
  const widths = [...new Set(o.widths.filter((w) => w > o.trim + 1))].sort((a, b) => a - b);
  if (!widths.length) return plan([], insts.length, ["Pick at least one roll width."]);

  let best = packWidth(insts, widths[0], o);
  for (const W of widths.slice(1)) {
    const s = packWidth(insts, W, o);
    if (better(s, best)) best = s;
  }
  if (o.multi && widths.length > 1) {
    const mixed = mix(insts, widths, o);
    if (better(mixed, best)) best = mixed;
  }
  best.sort((a, b) => b.widthIn - a.widthIn);

  const warnings: string[] = [];
  const seamed = new Map<string, Placement & { W: number }>();
  for (const s of best) for (const p of s.placements) if (p.part) seamed.set(p.label, { ...p, W: s.widthIn });
  for (const p of seamed.values()) {
    warnings.push(`${p.label} is wider than the ${p.W}" roll${o.rotate ? " either way" : ""}, so it's seamed from ${p.part![1]} strips.`);
  }
  if (o.maxLengthIn > 0) {
    for (const s of best) {
      if (s.lengthIn > o.maxLengthIn + EPS) warnings.push(`${s.placements[0].label} is longer than the ${dim(o.maxLengthIn / 12)} ft sheet limit, so it runs on its own sheet.`);
    }
  }
  return plan(best, insts.length, warnings);
}
