import { useState } from "react";
import { AlertTriangle, Car, Check, Home, Pencil } from "lucide-react";
import {
  AUTO_SHADES, AZ_FRONT_MIN_VLT, BODY_TYPES, FILMS, HOME_FILMS, HOME_GOALS, PANES, PAINTS, REGIONS, ZONES,
  type FilmTier, type HomeFilm, type HomeGoal, type RegionId,
} from "../../data/config";
import { CarVisualizer } from "../../components/CarVisualizer";
import { Badge, Button, Card, CardHeader, Chip, Counter, Field, Input, KeyValue, Segmented, Select, Toggle, cx } from "../../components/ui";
import { frontsLegal, homePaneCount, homeSqft, zoneLabel } from "../../lib/pricing";
import { getSettings, leads } from "../../lib/store";
import type { HomeSpec, Lead, VehicleSpec } from "../../lib/types";
import { INITIAL } from "../../pages/quote/context";
import { BLANK_HOME, requote } from "./jobUtils";

/** Saves a change and re-prices the instant quote from it (an agreed price, if set, still wins). */
function apply(id: string, patch: (l: Lead) => Partial<Lead>) {
  leads.update(id, (l) => {
    const p = patch(l);
    return { ...p, quote: requote({ ...l, ...p }, getSettings()) };
  });
}

export function DetailsCard({ lead }: { lead: Lead }) {
  const [editing, setEditing] = useState(false);
  const vehicle = lead.kind === "vehicle";
  return (
    <Card>
      <CardHeader title={vehicle ? "Vehicle" : "Property & film"} icon={vehicle ? <Car size={16} /> : <Home size={16} />}
        actions={<Button size="sm" variant={editing ? "primary" : "ghost"} onClick={() => setEditing(!editing)}>{editing ? <><Check size={14} /> Done</> : <><Pencil size={14} /> Edit</>}</Button>} />
      {vehicle ? <VehicleDetails lead={lead} editing={editing} /> : <FlatDetails lead={lead} editing={editing} />}
    </Card>
  );
}

const shadeName = (vlt: number) => AUTO_SHADES.find((s) => s.vlt === vlt)?.name;

