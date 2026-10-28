import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Gift, Phone, ShieldCheck } from "lucide-react";
import { BUSINESS } from "../data/config";
import { CarVisualizer } from "../components/CarVisualizer";
import { Button, Logo, cx } from "../components/ui";
import { buildQuote, frontsLegal, homePaneCount, isFullVehicle, money } from "../lib/pricing";
import { forwardLead, newId, saveLead, useSettings } from "../lib/store";
import type { Lead, QuoteState } from "../lib/types";
import { Ctx, INITIAL, useQuote, type QuoteCtx } from "./quote/context";
import { ContactStep, DoneStep, LocationStep, ScheduleStep, StartStep, phoneOk } from "./quote/CommonSteps";
import { HomeFilmStep, PropertyStep } from "./quote/HomeSteps";
import { CoverageStep, ShadeStep, VehicleStep } from "./quote/VehicleSteps";

type StepId = "start" | "vehicle" | "coverage" | "shade" | "property" | "homefilm" | "location" | "schedule" | "contact" | "done";

const FLOWS: Record<"vehicle" | "home", StepId[]> = {
  vehicle: ["start", "vehicle", "coverage", "shade", "location", "schedule", "contact", "done"],
  home: ["start", "property", "homefilm", "location", "schedule", "contact", "done"],
};

const VIEWS: Record<StepId, () => JSX.Element | null> = {
  start: StartStep, vehicle: VehicleStep, coverage: CoverageStep, shade: ShadeStep,
  property: PropertyStep, homefilm: HomeFilmStep, location: LocationStep,
  schedule: ScheduleStep, contact: ContactStep, done: DoneStep,
};

const DRAFT_KEY = "axis.draft.v1";

function loadDraft(): { q: QuoteState; step: number } {
  const ref = new URLSearchParams(location.search).get("ref")?.toUpperCase() ?? "";
  try {
    const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? "");
    return { q: { ...d.q, referral: ref || d.q.referral }, step: d.step };
  } catch {
    return { q: { ...INITIAL, referral: ref }, step: 0 };
  }
}

