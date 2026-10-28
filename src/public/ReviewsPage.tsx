import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { ExternalLink, Phone } from "lucide-react";
import { BUSINESS, REVIEWS } from "../data/config";
import { Avatar, Button, Logo, Stars, cx } from "../components/ui";
import { reviewsUrl } from "../lib/links";
import { reviews, useSettings } from "../lib/store";
import type { Review } from "../lib/types";

/*
 * Customer-facing review profile at /reviews, and a compact widget at /reviews?embed=1 for the website.
 * Always dark. Reviews live on the shop's device, so other phones see the reviews from the website config.
 */
export default function PublicReviewsPage() {
  const [params] = useSearchParams();
  const embed = params.get("embed") === "1";
  const logged = reviews.use();
  const s = useSettings();

  useEffect(() => {
    const html = document.documentElement;
    delete html.dataset.theme;
    if (!embed) return;
    // "normal" keeps Chrome from painting an opaque dark canvas behind the iframe on a light site.
    const prev = [html.style.background, document.body.style.background, html.style.colorScheme];
    html.style.background = document.body.style.background = "transparent";
    html.style.colorScheme = "normal";
    return () => { [html.style.background, document.body.style.background, html.style.colorScheme] = prev; };
  }, [embed]);

  const list = useMemo(() => {
    const published = logged.filter((r) => r.published);
    const src: Review[] = published.length ? published : REVIEWS.map((r, i) => ({ id: `site-${i}`, name: r.name, text: r.text, rating: 5, source: "Google", date: "", published: true, featured: true }));
    return [...src].sort((a, b) => Number(b.featured) - Number(a.featured) || b.date.localeCompare(a.date));
  }, [logged]);
  const avg = list.reduce((a, r) => a + r.rating, 0) / (list.length || 1);
  const sites = s.reviews.sites.map((x) => ({ ...x, url: x.url || (x.name === "Google" ? s.googleReviewUrl : "") })).filter((x) => x.url);

  if (embed) {
    const shown = list.slice(0, 6);
    return (
      <div className="p-3 font-body text-fg">
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-display text-2xl font-semibold">{avg.toFixed(1)}</span>
          <Stars rating={Math.round(avg)} />
          <span className="text-sm text-fg/55">{list.length} review{list.length === 1 ? "" : "s"} · {BUSINESS.name}</span>
          <a href={reviewsUrl()} target="_blank" rel="noreferrer" className="ml-auto text-sm text-accent-fg hover:underline">See all</a>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{shown.map((r) => <ReviewTile key={r.id} r={r} compact />)}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg font-body text-fg">
      <div className="mx-auto max-w-4xl px-4 pb-16 pt-8 sm:px-6">
        <header className="flex items-center justify-between gap-4">
          <a href={import.meta.env.BASE_URL}><Logo flat className="h-9" /></a>
          <a href={BUSINESS.phoneHref} className="flex items-center gap-1.5 text-sm text-fg/60 hover:text-fg"><Phone size={14} /> {BUSINESS.phone}</a>
        </header>

        <section className="mt-10 text-center">
          <div className="font-display text-xs font-semibold uppercase tracking-[.25em] text-accent-fg">Customer reviews</div>
          <div className="mt-3 font-display text-6xl font-semibold">{avg.toFixed(1)}</div>
          <Stars rating={Math.round(avg)} className="mt-2 text-2xl" />
          <p className="mt-2 text-sm text-fg/55">From {list.length} review{list.length === 1 ? "" : "s"}</p>
          <dl className="mx-auto mt-8 grid max-w-md grid-cols-3 gap-3">
            {[[BUSINESS.rating, "Google rating"], [BUSINESS.projects, "Projects"], [BUSINESS.years, "Years tinting"]].map(([v, k]) => (
              <div key={k} className="rounded-2xl border border-fg/10 bg-surface px-2 py-3">
                <dd className="font-display text-xl font-semibold">{v}</dd>
                <dt className="text-xs text-fg/50">{k}</dt>
              </div>
            ))}
          </dl>
          {sites.length > 0 && (
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {sites.map((x, i) => (
                <Button key={x.name + i} variant={i === 0 ? "primary" : "outline"} onClick={() => window.open(x.url, "_blank", "noopener")}>Leave a review on {x.name} <ExternalLink size={14} /></Button>
              ))}
            </div>
          )}
        </section>

        <section className="mt-12 grid gap-4 sm:grid-cols-2">{list.map((r) => <ReviewTile key={r.id} r={r} />)}</section>

        <footer className="mt-14 text-center">
          <p className="font-display text-xl font-semibold">Want results like these?</p>
          <Button size="lg" className="mt-4" onClick={() => (location.href = import.meta.env.BASE_URL)}>Get an instant quote</Button>
          <p className="mt-6 text-xs text-fg/35">{BUSINESS.legalName} · {BUSINESS.hours}</p>
        </footer>
      </div>
    </div>
  );
}

function ReviewTile({ r, compact }: { r: Review; compact?: boolean }) {
  return (
    <figure className={cx("rounded-2xl border border-fg/10 bg-surface", compact ? "p-4" : "p-5")}>
      <div className="flex items-center gap-3">
        <Avatar name={r.name} size={compact ? 30 : 36} />
        <div className="min-w-0">
          <figcaption className="truncate font-medium">{r.name}</figcaption>
          <div className="flex items-center gap-2 text-xs text-fg/45">
            <Stars rating={r.rating} />
            {r.date && <span>{new Date(`${r.date}T12:00`).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>}
            {r.source && r.source !== "Direct" && <span>· {r.source}</span>}
          </div>
        </div>
      </div>
      <blockquote className={cx("mt-3 text-fg/80", compact ? "line-clamp-4 text-sm" : "text-[15px] leading-relaxed")}>“{r.text}”</blockquote>
    </figure>
  );
}
