import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Copy, ExternalLink, MessageSquareHeart, Pencil, Plus, Send, Star, Trash2 } from "lucide-react";
import {
  Avatar, Badge, Button, Card, CardHeader, Chip, EmptyState, Field, IconButton, Input, Kpi, PageHeader, Segmented, Select, Sheet, Stars,
  Tabs, Textarea, Toggle, cx,
} from "../../components/ui";
import { relative, shortDate, today } from "../../lib/format";
import { reviewsUrl } from "../../lib/links";
import { fill, leadContext, reach, sendSms, template } from "../../lib/messages";
import { notify } from "../../lib/notify";
import { reviewLink } from "../../lib/outbox";
import { jobTitle } from "../../lib/project";
import { leads, messages, newId, patchSettings, reviews, useSettings } from "../../lib/store";
import type { Lead, Review } from "../../lib/types";

type Tab = "reviews" | "requests" | "settings";
const SITE_PRESETS = ["Google", "Facebook", "Yelp", "Nextdoor", "HomeAdvisor"];

export default function ReviewsPage() {
  const list = reviews.use();
  const msgs = messages.use();
  const [tab, setTab] = useState<Tab>("reviews");
  const [edit, setEdit] = useState<Review | null>(null);
  const [send, setSend] = useState(false);
  const requests = useMemo(() => msgs.filter((m) => m.kind === "review").sort((a, b) => b.at.localeCompare(a.at)), [msgs]);
  const sorted = useMemo(() => [...list].sort((a, b) => b.date.localeCompare(a.date)), [list]);
  const avg = list.length ? list.reduce((s, r) => s + r.rating, 0) / list.length : null;

  return (
    <div>
      <PageHeader title="Reviews" sub="Ask happy customers for reviews, log the ones you get, and show off the best."
        actions={<>
          <Button variant="ghost" size="sm" onClick={() => window.open(reviewsUrl(), "_blank", "noopener")}><ExternalLink size={14} /> Public page</Button>
          <Button variant="outline" size="sm" onClick={() => setEdit(blank())}><Plus size={15} /> Add review</Button>
          <Button size="sm" onClick={() => setSend(true)}><Send size={15} /> Send request</Button>
        </>} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Requests sent" value={String(requests.length)} />
        <Kpi label="Reviews logged" value={String(list.length)} />
        <Kpi label="Average rating" value={avg == null ? "—" : `${avg.toFixed(1)}★`} />
        <Kpi label="Published · featured" value={`${list.filter((r) => r.published).length} · ${list.filter((r) => r.featured).length}`} />
      </div>

      <Tabs value={tab} onChange={setTab} tabs={[
        { id: "reviews", label: "Reviews", count: list.length },
        { id: "requests", label: "Request log", count: requests.length },
        { id: "settings", label: "Settings" },
      ]} />

      {tab === "reviews" && (!sorted.length ? (
        <EmptyState icon={<Star size={32} />} title="No reviews logged yet" actions={<Button onClick={() => setEdit(blank())}><Plus size={16} /> Add a review</Button>}>
          Copy reviews in from Google or Facebook so you can publish them on your review page and feature them on proposals.
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sorted.map((r) => <ReviewCard key={r.id} r={r} onEdit={() => setEdit(r)} />)}
        </div>
      ))}

      {tab === "requests" && (!requests.length ? (
        <EmptyState icon={<MessageSquareHeart size={32} />} title="No requests sent yet" actions={<Button onClick={() => setSend(true)}><Send size={16} /> Send one</Button>} />
      ) : (
        <Card>
          <ul className="divide-y divide-fg/5">
            {requests.map((m) => {
              const l = leads.get(m.leadId);
              return (
                <li key={m.id} className="flex items-center gap-3 py-3">
                  <Avatar name={l?.contact.name ?? m.to} size={30} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{l ? <Link to={`/admin/jobs/${l.id}`} className="hover:underline">{l.contact.name}</Link> : m.to}</div>
                    <div className="truncate text-xs text-fg/45">{l ? jobTitle(l) : ""} · {m.channel === "sms" ? "Text" : "Email"} to {m.to}</div>
                  </div>
                  <span className="shrink-0 text-xs text-fg/45">{relative(m.at)}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}

      {tab === "settings" && <ReviewSettings />}

      <AnimatePresence>
        {edit && <ReviewSheet key="edit" review={edit} onClose={() => setEdit(null)} />}
        {send && <RequestSheet key="send" onClose={() => setSend(false)} />}
      </AnimatePresence>
    </div>
  );
}

const blank = (): Review => ({ id: "", name: "", rating: 5, text: "", source: "Google", date: today(), published: true, featured: false });

function ReviewCard({ r, onEdit }: { r: Review; onEdit: () => void }) {
  const lead = leads.get(r.leadId);
  return (
    <Card className={cx(!r.published && "border-dashed")}>
      <div className="flex items-start gap-3">
        <Avatar name={r.name} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium">{r.name}</span>
            <Stars rating={r.rating} className="text-sm" />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-fg/45">
            <span>{r.source}</span><span>{shortDate(r.date)}</span>
            {lead && <Link to={`/admin/jobs/${lead.id}`} className="truncate hover:text-fg">{jobTitle(lead)}</Link>}
          </div>
        </div>
        <IconButton label="Edit review" onClick={onEdit}><Pencil size={15} /></IconButton>
      </div>
      <p className="mt-3 text-sm text-fg/80">{r.text || <span className="text-fg/35">No text</span>}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Chip size="sm" selected={r.published} onClick={() => reviews.update(r.id, { published: !r.published })}>{r.published ? "Published" : "Publish"}</Chip>
        <Chip size="sm" selected={r.featured} onClick={() => reviews.update(r.id, { featured: !r.featured })}>{r.featured ? "★ Featured" : "Feature"}</Chip>
        <IconButton label="Delete review" className="ml-auto" onClick={() => confirm(`Delete ${r.name}'s review?`) && reviews.remove(r.id)}><Trash2 size={15} /></IconButton>
      </div>
    </Card>
  );
}

function ReviewSheet({ review, onClose }: { review: Review; onClose: () => void }) {
  const { reviews: cfg } = useSettings();
  const allLeads = leads.use();
  const [r, setR] = useState(review);
  const set = (p: Partial<Review>) => setR({ ...r, ...p });
  const sources = [...new Set([...cfg.sites.map((s) => s.name), "Direct", "Other", r.source].filter(Boolean))];
  const jobs = useMemo(() => [...allLeads].filter((l) => l.status !== "lost").sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 80), [allLeads]);
  const save = () => {
    const isNew = !r.id;
    const saved = reviews.save({ ...r, id: r.id || newId("RV"), name: r.name.trim() });
    if (isNew) notify("review", `New ${saved.rating}★ review from ${saved.name}`, "/admin/reviews");
    onClose();
  };
  return (
    <Sheet title={review.id ? "Edit review" : "Add review"} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Customer name"><Input value={r.name} onChange={(e) => set({ name: e.target.value })} placeholder="Kim A." /></Field>
        <div>
          <div className="mb-1.5 text-sm font-medium text-fg/80">Rating</div>
          <div role="radiogroup" aria-label="Rating" className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={r.rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => set({ rating: n })}
                className={cx("grid h-10 w-10 place-items-center rounded-lg text-2xl transition hover:bg-fg/[.06]", n <= r.rating ? "text-warn" : "text-fg/20")}>★</button>
            ))}
          </div>
        </div>
        <Field label="Review"><Textarea value={r.text} onChange={(e) => set({ text: e.target.value })} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Where it was left"><Select value={r.source} onChange={(e) => set({ source: e.target.value })}>{sources.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="Date"><Input type="date" value={r.date} max={today()} onChange={(e) => set({ date: e.target.value })} /></Field>
        </div>
        <Field label="Job" hint="Optional">
          <Select value={r.leadId ?? ""} onChange={(e) => set({ leadId: e.target.value || undefined })}>
            <option value="">Not linked</option>
            {jobs.map((l) => <option key={l.id} value={l.id}>{l.contact.name} · {jobTitle(l)}</option>)}
          </Select>
        </Field>
        <div className="divide-y divide-fg/5">
          <Toggle checked={r.published} onChange={(published) => set({ published })} label="Publish" hint="Shows on your public review page." />
          <Toggle checked={r.featured} onChange={(featured) => set({ featured })} label="Feature" hint="Shows on proposals and the website widget." />
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={!r.name.trim()}>Save review</Button>
      </div>
    </Sheet>
  );
}

function RequestSheet({ onClose }: { onClose: () => void }) {
  const allLeads = leads.use();
  const msgs = messages.use();
  const recent = useMemo(() => allLeads.filter((l) => ["installed", "invoiced", "paid"].includes(l.status))
    .sort((a, b) => (b.statusChangedAt ?? b.createdAt).localeCompare(a.statusChangedAt ?? a.createdAt)).slice(0, 15), [allLeads]);
  const [pick, setPick] = useState<Lead | undefined>(() => recent.find((l) => !msgs.some((m) => m.leadId === l.id && m.kind === "review")));
  const [body, setBody] = useState(() => (pick ? fill(template("review"), leadContext(pick, { link: reviewLink() })) : ""));
  const choose = (l: Lead) => { setPick(l); setBody(fill(template("review"), leadContext(l, { link: reviewLink() }))); };
  const to = pick ? reach(pick) : null;
  const go = () => {
    if (!pick || !to) return;
    if (pick.completion) leads.update(pick.id, (l) => ({ completion: l.completion && { ...l.completion, reviewRequested: true } }));
    sendSms(to.phone, body, "review", pick.id);
    onClose();
  };
  return (
    <Sheet title="Send review request" onClose={onClose}>
      {!recent.length ? <p className="text-sm text-fg/50">Review requests go to customers whose job is installed or paid. None yet.</p> : (
        <>
          <div className="mb-4 max-h-60 divide-y divide-fg/5 overflow-y-auto rounded-xl border border-fg/10">
            {recent.map((l) => {
              const asked = msgs.some((m) => m.leadId === l.id && m.kind === "review");
              return (
                <button key={l.id} type="button" onClick={() => choose(l)} className={cx("flex w-full items-center gap-3 px-3 py-2.5 text-left transition", pick?.id === l.id ? "bg-accent/10" : "hover:bg-fg/[.04]")}>
                  <Avatar name={l.contact.name} size={26} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm">{l.contact.name}</span><span className="block truncate text-xs text-fg/45">{jobTitle(l)}</span></span>
                  {asked && <Badge>Asked</Badge>}
                  {!reach(l).followupsOk && <Badge tone="warn">Opted out</Badge>}
                </button>
              );
            })}
          </div>
          <Field label={to ? `Text to ${to.phone}` : "Message"}><Textarea value={body} onChange={(e) => setBody(e.target.value)} /></Field>
          <p className="mt-2 text-xs text-fg/40">The link is your first review site with a URL (Settings tab), else the Google link from Business settings, else your public review page.</p>
        </>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={go} disabled={!pick || !to?.phone || !body.trim()}><Send size={16} /> Open in Messages</Button>
      </div>
    </Sheet>
  );
}

function ReviewSettings() {
  const s = useSettings();
  const sites = s.reviews.sites;
  const [copied, setCopied] = useState("");
  const setSites = (next: typeof sites) => patchSettings((cur) => ({ reviews: { ...cur.reviews, sites: next } }));
  const embed = `<iframe src="${reviewsUrl()}?embed=1" title="Axis Glass Tinting reviews" loading="lazy" style="width:100%;min-height:420px;border:0;background:transparent"></iframe>`;
  const copy = (key: string, text: string) => navigator.clipboard?.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(""), 1500); });

  return (
    <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Review sites" sub="Where customers can leave a review. The first one with a link is used in requests." />
        <div className="space-y-2">
          {sites.map((site, i) => (
            <div key={i} className="flex gap-2">
              <Input value={site.name} onChange={(e) => setSites(sites.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} aria-label="Site name" className="!w-32 shrink-0 !py-2 text-sm" />
              <Input value={site.url} onChange={(e) => setSites(sites.map((x, j) => (j === i ? { ...x, url: e.target.value.trim() } : x)))} aria-label={`${site.name} review link`}
                placeholder={site.name === "Google" && s.googleReviewUrl ? "Using the Business settings link" : "https://…"} className="min-w-0 !py-2 text-sm" />
              <IconButton label={`Remove ${site.name}`} className="!h-10" onClick={() => setSites(sites.filter((_, j) => j !== i))}><Trash2 size={15} /></IconButton>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {SITE_PRESETS.filter((p) => !sites.some((x) => x.name === p)).map((p) => <Chip key={p} size="sm" selected={false} onClick={() => setSites([...sites, { name: p, url: "" }])}>+ {p}</Chip>)}
          <Chip size="sm" selected={false} onClick={() => setSites([...sites, { name: "Other", url: "" }])}>+ Other</Chip>
        </div>
      </Card>

      <Card>
        <CardHeader title="Automatic requests" sub="Due requests wait in the Outbox for one-tap sending. Customers who opted out of follow-ups are skipped." />
        <Segmented value={s.reviews.autoRequest} onChange={(autoRequest) => patchSettings((cur) => ({ reviews: { ...cur.reviews, autoRequest } }))}
          options={[{ value: "installed", label: "When installed" }, { value: "paid", label: "When paid in full" }, { value: "off", label: "Off" }]} />
        <p className="mt-3 text-sm text-fg/55">Message text is under Settings → Message templates → Review request.</p>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader title="Review page & website widget" sub="Published reviews show on the page. The widget shows featured reviews first." />
        <Field label="Public review page">
          <div className="flex gap-2">
            <Input readOnly value={reviewsUrl()} className="min-w-0 !py-2 text-sm" onFocus={(e) => e.target.select()} />
            <Button variant="outline" size="sm" className="!h-10" onClick={() => copy("url", reviewsUrl())}><Copy size={14} /> {copied === "url" ? "Copied" : "Copy"}</Button>
          </div>
        </Field>
        <Field label="Embed code" hint="Paste into your website builder's HTML block" className="mt-4">
          <Textarea readOnly value={embed} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
        </Field>
        <div className="mt-2 flex justify-end"><Button variant="outline" size="sm" onClick={() => copy("embed", embed)}><Copy size={14} /> {copied === "embed" ? "Copied" : "Copy embed code"}</Button></div>
      </Card>
    </div>
  );
}
