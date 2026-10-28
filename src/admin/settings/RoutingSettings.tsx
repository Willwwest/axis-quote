import { useState } from "react";
import { ChevronDown, Clock, Cpu, Loader2, MapPin, Route as RouteIcon, ShieldCheck, Users } from "lucide-react";
import { Avatar, Badge, Button, Card, CardHeader, Chip, Choice, Field, Input, Select, Toggle, cx } from "../../components/ui";
import { REGIONS, type CrewProfile, type RegionId, type RoutingSettings as Routing } from "../../data/config";
import { time12 } from "../../lib/format";
import { geocodeAddress, locateAddress } from "../../lib/routing";
import { OWNER_ID, ownerUser } from "../../lib/session";
import { patchSettings, staff, useSettings } from "../../lib/store";
import type { GeoPoint, Role } from "../../lib/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const halfHours = (from: number, to: number) => Array.from({ length: (to - from) * 2 + 1 }, (_, i) => `${String(from + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
const SOURCE: Record<GeoPoint["source"], string> = { geocoded: "Street address", city: "Town center", manual: "Set by hand", sample: "Sample data" };

const patch = (p: Partial<Routing>) => patchSettings((x) => ({ routing: { ...x.routing, ...p } }));
const patchCrew = (id: string, p: Partial<CrewProfile>) =>
  patchSettings((x) => ({ routing: { ...x.routing, crew: { ...x.routing.crew, [id]: { ...x.routing.crew[id], ...p } } } }));

