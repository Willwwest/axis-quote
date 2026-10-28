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
      <div className="grid min-h-screen place-items-center bg-axis-black px-6 text-center text-white">
        <div>
          <Logo className="mx-auto h-14" />
          <p className="mt-6 text-white/60">This warranty link looks incomplete. Call us at <a className="text-axis-bright" href={BUSINESS.phoneHref}>{BUSINESS.phone}</a> and we'll resend it.</p>
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
    <div className="min-h-screen bg-axis-black px-4 pb-16 pt-8 text-white print:p-0">
      <div className="mx-auto max-w-2xl">
        {/* Certificate */}
        <article className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-b from-[#18181c] to-[#0d0d0f] p-8 shadow-[0_40px_120px_-40px_rgba(218,40,27,.5)] sm:p-12 print:shadow-none">
          <div className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[140%] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(255,42,42,.25),transparent_65%)]" />
          <div className="pointer-events-none absolute inset-3 rounded-[22px] border border-white/[.06]" />
          <div className="relative text-center">
            <Logo className="mx-auto h-16" />
            <div className="mt-8 font-display text-xs font-semibold uppercase tracking-[.4em] text-axis-bright">Certificate of</div>
            <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Lifetime Warranty</h1>
            <p className="mx-auto mt-4 max-w-md text-white/60">
              This certifies that the window film installed for <span className="text-white">{cert.name}</span> is covered against bubbling, peeling and fading on materials and workmanship under normal use.
            </p>

            <dl className="mx-auto mt-8 grid max-w-md gap-px overflow-hidden rounded-2xl bg-white/10 text-left text-sm">
              {[
                ["Installed on", cert.subject],
                ["Film", cert.film],
                ["Coverage", cert.coverage],
                ["Install date", prettyDate(cert.date, { month: "long", day: "numeric", year: "numeric" })],
                ["Certificate", cert.id],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="flex gap-4 bg-[#121215] px-4 py-3">
                  <dt className="w-28 shrink-0 text-white/45">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-8 flex items-center justify-center gap-2 text-sm text-white/50">
              <ShieldCheck size={16} className="text-axis-bright" /> {BUSINESS.legalName} · {BUSINESS.phone}
            </div>
          </div>
        </article>

        <div className="mt-4 flex justify-center gap-2 print:hidden">
          <Button variant="outline" onClick={() => print()}><Printer size={16} /> Save / print</Button>
          <a href={BUSINESS.phoneHref}><Button variant="outline"><Phone size={16} /> Call us</Button></a>
        </div>

        {cert.review && (
          <section className="mt-10 rounded-3xl border border-white/10 bg-white/[.03] p-6 text-center print:hidden">
            <div className="text-2xl text-amber-400">★★★★★</div>
            <h2 className="mt-2 font-display text-2xl font-semibold">Happy with the result?</h2>
            <p className="mx-auto mt-2 max-w-sm text-white/60">We're a small local crew. A 30-second Google review is the best way to help us out.</p>
            <a href={cert.review} target="_blank" rel="noreferrer"><Button size="lg" className="mt-5"><Star size={18} /> Leave a review</Button></a>
          </section>
        )}

        <section className="mt-6 rounded-3xl border border-axis-red/40 bg-gradient-to-br from-axis-red/15 to-transparent p-6 print:hidden">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-b from-axis-bright to-axis-deep"><Gift size={22} /></span>
            <div className="flex-1">
              <h2 className="font-display text-xl font-semibold">Give ${cert.credit}, get ${cert.credit}</h2>
              <p className="mt-1 text-sm text-white/60">Share your link. Your friend gets ${cert.credit} off, and so do you on your next tint. Your code: <span className="font-mono text-white">{cert.ref}</span></p>
              <Button className="mt-4" onClick={share}>{shared ? <><Check size={16} /> Link ready</> : <><Share2 size={16} /> Share my link</>}</Button>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-white/10 p-6">
          <h2 className="font-display text-lg font-semibold">Aftercare</h2>
          <ul className="mt-3 space-y-2 text-sm text-white/70">
            {CARE.map((c) => <li key={c} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-axis-bright" />{c}</li>)}
          </ul>
        </section>
      </div>
    </div>
  );
}
