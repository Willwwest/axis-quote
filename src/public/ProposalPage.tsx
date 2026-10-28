import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { AlertTriangle, Car, Check, CheckCircle2, CreditCard, Home, Mail, MessageSquare, Phone, Ruler, Star } from "lucide-react";
import { BUSINESS, REVIEWS } from "../data/config";
import { addonPrice, approveProposal, depositFor, liveStatus, optionBefore, optionPrice, selectionTotal, type ProposalView, proposalView } from "../admin/proposals/logic";
import { Badge, Button, Card, Choice, Field, Input, Logo, Stars, Textarea, cx } from "../components/ui";
import { firstName, money } from "../lib/format";
import { decodeSnap } from "../lib/links";
import { Markdown } from "../lib/markdown";
import { fill, smsHref } from "../lib/messages";
import { prettyDate } from "../lib/schedule";
import { proposals, useSettings } from "../lib/store";

// Plain dates (expiry) are local already; timestamps are UTC, so let Date convert them.
const longDate = (iso: string) => {
  const opts = { month: "long", day: "numeric", year: "numeric" } as const;
  return iso.length === 10 ? prettyDate(iso, opts) : new Date(iso).toLocaleDateString("en-US", opts);
};
const REMOTE_KEY = (id: string) => `axis.sentApproval.${id}`;

export default function ProposalPage() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const local = proposals.useOne(id);
  const settings = useSettings();
  const snap = useMemo(() => decodeSnap<ProposalView>(window.location.hash), []);
  const view = local ? proposalView(local, settings) : snap;

  // Opening the link counts as viewed, except the crew's own preview.
  useEffect(() => {
    if (!local || params.has("preview") || local.viewedAt || local.status === "draft") return;
    proposals.update(local.id, { viewedAt: new Date().toISOString(), ...(local.status === "sent" ? { status: "viewed" as const } : {}) });
  }, [local, params]);

  useEffect(() => {
    if (view) document.title = `Proposal #${view.code} · ${BUSINESS.name}`;
  }, [view]);

  return (
    <div className="min-h-screen bg-bg pb-32 text-fg">
      <header className="border-b border-fg/5">
        <div className="mx-auto flex h-16 max-w-2xl items-center gap-3 px-4">
          <Logo flat className="h-9" />
          <div className="flex-1" />
          <a href={BUSINESS.phoneHref} className="flex items-center gap-1.5 rounded-full border border-fg/15 px-3 py-1.5 text-sm text-fg/75 hover:border-fg/30 hover:text-fg"><Phone size={14} /> {BUSINESS.phone}</a>
        </div>
      </header>
      {view ? <Proposal view={view} isLocal={!!local} /> : <Missing />}
    </div>
  );
}

function Missing() {
  return (
    <main className="mx-auto max-w-md px-4 pt-20 text-center">
      <AlertTriangle className="mx-auto text-warn" size={32} />
      <h1 className="mt-4 font-display text-2xl font-semibold">This link looks incomplete</h1>
      <p className="mt-2 text-fg/60">Some apps cut long links short. Text us and we'll send your proposal again.</p>
      <a href={BUSINESS.smsHref}><Button className="mt-6"><MessageSquare size={16} /> Text {BUSINESS.name}</Button></a>
    </main>
  );
}

