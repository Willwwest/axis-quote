import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight, Building2, CalendarCheck, CalendarPlus, Car, Check, Clock, Home, MapPin, MessageSquare,
  Phone, ShieldCheck, Sparkles, Star, Truck, Warehouse,
} from "lucide-react";
import { BUSINESS, REGIONS, REVIEWS } from "../../data/config";
import { CarVisualizer } from "../../components/CarVisualizer";
import { Button, Choice, Field, Input, StepHeader, Stars, Textarea, cx } from "../../components/ui";
import { money } from "../../lib/pricing";
import { downloadIcs, parseIso, prettyDate, upcomingDays } from "../../lib/schedule";
import { useLeads } from "../../lib/store";
import type { JobKind } from "../../lib/types";
import { useQuote } from "./context";

/* ---------- Start ---------- */

const HERO_SHADES = [70, 50, 35, 20, 5, 20, 35];

export function StartStep() {
  const { set, next, q, settings } = useQuote();
  const [i, setI] = useState(2);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % HERO_SHADES.length), 1600);
    return () => clearInterval(t);
  }, []);
  const vlt = HERO_SHADES[i];
  const pick = (kind: JobKind) => {
    set({ kind });
    next();
  };

  const kinds: { id: JobKind; icon: typeof Car; title: string; sub: string }[] = [
    { id: "vehicle", icon: Car, title: "Vehicle", sub: "Car, truck, SUV · price in 60 seconds" },
    { id: "home", icon: Home, title: "Home", sub: "Heat, glare & privacy film" },
    { id: "business", icon: Building2, title: "Business", sub: "Storefronts & offices" },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      {q.referral && (
        <div className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-full border border-success/30 bg-success/10 px-4 py-2 text-sm text-success">
          <Sparkles size={15} /> A friend sent you. {money(settings.referralCredit)} off is applied to your quote.
        </div>
      )}
      <div className="text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-fg/10 bg-fg/[.03] px-4 py-1.5 text-xs text-fg/70">
          <Stars className="text-[11px]" /> {BUSINESS.rating} on Google · {BUSINESS.projects} installs across Arizona
        </div>
        <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          See your tint
          <br />
          <span className="bg-gradient-to-r from-accent-bright via-accent-fg to-accent bg-clip-text text-transparent">before it's on the glass.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-fg/60">
          Preview every shade, get your exact price, and book a mobile install at your place. About two minutes.
        </p>
      </div>

      <div className="relative mx-auto mt-6 max-w-4xl">
        <CarVisualizer body="sedan" paint="#141416" zones={["frontSides", "rearSides", "rearWindshield"]} frontVlt={Math.max(vlt, 35)} rearVlt={vlt} className="w-full" />
        <motion.div
          key={vlt}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute right-[4%] top-[8%] hidden rounded-xl sm:block border border-fg/10 bg-scrim/60 px-3 py-2 text-right backdrop-blur"
        >
          <div className="font-display text-2xl font-bold tabular-nums">{vlt}%</div>
          <div className="text-[10px] uppercase tracking-widest text-fg/50">rear glass</div>
        </motion.div>
      </div>

      <div className="mx-auto mt-4 grid max-w-4xl gap-3 sm:grid-cols-3">
        {kinds.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => pick(k.id)}
            className="group flex items-center gap-4 rounded-2xl border border-fg/10 bg-fg/[.03] p-5 text-left transition-all hover:-translate-y-0.5 hover:border-accent hover:bg-accent/10 hover:shadow-glow"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-b from-accent-bright to-accent-deep shadow-lg">
              <k.icon size={22} />
            </span>
            <span className="flex-1">
              <span className="block font-display text-lg font-semibold">{k.title}</span>
              <span className="block text-xs text-fg/55">{k.sub}</span>
            </span>
            <ArrowRight size={18} className="text-fg/30 transition group-hover:translate-x-1 group-hover:text-fg" />
          </button>
        ))}
      </div>

      <div className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-fg/10 bg-fg/10 sm:grid-cols-4">
        {[
          { icon: Truck, t: "100% mobile", s: "We come to you" },
          { icon: ShieldCheck, t: "Lifetime warranty", s: "No bubbles, peeling, fading" },
          { icon: Star, t: `${BUSINESS.rating} rated`, s: "Real local reviews" },
          { icon: Sparkles, t: `${BUSINESS.years} years`, s: `${BUSINESS.projects} projects` },
        ].map((b) => (
          <div key={b.t} className="flex items-center gap-3 bg-bg px-4 py-4">
            <b.icon size={20} className="shrink-0 text-accent-fg" />
            <div>
              <div className="text-sm font-semibold">{b.t}</div>
              <div className="text-xs text-fg/45">{b.s}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="relative mx-auto mt-10 max-w-5xl overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]">
        <div className="flex w-max animate-marquee gap-4 hover:[animation-play-state:paused]">
          {[...REVIEWS, ...REVIEWS].map((r, n) => (
            <figure key={n} className="w-80 shrink-0 rounded-2xl border border-fg/10 bg-fg/[.03] p-5">
              <Stars className="text-sm" />
              <blockquote className="mt-2 text-sm leading-relaxed text-fg/75">“{r.text}”</blockquote>
              <figcaption className="mt-3 text-xs font-semibold text-fg/50">{r.name}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Location ---------- */

export function LocationStep() {
  const { q, set } = useQuote();
  const vehicle = q.kind === "vehicle";
  return (
    <div>
      <StepHeader eyebrow="Where" title="Where should we meet you?" sub="We're 100% mobile. No shop, no drop-off, no waiting room." />
      <div className="grid gap-3">
        {REGIONS.map((r) => (
          <Choice key={r.id} selected={q.region === r.id} onClick={() => set({ region: r.id, appointment: null })} className="flex items-center gap-4">
            <MapPin size={20} className={q.region === r.id ? "text-accent-fg" : "text-fg/40"} />
            <span className="flex-1">
              <span className="block font-display text-lg font-semibold">{r.label}</span>
              <span className="block text-xs text-fg/50">{r.cities}</span>
            </span>
          </Choice>
        ))}
      </div>
      <div className="mt-6">
        <Field label={vehicle ? "City or address for the install" : "Property address"} hint="So we can plan the route">
          <Input value={q.city} onChange={(e) => set({ city: e.target.value })} placeholder={vehicle ? "e.g. Prescott Valley" : "123 Main St, Prescott"} autoComplete="street-address" />
        </Field>
      </div>

      {vehicle && (
        <>
          <h2 className="mb-1 mt-10 font-display text-xl font-semibold">Do you have a garage we can work in?</h2>
          <p className="mb-4 text-sm text-fg/55">A covered garage keeps dust and wind off the film and lets it cure properly.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Choice selected={q.garage === "yes"} onClick={() => set({ garage: "yes" })} className="flex items-center gap-3">
              <Warehouse size={22} className="text-accent-fg" />
              <span><span className="block font-semibold">Yes, covered garage</span><span className="text-xs text-fg/50">Perfect. We'll come to you.</span></span>
            </Choice>
            <Choice selected={q.garage === "no"} onClick={() => set({ garage: "no" })} className="flex items-center gap-3">
              <MapPin size={22} className="text-fg/50" />
              <span><span className="block font-semibold">No garage</span><span className="text-xs text-fg/50">No problem. We'll find a spot together.</span></span>
            </Choice>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Schedule ---------- */

export function ScheduleStep() {
  const { q, set, settings } = useQuote();
  const leads = useLeads();
  const days = useMemo(() => upcomingDays(settings, q.region ?? "quad", leads), [settings, q.region, leads]);
  const openDays = days.filter((d) => d.open.length);
  const [day, setDay] = useState(q.appointment?.date ?? openDays[0]?.date ?? null);
  const selected = days.find((d) => d.date === day);
  const vehicle = q.kind === "vehicle";
  const region = REGIONS.find((r) => r.id === q.region);

  return (
    <div>
      <StepHeader
        eyebrow="When"
        title={vehicle ? "Pick your install time" : "Book your free consultation"}
        sub={vehicle
          ? `Showing open slots for ${region?.label ?? "your area"}. We'll text to confirm.`
          : "We'll measure every window, show you film samples on your glass, and lock in your exact price. No obligation."}
      />

      <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-3">
        {days.map((d) => {
          const date = parseIso(d.date);
          const open = d.open.length > 0;
          return (
            <button
              key={d.date}
              type="button"
              disabled={!open}
              onClick={() => setDay(d.date)}
              className={cx(
                "flex w-[68px] shrink-0 snap-start flex-col items-center rounded-2xl border py-3 transition-all",
                day === d.date ? "border-accent bg-accent/15 shadow-glow" : open ? "border-fg/12 bg-fg/[.03] hover:border-fg/30" : "border-transparent opacity-25",
              )}
            >
              <span className="text-[11px] uppercase tracking-wider text-fg/50">{date.toLocaleDateString("en-US", { weekday: "short" })}</span>
              <span className="font-display text-2xl font-semibold">{date.getDate()}</span>
              <span className="text-[10px] text-fg/40">{date.toLocaleDateString("en-US", { month: "short" })}</span>
              {open && <span className="mt-1 h-1 w-1 rounded-full bg-accent-bright" />}
            </button>
          );
        })}
      </div>

      {selected && selected.open.length > 0 && (
        <div className="mt-4">
          <div className="mb-3 text-sm text-fg/60">{prettyDate(selected.date)}</div>
          <div className="grid grid-cols-2 gap-3">
            {selected.open.map((slot) => {
              const on = q.appointment?.date === selected.date && q.appointment.slot === slot;
              return (
                <Choice key={slot} selected={on} onClick={() => set({ appointment: { date: selected.date, slot } })} className="flex items-center gap-3">
                  <Clock size={18} className={on ? "text-accent-fg" : "text-fg/40"} />
                  <span>
                    <span className="block font-display text-lg font-semibold">{slot}</span>
                    <span className="text-xs text-fg/50">{slot.includes("AM") ? "Morning arrival" : "Afternoon arrival"}</span>
                  </span>
                </Choice>
              );
            })}
          </div>
        </div>
      )}
      {!openDays.length && <p className="rounded-xl bg-fg/[.04] p-4 text-fg/70">The calendar's full for the next few weeks. Send your quote and we'll call you with the first opening.</p>}

      <button type="button" onClick={() => set({ appointment: null })} className={cx("mt-6 text-sm underline-offset-4 hover:underline", q.appointment ? "text-fg/50" : "text-accent-fg")}>
        {q.appointment ? "Actually, just send me the quote for now" : "✓ Just sending a quote, no appointment yet"}
      </button>
    </div>
  );
}

/* ---------- Contact ---------- */

export const phoneOk = (p: string) => p.replace(/\D/g, "").length >= 10;

export function ContactStep() {
  const { q, set } = useQuote();
  const c = q.contact;
  const update = (patch: Partial<typeof c>) => set((s) => ({ contact: { ...s.contact, ...patch } }));
  return (
    <div>
      <StepHeader
        eyebrow="Last step"
        title={q.appointment ? "Lock in your appointment" : "Where should we send your quote?"}
        sub="A real person on our crew follows up. When you call, you talk to the people doing the work."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name"><Input value={c.name} onChange={(e) => update({ name: e.target.value })} autoComplete="name" placeholder="First and last" /></Field>
        <Field label="Mobile number"><Input value={c.phone} onChange={(e) => update({ phone: e.target.value })} autoComplete="tel" inputMode="tel" placeholder="(928) 555-0123" /></Field>
        <Field label="Email" hint="Optional"><Input value={c.email} onChange={(e) => update({ email: e.target.value })} autoComplete="email" type="email" placeholder="you@email.com" /></Field>
        <Field label="Promo or referral code" hint="Optional"><Input value={q.referral} onChange={(e) => set({ referral: e.target.value.toUpperCase().trim() })} placeholder="AXIS-XXXXXX" /></Field>
        <div className="sm:col-span-2">
          <Field label="Anything we should know?" hint="Optional"><Textarea value={c.notes} onChange={(e) => update({ notes: e.target.value })} placeholder="Gate code, medical exemption, existing tint, questions…" /></Field>
        </div>
      </div>
      <label className="mt-5 flex cursor-pointer gap-3 text-sm text-fg/60">
        <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[rgb(var(--c-accent))]" checked={c.sms} onChange={(e) => update({ sms: e.target.checked })} />
        <span>
          Text me about this quote and appointment. Axis Glass Tinting LLC may send quote follow-ups, appointment confirmations and service reminders.
          Msg & data rates may apply. Reply STOP to opt out. Consent is not a condition of purchase.
        </span>
      </label>
    </div>
  );
}

/* ---------- Done ---------- */

export function DoneStep() {
  const { lead, restart } = useQuote();
  if (!lead) return null;
  const first = lead.contact.name.split(" ")[0];
  const appt = lead.appointment;
  const vehicle = lead.kind === "vehicle";
  const hours = vehicle ? Math.max(1.5, (lead.vehicle?.zones.length ?? 3) * 0.6) : 1;

  const steps = vehicle
    ? [
        { icon: MessageSquare, t: "We confirm by text", s: "Usually within a few business hours." },
        { icon: Warehouse, t: "Clear a spot in the garage", s: "Empty door pockets and the rear deck so we can get to the glass." },
        { icon: Car, t: "We tint while you go about your day", s: `Plan on about ${Math.round(hours * 2) / 2} hours.` },
        { icon: ShieldCheck, t: "Let it cure", s: "Keep windows up 3–5 days. A little haze or tiny water pockets are normal and clear as it dries." },
      ]
    : [
        { icon: MessageSquare, t: "We confirm by text", s: "Usually within a few business hours." },
        { icon: Home, t: "Free on-site consultation", s: "We measure, show samples on your actual glass, and give you an exact price." },
        { icon: CalendarCheck, t: "Install day", s: "Clean, quiet work. Most homes are done in a day." },
        { icon: ShieldCheck, t: "Lifetime warranty", s: "Backed against bubbling, peeling and fading." },
      ];

  return (
    <div className="mx-auto max-w-2xl text-center">
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 14 }}
        className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-gradient-to-b from-accent-bright to-accent-deep shadow-glow"
      >
        <Check size={40} strokeWidth={3} />
      </motion.div>
      <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight">
        {appt ? `You're on the calendar, ${first}.` : `Quote sent, ${first}.`}
      </h1>
      <p className="mt-3 text-fg/60">Reference <span className="font-mono text-fg">{lead.id}</span>. We just saved everything you picked.</p>

      {appt && (
        <div className="mx-auto mt-8 max-w-md rounded-2xl border border-accent/40 bg-gradient-to-b from-accent/15 to-transparent p-6">
          <div className="text-xs uppercase tracking-widest text-accent-fg">{vehicle ? "Mobile install" : "Free consultation"}</div>
          <div className="mt-1 font-display text-2xl font-semibold">{prettyDate(appt.date)}</div>
          <div className="text-fg/70">Arriving around {appt.slot} · {lead.city}</div>
          <Button
            variant="outline"
            className="mt-5 w-full"
            onClick={() => downloadIcs({
              date: appt.date,
              slot: appt.slot,
              hours,
              title: `Axis Glass Tinting ${vehicle ? "install" : "consultation"}`,
              details: `Ref ${lead.id}. Questions? Call ${BUSINESS.phone}.`,
              location: lead.city,
            })}
          >
            <CalendarPlus size={18} /> Add to calendar
          </Button>
        </div>
      )}

      <div className="mt-8 rounded-2xl border border-fg/10 bg-fg/[.02] p-6 text-left">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="font-display text-lg font-semibold">Your quote</span>
          <span className="font-display text-2xl font-bold">
            {lead.quote.range ? `${money(lead.quote.range[0])}–${money(lead.quote.range[1])}` : money(lead.quote.total)}
          </span>
        </div>
        {lead.quote.lines.map((l) => (
          <div key={l.label} className="flex justify-between border-t border-fg/5 py-2 text-sm">
            <span className="text-fg/70">{l.label}{l.note && <span className="ml-2 text-fg/35">{l.note}</span>}</span>
            <span className="tabular-nums">{l.amount === 0 ? "Free" : money(l.amount)}</span>
          </div>
        ))}
      </div>

      <ol className="mt-8 space-y-4 text-left">
        {steps.map((s, n) => (
          <li key={s.t} className="flex gap-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-fg/10 bg-fg/[.04] text-accent-fg"><s.icon size={18} /></span>
            <span>
              <span className="block font-semibold">{n + 1}. {s.t}</span>
              <span className="text-sm text-fg/55">{s.s}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <a href={BUSINESS.phoneHref}><Button size="lg" className="w-full"><Phone size={18} /> Call {BUSINESS.phone}</Button></a>
        <Button size="lg" variant="outline" onClick={restart}>Quote another vehicle</Button>
      </div>
    </div>
  );
}
