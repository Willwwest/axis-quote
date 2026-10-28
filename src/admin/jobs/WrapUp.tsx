import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Camera, Check, ChevronRight, ClipboardCheck, Copy, ExternalLink, Mail, MessageSquare, ShieldCheck, Star } from "lucide-react";
import { FilmCard } from "../../components/project/FilmCard";
import { Badge, Button, Card, CardHeader, Field, Textarea, cx } from "../../components/ui";
import { firstName } from "../../lib/format";
import { reviewsUrl } from "../../lib/links";
import { fill, leadContext, markSent, reach, sendEmail, sendSms, template } from "../../lib/messages";
import { jobTitle, setStatus } from "../../lib/project";
import { isoDate } from "../../lib/schedule";
import { leads, newId, useSettings } from "../../lib/store";
import type { Lead } from "../../lib/types";
import { certFor, certUrl, referralUrl } from "../../lib/warranty";
import { Thumb, addAttachments, removeAttachment } from "./AttachmentsCard";
import { copyText } from "./SendSheet";

const CHECKS = [
  "Glass cleaned and film edges sealed",
  "Every window inspected with the customer",
  "Aftercare explained: windows up 3–5 days",
  "Haze and small water pockets explained as normal while curing",
];

const PRE_INSTALL = ["new", "consult", "proposal", "approved", "booked"];

/** Hub summary: where the wrap-up stands, one tap into it. */
export function WrapUpCard({ lead }: { lead: Lead }) {
  const done = lead.completion;
  const photos = (lead.attachments ?? []).filter((a) => a.tag === "Before" || a.tag === "After").length;
  return (
    <Card tone={done ? "success" : lead.status === "booked" ? "accent" : undefined}>
      <CardHeader title="Wrap-up & warranty" icon={<ClipboardCheck size={16} />} />
      {done ? (
        <div className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="success" icon={<ShieldCheck size={12} />}>Warranty {done.certId}</Badge>
            <span className="text-fg/50">Installed {done.date}</span>
          </div>
          <div className="text-fg/60">{done.reviewRequested ? "Warranty & review text sent." : "Warranty and review text not sent yet."} {photos > 0 && `${photos} before/after photos.`}</div>
        </div>
      ) : (
        <p className="text-sm text-fg/55">Checklist, before & after photos, film used, then the warranty certificate and review ask in one text.</p>
      )}
      <Link to="wrapup" className="mt-3 block">
        <Button size="sm" variant={done || lead.status !== "booked" ? "outline" : "primary"} className="w-full">
          {done ? done.reviewRequested ? "Open wrap-up" : "Send warranty & review" : "Start wrap-up"} <ChevronRight size={14} />
        </Button>
      </Link>
    </Card>
  );
}

function PhotoGroup({ lead, tag }: { lead: Lead; tag: "Before" | "After" }) {
  const photos = (lead.attachments ?? []).filter((a) => a.tag === tag);
  return (
    <div>
      <div className="mb-2 text-sm font-medium text-fg/70">{tag}</div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((a) => (
          <div key={a.id} className="relative">
            <Thumb a={{ ...a, tag: undefined }} />
            <button type="button" onClick={() => removeAttachment(lead.id, a.id)} className="absolute right-1 top-1 rounded-full bg-scrim/70 px-1.5 text-xs text-on-accent" aria-label="Remove photo">×</button>
          </div>
        ))}
        <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border border-dashed border-fg/20 text-fg/50 transition hover:border-accent hover:text-fg">
          <span className="text-center text-xs"><Camera className="mx-auto mb-1" size={22} />Add</span>
          <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => { if (e.target.files) addAttachments(lead.id, e.target.files, tag); e.target.value = ""; }} />
        </label>
      </div>
    </div>
  );
}