function Proposal({ view, isLocal }: { view: ProposalView; isLocal: boolean }) {
  const status = liveStatus(view);
  const rec = view.options.find((o) => o.recommended) ?? view.options[0];
  const [opts, setOpts] = useState<string[]>(view.chosenOptionIds ?? (rec ? [rec.id] : []));
  const [adds, setAdds] = useState<string[]>(view.chosenAddonIds ?? []);
  const [notes, setNotes] = useState("");
  const [name, setName] = useState("");
  const [tried, setTried] = useState(false);
  const [remoteAt, setRemoteAt] = useState<string | null>(() => { try { return localStorage.getItem(REMOTE_KEY(view.id)); } catch { return null; } });
  const approveRef = useRef<HTMLDivElement>(null);
  const [approveVisible, setApproveVisible] = useState(false);

  useEffect(() => {
    const el = approveRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setApproveVisible(e.isIntersecting), { rootMargin: "0px 0px -80px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const total = selectionTotal(view, opts, adds);
  const deposit = depositFor(total, view.depositPct);
  const first = firstName(view.customer.name);
  const expired = status === "expired";
  const approved = status === "approved";
  const nameOk = !view.terms.requireName || name.trim().length >= 2;
  const chosen = view.options.filter((o) => opts.includes(o.id));
  const chosenAdds = view.addons.filter((a) => adds.includes(a.id));

  const toggle = (id: string) => setOpts((cur) => (view.selectTogether ? (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]) : [id]));
  const toggleAdd = (id: string) => setAdds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const approve = () => {
    setTried(true);
    if (!opts.length || !nameOk) return;
    const record = proposals.get(view.id);
    if (isLocal && record) {
      approveProposal(record, { optionIds: opts, addonIds: adds, name, notes });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    // Someone else's phone: the shop's data isn't here, so the approval goes to the shop as a text.
    const body = [
      `Hi ${BUSINESS.name}, I approve proposal #${view.code}.`,
      ...chosen.map((o) => `Option: ${o.title || "Option"} (${money(optionPrice(o))})`),
      ...chosenAdds.map((a) => `Add-on: ${a.name} (${money(addonPrice(a))})`),
      `Total: ${money(total)}`,
      `Name: ${name.trim() || view.customer.name}`,
      notes.trim() && `Notes: ${notes.trim()}`,
    ].filter(Boolean).join("\n");
    const at = new Date().toISOString();
    try { localStorage.setItem(REMOTE_KEY(view.id), at); } catch { /* private mode */ }
    setRemoteAt(at);
    window.location.href = smsHref(BUSINESS.phone, body);
  };

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8">
      <div className="font-display text-xs font-semibold uppercase tracking-[.25em] text-accent-fg">Proposal #{view.code}</div>
      <h1 className="mt-2 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
        {approved ? `You're all set${first ? `, ${first}` : ""}` : `${first ? `${first}, here` : "Here"} ${view.options.length > 1 ? "are your options" : "is your quote"}`}
      </h1>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-fg/55">
        {view.job && <span className="flex items-center gap-1.5">{view.kind === "vehicle" ? <Car size={14} /> : <Home size={14} />} {view.job}</span>}
        <span>Issued {longDate(view.date)}</span>
        {!approved && view.expiresAt && <span className={cx(expired && "text-warn")}>{expired ? "Expired" : "Valid through"} {longDate(view.expiresAt)}</span>}
      </div>
      <p className="mt-1 text-sm text-fg/40">Prepared for {view.customer.name}{view.customer.address ? ` · ${view.customer.address}` : ""}</p>

      {approved && <ApprovedCard view={view} />}
      {!approved && remoteAt && (
        <Card tone="success" className="mt-6">
          <div className="flex gap-3">
            <MessageSquare className="mt-0.5 shrink-0 text-success" size={20} />
            <div>
              <p className="font-semibold">Approval ready to send</p>
              <p className="mt-1 text-sm text-fg/60">We opened a text to {BUSINESS.name} with your choices. Hit send if you haven't yet, and we'll text back to lock in your install date.</p>
              <button type="button" onClick={approve} className="mt-2 text-sm font-semibold text-accent-fg underline">Open the text again</button>
            </div>
          </div>
        </Card>
      )}
      {expired && (
        <Card tone="warn" className="mt-6">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 shrink-0 text-warn" size={20} />
            <div>
              <p className="font-semibold">This proposal has expired</p>
              <p className="mt-1 text-sm text-fg/60">Prices may have changed since {longDate(view.date)}. Text us and we'll send a fresh one.</p>
              <a href={smsHref(BUSINESS.phone, `Hi, can you refresh proposal #${view.code}?`)}><Button size="sm" className="mt-3"><MessageSquare size={14} /> Text us</Button></a>
            </div>
          </div>
        </Card>
      )}

      {view.rooms && (
        <Card className="mt-6">
          <div className="mb-2 flex items-center gap-2 font-display font-semibold"><Ruler size={16} className="text-fg/45" /> Scope</div>
          <div className="divide-y divide-fg/5 text-sm">
            {view.rooms.map((r) => (
              <div key={r.id} className="flex justify-between gap-3 py-2"><span>{r.name}</span><span className="text-fg/50">{r.items} item{r.items === 1 ? "" : "s"} · ~{r.sqft} sq ft</span></div>
            ))}
          </div>
        </Card>
      )}

      {!approved && (
        <>
          <section className="mt-8">
            <h2 className="font-display text-xl font-semibold">{view.options.length > 1 ? (view.selectTogether ? "Pick any combination" : "Choose your option") : "Your quote"}</h2>
            {view.selectTogether && view.options.length > 1 && <p className="mt-1 text-sm text-fg/50">Tap to add or remove. Your total updates below.</p>}
            <div className="mt-4 space-y-3">
              {view.options.map((o) => {
                const on = opts.includes(o.id);
                const before = optionBefore(o), price = optionPrice(o);
                return (
                  <Choice key={o.id} selected={on} onClick={() => !expired && toggle(o.id)} className="w-full">
                    <div className="flex items-start gap-3">
                      <span className={cx("mt-1 grid h-6 w-6 shrink-0 place-items-center border-2 transition", view.selectTogether ? "rounded-md" : "rounded-full", on ? "border-accent bg-accent text-on-accent" : "border-fg/25")}>
                        {on && <Check size={14} strokeWidth={3} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        {o.recommended && view.options.length > 1 && <Badge tone="accent" icon={<Star size={11} />} className="mb-1">Recommended</Badge>}
                        <div className="font-display text-lg font-semibold leading-snug text-fg">{o.title || "Option"}</div>
                        {o.film && <div className="text-xs text-fg/50">Film: {o.film}</div>}
                      </div>
                      <div className="shrink-0 text-right">
                        {o.discountPct > 0 && <div className="text-sm tabular-nums text-fg/40 line-through">{money(before)}</div>}
                        <div className="font-display text-2xl font-bold tabular-nums text-fg">{money(price)}</div>
                        {o.discountPct > 0 && <div className="text-xs font-medium text-success">Save {money(before - price)}</div>}
                      </div>
                    </div>
                    {o.description.trim() && <Markdown text={o.description} className="mt-3 pl-9" />}
                    {o.lines.length > 0 && (
                      <div className="mt-3 space-y-1 border-t border-fg/10 pl-9 pt-3 text-xs">
                        {o.lines.map((l, i) => (
                          <div key={i} className="flex justify-between gap-3">
                            <span className="text-fg/65">{l.label}{l.note && <span className="text-fg/40"> · {l.note}</span>}</span>
                            <span className="shrink-0 tabular-nums text-fg/65">{l.amount === 0 ? "Included" : money(l.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Choice>
                );
              })}
            </div>
          </section>

          {view.addons.length > 0 && (
            <section className="mt-8">
              <h2 className="font-display text-xl font-semibold">Add-ons</h2>
              <Card className="mt-3 !p-0">
                <div className="divide-y divide-fg/5">
                  {view.addons.map((a) => {
                    const on = adds.includes(a.id);
                    return (
                      <button key={a.id} type="button" disabled={expired} onClick={() => toggleAdd(a.id)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-fg/[.03]">
                        <span className="min-w-0 flex-1 font-medium">{a.name}</span>
                        <span className="tabular-nums text-fg/70">+{money(addonPrice(a))}</span>
                        <span className={cx("flex h-8 shrink-0 items-center gap-1 rounded-full border px-3 text-xs font-semibold transition", on ? "border-success/50 bg-success/15 text-success" : "border-fg/15 text-fg/70")}>
                          {on ? <><Check size={13} /> Added</> : "+ Add"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Card>
            </section>
          )}

          {view.notes.trim() && <Card className="mt-8"><Markdown text={view.notes} /></Card>}

          <div ref={approveRef} id="approve" className="mt-8 scroll-mt-6">
            <Card tone="accent" className="!p-5 sm:!p-6">
              <h2 className="font-display text-xl font-semibold">Approve</h2>
              <p className="mt-1 text-sm text-fg/55">Review your selection. To speed up scheduling, add your preferred install date and anything we should know.</p>
              <div className="mt-4 space-y-1.5 text-sm">
                {chosen.map((o) => <div key={o.id} className="flex justify-between gap-3"><span className="text-fg/80">{o.title || "Option"}</span><span className="tabular-nums">{money(optionPrice(o))}</span></div>)}
                {chosenAdds.map((a) => <div key={a.id} className="flex justify-between gap-3"><span className="text-fg/65">+ {a.name}</span><span className="tabular-nums text-fg/65">{money(addonPrice(a))}</span></div>)}
                {!chosen.length && <p className={cx("text-fg/45", tried && "text-warn")}>Pick an option above.</p>}
              </div>
              <div className="mt-3 flex items-end justify-between border-t border-fg/10 pt-3">
                <span className="font-display font-semibold">Total</span>
                <span className="font-display text-3xl font-bold tabular-nums">{money(total)}</span>
              </div>
              {deposit > 0 && <div className="mt-1 flex justify-between text-sm text-fg/60"><span>Deposit due on approval ({view.depositPct}%)</span><span className="tabular-nums">{money(deposit)}</span></div>}

              <Field label="Preferred install date & notes" hint="Optional" className="mt-5">
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="e.g. Any weekday morning next week. Gate code 1234." disabled={expired} />
              </Field>
              {view.terms.requireName && (
                <Field label="Your full name" className="mt-3">
                  <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder={view.customer.name || "First and last name"} disabled={expired} className={cx(tried && !nameOk && "border-warn")} />
                </Field>
              )}
              <Button size="lg" className="mt-5 w-full" disabled={expired} onClick={approve}>
                {isLocal ? <><CheckCircle2 size={18} /> Approve proposal</> : <><MessageSquare size={18} /> Send my approval</>}
              </Button>
              <p className="mt-2 text-center text-xs text-fg/40">
                {isLocal ? "Approving locks in this price." : `Opens a text to ${BUSINESS.name} with your choices, ready to send.`}
              </p>
            </Card>
          </div>
        </>
      )}

      <section className="mt-10">
        <div className="flex items-center gap-2 text-sm text-fg/55"><Stars /> {BUSINESS.rating} on Google · {BUSINESS.projects} projects</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {REVIEWS.slice(0, 2).map((r) => (
            <figure key={r.name} className="rounded-2xl border border-fg/10 bg-fg/[.02] p-4">
              <blockquote className="text-sm text-fg/70">“{r.text}”</blockquote>
              <figcaption className="mt-2 text-xs text-fg/45">{r.name}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {view.terms.finePrint && <p className="mt-8 text-xs leading-relaxed text-fg/40">{view.terms.finePrint}</p>}

      <footer className="mt-10 border-t border-fg/5 pt-6 text-sm text-fg/45">
        <div className="font-display font-semibold text-fg/70">{BUSINESS.name}</div>
        {view.terms.address && <div>{view.terms.address}</div>}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <a href={BUSINESS.phoneHref} className="flex items-center gap-1.5 hover:text-fg"><Phone size={13} /> {BUSINESS.phone}</a>
          <a href={`mailto:${BUSINESS.email}`} className="flex items-center gap-1.5 hover:text-fg"><Mail size={13} /> {BUSINESS.email}</a>
        </div>
        <div className="mt-1">{BUSINESS.hours}</div>
      </footer>

      {!approved && !expired && !approveVisible && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-fg/10 bg-sunken/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
          <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-fg/45">{chosen.length ? `${chosen.length + chosenAdds.length} selected` : "Nothing selected"}</div>
              <div className="font-display text-xl font-bold tabular-nums">{money(total)}</div>
            </div>
            <Button onClick={() => approveRef.current?.scrollIntoView({ behavior: "smooth" })}>Review & approve</Button>
          </div>
        </div>
      )}
    </main>
  );
}

function ApprovedCard({ view }: { view: ProposalView }) {
  const chosen = view.options.filter((o) => view.chosenOptionIds?.includes(o.id));
  const adds = view.addons.filter((a) => view.chosenAddonIds?.includes(a.id));
  const total = selectionTotal(view, view.chosenOptionIds ?? [], view.chosenAddonIds);
  const deposit = depositFor(total, view.depositPct);
  return (
    <Card tone="success" className="mt-6 !p-5 sm:!p-6">
      <div className="flex items-center gap-2 font-display text-lg font-semibold text-success"><CheckCircle2 size={22} /> Approved</div>
      <p className="mt-2 text-fg/75">{fill(view.terms.approvalMessage, { name: view.approvedName || view.customer.name, approvedAt: view.approvedAt })}</p>
      <div className="mt-4 space-y-1.5 border-t border-fg/10 pt-4 text-sm">
        {chosen.map((o) => <div key={o.id} className="flex justify-between gap-3"><span>{o.title}</span><span className="tabular-nums">{money(optionPrice(o))}</span></div>)}
        {adds.map((a) => <div key={a.id} className="flex justify-between gap-3 text-fg/65"><span>+ {a.name}</span><span className="tabular-nums">{money(addonPrice(a))}</span></div>)}
        <div className="flex justify-between gap-3 pt-1 font-display text-lg font-semibold"><span>Total</span><span className="tabular-nums">{money(total)}</span></div>
      </div>
      {deposit > 0 && (
        <div className="mt-4 rounded-xl bg-fg/[.04] p-4">
          <div className="flex justify-between text-sm"><span className="text-fg/60">Deposit to hold your spot</span><span className="font-display font-semibold tabular-nums">{money(deposit)}</span></div>
          {view.terms.payUrl
            ? <a href={view.terms.payUrl} target="_blank" rel="noreferrer"><Button className="mt-3 w-full"><CreditCard size={16} /> Pay {money(deposit)} deposit</Button></a>
            : <p className="mt-1 text-xs text-fg/45">We'll text you a secure payment link.</p>}
        </div>
      )}
      <a href={BUSINESS.smsHref} className="mt-4 inline-flex items-center gap-1.5 text-sm text-fg/60 hover:text-fg"><MessageSquare size={14} /> Questions? Text {BUSINESS.phone}</a>
    </Card>
  );
}