/** Where routes start, how drive times are worked out, and when and where each person works. */
export function RoutingSettings() {
  const s = useSettings();
  const r = s.routing;
  const [advanced, setAdvanced] = useState(() => r.travel === "ors" || r.optimizer === "vroom" || r.osrmUrl !== "https://router.project-osrm.org");
  const people = staff.use().filter((p) => p.active);
  const owner = ownerUser();
  const team: { id: string; name: string; color: string; role: Role }[] = [
    { id: OWNER_ID, name: owner.name, color: owner.color, role: "owner" },
    ...people.map((p) => ({ id: p.id, name: p.name, color: p.color, role: p.role })),
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold">Routing</h2>
        <p className="mt-1 text-sm text-fg/50">Used by Routes to plan each day: who goes where, in what order, and which day a job lands on.</p>
      </div>

      <Card>
        <CardHeader title="Home base" icon={<MapPin size={16} />} sub="Where the day starts and ends, unless someone has their own start below." />
        <AddressFinder value={r.base} onChange={(base) => patch({ base })} />
      </Card>

      <Card>
        <CardHeader title="Work day" icon={<Clock size={16} />} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Day starts">
            <Select value={r.dayStart} onChange={(e) => patch({ dayStart: e.target.value })}>
              {halfHours(5, 12).map((t) => <option key={t} value={t}>{time12(t)}</option>)}
            </Select>
          </Field>
          <Field label="Day ends">
            <Select value={r.dayEnd} onChange={(e) => patch({ dayEnd: e.target.value })}>
              {halfHours(12, 21).map((t) => <option key={t} value={t}>{time12(t)}</option>)}
            </Select>
          </Field>
          <Field label="Time added at each stop" hint="Parking, setup, walkthrough">
            <Select value={r.bufferMin} onChange={(e) => patch({ bufferMin: Number(e.target.value) })}>
              {[0, 5, 10, 15, 20, 30, 45].map((m) => <option key={m} value={m}>{m} minutes</option>)}
            </Select>
          </Field>
          <Field label="Most installs per person per day" hint="When planning the week">
            <Select value={r.maxJobsPerDay} onChange={(e) => patch({ maxJobsPerDay: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5, 6, 8].map((n) => <option key={n} value={n}>{n}</option>)}
            </Select>
          </Field>
        </div>
        <div className="mt-2">
          <Toggle checked={r.returnToBase} onChange={(returnToBase) => patch({ returnToBase })} label="Count the drive home" hint="Include the drive back to base at the end of the day." />
        </div>
      </Card>

      <Card>
        <CardHeader title="Drive times & optimizer" icon={<Cpu size={16} />} sub="Free and open source out of the box: no keys or sign-ups. If a service is down, plans fall back to distance estimates." />
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 text-sm font-medium text-fg/80">Road times</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Choice selected={r.travel !== "estimate"} onClick={() => patch({ travel: r.travel === "ors" && r.orsKey ? "ors" : "osrm" })}>
                <div className="font-medium">{r.travel === "ors" ? "OpenRouteService" : "OSRM"} <span className="text-fg/45">(free, open source)</span></div>
                <div className="mt-0.5 text-xs text-fg/50">Real road drive times and route lines from OpenStreetMap data.</div>
              </Choice>
              <Choice selected={r.travel === "estimate"} onClick={() => patch({ travel: "estimate" })}>
                <div className="font-medium">Distance estimate <span className="text-fg/45">(offline)</span></div>
                <div className="mt-0.5 text-xs text-fg/50">Straight-line distance × {r.detourFactor} at {r.avgMph} mph. No network calls.</div>
              </Choice>
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-sm font-medium text-fg/80">Optimizer</div>
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-fg/10 px-4 py-3 text-sm">
              <span className="font-medium">{r.optimizer === "vroom" && r.orsKey ? "VROOM via OpenRouteService" : "Built-in"}</span>
              <span className="text-fg/45">{r.optimizer === "vroom" && r.orsKey ? "(open source, free key)" : "(free, works offline)"}</span>
              <Badge tone="success">Ready</Badge>
            </div>
          </div>

          <div className="rounded-xl border border-fg/10">
            <button type="button" onClick={() => setAdvanced((a) => !a)} aria-expanded={advanced}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm">
              <span><span className="font-medium">Advanced</span> <span className="text-fg/45">· optional</span></span>
              <ChevronDown size={16} className={cx("text-fg/45 transition", advanced && "rotate-180")} />
            </button>
            {advanced && (
              <div className="space-y-4 border-t border-fg/10 p-4">
                <Field label="OSRM server" hint="Default: the free public server">
                  <Input value={r.osrmUrl} onChange={(e) => patch({ osrmUrl: e.target.value.trim() || "https://router.project-osrm.org" })} placeholder="https://router.project-osrm.org" />
                </Field>
                <p className="text-xs text-fg/45">The public OSRM server suits a small crew. For heavy use, run your own (it's open source) and paste its address here.</p>
                <div>
                  <div className="text-sm font-medium text-fg/80">OpenRouteService + VROOM</div>
                  <p className="mt-0.5 text-xs text-fg/45">Not needed. With a free key from openrouteservice.org you can use their road times and the open-source VROOM optimizer instead.</p>
                </div>
                <Field label="OpenRouteService key" hint="Optional">
                  <Input value={r.orsKey} onChange={(e) => {
                    const orsKey = e.target.value.trim();
                    patch(orsKey ? { orsKey } : { orsKey, travel: r.travel === "ors" ? "osrm" : r.travel, optimizer: "builtin" });
                  }} placeholder="Paste a key to unlock the options below" autoComplete="off" />
                </Field>
                <div className={cx("divide-y divide-fg/5", !r.orsKey && "pointer-events-none opacity-40")}>
                  <Toggle checked={r.travel === "ors"} onChange={(on) => patch({ travel: on ? "ors" : "osrm" })} label="Road times from OpenRouteService" hint="Instead of OSRM." />
                  <Toggle checked={r.optimizer === "vroom"} onChange={(on) => patch({ optimizer: on ? "vroom" : "builtin" })} label="Optimize with VROOM" hint="Instead of the built-in optimizer. Falls back to built-in if it's unreachable." />
                </div>
                {r.travel === "estimate" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Detour factor" hint="Road miles per straight mile">
                      <Input type="number" min={1} max={3} step={0.05} value={r.detourFactor} onChange={(e) => patch({ detourFactor: Number(e.target.value) || 1.3 })} />
                    </Field>
                    <Field label="Average speed" hint="mph">
                      <Input type="number" min={10} max={80} value={r.avgMph} onChange={(e) => patch({ avgMph: Number(e.target.value) || 45 })} />
                    </Field>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Address lookup" icon={<ShieldCheck size={16} />} sub="Turns job addresses into map spots. Until then, jobs sit at their town center." />
        <Select value={r.geocoder} onChange={(e) => patch({ geocoder: e.target.value as Routing["geocoder"] })}>
          <option value="nominatim">OpenStreetMap Nominatim (free)</option>
          <option value="photon">Photon (free, OpenStreetMap data)</option>
          <option value="off">Off: keep jobs at their town center</option>
        </Select>
        <p className="mt-2 text-xs text-fg/45">
          {r.geocoder === "off" ? "Routes still work, with rougher drive times."
            : "Only the street address is sent (never the customer's name or phone), one lookup a second, and the answer is saved on this device."}
        </p>
      </Card>

      <Card>
        <CardHeader title="Crew" icon={<Users size={16} />} sub="Who gets routed, where their day starts, and the days, hours and areas they work." />
        <ul className="-mx-2 divide-y divide-fg/5">
          {team.map((m) => <CrewRow key={m.id} member={m} profile={r.crew[m.id] ?? {}} dayStart={r.dayStart} dayEnd={r.dayEnd} />)}
        </ul>
      </Card>

      <p className="flex items-start gap-2 text-xs text-fg/40">
        <RouteIcon size={14} className="mt-0.5 shrink-0" />
        Built on open-source routing: OSRM, VROOM and OpenRouteService for drive times and optimizing, Nominatim and Photon for addresses,
        Leaflet and OpenStreetMap for the map, and U.S. Census place centers.
      </p>
    </div>
  );
}

function CrewRow({ member, profile, dayStart, dayEnd }: { member: { id: string; name: string; color: string; role: Role }; profile: CrewProfile; dayStart: string; dayEnd: string }) {
  const [open, setOpen] = useState(false);
  const field = profile.field ?? member.role !== "admin";
  const days = profile.days ?? [1, 2, 3, 4, 5];
  const regions = profile.regions ?? [];
  const p = (x: Partial<CrewProfile>) => patchCrew(member.id, x);
  const summary = field
    ? [days.map((d) => WEEKDAYS[d]).join(" "), `${time12(profile.start ?? dayStart)}–${time12(profile.end ?? dayEnd)}`,
      regions.length ? regions.map((id) => REGIONS.find((r) => r.id === id)?.label).join(", ") : "All areas"].join(" · ")
    : "Not routed";

  return (
    <li className="px-2 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={member.name} color={member.color} size={34} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{member.name}</div>
          <div className="truncate text-xs text-fg/45">{summary}{field && profile.base?.address ? ` · from ${profile.base.address}` : ""}</div>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)}>{open ? "Done" : "Edit"}</Button>
      </div>
      {open && (
        <div className="mt-3 space-y-4 rounded-xl border border-fg/10 p-4">
          <Toggle checked={field} onChange={(v) => p({ field: v })} label="Does field work" hint="Turn off for office-only people so they're never routed." />
          {field && (
            <>
              <div>
                <div className="mb-1.5 text-sm font-medium text-fg/80">Starts from</div>
                <AddressFinder value={profile.base ?? { address: "" }} onChange={(base) => p({ base: base.address ? base : undefined })} placeholder="Leave blank to start from home base" />
              </div>
              <div>
                <div className="mb-1.5 text-sm font-medium text-fg/80">Works</div>
                <div className="grid max-w-sm grid-cols-7 gap-1.5">
                  {WEEKDAYS.map((d, i) => {
                    const on = days.includes(i);
                    return (
                      <button key={d} type="button" aria-pressed={on} onClick={() => p({ days: on ? days.filter((n) => n !== i) : [...days, i].sort() })}
                        className={cx("h-9 min-w-0 rounded-lg border text-xs transition", on ? "border-accent bg-accent/20 text-fg" : "border-fg/10 text-fg/40 hover:text-fg")}>
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Starts">
                  <Select value={profile.start ?? ""} onChange={(e) => p({ start: e.target.value || undefined })}>
                    <option value="">Default ({time12(dayStart)})</option>
                    {halfHours(5, 12).map((t) => <option key={t} value={t}>{time12(t)}</option>)}
                  </Select>
                </Field>
                <Field label="Ends">
                  <Select value={profile.end ?? ""} onChange={(e) => p({ end: e.target.value || undefined })}>
                    <option value="">Default ({time12(dayEnd)})</option>
                    {halfHours(12, 21).map((t) => <option key={t} value={t}>{time12(t)}</option>)}
                  </Select>
                </Field>
              </div>
              <div>
                <div className="mb-1.5 text-sm font-medium text-fg/80">Areas <span className="font-normal text-fg/40">· none picked = all</span></div>
                <div className="flex flex-wrap gap-2">
                  {REGIONS.map((reg) => {
                    const on = regions.includes(reg.id);
                    return <Chip key={reg.id} size="sm" selected={on} onClick={() => p({ regions: on ? regions.filter((x) => x !== reg.id) : [...regions, reg.id as RegionId] })}>{reg.label}</Chip>;
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </li>
  );
}

/** Address box with a "Find on map" lookup. Falls back to the town center when the street can't be found. */
function AddressFinder({ value, onChange, placeholder }: { value: { address: string; geo?: GeoPoint }; onChange: (v: { address: string; geo?: GeoPoint }) => void; placeholder?: string }) {
  const [text, setText] = useState(value.address);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const find = async () => {
    const address = text.trim();
    if (!address) { onChange({ address: "" }); return; }
    setBusy(true);
    setMsg(null);
    try {
      const hit = await geocodeAddress(address);
      const geo = hit ?? locateAddress(address) ?? undefined;
      onChange({ address, geo });
      setMsg(hit ? null : geo ? "Street not found; using the town center." : "Couldn't find that address. Try adding the town, e.g. \"Prescott, AZ\".");
    } catch {
      const geo = locateAddress(address) ?? undefined;
      onChange({ address, geo });
      setMsg(geo ? "Address lookup is unavailable right now; using the town center." : "Address lookup is unavailable right now. Try again later.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} onBlur={() => text.trim() !== value.address && find()} placeholder={placeholder ?? "Street, town"} className="min-w-0 flex-1 basis-56" />
        <Button variant="outline" onClick={find} disabled={busy}>{busy ? <Loader2 size={15} className="animate-spin" /> : <MapPin size={15} />} Find on map</Button>
      </div>
      {value.geo && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-fg/50">
          <Badge tone={value.geo.source === "city" ? "warn" : "success"}>{SOURCE[value.geo.source]}</Badge>
          <span className="truncate">{value.geo.label ?? value.address}</span>
          <span className="tabular-nums text-fg/35">{value.geo.lat.toFixed(4)}, {value.geo.lng.toFixed(4)}</span>
        </div>
      )}
      {msg && <p className="mt-1.5 text-xs text-warn">{msg}</p>}
    </div>
  );
}