function VehicleDetails({ lead, editing }: { lead: Lead; editing: boolean }) {
  const v = lead.vehicle ?? INITIAL.vehicle;
  const set = (p: Partial<VehicleSpec>) => apply(lead.id, (l) => ({ vehicle: { ...(l.vehicle ?? INITIAL.vehicle), ...p } }));
  const toggleZone = (z: VehicleSpec["zones"][number]) => set({ zones: v.zones.includes(z) ? v.zones.filter((x) => x !== z) : [...v.zones, z] });
  const legal = frontsLegal(v);
  const body = BODY_TYPES.find((b) => b.id === v.body)!;
  const shade = (n: number) => `${n}%${shadeName(n) ? ` ${shadeName(n)}` : ""}`;

  return (
    <div>
      <div className="-mx-2 mb-2 rounded-2xl bg-gradient-to-b from-fg/[.05] to-transparent p-1">
        <CarVisualizer body={v.body} paint={v.paint || PAINTS[0].hex} zones={v.zones} frontVlt={v.frontVlt} rearVlt={v.rearVlt} stage={false} className="w-full" />
      </div>
      {!legal && (
        <p className="mb-3 flex items-start gap-2 rounded-xl bg-warn/10 px-3 py-2 text-xs text-warn">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> Front doors at {v.frontVlt}% are darker than Arizona's {AZ_FRONT_MIN_VLT}% limit. Send the dark tint waiver from Documents.
        </p>
      )}

      {!editing ? (
        <dl className="divide-y divide-fg/5">
          <KeyValue k="Vehicle">{v.ymm || <span className="text-fg/40">{body.label} · add year, make & model</span>}</KeyValue>
          {v.vin && <KeyValue k="VIN"><span className="font-mono text-xs tracking-wider">{v.vin}</span></KeyValue>}
          <KeyValue k="Body">{body.label}{PAINTS.find((p) => p.hex === v.paint) && ` · ${PAINTS.find((p) => p.hex === v.paint)!.name}`}</KeyValue>
          <KeyValue k="Windows">{v.zones.length ? v.zones.map((z) => zoneLabel(z, v)).join(", ") : <span className="text-fg/40">None picked</span>}</KeyValue>
          <KeyValue k="Film">{FILMS[v.film].name} · fronts {shade(v.frontVlt)} · rear {shade(v.rearVlt)}</KeyValue>
          {v.removal && <KeyValue k="Removal">Old tint removal</KeyValue>}
          <KeyValue k="Where">{[REGIONS.find((r) => r.id === lead.region)?.label, lead.city].filter(Boolean).join(" · ") || <span className="text-fg/40">Not set</span>}</KeyValue>
          {lead.garage && <KeyValue k="Garage">{lead.garage === "yes" ? "Yes, covered spot" : <Badge tone="warn">No garage: find shade or reschedule for weather</Badge>}</KeyValue>}
        </dl>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Year, make & model"><Input value={v.ymm} onChange={(e) => set({ ymm: e.target.value })} placeholder="2024 Toyota Tacoma" className="!py-2.5" /></Field>
            <Field label="VIN" hint={v.vin ? `${v.vin.length}/17` : "Optional"}>
              <Input value={v.vin ?? ""} maxLength={17} onChange={(e) => set({ vin: e.target.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "") || undefined })} className="!py-2.5 font-mono uppercase tracking-wider" />
            </Field>
            <Field label="Body">
              <Select value={v.body} onChange={(e) => set({ body: e.target.value as VehicleSpec["body"] })} className="!py-2.5">
                {BODY_TYPES.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
              </Select>
            </Field>
            <div>
              <div className="mb-1.5 text-sm font-medium text-fg/80">Paint</div>
              <div className="flex flex-wrap gap-2">
                {PAINTS.map((p) => (
                  <button key={p.id} type="button" title={p.name} aria-label={p.name} onClick={() => set({ paint: p.hex })} style={{ background: p.hex }}
                    className={cx("h-9 w-9 rounded-full border-2 transition", v.paint === p.hex ? "scale-110 border-fg" : "border-fg/15 hover:border-fg/40")} />
                ))}
              </div>
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-sm font-medium text-fg/80">Windows</div>
            <div className="flex flex-wrap gap-1.5">{ZONES.map((z) => <Chip key={z.id} size="sm" selected={v.zones.includes(z.id)} onClick={() => toggleZone(z.id)}>{zoneLabel(z.id, v)}</Chip>)}</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <div className="mb-1.5 text-sm font-medium text-fg/80">Film</div>
              <Segmented size="sm" value={v.film} onChange={(film: FilmTier) => set({ film })} options={(Object.keys(FILMS) as FilmTier[]).map((f) => ({ value: f, label: FILMS[f].name }))} />
            </div>
            <Field label="Front doors">
              <Select value={v.frontVlt} onChange={(e) => set({ frontVlt: Number(e.target.value) })} className={cx("!py-2.5", v.frontVlt < AZ_FRONT_MIN_VLT && "border-warn/60")}>
                {AUTO_SHADES.map((s) => <option key={s.vlt} value={s.vlt}>{s.vlt}% {s.name}{s.vlt < AZ_FRONT_MIN_VLT ? " (waiver)" : ""}</option>)}
              </Select>
            </Field>
            <Field label="Rear & back glass">
              <Select value={v.rearVlt} onChange={(e) => set({ rearVlt: Number(e.target.value) })} className="!py-2.5">
                {AUTO_SHADES.map((s) => <option key={s.vlt} value={s.vlt}>{s.vlt}% {s.name}</option>)}
              </Select>
            </Field>
          </div>
          <Toggle checked={v.removal} onChange={(removal) => set({ removal })} label="Old tint removal" />
          <Where lead={lead} />
          <div>
            <div className="mb-1.5 text-sm font-medium text-fg/80">Garage or covered spot</div>
            <Segmented size="sm" value={lead.garage ?? "unknown"} onChange={(g) => leads.update(lead.id, { garage: g === "unknown" ? null : g })}
              options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "unknown", label: "Not sure" }]} />
          </div>
        </div>
      )}
    </div>
  );
}

