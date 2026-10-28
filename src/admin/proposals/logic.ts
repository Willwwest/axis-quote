import { BODY_TYPES, FILMS, HOME_FILMS, type HomeFilm, type Settings, type Zone } from "../../data/config";
import type { Tone } from "../../components/ui";
import { addDays, money, sqft, today } from "../../lib/format";
import { publicUrl } from "../../lib/links";
import { fill, leadContext, reach, sendSms, template } from "../../lib/messages";
import { notify } from "../../lib/notify";
import { buildQuote, homeSqft } from "../../lib/pricing";
import { isoDate, parseIso } from "../../lib/schedule";
import { jobTitle, setStatus } from "../../lib/project";
import { contacts, filmTypes, getSettings, leads, newId, nextNumber, proposals, proposalTemplates } from "../../lib/store";
import type {
  FilmType, JobKind, Lead, Proposal, ProposalOption, ProposalStatus, ProposalTemplate, QuoteLine, Room, ServiceLine,
} from "../../lib/types";
import { quoteState } from "../jobs/jobUtils";

/* ---------- Money ---------- */

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Sum of an option's lines before its discount. */
export const optionBefore = (o: ProposalOption) => round2(o.lines.reduce((s, l) => s + l.amount, 0));
export const optionPrice = (o: ProposalOption) => round2(optionBefore(o) * (1 - (o.discountPct || 0) / 100));
export const addonPrice = (a: ServiceLine) => round2(a.price * (a.qty || 1));

export function selectionTotal(p: Pick<Proposal, "options" | "addons">, optionIds: string[], addonIds: string[] = []) {
  return round2(
    p.options.filter((o) => optionIds.includes(o.id)).reduce((s, o) => s + optionPrice(o), 0) +
    p.addons.filter((a) => addonIds.includes(a.id)).reduce((s, a) => s + addonPrice(a), 0),
  );
}

export const depositFor = (total: number, pct: number) => round2((total * pct) / 100);

/** "$450" or "$300 – $900" when the options differ. */
export function priceRange(options: ProposalOption[]) {
  if (!options.length) return "—";
  const prices = options.map(optionPrice);
  const lo = Math.min(...prices), hi = Math.max(...prices);
  return lo === hi ? money(lo) : `${money(lo)} – ${money(hi)}`;
}

/** What a proposal is worth: the approved choice, else the recommended (or priciest) option. */
export function proposalValue(p: Proposal) {
  if (p.status === "approved" && p.chosenOptionIds?.length) return selectionTotal(p, p.chosenOptionIds, p.chosenAddonIds);
  const rec = p.options.find((o) => o.recommended);
  return rec ? optionPrice(rec) : Math.max(0, ...p.options.map(optionPrice));
}

/* ---------- Status ---------- */

/** Expiry is computed: a sent proposal past its last valid day reads as expired. */
export function liveStatus(p: Pick<Proposal, "status" | "expiresAt">): ProposalStatus {
  if ((p.status === "sent" || p.status === "viewed") && p.expiresAt && p.expiresAt < today()) return "expired";
  return p.status;
}

export const STATUS_META: Record<ProposalStatus, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  sent: { label: "Sent", tone: "info" },
  viewed: { label: "Viewed", tone: "warn" },
  approved: { label: "Approved", tone: "success" },
  declined: { label: "Declined", tone: "danger" },
  expired: { label: "Expired", tone: "neutral" },
};

const HOUR = 3600_000;

/** Which follow-up is due: not opened 24h after sending, or opened but not approved 48h later. */
export function followupDue(p: Proposal, now = Date.now()): "proposalFollow24" | "proposalFollow48" | null {
  const s = liveStatus(p);
  if (s === "sent" && p.sentAt && !p.viewedAt && now - +new Date(p.sentAt) > 24 * HOUR && !p.followups?.notViewed) return "proposalFollow24";
  if (s === "viewed" && p.viewedAt && now - +new Date(p.viewedAt) > 48 * HOUR && !p.followups?.notApproved) return "proposalFollow48";
  return null;
}

/* ---------- Creating ---------- */

const blankOption = (title = ""): ProposalOption => ({ id: newId("O"), title, description: "", lines: [], discountPct: 0 });

export const newOption = blankOption;

export function blankProposal(lead: Lead, s: Settings = getSettings()): Proposal {
  return {
    id: newId("P"),
    code: nextNumber("proposal"),
    leadId: lead.id,
    options: [],
    addons: [],
    selectTogether: false,
    notes: "",
    depositPct: s.proposals.depositPct,
    expiresAt: addDays(today(), s.proposals.expiryDays),
    status: "draft",
    createdAt: new Date().toISOString(),
  };
}

const bullets = (items: readonly string[]) => items.map((i) => `- ${i}`).join("\n");

