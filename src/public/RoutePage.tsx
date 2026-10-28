import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { Check, Home, MessageSquare, Navigation, Phone, StickyNote } from "lucide-react";
import { RouteMap, type MapRoute } from "../components/RouteMap";
import { Badge, Button, Card, Logo, cx } from "../components/ui";
import { BUSINESS } from "../data/config";
import { digits, firstName, time12 } from "../lib/format";
import { decodeSnap } from "../lib/links";
import { directionsLegs, roadPath, type RouteSnap } from "../lib/routing";
import type { LatLng } from "../lib/types";
import { prettyDate } from "../lib/schedule";

type SnapStop = RouteSnap["stops"][number];

const dur = (min: number) => {
  const m = Math.max(0, Math.round(min));
  return m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60}h`;
};
const place = (s: { lat?: number; lng?: number; address?: string }) => (s.lat != null && s.lng != null ? `${s.lat},${s.lng}` : s.address ?? "");
const googleTo = (s: SnapStop) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place(s))}&travelmode=driving`;
const appleTo = (s: SnapStop) => `https://maps.apple.com/?daddr=${encodeURIComponent(place(s))}&dirflg=d`;
const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// Ticked-off stops are a per-phone convenience; the shop's calendar is the record.
const doneKey = (id: string) => `axisRouteDone.${id}`;
function readDone(id: string): string[] {
  try { return JSON.parse(localStorage.getItem(doneKey(id)) || "[]"); } catch { return []; }
}
function writeDone(id: string, ids: string[]) {
  try { localStorage.setItem(doneKey(id), JSON.stringify(ids)); } catch { /* private mode */ }
}

