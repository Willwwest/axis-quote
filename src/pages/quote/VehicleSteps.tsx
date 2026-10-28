import { useState, type ReactNode } from "react";
import { AlertTriangle, Check, Eye, Gift, ShieldCheck, Sun, Thermometer } from "lucide-react";
import {
  AUTO_SHADES, AZ_FRONT_MIN_VLT, BODY_TYPES, FILMS, FULL_VEHICLE, PAINTS, ZONES,
  type FilmTier, type Zone,
} from "../../data/config";
import { CarVisualizer, DriverView } from "../../components/CarVisualizer";
import { WindowPicker } from "../../components/WindowPicker";
import { Choice, Chip, Field, Input, Segmented, StepHeader, cx } from "../../components/ui";
import { frontsLegal, isFullVehicle, money, tintOpacity, zoneLabel, zonePrice } from "../../lib/pricing";
import type { VehicleSpec } from "../../lib/types";
import { useQuote } from "./context";

function useVehicle() {
  const { q, set } = useQuote();
  const update = (patch: Partial<VehicleSpec>) => set((s) => ({ vehicle: { ...s.vehicle, ...patch } }));
  return [q.vehicle, update] as const;
}

export function VehicleStep() {
  const [v, update] = useVehicle();
  return (
    <div>
      <StepHeader eyebrow="Step 1 · Your ride" title="What are we tinting?" sub="Pick the closest body style. We'll draw it so you can preview every shade on your actual shape." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {BODY_TYPES.map((b) => (
          <Choice key={b.id} selected={v.body === b.id} onClick={() => update({ body: b.id })} className="!p-3">
            <CarVisualizer body={b.id} paint={v.body === b.id ? v.paint : "#3a3b40"} zones={v.zones} frontVlt={v.frontVlt} rearVlt={v.rearVlt} stage={false} className="-mx-1 w-[calc(100%+.5rem)]" />
            <div className="mt-1 font-display font-semibold text-white">{b.label}</div>
            <div className="text-xs text-white/50">{b.hint}</div>
          </Choice>
        ))}
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <Field label="Year, make & model" hint="Optional">
          <Input value={v.ymm} onChange={(e) => update({ ymm: e.target.value })} placeholder="e.g. 2024 Toyota Tacoma" />
        </Field>
        <div>
          <div className="mb-1.5 text-sm font-medium text-white/80">Paint color <span className="text-white/40">· for the preview</span></div>
          <div className="flex flex-wrap gap-2.5">
            {PAINTS.map((p) => (
              <button
                key={p.id}
                type="button"
                title={p.name}
                aria-label={p.name}
                onClick={() => update({ paint: p.hex })}
                className={cx("h-11 w-11 rounded-full border-2 transition-all", v.paint === p.hex ? "scale-110 border-white shadow-[0_0_0_3px_rgba(218,40,27,.8)]" : "border-white/15 hover:border-white/40")}
                style={{ background: `radial-gradient(circle at 35% 30%, #ffffff55, ${p.hex} 45%, #000 140%)` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const PACKAGES: { label: string; zones: Zone[]; tag?: string }[] = [
  { label: "Full tint", zones: [...FULL_VEHICLE, "visor"], tag: "Free visor strip" },
  { label: "Full + windshield", zones: [...FULL_VEHICLE, "visor", "windshield"], tag: "Max heat rejection" },
  { label: "Front doors only", zones: ["frontSides"], tag: "Match factory rear" },
  { label: "Windshield only", zones: ["windshield"] },
];

export function CoverageStep() {
  const { settings } = useQuote();
  const [v, update] = useVehicle();
  const [hover, setHover] = useState<Zone | null>(null);
  const toggle = (z: Zone) => update({ zones: v.zones.includes(z) ? v.zones.filter((x) => x !== z) : [...v.zones, z] });
  const full = isFullVehicle(v.zones);
  const same = (a: Zone[], b: Zone[]) => a.length === b.length && a.every((z) => b.includes(z));

  return (
    <div>
      <StepHeader eyebrow="Step 2 · Coverage" title="Which windows?" sub="Tap the glass on the diagram or the list. Prices update live." />
      <div className="mb-6 flex flex-wrap gap-2">
        {PACKAGES.map((p) => (
          <Chip key={p.label} selected={same(p.zones, v.zones)} onClick={() => update({ zones: p.zones })}>
            {p.label}
            {p.tag && <span className="ml-2 text-xs text-white/45">{p.tag}</span>}
          </Chip>
        ))}
      </div>

      <div className="grid items-start gap-6 sm:grid-cols-[200px_1fr]">
        <div className="mx-auto h-[360px] w-[200px] rounded-3xl bg-gradient-to-b from-white/[.04] to-transparent p-3">
          <WindowPicker zones={v.zones} onToggle={toggle} hover={hover} onHover={setHover} />
        </div>
        <div className="space-y-2">
          {ZONES.map((z) => {
            const on = v.zones.includes(z.id);
            const price = zonePrice(settings, v, z.id);
            const free = z.id === "visor" && full;
            return (
              <button
                key={z.id}
                type="button"
                onClick={() => toggle(z.id)}
                onMouseEnter={() => setHover(z.id)}
                onMouseLeave={() => setHover(null)}
                className={cx(
                  "flex w-full items-center gap-4 rounded-xl border px-4 py-3 text-left transition-all",
                  on ? "border-axis-red/70 bg-axis-red/10" : "border-white/10 bg-white/[.02] hover:border-white/25",
                )}
              >
                <span className={cx("grid h-6 w-6 shrink-0 place-items-center rounded-md border transition", on ? "border-axis-red bg-axis-red" : "border-white/25")}>
                  {on && <Check size={15} strokeWidth={3} />}
                </span>
                <span className="flex-1">
                  <span className="block font-medium text-white">{zoneLabel(z.id, v)}</span>
                  <span className="block text-xs text-white/50">{z.desc}</span>
                </span>
                <span className="text-right font-display font-semibold tabular-nums">
                  {free ? (
                    <span className="flex items-center gap-1 text-emerald-400"><Gift size={14} /> Free</span>
                  ) : (
                    <span className={on ? "text-white" : "text-white/50"}>{price == null ? "—" : money(price)}</span>
                  )}
                </span>
              </button>
            );
          })}

          <label className="mt-4 flex cursor-pointer items-center gap-4 rounded-xl border border-white/10 bg-white/[.02] px-4 py-3">
            <input type="checkbox" className="h-5 w-5 accent-[#da281b]" checked={v.removal} onChange={(e) => update({ removal: e.target.checked })} />
            <span className="flex-1">
              <span className="block font-medium">Old tint needs to come off</span>
              <span className="block text-xs text-white/50">Bubbling, purple or peeling film. We strip it clean first.</span>
            </span>
            <span className="font-display font-semibold text-white/70">+{money(settings.removalFee)}</span>
          </label>

          {!full && v.zones.some((z) => FULL_VEHICLE.includes(z)) && (
            <p className="flex items-center gap-2 pt-2 text-sm text-white/55">
              <Gift size={15} className="text-axis-bright" /> Add the rest of the sides and back glass to get the visor strip free.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const PRESETS = [
  { label: "Arizona classic", front: 35, rear: 20 },
  { label: "Stealth", front: 35, rear: 5 },
  { label: "All-around 35", front: 35, rear: 35 },
  { label: "Heat only", front: 70, rear: 70 },
];

export function ShadeStep() {
  const [v, update] = useVehicle();
  const [editing, setEditing] = useState<"front" | "rear">("front");
  const [view, setView] = useState<"outside" | "inside">("outside");
  const hasFront = v.zones.includes("frontSides");
  const hasRear = v.zones.includes("rearSides") || v.zones.includes("rearWindshield");
  const target = editing === "front" && hasFront ? "front" : hasRear ? "rear" : "front";
  const current = target === "front" ? v.frontVlt : v.rearVlt;
  const legal = frontsLegal(v);
  const film = FILMS[v.film];

  return (
    <div>
      <StepHeader eyebrow="Step 3 · Shade & film" title="Dial in your look" sub="Lower % is darker. Flip to the driver's seat to see what the road looks like through it." />

      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#141417] to-[#0b0b0c]">
        <div className="absolute left-4 top-4 z-10">
          <Segmented size="sm" value={view} onChange={setView} options={[
            { value: "outside", label: <span className="flex items-center gap-1.5"><Eye size={13} /> Outside</span> },
            { value: "inside", label: <span className="flex items-center gap-1.5"><Sun size={13} /> Driver's seat</span> },
          ]} />
        </div>
        <div className="absolute right-4 top-4 z-10 text-right">
          <div className="font-display text-3xl font-bold tabular-nums">{current}%</div>
          <div className="text-[11px] uppercase tracking-widest text-white/45">{target === "front" ? "Front doors" : "Rear & back"}</div>
        </div>
        <div className="pt-16 sm:pt-10">
          {view === "outside" ? (
            <CarVisualizer body={v.body} paint={v.paint} zones={v.zones} frontVlt={v.frontVlt} rearVlt={v.rearVlt} className="w-full" />
          ) : (
            <DriverView vlt={current} className="w-full" />
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Chip key={p.label} selected={v.frontVlt === p.front && v.rearVlt === p.rear} onClick={() => update({ frontVlt: p.front, rearVlt: p.rear })}>
            {p.label} <span className="ml-1 text-xs text-white/45">{p.front}/{p.rear}</span>
          </Chip>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[.02] p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Segmented value={target} onChange={setEditing} options={[
            ...(hasFront ? [{ value: "front" as const, label: `Front doors · ${v.frontVlt}%` }] : []),
            ...(hasRear ? [{ value: "rear" as const, label: `Rear & back · ${v.rearVlt}%` }] : []),
          ]} />
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {AUTO_SHADES.map((s) => {
            const sel = current === s.vlt;
            const illegal = target === "front" && s.vlt < AZ_FRONT_MIN_VLT;
            return (
              <button
                key={s.vlt}
                type="button"
                onClick={() => update(target === "front" ? { frontVlt: s.vlt } : { rearVlt: s.vlt })}
                className={cx("group rounded-xl border p-2 text-left transition-all", sel ? "border-axis-red shadow-glow" : "border-white/10 hover:border-white/30")}
              >
                <div className="relative h-14 overflow-hidden rounded-lg bg-gradient-to-br from-sky-300 via-amber-100 to-orange-300">
                  <div className="absolute inset-0 bg-black" style={{ opacity: tintOpacity(s.vlt) }} />
                  <div className="absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-transparent" />
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="font-display text-lg font-semibold">{s.vlt}%</span>
                  {illegal && <AlertTriangle size={13} className="text-amber-400" />}
                </div>
                <div className="text-xs text-white/50">{s.name}</div>
              </button>
            );
          })}
        </div>
        <div className={cx("mt-4 flex items-start gap-3 rounded-xl px-4 py-3 text-sm", legal ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-200")}>
          {legal ? <ShieldCheck size={18} className="mt-0.5 shrink-0" /> : <AlertTriangle size={18} className="mt-0.5 shrink-0" />}
          {legal ? (
            <span>Arizona street-legal. Front doors must let in at least {AZ_FRONT_MIN_VLT}% of light; rear glass can go as dark as you like.</span>
          ) : (
            <span>
              {v.frontVlt}% on the front doors is darker than Arizona allows ({AZ_FRONT_MIN_VLT}% minimum) unless you have a medical exemption.{" "}
              <button type="button" className="font-semibold underline underline-offset-2" onClick={() => update({ frontVlt: 35 })}>Switch fronts to 35%</button>
            </span>
          )}
        </div>
      </div>

      <h2 className="mb-3 mt-8 font-display text-xl font-semibold">Film</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(FILMS) as FilmTier[]).map((id) => {
          const f = FILMS[id];
          return (
            <Choice key={id} selected={v.film === id} onClick={() => update({ film: id })} className="!p-5">
              {id === "ceramic" && <span className="absolute right-4 top-4 rounded-full bg-axis-red px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">Most popular</span>}
              <div className="font-display text-xl font-semibold">{f.name}</div>
              <p className="mt-1 text-sm text-white/60">{f.tagline}</p>
              <div className="mt-4 space-y-2">
                <Meter icon={<Thermometer size={14} />} label="Infrared heat rejected" value={f.irr} />
                <Meter icon={<Sun size={14} />} label="UV blocked" value={f.uv} />
              </div>
              <ul className="mt-4 space-y-1.5 text-sm text-white/70">
                {f.perks.map((p) => <li key={p} className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-axis-bright" />{p}</li>)}
              </ul>
            </Choice>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-white/40">{film.name} performance figures are manufacturer maximums. Full windshields always use clear ceramic.</p>
    </div>
  );
}

function Meter({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-white/60">
        <span className="flex items-center gap-1.5">{icon}{label}</span>
        <span className="font-semibold text-white">up to {value}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-axis-deep to-axis-bright transition-all duration-700" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