/** Good / Better / Best for a vehicle: carbon, ceramic, and ceramic plus a clear windshield. */
function vehicleOptions(lead: Lead, s: Settings): ProposalOption[] {
  const base = quoteState(lead);
  const v = base.vehicle;
  let zones = v.zones.filter((z) => z !== "windshield");
  if (!zones.length) zones = ["frontSides", "rearSides", "rearWindshield", "visor"];
  const lines = (film: "carbon" | "ceramic", zs: Zone[]) => buildQuote(s, { ...base, kind: "vehicle", vehicle: { ...v, film, zones: zs } }).lines;
  const opts: ProposalOption[] = [];
  const carbonOk = zones.every((z) => s.prices[v.body][z].carbon != null);
  if (carbonOk) {
    opts.push({ ...blankOption("Good · Carbon"), lines: lines("carbon", zones),
      description: `${FILMS.carbon.tagline}\n\n${bullets(FILMS.carbon.perks)}` });
  }
  opts.push({ ...blankOption("Better · Ceramic"), lines: lines("ceramic", zones), recommended: true,
    description: `${FILMS.ceramic.tagline}\n\n${bullets(FILMS.ceramic.perks)}` });
  if (s.prices[v.body].windshield.ceramic != null) {
    opts.push({ ...blankOption("Best · Ceramic + windshield"), lines: lines("ceramic", [...zones, "windshield"]),
      description: `Everything in **Better**, plus a clear ceramic film on the windshield.\n\n${bullets(["Blocks heat and glare through the biggest piece of glass", "Stays clear: no darkening, legal in Arizona", "The coolest cabin we offer"])}` });
  }
  return opts;
}

export const roomSqft = (r: Room) => r.items.reduce((s, m) => s + sqft(m.w, m.h, m.qty), 0);
export const roomItems = (r: Room) => r.items.reduce((s, m) => s + m.qty, 0);

/** Flat glass: one whole-job option per film, priced from the measured rooms (or the instant-quote panes). */
function flatOptions(lead: Lead, s: Settings): ProposalOption[] {
  const rooms = (lead.rooms ?? []).filter((r) => r.approved !== false && r.items.length);
  const panesSqft = lead.home ? homeSqft(lead.home) : 0;
  const travel = buildQuote(s, quoteState(lead)).lines.filter((l) => l.label === "Travel" || l.label === "Referral credit");
  const linesAt = (rate: number): QuoteLine[] => {
    const out: QuoteLine[] = rooms.length
      ? rooms.map((r) => ({ label: r.name || "Room", amount: round2(roomSqft(r) * rate), note: `${roomItems(r)} items · ~${Math.round(roomSqft(r))} sq ft` }))
      : panesSqft ? [{ label: "Windows", amount: round2(panesSqft * rate), note: `~${panesSqft} sq ft (estimate)` }] : [];
    const sum = out.reduce((t, l) => t + l.amount, 0);
    if (out.length && sum < s.homeMinimum) out.push({ label: "Job minimum", amount: round2(s.homeMinimum - sum) });
    return [...out, ...(out.length ? travel : [])];
  };
  const flat = filmTypes.all().filter((f) => f.category === "flat" && f.pricePerSqft > 0).sort((a, b) => a.pricePerSqft - b.pricePerSqft).slice(0, 3);
  const tiers = ["Good", "Better", "Best"];
  if (flat.length) {
    return flat.map((f, i) => ({
      ...blankOption(`${flat.length > 1 ? `${tiers[i]} · ` : ""}${filmName(f)}`), filmTypeId: f.id, description: f.description,
      lines: linesAt(f.pricePerSqft), recommended: flat.length > 1 && i === 1,
    }));
  }
  return (Object.keys(HOME_FILMS) as HomeFilm[]).map((id, i) => {
    const f = HOME_FILMS[id];
    const shade = lead.home?.film === id ? lead.home.shade : f.shades[Math.floor(f.shades.length / 2)].name;
    return { ...blankOption(`${f.name} · ${shade}`), description: `**${f.kind}.** ${f.tagline}`, lines: linesAt(s.homeRatePerSqft[id]), recommended: lead.home ? lead.home.film === id : i === 0 };
  });
}

export function autoOptions(lead: Lead, s: Settings = getSettings()) {
  return lead.kind === "vehicle" ? vehicleOptions(lead, s) : flatOptions(lead, s);
}

const cloneOptions = (opts: ProposalOption[], keepRooms: boolean) =>
  opts.map((o) => ({ ...structuredClone(o), id: newId("O"), roomIds: keepRooms ? o.roomIds : undefined }));
const cloneAddons = (a: ServiceLine[]) => a.map((x) => ({ ...x, id: newId("S") }));