/** A crew member's route for the day, opened from the link the office texted. Works on any phone, no sign-in. */
export default function RoutePage() {
  const { id = "" } = useParams();
  const snap = useMemo(() => {
    const s = decodeSnap<RouteSnap>(location.hash);
    return s && Array.isArray(s.stops) && s.member ? s : null;
  }, []);
  const [done, setDone] = useState<string[]>(() => readDone(id));
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => writeDone(id, done), [id, done]);
  const ios = useMemo(isIos, []);
  const [path, setPath] = useState<LatLng[] | null>(null);
  useEffect(() => {
    if (!snap) return;
    const pts = snap.stops.filter((s) => s.lat != null && s.lng != null).map((s) => ({ lat: s.lat!, lng: s.lng! }));
    if (!pts.length) return;
    const home = { lat: snap.base.lat, lng: snap.base.lng };
    roadPath([home, ...pts, ...(snap.returnMin > 0 ? [home] : [])]).then(setPath).catch(() => {});
  }, [snap]);

  const mapRoutes = useMemo<MapRoute[]>(() => !snap ? [] : [{
    id: snap.member.id,
    color: snap.member.color || "rgb(var(--c-accent))",
    base: { lat: snap.base.lat, lng: snap.base.lng, label: snap.base.label },
    returnToBase: snap.returnMin > 0,
    path,
    stops: snap.stops.filter((s) => s.lat != null && s.lng != null).map((s, i) => ({ id: s.id, n: i + 1, lat: s.lat!, lng: s.lng!, label: `${time12(s.start)} · ${s.customer}`, done: done.includes(s.id) })),
  }], [snap, done, path]);

  if (!snap) {
    return (
      <Shell>
        <Card className="text-center">
          <p className="font-display text-lg">Route link is incomplete</p>
          <p className="mt-1 text-sm text-fg/60">Ask the office to send it again, or call <a className="text-accent-fg" href={BUSINESS.phoneHref}>{BUSINESS.phone}</a>.</p>
        </Card>
      </Shell>
    );
  }

  const legs = directionsLegs({ lat: snap.base.lat, lng: snap.base.lng }, snap.stops);
  const left = snap.stops.filter((s) => !done.includes(s.id)).length;
  const toggle = (sid: string) => setDone((d) => (d.includes(sid) ? d.filter((x) => x !== sid) : [...d, sid]));
  const pick = (sid: string) => {
    setSelected(sid);
    document.getElementById(`rstop-${sid}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  return (
    <Shell>
      <div className="text-center">
        <div className="font-display text-xs font-semibold uppercase tracking-[.3em] text-accent-fg">Hi {firstName(snap.member.name)}, your route</div>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">{prettyDate(snap.date)}</h1>
        <p className="mt-2 text-sm text-fg/55 tabular-nums">
          {snap.stops.length} stop{snap.stops.length === 1 ? "" : "s"} · {dur(snap.driveMin + snap.returnMin)} driving · {Math.round(snap.driveMiles)} mi
          {snap.stops[0] && ` · first at ${time12(snap.stops[0].start)}`}
        </p>
        {snap.stops.length > 0 && <div className="mt-2"><Badge tone={left ? "info" : "success"}>{left ? `${left} to go` : "All done"}</Badge></div>}
      </div>

      {legs.length > 0 && (
        <div className="mt-6 grid gap-2">
          {legs.map((url, i) => (
            <a key={url} href={url} target="_blank" rel="noreferrer">
              <Button size="lg" className="w-full" variant={i ? "outline" : "primary"} tabIndex={-1}>
                <Navigation size={18} /> {legs.length === 1 ? "Start route in Google Maps" : `Leg ${i + 1}: stops ${i * 4 + 1}–${Math.min(snap.stops.length, i * 4 + 4)}`}
              </Button>
            </a>
          ))}
        </div>
      )}

      {mapRoutes[0]?.stops.length > 0 && (
        <RouteMap routes={mapRoutes} selectedId={selected} onSelect={pick} fitKey={id} className="mt-5 h-64" label="Your route" />
      )}

      <ol className="mt-5 space-y-3">
        <li className="flex items-center gap-3 px-1 text-sm text-fg/50"><Home size={16} /> Leave {snap.base.label}</li>
        {snap.stops.map((s, i) => {
          const isDone = done.includes(s.id);
          return (
            <li key={s.id} id={`rstop-${s.id}`}>
              <div className="mb-1 px-1 text-xs text-fg/40 tabular-nums">{dur(s.driveMin)} drive</div>
              <Card className={cx("!p-4 transition", isDone && "opacity-60", selected === s.id && "border-fg/30")}>
                <div className="flex items-start gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full font-display text-sm font-bold text-on-accent" style={{ background: snap.member.color || "rgb(var(--c-accent))" }}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-display font-semibold tabular-nums">{time12(s.start)}–{time12(s.end)}</div>
                    <div className={cx("truncate", isDone && "line-through")}>{s.customer}</div>
                    <div className="text-sm text-fg/55">{s.title}</div>
                    {s.address && <div className="mt-1 text-sm text-fg/70">{s.address}</div>}
                    {s.notes && <div className="mt-2 flex gap-1.5 rounded-lg bg-fg/[.04] px-2.5 py-2 text-xs text-fg/65"><StickyNote size={13} className="mt-0.5 shrink-0" />{s.notes}</div>}
                  </div>
                  <button type="button" role="checkbox" aria-checked={isDone} aria-label={`Mark stop ${i + 1} done`} onClick={() => toggle(s.id)}
                    className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition", isDone ? "border-success bg-success text-on-accent" : "border-fg/25 text-fg/25")}>
                    <Check size={16} />
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <a href={ios ? appleTo(s) : googleTo(s)} target="_blank" rel="noreferrer"><Button size="sm" className="w-full" tabIndex={-1}><Navigation size={14} /> Go</Button></a>
                  {s.phone ? <a href={`tel:${digits(s.phone)}`}><Button size="sm" variant="outline" className="w-full" tabIndex={-1}><Phone size={14} /> Call</Button></a> : <span />}
                  {s.phone ? <a href={`sms:${digits(s.phone)}`}><Button size="sm" variant="outline" className="w-full" tabIndex={-1}><MessageSquare size={14} /> Text</Button></a> : <span />}
                </div>
                {ios && <a href={googleTo(s)} target="_blank" rel="noreferrer" className="mt-2 block text-center text-xs text-fg/45 underline underline-offset-2">Open in Google Maps instead</a>}
              </Card>
            </li>
          );
        })}
        {snap.returnMin > 0 && (
          <li>
            <div className="mb-1 px-1 text-xs text-fg/40 tabular-nums">{dur(snap.returnMin)} drive</div>
            <div className="flex items-center gap-3 px-1 text-sm text-fg/50"><Home size={16} /> Back to {snap.base.label}</div>
          </li>
        )}
      </ol>
      <p className="mt-6 text-center text-xs text-fg/35">Sent {new Date(snap.sentAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}. If the office changes your day, they'll text a new link.</p>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg px-4 pb-16 pt-8 text-fg">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,rgb(var(--c-accent-bright)_/_.18),transparent_70%)]" />
      <div className="relative mx-auto max-w-lg">
        <Logo className="mx-auto mb-8 h-12" />
        {children}
        <div className="mt-10 flex items-center justify-center gap-4 text-sm text-fg/45">
          <a href={BUSINESS.phoneHref} className="inline-flex items-center gap-1.5 hover:text-fg"><Phone size={14} /> Office {BUSINESS.phone}</a>
        </div>
      </div>
    </div>
  );
}
