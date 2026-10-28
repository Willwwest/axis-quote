import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays, Car, CheckCircle2, ClipboardList, DollarSign, Download, ExternalLink, Home, Inbox, Lock,
  MessageSquare, Phone, Settings as Cog, Tag, Trash2, X,
} from "lucide-react";
import {
  BODY_TYPES, DEFAULT_SETTINGS, REGIONS, ZONES, type BodyType, type RegionId, type Settings, type Zone,
} from "../data/config";
import { CarVisualizer } from "../components/CarVisualizer";
import { Button, Field, Input, Logo, Segmented, cx } from "../components/ui";
import { money, zoneLabel } from "../lib/pricing";
import { isoDate, prettyDate } from "../lib/schedule";
import { deleteLead, getSettings, saveLead, saveSettings, useLeads, useSettings } from "../lib/store";
import type { Lead, LeadStatus } from "../lib/types";
import { sampleLeads } from "../lib/samples";

const STATUSES: { id: LeadStatus; label: string; dot: string }[] = [
  { id: "new", label: "New", dot: "bg-sky-400" },
  { id: "contacted", label: "Contacted", dot: "bg-amber-400" },
  { id: "booked", label: "Booked", dot: "bg-axis-bright" },
  { id: "completed", label: "Completed", dot: "bg-emerald-400" },
  { id: "lost", label: "Lost", dot: "bg-white/30" },
];

const AUTH_KEY = "axis.admin";

export default function AdminPage() {
  const settings = useSettings();
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(AUTH_KEY) === "1");
  if (!authed) return <PinGate pin={settings.adminPin} onOk={() => { sessionStorage.setItem(AUTH_KEY, "1"); setAuthed(true); }} />;
  return <Dashboard />;
}

function PinGate({ pin, onOk }: { pin: string; onOk: () => void }) {
  const [v, setV] = useState("");
  const [bad, setBad] = useState(false);
  return (
    <div className="grid min-h-screen place-items-center bg-axis-black px-4 text-white">
      <form
        className="w-full max-w-xs text-center"
        onSubmit={(e) => {
          e.preventDefault();
          if (v === pin) onOk();
          else { setBad(true); setV(""); }
        }}
      >
        <Logo className="mx-auto h-14" />
        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-white/50"><Lock size={14} /> Crew dashboard</div>
        <Input autoFocus type="password" inputMode="numeric" value={v} onChange={(e) => { setV(e.target.value); setBad(false); }} placeholder="PIN" className={cx("mt-4 text-center text-2xl tracking-[.5em]", bad && "border-axis-red")} />
        {bad && <p className="mt-2 text-sm text-axis-bright">Wrong PIN</p>}
        <Button className="mt-4 w-full" type="submit">Unlock</Button>
      </form>
    </div>
  );
}

type Tab = "pipeline" | "calendar" | "pricing" | "settings";