function Where({ lead }: { lead: Lead }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Area">
        <Select value={lead.region ?? ""} onChange={(e) => apply(lead.id, () => ({ region: (e.target.value || null) as RegionId | null }))} className="!py-2.5">
          <option value="">Not set</option>
          {REGIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </Select>
      </Field>
      <Field label="City"><Input value={lead.city} onChange={(e) => leads.update(lead.id, { city: e.target.value })} className="!py-2.5" /></Field>
    </div>
  );
}

function FlatDetails({ lead, editing }: { lead: Lead; editing: boolean }) {
  const h = lead.home ?? BLANK_HOME;
  const set = (p: Partial<HomeSpec>) => apply(lead.id, (l) => ({ home: { ...(l.home ?? BLANK_HOME), ...p } }));
  const film = HOME_FILMS[h.film];
  const toggleGoal = (g: HomeGoal) => set({ goals: h.goals.includes(g) ? h.goals.filter((x) => x !== g) : [...h.goals, g] });
  const measured = (lead.rooms ?? []).filter((r) => r.items.length).length;
  const panes = homePaneCount(h);

  if (!editing) {
    return (
      <dl className="divide-y divide-fg/5">
        <KeyValue k="Address">{lead.address || <span className="text-fg/40">Same as customer{lead.city ? ` · ${lead.city}` : ""}</span>}</KeyValue>
        <KeyValue k="Goals">{h.goals.length ? h.goals.map((g) => HOME_GOALS.find((x) => x.id === g)?.label).join(", ") : <span className="text-fg/40">Not set</span>}</KeyValue>
        <KeyValue k="Film">{film.name} · {h.shade}</KeyValue>
        <KeyValue k="Windows">{panes ? `${panes} windows · ~${homeSqft(h)} sq ft (estimate)` : <span className="text-fg/40">No estimate</span>}{measured > 0 && <span className="text-fg/50"> · {measured} room{measured > 1 ? "s" : ""} measured</span>}</KeyValue>
        <KeyValue k="Area">{[REGIONS.find((r) => r.id === lead.region)?.label, lead.city].filter(Boolean).join(" · ") || <span className="text-fg/40">Not set</span>}</KeyValue>
      </dl>
    );
  }
  return (
    <div className="space-y-4">
      <Field label="Job address" hint="Blank = customer's address"><Input value={lead.address ?? ""} onChange={(e) => leads.update(lead.id, { address: e.target.value || undefined })} placeholder="Street, city" className="!py-2.5" /></Field>
      <div>
        <div className="mb-1.5 text-sm font-medium text-fg/80">Goals</div>
        <div className="flex flex-wrap gap-1.5">{HOME_GOALS.map((g) => <Chip key={g.id} size="sm" selected={h.goals.includes(g.id)} onClick={() => toggleGoal(g.id)}>{g.label}</Chip>)}</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className="mb-1.5 text-sm font-medium text-fg/80">Film</div>
          <Segmented size="sm" value={h.film} onChange={(f: HomeFilm) => set({ film: f, shade: HOME_FILMS[f].shades.some((s) => s.name === h.shade) ? h.shade : HOME_FILMS[f].shades[0].name })}
            options={(Object.keys(HOME_FILMS) as HomeFilm[]).map((f) => ({ value: f, label: HOME_FILMS[f].name.replace("Edge ", "") }))} />
        </div>
        <Field label="Shade">
          <Select value={h.shade} onChange={(e) => set({ shade: e.target.value })} className="!py-2.5">
            {film.shades.map((s) => <option key={s.name} value={s.name}>{s.name} · {s.vlt}% light</option>)}
          </Select>
        </Field>
      </div>
      <div>
        <div className="mb-1 text-sm font-medium text-fg/80">Window estimate</div>
        <p className="mb-2 text-xs text-fg/45">For the instant quote. Real sizes go in Measurements.</p>
        <div className="divide-y divide-fg/5">
          {PANES.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 py-2">
              <div><div className="text-sm">{p.label}</div><div className="text-xs text-fg/40">{p.hint} · ~{p.sqft} sq ft</div></div>
              <Counter value={h.panes[p.id] || 0} onChange={(n) => set({ panes: { ...h.panes, [p.id]: n } })} />
            </div>
          ))}
        </div>
      </div>
      <Where lead={lead} />
    </div>
  );
}