export function proposalFromTemplate(lead: Lead, t: ProposalTemplate): Proposal {
  return {
    ...blankProposal(lead),
    options: cloneOptions(t.options, false),
    addons: cloneAddons(t.addons),
    notes: t.notes,
    depositPct: t.depositPct,
    selectTogether: !!t.selectTogether,
    expiresAt: addDays(today(), t.expiryDays || getSettings().proposals.expiryDays),
  };
}

/** A fresh draft copy, for revising a sent or approved proposal. */
export function duplicateProposal(p: Proposal): Proposal {
  const lead = leads.get(p.leadId)!;
  return { ...blankProposal(lead), options: cloneOptions(p.options, true), addons: cloneAddons(p.addons), notes: p.notes, depositPct: p.depositPct, selectTogether: p.selectTogether };
}

export function templateFromProposal(p: Proposal, name: string): ProposalTemplate {
  const days = Math.max(1, Math.round((+parseIso(p.expiresAt) - +parseIso(isoDate(new Date(p.createdAt)))) / 864e5)) || getSettings().proposals.expiryDays;
  return { id: newId("PT"), name, options: cloneOptions(p.options, false), addons: cloneAddons(p.addons), notes: p.notes, depositPct: p.depositPct, expiryDays: days, selectTogether: p.selectTogether };
}

/** Starter canned proposals for the common body styles, priced from the current price sheet. */
export function starterTemplates(s: Settings = getSettings()): ProposalTemplate[] {
  const fake = (body: (typeof BODY_TYPES)[number]["id"]): Lead => ({
    id: "x", createdAt: "", status: "new", kind: "vehicle", region: null, garage: null, appointment: null, referral: "", city: "",
    contact: { name: "", phone: "", email: "", notes: "", sms: true }, quote: { lines: [], total: 0 },
    vehicle: { body, ymm: "", paint: "", zones: ["frontSides", "rearSides", "rearWindshield", "visor"], film: "ceramic", frontVlt: 35, rearVlt: 20, removal: false },
  });
  const base = (name: string, options: ProposalOption[]): ProposalTemplate =>
    ({ id: newId("PT"), name, options, addons: [], notes: "", depositPct: s.proposals.depositPct, expiryDays: s.proposals.expiryDays, selectTogether: false });
  const list = (["sedan", "suv", "truck"] as const).map((b) => base(`${BODY_TYPES.find((x) => x.id === b)!.label} · Good / Better / Best`, vehicleOptions(fake(b), s)));
  const ws = s.prices.sedan.windshield.ceramic;
  if (ws != null) {
    list.push(base("Windshield only", [{ ...blankOption("Clear ceramic windshield"), lines: [{ label: "Full windshield", amount: ws, note: "Clear ceramic · 70%" }],
      description: "Heat and glare rejection with no tint look. Legal in Arizona." }]));
  }
  return list;
}

/* ---------- What the customer sees ---------- */

export interface ProposalView {
  id: string;
  code: string;
  leadId: string;
  kind: JobKind | null;
  customer: { name: string; phone?: string; address?: string };
  job: string;
  rooms?: { id: string; name: string; items: number; sqft: number }[];
  options: (ProposalOption & { film?: string })[];
  addons: ServiceLine[];
  selectTogether: boolean;
  notes: string;
  depositPct: number;
  expiresAt: string;
  date: string;
  status: ProposalStatus;
  approvedAt?: string;
  approvedName?: string;
  chosenOptionIds?: string[];
  chosenAddonIds?: string[];
  /** Owner settings ride along, since the customer's phone has none of them. */
  terms: { requireName: boolean; approvalMessage: string; finePrint: string; payUrl: string; address: string };
}

// Skip the series when the name already starts with it ("Ceramic" + "Ceramic 35").
export const filmName = (f: FilmType) => [f.brand, f.name.toLowerCase().startsWith(f.series.toLowerCase()) ? "" : f.series, f.name].filter(Boolean).join(" ") + (f.vlt != null && !/\d/.test(f.name) ? ` ${f.vlt}` : "");

export function proposalView(p: Proposal, s: Settings = getSettings()): ProposalView {
  const lead = leads.get(p.leadId);
  const c = contacts.get(lead?.contactId);
  const types = filmTypes.all();
  const rooms = lead?.rooms?.filter((r) => r.items.length).map((r) => ({ id: r.id, name: r.name, items: roomItems(r), sqft: Math.round(roomSqft(r)) }));
  return {
    id: p.id, code: p.code, leadId: p.leadId,
    kind: lead?.kind ?? null,
    customer: { name: c?.name || lead?.contact.name || "", phone: c?.phone || lead?.contact.phone, address: lead?.address || c?.address || lead?.city || c?.city },
    job: lead ? jobTitle(lead) : "",
    rooms: rooms?.length ? rooms : undefined,
    options: p.options.map((o) => {
      const f = types.find((t) => t.id === o.filmTypeId);
      return f ? { ...o, film: filmName(f) } : o;
    }),
    addons: p.addons, selectTogether: p.selectTogether, notes: p.notes, depositPct: p.depositPct, expiresAt: p.expiresAt,
    date: p.sentAt ?? p.createdAt,
    status: p.status, approvedAt: p.approvedAt, approvedName: p.approvedName, chosenOptionIds: p.chosenOptionIds, chosenAddonIds: p.chosenAddonIds,
    terms: { requireName: s.proposals.requireName, approvalMessage: s.proposals.approvalMessage, finePrint: s.proposals.finePrint, payUrl: s.invoices.payUrl, address: s.businessAddress },
  };
}