/** The driveway checklist: inspect, photograph, log film, create the warranty, ask for the review. */
export function WrapUpPage({ lead }: { lead: Lead }) {
  const settings = useSettings();
  const done = lead.completion;
  const [checks, setChecks] = useState<boolean[]>(() => CHECKS.map(() => !!done));
  const [notes, setNotes] = useState(done?.notes ?? "");
  const cert = done ? certFor(lead, done.certId, done.date, settings) : null;
  const first = firstName(lead.contact.name);
  const r = reach(lead);
  const reviewLink = settings.googleReviewUrl || reviewsUrl();

  const [message, setMessage] = useState<string | null>(null);
  const defaultMessage = cert
    ? [
      fill(template("review"), leadContext(lead, { link: reviewLink })),
      `Your lifetime warranty certificate: ${certUrl(cert)}`,
      `Know someone who needs tint? Send them ${referralUrl(cert.ref)} and you both get $${settings.referralCredit} off.`,
    ].join("\n\n")
    : "";
  const text = message ?? defaultMessage;

  const complete = () => {
    leads.update(lead.id, { completion: { date: isoDate(new Date()), certId: newId("W"), photos: [], notes: notes.trim(), reviewRequested: false } });
    if (PRE_INSTALL.includes(lead.status)) setStatus(leads.get(lead.id)!, "installed");
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  };
  const sent = () => leads.update(lead.id, (l) => ({ completion: l.completion && { ...l.completion, reviewRequested: true } }));

  return (
    <div className="mx-auto max-w-3xl">
      <Link to=".." relative="path" className="mb-3 inline-flex items-center gap-1.5 text-sm text-fg/50 hover:text-fg"><ArrowLeft size={15} /> Back to job</Link>
      <div className="font-display text-xs font-semibold uppercase tracking-[.25em] text-accent-fg">Job wrap-up</div>
      <h1 className="mt-1 font-display text-3xl font-semibold">{lead.contact.name}</h1>
      <p className="text-fg/55">{jobTitle(lead)} · {lead.id}</p>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg font-semibold">Before you leave</h2>
        <div className="space-y-2">
          {CHECKS.map((c, i) => (
            <button key={c} type="button" onClick={() => setChecks((s) => s.map((v, n) => (n === i ? !v : v)))}
              className={cx("flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition", checks[i] ? "border-success/40 bg-success/10" : "border-fg/10 hover:border-fg/25")}>
              <span className={cx("grid h-6 w-6 shrink-0 place-items-center rounded-md border", checks[i] ? "border-success bg-success text-bg" : "border-fg/25")}>{checks[i] && <Check size={14} strokeWidth={3} />}</span>
              {c}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-1 font-display text-lg font-semibold">Before & after photos</h2>
        <p className="mb-3 text-sm text-fg/50">Great for social posts and warranty records. They're saved with the job's files.</p>
        <div className="space-y-4">
          <PhotoGroup lead={lead} tag="Before" />
          <PhotoGroup lead={lead} tag="After" />
          {!!done?.photos.length && (
            <div>
              <div className="mb-2 text-sm font-medium text-fg/70">Earlier photos</div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{done.photos.map((p, i) => <img key={i} src={p} alt="" className="aspect-square w-full rounded-xl object-cover" />)}</div>
            </div>
          )}
        </div>
      </section>

      <section className="mt-8"><FilmCard lead={lead} /></section>

      {!done && (
        <section className="mt-8">
          <Field label="Install notes" hint="Internal"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Film lot #, anything to remember for this customer…" /></Field>
          <Button size="lg" className="mt-6 w-full" disabled={!checks.every(Boolean)} onClick={complete}><Check size={18} /> Mark installed & create warranty</Button>
          {!checks.every(Boolean) && <p className="mt-2 text-center text-xs text-fg/40">Tick off the checklist first.</p>}
        </section>
      )}

      {cert && done && (
        <section className="mt-10 rounded-3xl border border-accent/40 bg-gradient-to-b from-accent/10 to-transparent p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-accent-fg">Warranty {cert.id}</div>
              <h2 className="mt-1 font-display text-2xl font-semibold">Send {first || "them"} their certificate</h2>
              <p className="mt-1 text-sm text-fg/60">One text with the review ask, the warranty and their referral link. Send it while you're still in the driveway; that's when people actually leave reviews.</p>
            </div>
            {done.reviewRequested && <Badge tone="success" icon={<Check size={12} />}>Sent</Badge>}
          </div>
          {!settings.googleReviewUrl && (
            <p className="mt-4 rounded-xl bg-warn/10 px-4 py-3 text-sm text-warn">
              <Star size={14} className="mr-1 inline" /> No Google review link yet, so this points to your reviews page. Add it under <Link to="/admin/reviews" className="underline">Reviews</Link>.
            </p>
          )}
          <Textarea value={text} onChange={(e) => setMessage(e.target.value)} rows={7} className="mt-5 text-sm leading-relaxed" />
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <Button disabled={!r.phone} onClick={() => { sent(); sendSms(r.phone, text, "review", lead.id); }}><MessageSquare size={16} /> Text it</Button>
            <Button variant="outline" disabled={!r.email} onClick={() => { sent(); sendEmail(r.email, "Your Axis Glass Tinting warranty", text, "review", lead.id); }}><Mail size={16} /> {r.email ? "Email it" : "No email"}</Button>
            <Button variant="outline" onClick={async () => { await copyText(text); markSent(r.phone || r.email, text, "review", lead.id); sent(); }}><Copy size={16} /> Copy</Button>
          </div>
          <a href={certUrl(cert)} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm text-fg/60 hover:text-fg">Preview certificate <ExternalLink size={13} /></a>
        </section>
      )}
    </div>
  );
}
