import { useEffect, useState } from "react";
import { AlertTriangle, Check, Copy, Home, MessageSquare, Navigation } from "lucide-react";
import { Avatar, Badge, Button, Card, cx } from "../../components/ui";
import { firstName } from "../../lib/format";
import { directionsLegs, routeLink, sendRoute, type MemberRoute } from "../../lib/routing";
import { copyText } from "../jobs/SendSheet";
import { clock, dur, isApprox, miles } from "./util";

/** What changed for a stop in a proposed plan, e.g. "from Sample Installer" or "was 1:00 PM". */
export type StopNotes = Record<string, string[]>;

/** One person's day: where they leave from, each stop with its drive, and how to send or open the route. */
export function RouteCard({ route, manage, notes, selectedId, onSelect, returnToBase, preview }: {
  route: MemberRoute;
  manage: boolean;
  notes?: StopNotes;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  returnToBase: boolean;
  /** A proposed plan: hide send/share until it's applied. */
  preview?: boolean;
}) {
  const { member, stops } = route;
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (copied) { const t = setTimeout(() => setCopied(false), 2000); return () => clearTimeout(t); } }, [copied]);

  const first = stops[0];
  const leave = first ? first.arrive - first.driveMin : null;
  const legs = stops.length ? directionsLegs(member.base, stops.map((p) => ({ lat: p.stop.point?.lat, lng: p.stop.point?.lng, address: p.stop.address }))) : [];
  const link = !preview && stops.length ? routeLink(route) : "";
  const late = stops.filter((p) => p.late).length;
  const approx = stops.filter((p) => isApprox(p.stop)).length;

  return (
    <Card className="!p-0">
      <div className="flex flex-wrap items-center gap-3 p-4 sm:px-5">
        <Avatar name={member.name} color={member.color} size={36} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display font-semibold">{member.name}</div>
          <div className="text-xs text-fg/50 tabular-nums">
            {stops.length} stop{stops.length === 1 ? "" : "s"} · {dur(route.driveMin + route.returnMin)} driving · {miles(route.driveMiles)}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {route.overtime && <Badge tone="warn">Past {clock(member.end)}</Badge>}
          {late > 0 && <Badge tone="danger">{late} late</Badge>}
          {approx > 0 && <Badge tone="warn" icon={<AlertTriangle size={11} />}>{approx} approximate</Badge>}
        </div>
      </div>

      {!stops.length ? (
        <p className="border-t border-fg/5 px-4 py-4 text-sm text-fg/45 sm:px-5">No stops for {firstName(member.name)} this day.</p>
      ) : (
        <ol className="border-t border-fg/5 px-2 py-2 sm:px-3">
          <li className="flex items-center gap-3 px-2 py-1.5 text-xs text-fg/45">
            <span className="grid w-7 shrink-0 place-items-center"><Home size={14} /></span>
            <span className="min-w-0 truncate">Leave {member.baseLabel}{leave != null && ` · ${clock(leave)}`}</span>
          </li>
          {stops.map((p, i) => {
            const on = selectedId === p.stop.id;
            const extra = notes?.[p.stop.id] ?? [];
            return (
              <li key={p.stop.id} id={`stop-${p.stop.id}`}>
                <div className="flex items-center gap-3 px-2 py-0.5 text-[11px] text-fg/40 tabular-nums">
                  <span className="flex w-7 shrink-0 justify-center"><span className="h-3 w-px bg-fg/15" /></span>
                  {dur(p.driveMin)} · {miles(p.driveMiles)}
                </div>
                <button type="button" onClick={() => onSelect?.(p.stop.id)} aria-pressed={on}
                  className={cx("flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left transition", on ? "bg-fg/[.07]" : "hover:bg-fg/[.04]")}>
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full font-display text-xs font-bold text-on-accent" style={{ background: member.color }}>{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-display text-sm font-semibold tabular-nums">{clock(p.start)}–{clock(p.end)}</span>
                      <span className="truncate text-sm">{p.stop.customer || p.stop.title}</span>
                    </span>
                    <span className="block truncate text-xs text-fg/50">{p.stop.title}{p.stop.address && ` · ${p.stop.address}`}</span>
                    {(p.late || isApprox(p.stop) || extra.length > 0 || p.stop.locked || p.arrive < p.start - 10) && (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {p.stop.locked && <Badge>Locked</Badge>}
                        {p.late && <Badge tone="danger">After their window</Badge>}
                        {!p.stop.point ? <Badge tone="warn">No location</Badge> : p.stop.point.source === "city" && <Badge tone="warn">Town center only</Badge>}
                        {p.arrive < p.start - 10 && <Badge>Waits {dur(p.start - p.arrive)}</Badge>}
                        {extra.map((n) => <Badge key={n} tone="info">{n}</Badge>)}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
          {returnToBase && (
            <li>
              <div className="flex items-center gap-3 px-2 py-0.5 text-[11px] text-fg/40 tabular-nums">
                <span className="flex w-7 shrink-0 justify-center"><span className="h-3 w-px bg-fg/15" /></span>
                {dur(route.returnMin)}
              </div>
              <div className="flex items-center gap-3 px-2 py-1.5 text-xs text-fg/45">
                <span className="grid w-7 shrink-0 place-items-center"><Home size={14} /></span>
                Back at {member.baseLabel} · {clock(route.finish)}
              </div>
            </li>
          )}
        </ol>
      )}

      {stops.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-fg/5 p-3 sm:px-5">
          {manage && !preview && (
            <Button size="sm" onClick={() => sendRoute(route)} disabled={!member.phone} title={member.phone ? undefined : "Add a phone number under Settings → Staff"}>
              <MessageSquare size={14} /> Text route to {firstName(member.name)}
            </Button>
          )}
          {legs.map((url, i) => (
            <a key={url} href={url} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline" tabIndex={-1}>
                <Navigation size={14} /> {legs.length === 1 ? "Google Maps" : `Leg ${i + 1} · stops ${i * 4 + 1}–${Math.min(stops.length, i * 4 + 4)}`}
              </Button>
            </a>
          ))}
          {link && (
            <Button size="sm" variant="ghost" onClick={async () => { await copyText(link); setCopied(true); }}>
              {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy link</>}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
