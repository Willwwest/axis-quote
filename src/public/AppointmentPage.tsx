import { useMemo, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { CalendarCheck, CalendarPlus, CalendarX, Clock, MapPin, MessageSquare, Phone } from "lucide-react";
import { cancelAppointment } from "../admin/calendar/actions";
import { Badge, Button, Card, Logo } from "../components/ui";
import { BUSINESS } from "../data/config";
import { addMinutes, at, time12 } from "../lib/format";
import { decodeSnap } from "../lib/links";
import { apptSnap, appointmentIcs, mapsUrl, prettyDate, type AppointmentSnap } from "../lib/schedule";
import { appointments } from "../lib/store";

const WHAT: Record<AppointmentSnap["ty"], string> = { consult: "On-site consultation", install: "Tint installation", misc: "Appointment" };

/** Customer's view of one appointment: when, where, add to calendar, self-cancel. Always dark. */
export default function AppointmentPage() {
  const { id = "" } = useParams();
  const local = appointments.useOne(id);
  const fromLink = useMemo(() => decodeSnap<AppointmentSnap>(location.hash), []);
  const snap = local ? apptSnap(local) : fromLink;
  const [asking, setAsking] = useState(false);
  const [texted, setTexted] = useState(false);

  if (!snap) {
    return (
      <Shell>
        <Card className="text-center">
          <p className="text-fg/60">This appointment link looks incomplete. Call us at <a className="text-accent-fg" href={BUSINESS.phoneHref}>{BUSINESS.phone}</a> and we'll sort it out.</p>
        </Card>
      </Shell>
    );
  }

  const start = at(snap.d, snap.s);
  const upcoming = +start > Date.now();
  const cancelled = snap.st === "cancelled";
  const end = addMinutes(snap.s, snap.m);
  const ref = id.replace(/^AP-/, "");
  const cancelText = `Hi ${BUSINESS.name}, this is ${snap.n || "a customer"}. I need to cancel my appointment on ${prettyDate(snap.d)} at ${time12(snap.s)} (ref ${ref}).`;

  const cancel = () => {
    if (local) {
      cancelAppointment(local, { tellCustomer: false, by: "customer" });
    } else {
      // The booking lives on the shop's device, so let the crew know by text.
      setTexted(true);
      location.href = `${BUSINESS.smsHref}?&body=${encodeURIComponent(cancelText)}`;
    }
    setAsking(false);
  };

  const state = cancelled ? { tone: "danger" as const, label: "Cancelled" }
    : snap.st === "done" ? { tone: "success" as const, label: "Completed" }
    : snap.st === "checked_in" ? { tone: "warn" as const, label: "In progress" }
    : snap.st === "no_show" ? { tone: "neutral" as const, label: "Missed" }
    : upcoming ? { tone: "success" as const, label: "Confirmed" } : { tone: "neutral" as const, label: "Past" };

  return (
    <Shell>
      <div className="text-center">
        <div className="font-display text-xs font-semibold uppercase tracking-[.3em] text-accent-fg">{snap.n ? `Hi ${snap.n}, here's your` : "Your"} appointment</div>
        <h1 className={`mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl ${cancelled ? "text-fg/50 line-through" : ""}`}>{WHAT[snap.ty]}</h1>
        <div className="mt-3"><Badge tone={state.tone}>{state.label}</Badge></div>
      </div>

      {cancelled && (
        <Card tone="danger" className="mt-6 flex items-start gap-3">
          <CalendarX className="mt-0.5 shrink-0 text-danger" size={20} />
          <div className="text-sm text-fg/75">
            This appointment has been cancelled. Want a new time? Text or call us at <a href={BUSINESS.phoneHref} className="text-accent-fg">{BUSINESS.phone}</a>.
          </div>
        </Card>
      )}
      {texted && !cancelled && (
        <Card tone="warn" className="mt-6 text-sm text-fg/75">
          We opened a text to {BUSINESS.name} asking to cancel. Send it and we'll confirm. Didn't open? Call <a href={BUSINESS.phoneHref} className="text-accent-fg">{BUSINESS.phone}</a>.
        </Card>
      )}

      <Card className="mt-6 divide-y divide-fg/5 !p-0">
        <Row icon={<CalendarCheck size={18} />} label="When">
          <div className="font-medium">{prettyDate(snap.d)}</div>
          <div className="text-sm text-fg/60">{time12(snap.s)} – {time12(end)}</div>
        </Row>
        {snap.a && (
          <Row icon={<MapPin size={18} />} label="Where">
            <a href={mapsUrl(snap.a)} target="_blank" rel="noreferrer" className="font-medium underline decoration-fg/20 underline-offset-4 hover:decoration-accent">{snap.a}</a>
            <div className="text-sm text-fg/50">We come to you. Tap for directions.</div>
          </Row>
        )}
        <Row icon={<Clock size={18} />} label="What">
          <div className="font-medium">{snap.t}</div>
          <div className="text-sm text-fg/50">{snap.ty === "install" ? "Please have the vehicle or windows clear and accessible." : snap.ty === "consult" ? "We'll measure, show samples and price it on the spot." : "See you then."}</div>
        </Row>
      </Card>

      {!cancelled && upcoming && (
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Button size="lg" onClick={() => appointmentIcs({ id, date: snap.d, start: snap.s, durationMin: snap.m, title: `${BUSINESS.name}: ${WHAT[snap.ty]}` }, snap.a, `${snap.t}\n${BUSINESS.phone}`)}>
            <CalendarPlus size={18} /> Add to calendar
          </Button>
          <Button size="lg" variant="outline" onClick={() => (location.href = BUSINESS.smsHref)}><MessageSquare size={18} /> Text us</Button>
        </div>
      )}

      {!cancelled && upcoming && snap.st === "scheduled" && (
        <div className="mt-8 text-center">
          {asking ? (
            <Card className="text-left">
              <p className="font-display font-semibold">Cancel this appointment?</p>
              <p className="mt-1 text-sm text-fg/55">{prettyDate(snap.d)} at {time12(snap.s)}. You can always text us to rebook.</p>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Button variant="ghost" onClick={() => setAsking(false)}>Keep it</Button>
                <Button variant="danger" onClick={cancel}>Yes, cancel</Button>
              </div>
            </Card>
          ) : (
            <button type="button" onClick={() => setAsking(true)} className="text-sm text-fg/45 underline underline-offset-4 hover:text-fg">Need to cancel?</button>
          )}
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg px-4 pb-16 pt-8 text-fg">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,rgb(var(--c-accent-bright)_/_.18),transparent_70%)]" />
      <div className="relative mx-auto max-w-lg">
        <Logo className="mx-auto mb-8 h-14" />
        {children}
        <div className="mt-12 flex items-center justify-center gap-4 text-sm text-fg/45">
          <a href={BUSINESS.phoneHref} className="inline-flex items-center gap-1.5 hover:text-fg"><Phone size={14} /> {BUSINESS.phone}</a>
          <a href={BUSINESS.site} className="hover:text-fg">axisglasstinting.com</a>
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-4 p-4 sm:p-5">
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/15 text-accent-fg">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wider text-fg/40">{label}</div>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}