function Dashboard() {
  const leads = useLeads();
  const [tab, setTab] = useState<Tab>("pipeline");
  const [open, setOpen] = useState<string | null>(null);
  const openLead = leads.find((l) => l.id === open) ?? null;

  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 864e5;
    const month = new Date().toISOString().slice(0, 7);
    const active = leads.filter((l) => ["new", "contacted", "booked"].includes(l.status));
    const value = (l: Lead) => l.quote.range ? l.quote.range[0] : l.quote.total;
    const decided = leads.filter((l) => l.status !== "new" && l.status !== "contacted");
    const won = decided.filter((l) => l.status === "booked" || l.status === "completed");
    return {
      newWeek: leads.filter((l) => +new Date(l.createdAt) > weekAgo).length,
      pipeline: active.reduce((s, l) => s + value(l), 0),
      booked: leads.filter((l) => l.status === "booked").length,
      revenue: leads.filter((l) => l.status === "completed" && l.completion?.date.startsWith(month)).reduce((s, l) => s + value(l), 0),
      close: decided.length ? Math.round((won.length / decided.length) * 100) : null,
      reviews: leads.filter((l) => l.completion?.reviewRequested).length,
    };
  }, [leads]);

  const tabs: { id: Tab; label: string; icon: typeof Inbox }[] = [
    { id: "pipeline", label: "Pipeline", icon: Inbox },
    { id: "calendar", label: "Schedule", icon: CalendarDays },
    { id: "pricing", label: "Pricing", icon: Tag },
    { id: "settings", label: "Settings", icon: Cog },
  ];

  return (
    <div className="min-h-screen bg-axis-black text-white">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-axis-black/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Logo flat className="h-10" />
          <nav className="flex gap-1 overflow-x-auto">
            {tabs.map((t) => (
              <button key={t.id} type="button" onClick={() => setTab(t.id)} className={cx("flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition", tab === t.id ? "bg-white/10 text-white" : "text-white/50 hover:text-white")}>
                <t.icon size={15} /> <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </nav>
          <div className="flex-1" />
          <Link to="/" className="hidden items-center gap-1.5 text-sm text-white/50 hover:text-white sm:flex">Customer app <ExternalLink size={13} /></Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {tab === "pipeline" && (
          <>
            <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-6">
              <Kpi label="New leads · 7 days" value={String(stats.newWeek)} />
              <Kpi label="Open pipeline" value={money(stats.pipeline)} />
              <Kpi label="Booked jobs" value={String(stats.booked)} />
              <Kpi label="Completed · this month" value={money(stats.revenue)} />
              <Kpi label="Close rate" value={stats.close == null ? "—" : `${stats.close}%`} />
              <Kpi label="Review requests sent" value={String(stats.reviews)} />
            </div>
            <Pipeline leads={leads} onOpen={setOpen} />
          </>
        )}
        {tab === "calendar" && <Schedule leads={leads} onOpen={setOpen} />}
        {tab === "pricing" && <Pricing />}
        {tab === "settings" && <SettingsPanel leads={leads} />}
      </main>

      <AnimatePresence>{openLead && <LeadDrawer lead={openLead} onClose={() => setOpen(null)} />}</AnimatePresence>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[.04] to-transparent p-4">
      <div className="font-display text-2xl font-bold tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-white/45">{label}</div>
    </div>
  );
}

const leadValue = (l: Lead) => (l.quote.range ? `${money(l.quote.range[0])}+` : money(l.quote.total));
const leadTitle = (l: Lead) =>
  l.vehicle ? l.vehicle.ymm || BODY_TYPES.find((b) => b.id === l.vehicle!.body)!.label : `${l.kind === "business" ? "Business" : "Home"} · ${l.city}`;

function Pipeline({ leads, onOpen }: { leads: Lead[]; onOpen: (id: string) => void }) {
  const [showLost, setShowLost] = useState(false);
  const cols = STATUSES.filter((s) => showLost || s.id !== "lost");
  if (!leads.length) {
    return (
      <div className="rounded-3xl border border-dashed border-white/15 p-12 text-center">
        <Inbox className="mx-auto text-white/30" size={36} />
        <p className="mt-4 font-display text-xl">No leads yet</p>
        <p className="mt-1 text-sm text-white/50">Quotes from the customer app land here instantly. You can load sample leads from Settings to try things out.</p>
      </div>
    );
  }
  return (
    <>
      <div className="mb-3 flex justify-end">
        <button type="button" onClick={() => setShowLost(!showLost)} className="text-xs text-white/40 hover:text-white">{showLost ? "Hide" : "Show"} lost</button>
      </div>
      <div className={cx("grid gap-4", showLost ? "lg:grid-cols-5" : "lg:grid-cols-4")}>
        {cols.map((s) => {
          const list = leads.filter((l) => l.status === s.id);
          return (
            <section key={s.id} className="rounded-2xl bg-white/[.02] p-3">
              <h3 className="mb-3 flex items-center gap-2 px-1 text-sm font-semibold">
                <span className={cx("h-2 w-2 rounded-full", s.dot)} /> {s.label}
                <span className="ml-auto text-xs font-normal text-white/40">{list.length}</span>
              </h3>
              <div className="space-y-2">
                {list.map((l) => (
                  <button key={l.id} type="button" onClick={() => onOpen(l.id)} className="block w-full rounded-xl border border-white/10 bg-axis-panel p-3 text-left transition hover:border-white/25">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold">{l.contact.name}</span>
                      <span className="font-display font-semibold tabular-nums">{leadValue(l)}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-white/50">
                      {l.vehicle ? <Car size={12} /> : <Home size={12} />} {leadTitle(l)}
                    </div>
                    {l.appointment && (
                      <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-axis-red/15 px-2 py-1 text-xs text-axis-bright">
                        <CalendarDays size={12} /> {prettyDate(l.appointment.date, { weekday: "short", month: "short", day: "numeric" })} · {l.appointment.slot}
                      </div>
                    )}
                    {l.garage === "no" && <div className="mt-2 text-xs text-amber-300">No garage — needs a location</div>}
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

function LeadDrawer({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const nav = useNavigate();
  const first = lead.contact.name.split(" ")[0];
  const digits = lead.contact.phone.replace(/\D/g, "");
  const text = encodeURIComponent(
    lead.appointment
      ? `Hi ${first}, this is Axis Glass Tinting confirming your appointment ${prettyDate(lead.appointment.date)} around ${lead.appointment.slot}. Reply here with any questions!`
      : `Hi ${first}, this is Axis Glass Tinting following up on your quote (${lead.id}, ${leadValue(lead)}). Want to get you on the calendar. What day works?`,
  );
  const setStatus = (status: LeadStatus) => saveLead({ ...lead, status });

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.aside
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed inset-y-0 right-0 z-50 w-full max-w-lg overflow-y-auto border-l border-white/10 bg-axis-ink p-6"
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="font-mono text-xs text-white/40">{lead.id} · {new Date(lead.createdAt).toLocaleString()}</div>
            <h2 className="mt-1 font-display text-2xl font-semibold">{lead.contact.name}</h2>
            <div className="text-sm text-white/60">{lead.contact.phone}{lead.contact.email && ` · ${lead.contact.email}`}</div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white" aria-label="Close"><X size={20} /></button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <a href={`tel:${digits}`}><Button variant="outline" className="w-full"><Phone size={16} /> Call</Button></a>
          <a href={`sms:${digits}?&body=${text}`}><Button variant="outline" className="w-full"><MessageSquare size={16} /> Text</Button></a>
        </div>

        <div className="mt-6 flex flex-wrap gap-1.5">
          {STATUSES.map((s) => (
            <button key={s.id} type="button" onClick={() => setStatus(s.id)} className={cx("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition", lead.status === s.id ? "border-white bg-white text-black" : "border-white/15 text-white/60 hover:text-white")}>
              <span className={cx("h-1.5 w-1.5 rounded-full", s.dot)} /> {s.label}
            </button>
          ))}
        </div>

        {lead.vehicle && (
          <div className="mt-6 rounded-2xl bg-gradient-to-b from-white/[.05] to-transparent p-2">
            <CarVisualizer {...lead.vehicle} stage={false} className="w-full" />
          </div>
        )}

        <dl className="mt-4 divide-y divide-white/5 text-sm">
          <Row k="Job">{leadTitle(lead)}</Row>
          {lead.vehicle && <Row k="Film">{lead.vehicle.film === "ceramic" ? "Ceramic" : "Carbon"} · fronts {lead.vehicle.frontVlt}% · rear {lead.vehicle.rearVlt}%</Row>}
          {lead.home && <Row k="Film">{lead.home.shade} · goals: {lead.home.goals.join(", ")}</Row>}
          <Row k="Where">{REGIONS.find((r) => r.id === lead.region)?.label} · {lead.city}</Row>
          {lead.garage && <Row k="Garage">{lead.garage === "yes" ? "Yes" : <span className="text-amber-300">No — find a location</span>}</Row>}
          <Row k="Appointment">{lead.appointment ? `${prettyDate(lead.appointment.date)} · ${lead.appointment.slot}` : "Not booked"}</Row>
          {lead.referral && <Row k="Referral">{lead.referral}</Row>}
          {lead.contact.notes && <Row k="Notes">{lead.contact.notes}</Row>}
          <Row k="Texts">{lead.contact.sms ? "Opted in" : "No SMS consent — call or email"}</Row>
        </dl>

        <div className="mt-5 rounded-2xl border border-white/10 p-4">
          {lead.quote.lines.map((l) => (
            <div key={l.label} className="flex justify-between py-1 text-sm">
              <span className="text-white/70">{l.label} <span className="text-white/35">{l.note}</span></span>
              <span className="tabular-nums">{l.amount === 0 ? "Free" : money(l.amount)}</span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t border-white/10 pt-2 font-display text-lg font-semibold">
            <span>Total</span><span>{leadValue(lead)}</span>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          {lead.status !== "completed" ? (
            <Button size="lg" className="w-full" onClick={() => nav(`/admin/job/${lead.id}`)}><CheckCircle2 size={18} /> Complete job & send warranty</Button>
          ) : (
            <Button size="lg" variant="outline" className="w-full" onClick={() => nav(`/admin/job/${lead.id}`)}><ClipboardList size={18} /> View completion & warranty</Button>
          )}
          <button type="button" onClick={() => { if (confirm(`Delete ${lead.contact.name}'s lead?`)) { deleteLead(lead.id); onClose(); } }} className="flex w-full items-center justify-center gap-2 py-2 text-xs text-white/35 hover:text-axis-bright">
            <Trash2 size={13} /> Delete lead
          </button>
        </div>
      </motion.aside>
    </>
  );
}

function Row({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex gap-4 py-2.5">
      <dt className="w-28 shrink-0 text-white/45">{k}</dt>
      <dd className="text-white/90">{children}</dd>
    </div>
  );
}

function Schedule({ leads, onOpen }: { leads: Lead[]; onOpen: (id: string) => void }) {
  const settings = useSettings();
  const today = isoDate(new Date());
  const upcoming = leads
    .filter((l) => l.appointment && l.appointment.date >= today && l.status !== "lost")
    .sort((a, b) => (a.appointment!.date + a.appointment!.slot).localeCompare(b.appointment!.date + b.appointment!.slot));
  const byDate = upcoming.reduce<Record<string, Lead[]>>((m, l) => ((m[l.appointment!.date] ||= []).push(l), m), {});

  const days = Array.from({ length: 28 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d;
  });
  const toggleBlock = (date: string) => {
    const s = getSettings();
    saveSettings({ ...s, blockedDates: s.blockedDates.includes(date) ? s.blockedDates.filter((x) => x !== date) : [...s.blockedDates, date] });
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div>
        <h2 className="mb-4 font-display text-2xl font-semibold">Upcoming jobs</h2>
        {!upcoming.length && <p className="text-white/50">Nothing booked yet.</p>}
        <div className="space-y-6">
          {Object.entries(byDate).map(([date, list]) => (
            <div key={date}>
              <div className="mb-2 text-sm font-semibold text-white/60">{prettyDate(date)}</div>
              <div className="space-y-2">
                {list.map((l) => (
                  <button key={l.id} type="button" onClick={() => onOpen(l.id)} className="flex w-full items-center gap-4 rounded-xl border border-white/10 bg-axis-panel p-4 text-left hover:border-white/25">
                    <div className="w-20 font-display font-semibold">{l.appointment!.slot}</div>
                    <div className="flex-1">
                      <div className="font-semibold">{l.contact.name}</div>
                      <div className="text-xs text-white/50">{leadTitle(l)} · {l.city}</div>
                    </div>
                    <div className="font-display tabular-nums">{leadValue(l)}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h2 className="mb-1 font-display text-2xl font-semibold">Availability</h2>
        <p className="mb-4 text-sm text-white/50">Tap a day to block it (vacation, weather, full). Region days are set in Settings.</p>
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((d) => {
            const date = isoDate(d);
            const blocked = settings.blockedDates.includes(date);
            const regions = (Object.keys(settings.regionDays) as RegionId[]).filter((r) => r !== "other" && settings.regionDays[r].includes(d.getDay()));
            const weekend = d.getDay() === 0 || d.getDay() === 6;
            return (
              <button key={date} type="button" disabled={weekend} onClick={() => toggleBlock(date)} className={cx("rounded-lg border p-1.5 text-center text-xs transition", blocked ? "border-axis-red bg-axis-red/20 text-axis-bright line-through" : weekend ? "border-transparent text-white/20" : "border-white/10 hover:border-white/30")}>
                <div className="text-[10px] text-white/40">{d.toLocaleDateString("en-US", { weekday: "narrow" })}</div>
                <div className="font-semibold">{d.getDate()}</div>
                <div className="text-[9px] text-white/40">{regions.map((r) => (r === "quad" ? "PRE" : "PHX")).join(" ")}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Pricing() {
  const settings = useSettings();
  const [body, setBody] = useState<BodyType>("sedan");
  const patch = (fn: (s: Settings) => Settings) => saveSettings(fn(structuredClone(getSettings())));
  const setCell = (zone: Zone, film: "carbon" | "ceramic", value: string) =>
    patch((s) => { s.prices[body][zone][film] = value === "" ? null : Number(value); return s; });
  const sample = { body, ymm: "", paint: "", zones: [], film: "ceramic" as const, frontVlt: 35, rearVlt: 20, removal: false };

  return (
    <div className="max-w-4xl">
      <h2 className="font-display text-2xl font-semibold">Pricing</h2>
      <p className="mb-6 mt-1 text-sm text-white/50">Changes go live in the customer app immediately. Leave a cell blank to hide that option.</p>
      <div className="mb-4 overflow-x-auto">
        <Segmented value={body} onChange={setBody} options={BODY_TYPES.map((b) => ({ value: b.id, label: b.label.split(" ")[0] }))} />
      </div>
      <div className="overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/[.04] text-left text-xs uppercase tracking-wider text-white/45">
            <tr><th className="px-4 py-3">Window</th><th className="px-4 py-3">Carbon</th><th className="px-4 py-3">Ceramic</th></tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {ZONES.map((z) => (
              <tr key={z.id}>
                <td className="px-4 py-2.5">{zoneLabel(z.id, sample)}</td>
                {(["carbon", "ceramic"] as const).map((f) => (
                  <td key={f} className="px-4 py-2">
                    {z.id === "windshield" && f === "carbon" ? <span className="text-white/30">Ceramic only</span> : (
                      <MoneyInput value={settings.prices[body][z.id][f]} onChange={(v) => setCell(z.id, f, v)} />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="mb-3 mt-10 font-display text-lg font-semibold">Extras & residential</h3>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Old tint removal"><MoneyInput value={settings.removalFee} onChange={(v) => patch((s) => ({ ...s, removalFee: Number(v) || 0 }))} /></Field>
        <Field label="Referral credit"><MoneyInput value={settings.referralCredit} onChange={(v) => patch((s) => ({ ...s, referralCredit: Number(v) || 0 }))} /></Field>
        <Field label="Residential minimum"><MoneyInput value={settings.homeMinimum} onChange={(v) => patch((s) => ({ ...s, homeMinimum: Number(v) || 0 }))} /></Field>
        <Field label="Ultra View · per sq ft"><MoneyInput value={settings.homeRatePerSqft.ultraview} onChange={(v) => patch((s) => ({ ...s, homeRatePerSqft: { ...s.homeRatePerSqft, ultraview: Number(v) || 0 } }))} /></Field>
        <Field label="Pristine · per sq ft"><MoneyInput value={settings.homeRatePerSqft.pristine} onChange={(v) => patch((s) => ({ ...s, homeRatePerSqft: { ...s.homeRatePerSqft, pristine: Number(v) || 0 } }))} /></Field>
      </div>
      <h3 className="mb-3 mt-10 font-display text-lg font-semibold">Travel fee by area</h3>
      <div className="grid gap-4 sm:grid-cols-3">
        {REGIONS.map((r) => (
          <Field key={r.id} label={r.label}><MoneyInput value={settings.travelFee[r.id]} onChange={(v) => patch((s) => ({ ...s, travelFee: { ...s.travelFee, [r.id]: Number(v) || 0 } }))} /></Field>
        ))}
      </div>
    </div>
  );
}

function MoneyInput({ value, onChange }: { value: number | null; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35" />
      <Input type="number" min={0} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="!py-2 pl-8 tabular-nums" />
    </div>
  );
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function SettingsPanel({ leads }: { leads: Lead[] }) {
  const settings = useSettings();
  const patch = (p: Partial<Settings>) => saveSettings({ ...getSettings(), ...p });

  const exportCsv = () => {
    const rows = [["id", "created", "status", "name", "phone", "email", "kind", "job", "city", "appointment", "total"]];
    for (const l of leads) {
      rows.push([l.id, l.createdAt, l.status, l.contact.name, l.contact.phone, l.contact.email, l.kind ?? "", leadTitle(l), l.city,
        l.appointment ? `${l.appointment.date} ${l.appointment.slot}` : "", String(l.quote.total)]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `axis-leads-${isoDate(new Date())}.csv`;
    a.click();
  };

  return (
    <div className="max-w-3xl space-y-10">
      <section>
        <h2 className="font-display text-2xl font-semibold">Reviews & leads</h2>
        <div className="mt-4 space-y-4">
          <Field label="Google review link" hint="Google Business Profile → Ask for reviews">
            <Input value={settings.googleReviewUrl} onChange={(e) => patch({ googleReviewUrl: e.target.value.trim() })} placeholder="https://g.page/r/…/review" />
          </Field>
          {!settings.googleReviewUrl && <p className="text-sm text-amber-300">Add this so warranty texts can ask for a review in one tap.</p>}
          <Field label="Lead webhook" hint="Optional · Zapier, Make, or your CRM">
            <Input value={settings.leadWebhookUrl} onChange={(e) => patch({ leadWebhookUrl: e.target.value.trim() })} placeholder="https://hooks.zapier.com/…" />
          </Field>
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl font-semibold">Route days</h2>
        <p className="mt-1 text-sm text-white/50">Which weekdays the crew works each area. Customers only see open slots on these days.</p>
        <div className="mt-4 space-y-3">
          {REGIONS.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3">
              <div className="w-48 text-sm">{r.label}</div>
              <div className="flex gap-1">
                {WEEKDAYS.map((d, i) => {
                  const on = settings.regionDays[r.id].includes(i);
                  return (
                    <button key={d} type="button" onClick={() => patch({ regionDays: { ...settings.regionDays, [r.id]: on ? settings.regionDays[r.id].filter((x) => x !== i) : [...settings.regionDays[r.id], i].sort() } })}
                      className={cx("h-9 w-11 rounded-lg border text-xs transition", on ? "border-axis-red bg-axis-red/20 text-white" : "border-white/10 text-white/40 hover:text-white")}>
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 max-w-sm">
          <Field label="Arrival windows" hint="Comma separated">
            <Input defaultValue={settings.slots.join(", ")} onBlur={(e) => patch({ slots: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
          </Field>
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl font-semibold">Security & data</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Dashboard PIN"><Input defaultValue={settings.adminPin} onBlur={(e) => e.target.value && patch({ adminPin: e.target.value })} /></Field>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button variant="outline" onClick={exportCsv}><Download size={16} /> Export leads (CSV)</Button>
          <Button variant="outline" onClick={() => sampleLeads().forEach(saveLead)}>Load sample leads</Button>
          <Button variant="ghost" onClick={() => confirm("Reset all pricing and settings to defaults?") && saveSettings(DEFAULT_SETTINGS)}>Reset to defaults</Button>
        </div>
      </section>
    </div>
  );
}