export default function QuotePage() {
  const settings = useSettings();
  const draft = useMemo(loadDraft, []);
  const [q, setQ] = useState<QuoteState>(draft.q);
  const [step, setStep] = useState(draft.step);
  const [dir, setDir] = useState(1);
  const [lead, setLead] = useState<Lead | null>(null);
  const top = useRef<HTMLDivElement>(null);

  const flow = FLOWS[q.kind === "vehicle" || !q.kind ? "vehicle" : "home"];
  const id = flow[Math.min(step, flow.length - 1)];
  const quote = useMemo(() => buildQuote(settings, q), [settings, q]);

  useEffect(() => {
    if (id === "done") sessionStorage.removeItem(DRAFT_KEY);
    else sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ q, step }));
  }, [q, step, id]);

  const go = (n: number) => {
    setDir(n > step ? 1 : -1);
    setStep(n);
    top.current?.scrollIntoView({ behavior: "smooth" });
  };

  const ctx: QuoteCtx = {
    q,
    settings,
    quote,
    lead,
    set: (patch) => setQ((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) })),
    next: () => go(step + 1),
    submit: () => {
      const { vehicle, home, ...rest } = q;
      const l: Lead = {
        ...rest,
        id: newId("AX"),
        createdAt: new Date().toISOString(),
        status: q.appointment ? "booked" : "new",
        ...(q.kind === "vehicle" ? { vehicle } : { home }),
        quote,
      };
      saveLead(l);
      void forwardLead(l, settings.leadWebhookUrl);
      setLead(l);
      go(flow.indexOf("done"));
    },
    restart: () => {
      setQ({ ...INITIAL, referral: q.referral });
      setLead(null);
      go(0);
    },
  };

  const canContinue = (() => {
    switch (id) {
      case "coverage": return q.vehicle.zones.length > 0;
      case "property": return homePaneCount(q.home) > 0;
      case "location": return !!q.region && q.city.trim().length > 1 && (q.kind !== "vehicle" || !!q.garage);
      case "contact": return q.contact.name.trim().length > 1 && phoneOk(q.contact.phone);
      default: return true;
    }
  })();

  const isLast = id === "contact";
  const showSummary = id !== "start" && id !== "done";
  const progress = (step / (flow.length - 1)) * 100;
  const View = VIEWS[id];
  const cta = isLast ? (q.appointment ? "Book my appointment" : "Send my quote") : "Continue";
  const onCta = isLast ? ctx.submit : ctx.next;

  return (
    <Ctx.Provider value={ctx}>
      <div ref={top} className="min-h-screen bg-axis-black pb-32 text-white lg:pb-16">
        <div className="pointer-events-none fixed inset-x-0 top-0 h-[480px] bg-[radial-gradient(ellipse_at_top,rgba(218,40,27,.18),transparent_60%)]" />

        <header className="sticky top-0 z-30 border-b border-white/5 bg-axis-black/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
            <button type="button" onClick={() => go(0)} aria-label="Start over"><Logo flat className="h-11" /></button>
            <div className="flex-1" />
            <a href={BUSINESS.phoneHref} className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-white/80 transition hover:border-axis-red hover:text-white">
              <Phone size={15} /> <span className="hidden sm:inline">{BUSINESS.phone}</span><span className="sm:hidden">Call</span>
            </a>
          </div>
          {showSummary && (
            <div className="h-0.5 bg-white/5">
              <motion.div className="h-full bg-gradient-to-r from-axis-deep to-axis-bright" animate={{ width: `${progress}%` }} transition={{ duration: 0.5 }} />
            </div>
          )}
        </header>

        <main className={cx("relative mx-auto max-w-7xl px-4 sm:px-6", showSummary ? "pt-8 lg:grid lg:grid-cols-[1fr_380px] lg:gap-10" : "pt-10")}>
          <div className="min-w-0">
            {showSummary && step > 0 && (
              <button type="button" onClick={() => go(step - 1)} className="mb-5 flex items-center gap-1.5 text-sm text-white/50 transition hover:text-white">
                <ArrowLeft size={15} /> Back
              </button>
            )}
            <AnimatePresence mode="wait" custom={dir}>
              <motion.div
                key={id}
                custom={dir}
                initial={{ opacity: 0, x: dir * 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: dir * -28 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                <View />
              </motion.div>
            </AnimatePresence>
            {showSummary && (
              <div className="mt-10 hidden lg:block">
                <Button size="lg" onClick={onCta} disabled={!canContinue} className="min-w-[240px]">
                  {cta} <ArrowRight size={18} />
                </Button>
              </div>
            )}
          </div>

          {showSummary && <Summary />}
        </main>

        {showSummary && (
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-axis-ink/95 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur-xl lg:hidden">
            <div className="mx-auto flex max-w-xl items-center gap-4">
              <div className="flex-1">
                <div className="text-[11px] uppercase tracking-widest text-white/45">{quote.range ? "Estimate" : "Your price"}</div>
                <div className="font-display text-2xl font-bold tabular-nums">
                  {quote.range ? `${money(quote.range[0])}+` : money(quote.total)}
                </div>
              </div>
              <Button size="lg" onClick={onCta} disabled={!canContinue}>{isLast ? (q.appointment ? "Book it" : "Send") : "Continue"} <ArrowRight size={18} /></Button>
            </div>
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}

function Summary() {
  const { q, quote } = useQuote();
  const v = q.vehicle;
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-24 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#16161a] to-[#0f0f11]">
        <div className="border-b border-white/5 px-6 pb-2 pt-5">
          <div className="text-xs uppercase tracking-[.2em] text-white/40">Your build</div>
          {q.kind === "vehicle" ? (
            <>
              <div className="mt-1 font-display text-lg font-semibold">{v.ymm || "Your vehicle"}</div>
              <CarVisualizer body={v.body} paint={v.paint} zones={v.zones} frontVlt={v.frontVlt} rearVlt={v.rearVlt} stage={false} className="-mx-2 w-[calc(100%+1rem)]" />
            </>
          ) : (
            <div className="mb-3 mt-1 font-display text-lg font-semibold">
              {q.home.shade}
              <div className="text-sm font-normal text-white/50">{homePaneCount(q.home)} windows · {q.kind === "business" ? "Business" : "Home"}</div>
            </div>
          )}
        </div>
        <div className="px-6 py-4">
          {quote.lines.length === 0 && <p className="py-2 text-sm text-white/40">Pick some windows to see your price.</p>}
          {quote.lines.map((l) => (
            <div key={l.label} className="flex items-start justify-between gap-3 py-1.5 text-sm">
              <span>
                <span className="text-white/80">{l.label}</span>
                {l.note && <span className="block text-xs text-white/40">{l.note}</span>}
              </span>
              <span className={cx("tabular-nums", l.amount === 0 ? "text-emerald-400" : l.amount < 0 ? "text-emerald-400" : "text-white")}>
                {l.amount === 0 ? "Free" : money(l.amount)}
              </span>
            </div>
          ))}
        </div>
        <div className="border-t border-white/5 bg-black/30 px-6 py-5">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-white/60">{quote.range ? "Estimated" : "Total"}</span>
            <motion.span key={quote.total} initial={{ opacity: 0.4, y: -4 }} animate={{ opacity: 1, y: 0 }} className="font-display text-3xl font-bold tabular-nums">
              {quote.range ? `${money(quote.range[0])}–${money(quote.range[1])}` : money(quote.total)}
            </motion.span>
          </div>
          {q.kind === "vehicle" && isFullVehicle(v.zones) && (
            <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400"><Gift size={14} /> Visor strip included free</div>
          )}
          {q.kind === "vehicle" && !frontsLegal(v) && (
            <div className="mt-2 text-xs text-amber-300">Front doors below Arizona's 33% limit</div>
          )}
          <div className="mt-3 flex items-center gap-2 text-xs text-white/45"><ShieldCheck size={14} /> Lifetime warranty · we come to you</div>
          {quote.range && <p className="mt-2 text-xs text-white/40">Exact price confirmed at your free on-site measure.</p>}
        </div>
      </div>
    </aside>
  );
}

