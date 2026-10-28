import { useMemo, useState } from "react";
import { Check, Gift, Phone, Printer, Share2, ShieldCheck, Star } from "lucide-react";
import { BUSINESS } from "../data/config";
import { Button, Logo } from "../components/ui";
import { prettyDate } from "../lib/schedule";
import { decodeCert, referralUrl } from "../lib/warranty";

const CARE = [
  "Keep windows rolled up for 3–5 days while the film cures.",
  "A little haze or small water pockets are normal and clear up as it dries.",
  "Clean with a soft cloth and ammonia-free cleaner.",
  "Skip anything abrasive near the edges.",
];

export default function WarrantyPage() {
  const cert = useMemo(() => decodeCert(location.hash.slice(1)), []);
  const [shared, setShared] = useState(false);

  if (!cert) {
    return (
      <div className="grid min-h-screen place-items-center bg-bg px-6 text-center text-fg">
        <div>
          <Logo className="mx-auto h-14" />
          <p className="mt-6 text-fg/60">This warranty link looks incomplete. Call us at <a className="text-accent-fg" href={BUSINESS.phoneHref}>{BUSINESS.phone}</a> and we'll resend it.</p>
        </div>
      </div>
    );
  }

  const refLink = referralUrl(cert.ref);
  const share = async () => {
    const text = `I got my windows tinted by Axis Glass Tinting and they're great. Use my link for $${cert.credit} off:`;
    if (navigator.share) {
      try { await navigator.share({ title: "Axis Glass Tinting", text, url: refLink }); } catch { return; }
    } else {
      await navigator.clipboard.writeText(`${text} ${refLink}`);
    }
    setShared(true);
  };

  return (
    <div className="min-h-screen bg-bg px-4 pb-16 pt-8 text-fg print:p-0">
      <div className="mx-auto max-w-2xl">
        {/* Certificate */}
        <article className="relative overflow-hidden rounded-[28px] border border-fg/10 bg-gradient-to-b from-raised to-sunken p-8 shadow-[0_40px_120px_-40px_rgb(var(--c-accent)_/_.5)] sm:p-12 print:shadow-none">
          <div className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[140%] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgb(var(--c-accent-bright)_/_.25),transparent_65%)]" />
          <div className="pointer-events-none absolute inset-3 rounded-[22px] border border-fg/[.06]" />
          <div className="relative text-center">
            <Logo className="mx-auto h-16" />
            <div className="mt-8 font-display text-xs font-semibold uppercase tracking-[.4em] text-accent-fg">Certificate of</div>
            <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Lifetime Warranty</h1>
            <p className="mx-auto mt-4 max-w-md text-fg/60">
              This certifies that the window film installed for <span className="text-fg">{cert.name}</span> is covered against bubbling, peeling and fading on materials and workmanship under normal use.
            </p>

            <dl className="mx-auto mt-8 grid max-w-md gap-px overflow-hidden rounded-2xl bg-fg/10 text-left text-sm">
              {[
                ["Installed on", cert.subject],
                ["Film", cert.film],
                ["Coverage", cert.coverage],
                ["Install date", prettyDate(cert.date, { month: "long", day: "numeric", year: "numeric" })],
                ["Certificate", cert.id],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="flex gap-4 bg-sunken px-4 py-3">
                  <dt className="w-28 shrink-0 text-fg/45">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-8 flex items-center justify-center gap-2 text-sm text-fg/50">
              <ShieldCheck size={16} className="text-accent-fg" /> {BUSINESS.legalName} · {BUSINESS.phone}
            </div>
          </div>
        </article>

        <div className="mt-4 flex justify-center gap-2 print:hidden">
          <Button variant="outline" onClick={() => print()}><Printer size={16} /> Save / print</Button>
          <a href={BUSINESS.phoneHref}><Button variant="outline"><Phone size={16} /> Call us</Button></a>
        </div>

        {cert.review && (
          <section className="mt-10 rounded-3xl border border-fg/10 bg-fg/[.03] p-6 text-center print:hidden">
            <div className="text-2xl text-warn">★★★★★</div>
            <h2 className="mt-2 font-display text-2xl font-semibold">Happy with the result?</h2>
            <p className="mx-auto mt-2 max-w-sm text-fg/60">We're a small local crew. A 30-second Google review is the best way to help us out.</p>
            <a href={cert.review} target="_blank" rel="noreferrer"><Button size="lg" className="mt-5"><Star size={18} /> Leave a review</Button></a>
          </section>
        )}

        <section className="mt-6 rounded-3xl border border-accent/40 bg-gradient-to-br from-accent/15 to-transparent p-6 print:hidden">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-b from-accent-bright to-accent-deep"><Gift size={22} /></span>
            <div className="flex-1">
              <h2 className="font-display text-xl font-semibold">Give ${cert.credit}, get ${cert.credit}</h2>
              <p className="mt-1 text-sm text-fg/60">Share your link. Your friend gets ${cert.credit} off, and so do you on your next tint. Your code: <span className="font-mono text-fg">{cert.ref}</span></p>
              <Button className="mt-4" onClick={share}>{shared ? <><Check size={16} /> Link ready</> : <><Share2 size={16} /> Share my link</>}</Button>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-fg/10 p-6">
          <h2 className="font-display text-lg font-semibold">Aftercare</h2>
          <ul className="mt-3 space-y-2 text-sm text-fg/70">
            {CARE.map((c) => <li key={c} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-accent-fg" />{c}</li>)}
          </ul>
        </section>
      </div>
    </div>
  );
}
