import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Camera, Check, Copy, ExternalLink, Mail, MessageSquare, Star, X } from "lucide-react";
import { BUSINESS } from "../data/config";
import { Button, Field, Logo, Textarea, cx } from "../components/ui";
import { isoDate } from "../lib/schedule";
import { getLeads, newId, saveLead, useLeads, useSettings } from "../lib/store";
import { certFor, certUrl, referralUrl } from "../lib/warranty";

const CHECKS = [
  "Glass cleaned and film edges sealed",
  "Every window inspected with the customer",
  "Aftercare explained: windows up 3–5 days",
  "Haze and small water pockets explained as normal while curing",
];

/** Shrinks a phone photo to a ~1200px JPEG so it fits in local storage. */
function compress(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = img.width * scale;
      c.height = img.height * scale;
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export default function JobCompletePage() {
  const { id } = useParams();
  const settings = useSettings();
  const lead = useLeads().find((l) => l.id === id);
  const [checks, setChecks] = useState<boolean[]>(() => CHECKS.map(() => !!lead?.completion));
  const [notes, setNotes] = useState(lead?.completion?.notes ?? "");
  const [copied, setCopied] = useState(false);

  if (!lead) {
    return (
      <div className="grid min-h-screen place-items-center bg-axis-black text-white">
        <div className="text-center"><p>Lead not found.</p><Link to="/admin" className="text-axis-bright">Back to dashboard</Link></div>
      </div>
    );
  }

  const done = lead.completion;
  const photos = done?.photos ?? [];
  const cert = done ? certFor(lead, done.certId, done.date, settings) : null;
  const first = lead.contact.name.split(" ")[0];
  const digits = lead.contact.phone.replace(/\D/g, "");

  const message = cert
    ? `Hi ${first}! Thanks for choosing Axis Glass Tinting. Here's your lifetime warranty certificate: ${certUrl(cert)}` +
      (settings.googleReviewUrl ? `\n\nIf you love the result, a quick Google review helps our small local crew a ton: ${settings.googleReviewUrl}` : "") +
      `\n\nKnow someone who needs tint? Send them ${referralUrl(cert.ref)} and you both get $${settings.referralCredit} off.`
    : "";

  const complete = () => {
    saveLead({
      ...lead,
      status: "completed",
      completion: { date: isoDate(new Date()), certId: newId("W"), photos, notes, reviewRequested: false },
    });
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    const added = await Promise.all([...files].map(compress));
    const fresh = getLeads().find((l) => l.id === lead.id)!;
    const base = fresh.completion ?? { date: "", certId: "", photos: [], notes, reviewRequested: false };
    try {
      saveLead({ ...fresh, completion: { ...base, photos: [...base.photos, ...added] } });
    } catch {
      alert("Storage is full. Remove a photo or two.");
    }
  };

  const removePhoto = (i: number) => {
    const fresh = getLeads().find((l) => l.id === lead.id)!;
    if (fresh.completion) saveLead({ ...fresh, completion: { ...fresh.completion, photos: fresh.completion.photos.filter((_, n) => n !== i) } });
  };

  const markSent = () => saveLead({ ...lead, completion: { ...done!, reviewRequested: true } });

  return (
    <div className="min-h-screen bg-axis-black pb-20 text-white">
      <header className="border-b border-white/5">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-4 px-4">
          <Link to="/admin" className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white"><ArrowLeft size={16} /> Dashboard</Link>
          <div className="flex-1" />
          <Logo flat className="h-10" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-8">
        <div className="text-xs uppercase tracking-[.25em] text-axis-bright">Job wrap-up</div>
        <h1 className="mt-2 font-display text-3xl font-semibold">{lead.contact.name}</h1>
        <p className="text-white/55">{lead.vehicle?.ymm || lead.city} · {lead.id}</p>

        <section className="mt-8">
          <h2 className="mb-3 font-display text-lg font-semibold">Before you leave</h2>
          <div className="space-y-2">
            {CHECKS.map((c, i) => (
              <button key={c} type="button" onClick={() => setChecks((s) => s.map((v, n) => (n === i ? !v : v)))}
                className={cx("flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition", checks[i] ? "border-emerald-500/40 bg-emerald-500/10" : "border-white/10 hover:border-white/25")}>
                <span className={cx("grid h-6 w-6 place-items-center rounded-md border", checks[i] ? "border-emerald-400 bg-emerald-500" : "border-white/25")}>{checks[i] && <Check size={14} strokeWidth={3} />}</span>
                {c}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-1 font-display text-lg font-semibold">Before & after photos</h2>
          <p className="mb-3 text-sm text-white/50">Great for social posts and warranty records.</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((p, i) => (
              <div key={i} className="group relative aspect-square overflow-hidden rounded-xl">
                <img src={p} alt="" className="h-full w-full object-cover" />
                <button type="button" onClick={() => removePhoto(i)} className="absolute right-1 top-1 rounded-full bg-black/70 p-1 opacity-0 transition group-hover:opacity-100" aria-label="Remove photo"><X size={14} /></button>
              </div>
            ))}
            <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border border-dashed border-white/20 text-white/50 transition hover:border-axis-red hover:text-white">
              <span className="text-center text-xs"><Camera className="mx-auto mb-1" size={22} />Add photo</span>
              <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} />
            </label>
          </div>
        </section>

        {!done && (
          <section className="mt-8">
            <Field label="Install notes" hint="Internal"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Film lot #, anything to remember for this customer…" /></Field>
            <Button size="lg" className="mt-6 w-full" disabled={!checks.every(Boolean)} onClick={complete}>
              <Check size={18} /> Mark complete & create warranty
            </Button>
            {!checks.every(Boolean) && <p className="mt-2 text-center text-xs text-white/40">Tick off the checklist first.</p>}
          </section>
        )}

        {cert && (
          <section className="mt-10 rounded-3xl border border-axis-red/40 bg-gradient-to-b from-axis-red/10 to-transparent p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-widest text-axis-bright">Warranty {cert.id}</div>
                <h2 className="mt-1 font-display text-2xl font-semibold">Send {first} their certificate</h2>
                <p className="mt-1 text-sm text-white/60">One text with the warranty, a review ask and their referral link. Send it while you're still in the driveway; that's when people actually leave reviews.</p>
              </div>
              {done?.reviewRequested && <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300"><Check size={12} /> Sent</span>}
            </div>

            {!settings.googleReviewUrl && (
              <p className="mt-4 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                <Star size={14} className="mr-1 inline" /> Add your Google review link in <Link to="/admin" className="underline">Settings</Link> to include the review ask.
              </p>
            )}

            <pre className="mt-5 whitespace-pre-wrap break-words rounded-2xl bg-black/40 p-4 font-body text-sm leading-relaxed text-white/80">
              {message.replace(/https?:\/\/\S{48,}/g, (u) => `${u.slice(0, 40)}…`)}
            </pre>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <a href={`sms:${digits}?&body=${encodeURIComponent(message)}`} onClick={markSent}><Button className="w-full"><MessageSquare size={16} /> Text it</Button></a>
              {lead.contact.email ? (
                <a href={`mailto:${lead.contact.email}?subject=${encodeURIComponent("Your Axis Glass Tinting warranty")}&body=${encodeURIComponent(message)}`} onClick={markSent}>
                  <Button variant="outline" className="w-full"><Mail size={16} /> Email it</Button>
                </a>
              ) : <Button variant="outline" disabled><Mail size={16} /> No email</Button>}
              <Button variant="outline" onClick={() => { navigator.clipboard.writeText(message); setCopied(true); markSent(); }}>
                {copied ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy</>}
              </Button>
            </div>
            <a href={certUrl(cert)} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white">
              Preview certificate <ExternalLink size={13} />
            </a>
            <p className="mt-2 text-xs text-white/35">Customer can always reach you at {BUSINESS.phone}.</p>
          </section>
        )}
      </main>
    </div>
  );
}