/** The copy that travels in the link. Lean: approval state and empty fields are dropped. */
export function proposalSnap(p: Proposal): ProposalView {
  return { ...proposalView(p), status: "sent", approvedAt: undefined, approvedName: undefined, chosenOptionIds: undefined, chosenAddonIds: undefined };
}

export const proposalLink = (p: Proposal) => publicUrl("p", p.id, proposalSnap(p));

export const proposalMessage = (lead: Lead, p: Proposal, link: string) => fill(template("proposalSend"), leadContext(lead, { link, code: p.code }));

/** Texts the due follow-up and remembers it, so the nudge isn't shown (or sent) twice. */
export function sendFollowup(p: Proposal, lead: Lead) {
  const due = followupDue(p);
  if (!due) return;
  proposals.update(p.id, { followups: { ...p.followups, [due === "proposalFollow24" ? "notViewed" : "notApproved"]: new Date().toISOString() } });
  sendSms(reach(lead).phone, fill(template(due), leadContext(lead, { link: proposalLink(p), code: p.code })), due, lead.id);
}

/* ---------- Actions ---------- */

/** Records a send: status, time, an expiry that hasn't already lapsed, and moves the job to "proposal". */
export function markProposalSent(p: Proposal) {
  const s = getSettings();
  const fresh = proposals.get(p.id) ?? p;
  proposals.update(p.id, {
    status: fresh.status === "draft" || liveStatus(fresh) === "expired" || fresh.status === "declined" ? "sent" : fresh.status,
    sentAt: new Date().toISOString(),
    expiresAt: fresh.expiresAt < today() ? addDays(today(), s.proposals.expiryDays) : fresh.expiresAt,
  });
  const lead = leads.get(p.leadId);
  if (lead && (lead.status === "new" || lead.status === "consult")) setStatus(lead, "proposal");
}

export interface Approval { optionIds: string[]; addonIds: string[]; name: string; notes: string }

/** Approval writes the agreed price (and room scope for flat glass) back to the job and tells the crew. */
export function approveProposal(p: Proposal, a: Approval, by: "customer" | "crew" = "customer") {
  const now = new Date().toISOString();
  const total = selectionTotal(p, a.optionIds, a.addonIds);
  proposals.update(p.id, {
    status: "approved", approvedAt: now, approvedName: a.name.trim() || undefined,
    chosenOptionIds: a.optionIds, chosenAddonIds: a.addonIds, customerNotes: a.notes.trim() || undefined,
  });
  const lead = leads.get(p.leadId);
  if (!lead) return total;
  const chosen = p.options.filter((o) => a.optionIds.includes(o.id));
  const scoped = chosen.some((o) => o.roomIds?.length) && !chosen.some((o) => !o.roomIds?.length);
  const inScope = new Set(chosen.flatMap((o) => o.roomIds ?? []));
  const filmFor = (roomId: string) => chosen.find((o) => (!o.roomIds?.length || o.roomIds.includes(roomId)) && o.filmTypeId)?.filmTypeId;
  leads.update(lead.id, {
    price: total,
    rooms: lead.rooms?.map((r) => ({ ...r, approved: scoped ? inScope.has(r.id) : r.approved, filmTypeId: filmFor(r.id) ?? r.filmTypeId })),
  });
  if (["new", "consult", "proposal"].includes(lead.status)) setStatus(leads.get(lead.id)!, "approved");
  const who = a.name.trim() || lead.contact.name;
  notify("proposal", by === "crew" ? `Proposal #${p.code} marked approved for ${who} (${money(total)})` : `${who} approved proposal #${p.code} (${money(total)})`, `/admin/jobs/${lead.id}`);
  return total;
}

export function unapprove(p: Proposal) {
  proposals.update(p.id, {
    status: p.viewedAt ? "viewed" : p.sentAt ? "sent" : "draft",
    approvedAt: undefined, approvedName: undefined, chosenOptionIds: undefined, chosenAddonIds: undefined, customerNotes: undefined,
  });
}

export const templatesSorted = () => [...proposalTemplates.all()].sort((a, b) => a.name.localeCompare(b.name));
