import { INITIAL } from "../pages/quote/context";
import { seedTypes } from "./film";
import { fill, template, type MergeContext } from "./messages";
import { buildQuote, vehicleLines } from "./pricing";
import { addDays, today } from "./format";
import { parseIso } from "./schedule";
import { OWNER_ID } from "./session";
import {
  appointments, contacts, docTemplates, filmLog, filmTypes, getSettings, invoices, leads, messages, notes, notifications,
  patchSettings, payments, proposalTemplates, proposals, remnants, reviews, rolls, signedDocs, staff,
} from "./store";
import type {
  Appointment, Contact, FilmRoll, FilmUse, Invoice, JobKind, Lead, LeadStatus, MessageLog, Note, Notification, Payment, Proposal,
  ProposalOption, QuoteLine, Room, ServiceLine, VehicleSpec,
} from "./types";
import type { RegionId, TemplateKey } from "../data/config";

/*
 * Demo data for every screen: clearly fake (names start with "Sample", phones are 555), dated relative to today.
 * Ids are fixed, so loading it twice refreshes the demo instead of duplicating it.
 */

const D = (n: number) => addDays(today(), n);
const T = (n: number, h = 10, m = 0) => {
  const d = parseIso(D(n));
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};
let seq = 0;
const sid = (p: string) => `${p}-SMP${String(++seq).padStart(3, "0")}`;

const INSTALLER = "ST-SMPINS";
const TECH = "ST-SMPTEC";

export function loadDemoData() {
  seq = 0;
  const s = getSettings();

  /* ---------- People ---------- */

  staff.saveMany([
    { id: INSTALLER, name: "Sample Installer", email: "installer@example.com", phone: "(928) 555-0110", role: "installer", pin: "2222", color: "rgb(var(--c-info))", active: true },
    { id: TECH, name: "Sample Technician", email: "tech@example.com", phone: "(928) 555-0111", role: "technician", pin: "3333", color: "rgb(var(--c-success))", active: true },
  ]);

  const prefs = { sms: true, email: true, reminders: true, followups: true };
  const C = (id: string, name: string, phone: string, city: string, tags: string[], created: number, extra: Partial<Contact> = {}): Contact => ({
    id, name, phone, city, tags, prefs, email: `${name.split(" ")[1]?.toLowerCase() ?? "sample"}@example.com`, notes: "", createdAt: T(created, 9), ...extra,
  });
  const c = {
    maria: C("CT-SMP01", "Maria Lopez (Sample)", "(928) 555-0101", "Prescott Valley", ["referral", "repeat"], -150, { address: "1420 Sample Way", source: "Referral" }),
    derek: C("CT-SMP02", "Derek Chen (Sample)", "(480) 555-0144", "Scottsdale", [], 0, { source: "Quote app" }),
    linda: C("CT-SMP03", "Linda Park (Sample)", "(928) 555-0177", "Prescott", ["repeat"], -90, { address: "88 Granite Dells Rd", source: "Google" }),
    tom: C("CT-SMP04", "Tom Reyes (Sample)", "(928) 555-0190", "Chino Valley", ["referral"], -8, { source: "Referral" }),
    fleet: C("CT-SMP05", "Jake Morris (Sample)", "(928) 555-0123", "Prescott", ["fleet", "repeat"], -100, { company: "Plumbing Co (Sample)", workPhone: "(928) 555-0124", address: "300 Industrial Way", source: "Phone call", taxExempt: false }),
    ana: C("CT-SMP06", "Ana Ruiz (Sample)", "(602) 555-0155", "Phoenix", [], -12, { source: "Instagram" }),
    brian: C("CT-SMP07", "Brian Holt (Sample)", "(928) 555-0168", "Dewey-Humboldt", ["repeat"], -62, { address: "12 Mesa View Dr", source: "Google" }),
    grace: C("CT-SMP08", "Grace Kim (Sample)", "(480) 555-0182", "Tempe", ["referral"], -14, { source: "Referral" }),
    office: C("CT-SMP09", "Rachel Stone (Sample)", "(928) 555-0136", "Prescott", ["commercial"], -9, { company: "Office Suites (Sample)", address: "500 Gurley St", source: "Website", taxExempt: true }),
    chris: C("CT-SMP10", "Chris Patel (Sample)", "(928) 555-0149", "Prescott Valley", [], -1, { source: "Google", prefs: { ...prefs, followups: false } }),
    // Same phone as Maria, entered by hand: shows up under "Merge duplicates".
    mariaDup: C("CT-SMP11", "M. Lopez (Sample)", "928-555-0101", "Prescott Valley", [], -20, { email: "", source: "Phone call" }),
  };
  contacts.saveMany(Object.values(c));

  /* ---------- Jobs ---------- */

  const vehicle = (v: Partial<VehicleSpec>): VehicleSpec => ({ ...INITIAL.vehicle, ...v });
  const job = (id: string, ct: Contact, status: LeadStatus, created: number, kind: JobKind, region: RegionId,
    extra: Partial<Lead> & { v?: Partial<VehicleSpec> } = {}): Lead => {
    const { v, ...rest } = extra;
    const state = { ...INITIAL, kind, region, city: ct.city ?? "", garage: "yes" as const, vehicle: vehicle(v ?? {}),
      contact: { name: ct.name, phone: ct.phone, email: ct.email, notes: "", sms: ct.prefs.sms }, referral: "" };
    const { vehicle: veh, home, ...base } = state;
    return {
      ...base, id, status, createdAt: T(created, 8 + (Number(id.slice(-2)) % 9)), contactId: ct.id, source: ct.source,
      ...(kind === "vehicle" ? { vehicle: veh } : { home }),
      quote: buildQuote(s, state), statusChangedAt: T(Math.min(0, created + 2), 15), ...rest,
    };
  };
  const m = (type: Room["items"][number]["type"], direction: Room["items"][number]["direction"], qty: number, w: number, h: number) =>
    ({ id: sid("MS"), type, direction, qty, w, h });
  const room = (name: string, items: Room["items"], filmTypeId = "FT-edge-ultra-view-25", approved = true): Room => ({ id: sid("RM"), name, filmTypeId, approved, items });
  const done = (n: number, reviewRequested = false) => ({ date: D(n), certId: sid("W"), photos: [], notes: "", reviewRequested });

  const J = {
    derek: job("AX-SMP01", c.derek, "new", 0, "vehicle", "phx", { v: { body: "suv", ymm: "2021 Jeep Grand Cherokee", paint: "#e6e7ea", film: "carbon", rearVlt: 5 }, createdAt: new Date(Date.now() - 3 * 3600_000).toISOString() }),
    chris: job("AX-SMP02", c.chris, "new", -1, "vehicle", "quad", { v: { body: "sedan", ymm: "2020 Honda Accord", zones: ["frontSides"], removal: true } }),
    linda: job("AX-SMP03", c.linda, "consult", -4, "home", "quad", {
      assigneeId: OWNER_ID, address: c.linda.address,
      rooms: [
        room("Living room", [m("window", "W", 2, 72, 60), m("door", "W", 1, 72, 80)]),
        room("Primary bedroom", [m("window", "S", 2, 48, 60)]),
      ],
    }),
    office: job("AX-SMP04", c.office, "consult", -9, "business", "quad", {
      assigneeId: INSTALLER, title: "Office Suites · lobby + conference", address: c.office.address,
      rooms: [
        room("Front lobby storefront", [m("window", "S", 3, 60, 96), m("transom", "S", 3, 60, 18)], "FT-edge-pristine-50"),
        room("Conference room", [m("window", "W", 4, 48, 72)], "FT-edge-pristine-50"),
      ],
    }),
    tom: job("AX-SMP05", c.tom, "proposal", -8, "vehicle", "quad", { v: { body: "truck", ymm: "2023 Ford F-150", paint: "#1d2d52", vin: "1FTFW1E5XPSMP0001", zones: ["frontSides", "rearSides", "rearWindshield", "windshield"] }, referral: "MARIA25" }),
    brian: job("AX-SMP06", c.brian, "proposal", -14, "home", "quad", {
      address: c.brian.address,
      rooms: [
        room("Kitchen", [m("window", "W", 2, 36, 48)]),
        room("Sunroom", [m("window", "SW", 6, 40, 60), m("skylight", undefined, 2, 30, 30)]),
        room("Garage door glass", [m("other", "E", 4, 20, 14)], "FT-edge-ultra-view-25", false),
      ],
    }),
    grace: job("AX-SMP07", c.grace, "approved", -13, "vehicle", "phx", { v: { body: "coupe", ymm: "2019 Ford Mustang GT", paint: "#b0160d", frontVlt: 50, rearVlt: 20 } }),
    maria: job("AX-SMP08", c.maria, "booked", -11, "vehicle", "quad", { assigneeId: INSTALLER, appointment: { date: D(3), slot: "9:00 AM" }, v: { body: "minivan", ymm: "2022 Honda Odyssey", paint: "#9da2a8", vin: "5FNRL6H7XNSMP0002", zones: ["frontSides", "rearSides", "rearWindshield", "visor", "sunroof"] } }),
    fleet: job("AX-SMP09", c.fleet, "booked", -10, "vehicle", "quad", {
      assigneeId: TECH, title: "Fleet: 4 work trucks", tags: ["fleet"], price: 1400,
      services: [{ id: sid("SV"), name: "Fleet truck tint (fronts + rears)", price: 350, qty: 4 }],
      v: { body: "truck", ymm: "2024 Chevrolet Silverado 2500", paint: "#e6e7ea", film: "carbon", frontVlt: 35, rearVlt: 20, vin: "1GC4YNEY5RSMP0003" },
    }),
    ana: job("AX-SMP10", c.ana, "installed", -12, "vehicle", "phx", { assigneeId: INSTALLER, completion: done(-1), v: { body: "sedan", ymm: "2023 Tesla Model 3", paint: "#e6e7ea", vin: "5YJ3E1EA5PSMP0004", zones: ["frontSides", "rearSides", "rearWindshield", "windshield", "sunroof"] } }),
    lindaCar: job("AX-SMP11", c.linda, "invoiced", -20, "vehicle", "quad", { assigneeId: INSTALLER, completion: done(-6), v: { body: "suv", ymm: "2022 Toyota 4Runner", paint: "#141416" } }),
    fleetOld: job("AX-SMP12", c.fleet, "invoiced", -45, "vehicle", "quad", {
      assigneeId: TECH, title: "Fleet: 3 service trucks", tags: ["fleet"], price: 1050, completion: done(-35),
      services: [{ id: sid("SV"), name: "Fleet truck tint (fronts + rears)", price: 350, qty: 3 }],
      v: { body: "truck", ymm: "2022 Ford F-250", paint: "#e6e7ea", film: "carbon", rearVlt: 20 },
    }),
    mariaBmw: job("AX-SMP13", c.maria, "paid", -32, "vehicle", "quad", { completion: done(-27, true), v: { body: "sedan", ymm: "2021 BMW 330i", paint: "#141416", frontVlt: 35, rearVlt: 20 } }),
    brianTruck: job("AX-SMP14", c.brian, "paid", -62, "vehicle", "quad", { completion: done(-58, true), v: { body: "truck", ymm: "2020 Toyota Tacoma", paint: "#9da2a8", film: "carbon", frontVlt: 35, rearVlt: 5 } }),
    lost: job("AX-SMP15", c.mariaDup, "lost", -20, "vehicle", "quad", { lostReason: "Went with a cheaper quote", v: { body: "sedan", ymm: "2018 Nissan Altima", film: "carbon" } }),
    lindaOld: job("AX-SMP16", c.linda, "paid", -88, "vehicle", "quad", { completion: done(-84, true), v: { body: "suv", ymm: "2019 Subaru Outback", paint: "#b59c76", frontVlt: 50, rearVlt: 35 } }),
    fleetFirst: job("AX-SMP17", c.fleet, "paid", -98, "vehicle", "quad", { title: "Fleet: first truck", tags: ["fleet"], completion: done(-95, true), v: { body: "truck", ymm: "2021 Ford F-150", paint: "#e6e7ea", film: "carbon" } }),
    mariaFirst: job("AX-SMP18", c.maria, "paid", -150, "vehicle", "quad", { completion: done(-146), v: { body: "coupe", ymm: "2017 Honda Civic Si", paint: "#b0160d", film: "carbon", frontVlt: 35, rearVlt: 20 } }),
  };

  /* ---------- Film catalog & rolls ---------- */

  // Demo rolls point at the house catalog so a demo load never duplicates it.
  filmTypes.saveMany(seedTypes());
  const R = (n: number, name: string, vlt: number | null, widthIn: number, lengthFt: number, filmTypeId: string, cost: number, added: number, extra: Partial<FilmRoll> = {}): FilmRoll => ({
    id: `RL-SMP0${n}`, name, vlt, widthIn, lengthFt, lowFt: 15, lot: `SMP-LOT-${400 + n}`, addedAt: T(added, 9), code: String(10000 + n),
    filmTypeId, status: "in", cost, coreWeightLb: 2.1, fullWeightLb: Math.round(lengthFt * widthIn * 0.0026 * 10) / 10 + 2.1, ...extra,
  });
  const rl = [
    R(1, "Ceramic 20%", 20, 40, 100, "FT-axis-ceramic-20", 520, -60),
    R(2, "Ceramic 35%", 35, 40, 100, "FT-axis-ceramic-35", 520, -120),
    R(3, "Carbon 5%", 5, 30, 100, "FT-axis-carbon-5", 260, -90),
    R(4, "Clear ceramic 70%", 70, 60, 50, "FT-axis-ceramic-70", 480, -40),
    R(5, "Ultra View 25", 27, 60, 100, "FT-edge-ultra-view-25", 900, -30, { reservedLeadId: J.brian.id }),
    R(6, "Ceramic 20% (old)", 20, 40, 100, "FT-axis-ceramic-20", 520, -200, { status: "lost" }),
  ];
  rolls.saveMany(rl);
  const use = (roll: number, n: number, inches: number, label: string, leadId?: string, source: FilmUse["source"] = "vehicle"): FilmUse =>
    ({ id: sid("FU"), rollId: `RL-SMP0${roll}`, date: T(n, 14), inches, source, label, leadId, byId: INSTALLER });
  filmLog.saveMany([
    use(6, -146, 150, "2017 Honda Civic Si · all sides", J.mariaFirst.id),
    use(2, -95, 90, "2021 Ford F-150 · fronts", J.fleetFirst.id),
    use(3, -58, 150, "2020 Toyota Tacoma · rears + back glass", J.brianTruck.id),
    use(2, -58, 90, "2020 Toyota Tacoma · fronts", J.brianTruck.id),
    use(2, -35, 260, "Fleet x3 · fronts", J.fleetOld.id),
    use(1, -35, 330, "Fleet x3 · rears", J.fleetOld.id),
    use(1, -27, 140, "2021 BMW 330i · rears + back glass", J.mariaBmw.id),
    use(2, -27, 80, "2021 BMW 330i · fronts", J.mariaBmw.id),
    use(1, -7, 110, "Fleet truck #1 · rears", J.fleet.id),
    use(2, -7, 90, "Fleet truck #1 · fronts", J.fleet.id),
    use(1, -6, 160, "2022 Toyota 4Runner · rears + back glass", J.lindaCar.id),
    use(2, -6, 90, "2022 Toyota 4Runner · fronts", J.lindaCar.id),
    use(1, -1, 120, "2023 Tesla Model 3 · rears + back glass", J.ana.id),
    use(2, -1, 80, "2023 Tesla Model 3 · fronts", J.ana.id),
    use(4, -1, 72, "2023 Tesla Model 3 · windshield", J.ana.id),
    use(2, -1, 247, "Counted the roll: about 14 ft left", undefined, "adjust"),
  ]);
  remnants.saveMany([
    { id: "RN-SMP01", rollId: "RL-SMP01", filmTypeId: "FT-axis-ceramic-20", name: "Ceramic 20% offcut", widthIn: 40, lengthIn: 30, location: "Van bin A", createdAt: T(-6, 15) },
    { id: "RN-SMP02", rollId: "RL-SMP05", filmTypeId: "FT-edge-ultra-view-25", name: "Ultra View 25 offcut", widthIn: 60, lengthIn: 22, location: "Shop shelf 2", createdAt: T(-20, 15) },
  ]);

  /* ---------- Proposals ---------- */

  const opt = (id: string, title: string, description: string, lines: QuoteLine[], extra: Partial<ProposalOption> = {}): ProposalOption =>
    ({ id, title, description, lines, discountPct: 0, ...extra });
  const total = (o: ProposalOption) => Math.round(o.lines.reduce((a, l) => a + l.amount, 0) * (1 - o.discountPct / 100));
  const carOptions = (l: Lead, pre: string): ProposalOption[] => [
    opt(`${pre}-A`, "Ceramic", "Maximum heat rejection with zero signal interference. Lifetime warranty.", vehicleLines(s, { ...l.vehicle!, film: "ceramic" }), { filmTypeId: "FT-axis-ceramic-35", recommended: true }),
    opt(`${pre}-B`, "Carbon", "Matte-black finish, solid heat rejection at a great value.", vehicleLines(s, { ...l.vehicle!, film: "carbon" })),
  ];
  const flatOption = (l: Lead, pre: string, film: "ultraview" | "pristine", filmTypeId: string): ProposalOption => {
    const rooms = (l.rooms ?? []).filter((r) => r.approved);
    const sq = rooms.reduce((a, r) => a + r.items.reduce((b, it) => b + (it.w * it.h * it.qty) / 144, 0), 0);
    const rate = s.homeRatePerSqft[film];
    return opt(`${pre}-${film}`, film === "ultraview" ? "Edge Ultra View 25" : "Edge Pristine 50",
      film === "ultraview" ? "Daytime privacy with a clear view out. Best heat rejection." : "Keeps the glass looking untouched.",
      [{ label: `${Math.round(sq)} sq ft @ $${rate}/sq ft`, amount: Math.max(s.homeMinimum, Math.round(sq * rate)) }],
      { filmTypeId, roomIds: rooms.map((r) => r.id), recommended: film === "ultraview" });
  };
  const P = (id: string, code: string, l: Lead, options: ProposalOption[], status: Proposal["status"], sent: number, extra: Partial<Proposal> = {}): Proposal => ({
    id, code, leadId: l.id, options, addons: [], selectTogether: false, notes: "Prices include materials and labor.", depositPct: s.proposals.depositPct,
    expiresAt: D(sent + s.proposals.expiryDays), status, createdAt: T(sent - 1, 16), sentAt: T(sent, 9), ...extra,
  });
  const windshield: ServiceLine = { id: "AD-SMPWS", name: "Clear ceramic windshield", price: s.prices.truck.windshield.ceramic ?? 280, qty: 1 };
  const pGrace = carOptions(J.grace, "OP-SMP3");
  const pMaria = carOptions(J.maria, "OP-SMP4");
  const gracePrice = (J.grace.price = total(pGrace[0]));
  const mariaPrice = (J.maria.price = total(pMaria[0]));
  const props: Proposal[] = [
    P("PR-SMP01", "2001", J.tom, carOptions(J.tom, "OP-SMP1"), "sent", -6, { addons: [windshield] }),
    P("PR-SMP02", "2002", J.brian, [flatOption(J.brian, "OP-SMP2", "ultraview", "FT-edge-ultra-view-25"), flatOption(J.brian, "OP-SMP2", "pristine", "FT-edge-pristine-50")], "viewed", -7, { viewedAt: T(-5, 19) }),
    P("PR-SMP03", "2003", J.grace, pGrace, "approved", -10, { viewedAt: T(-9, 20), approvedAt: T(-3, 11), approvedName: c.grace.name, chosenOptionIds: [pGrace[0].id], customerNotes: "Mornings work best for install." }),
    P("PR-SMP04", "2004", J.maria, pMaria, "approved", -10, { viewedAt: T(-10, 12), approvedAt: T(-9, 8), approvedName: c.maria.name, chosenOptionIds: [pMaria[0].id] }),
  ];
  proposals.saveMany(props);
  proposalTemplates.saveMany([{
    id: "PT-SMP01", name: "Sample · Good / Better / Best sedan", addons: [{ id: "AD-SMPVS", name: "Visor strip", price: 45, qty: 1 }],
    options: [
      opt("TO-SMP1", "Good · Carbon", "Matte carbon, lifetime warranty.", vehicleLines(s, { ...INITIAL.vehicle, film: "carbon" })),
      opt("TO-SMP2", "Better · Ceramic", "Nano-ceramic heat rejection.", vehicleLines(s, { ...INITIAL.vehicle, film: "ceramic" }), { recommended: true }),
      opt("TO-SMP3", "Best · Ceramic + windshield", "Ceramic everywhere plus a clear heat-shield windshield.", vehicleLines(s, { ...INITIAL.vehicle, film: "ceramic", zones: [...INITIAL.vehicle.zones, "windshield"] })),
    ],
    notes: "Every option includes a lifetime warranty.", depositPct: 25, expiryDays: 30,
  }]);

  /* ---------- Schedule ---------- */

  const A = (id: string, l: Lead | null, type: Appointment["type"], date: number, start: string, durationMin: number, status: Appointment["status"], extra: Partial<Appointment> = {}): Appointment => ({
    id, leadId: l?.id, contactId: l?.contactId, type, date: D(date), start, durationMin, status, notifyCustomer: !!l,
    title: l ? `${type === "consult" ? "Consult" : "Install"} · ${l.contact.name.replace(" (Sample)", "")}` : "Errand",
    assigneeId: l?.assigneeId ?? OWNER_ID, history: [{ at: T(Math.min(date, 0) - 2, 9), text: "Created", by: OWNER_ID }],
    ...(status === "done" ? { checkInAt: T(date, +start.slice(0, 2), 5), checkOutAt: T(date, +start.slice(0, 2) + Math.ceil(durationMin / 60), 0) } : {}),
    ...extra,
  });
  const series = { everyWeeks: 1, count: 4, seriesId: "SR-SMP01" };
  const fleetAppt = (n: number, week: number, status: Appointment["status"], extra: Partial<Appointment> = {}) =>
    A(`AP-SMPF${n}`, J.fleet, "install", week * 7, "08:00", 240, status, { title: `Fleet truck #${n} · Sample Plumbing`, recurrence: series, ...extra });
  appointments.saveMany([
    A("AP-SMP01", J.linda, "consult", 2, "10:00", 60, "scheduled", { notes: "Measure living room + bedroom. Bring Ultra View samples.", remindersSent: { confirm: T(-4, 12) } }),
    A("AP-SMP02", J.office, "consult", 1, "13:00", 60, "scheduled", { notes: "Rebooked after last week's no-show." }),
    A("AP-SMP03", J.office, "consult", -5, "13:00", 60, "no_show"),
    A("AP-SMP04", J.brian, "consult", -10, "09:00", 60, "done"),
    A("AP-SMP05", J.lost, "consult", -15, "11:00", 60, "cancelled", { history: [{ at: T(-16, 10), text: "Cancelled: customer went elsewhere", by: OWNER_ID }] }),
    A("AP-SMP06", J.maria, "install", 3, "09:00", 180, "scheduled", { remindersSent: { confirm: T(-9, 9) } }),
    fleetAppt(1, -1, "done"),
    fleetAppt(2, 0, "checked_in", { checkInAt: T(0, 8, 4) }),
    fleetAppt(3, 1, "scheduled"),
    fleetAppt(4, 2, "scheduled"),
    A("AP-SMP07", J.ana, "install", -1, "09:00", 180, "done"),
    A("AP-SMP08", J.lindaCar, "install", -6, "13:00", 150, "done"),
    A("AP-SMP09", J.fleetOld, "install", -35, "08:00", 360, "done"),
    A("AP-SMP10", J.mariaBmw, "install", -27, "09:00", 150, "done"),
    A("AP-SMP11", J.brianTruck, "install", -58, "13:00", 150, "done"),
    A("AP-SMP12", J.lindaOld, "install", -84, "09:00", 150, "done"),
    A("AP-SMP13", J.fleetFirst, "install", -95, "08:00", 150, "done"),
    A("AP-SMP14", J.mariaFirst, "install", -146, "09:00", 150, "done"),
    A("AP-SMP15", null, "misc", 0, "12:30", 60, "scheduled", { title: "Pick up film order · supplier", notes: "Ceramic 35% reorder" }),
    A("AP-SMP16", J.grace, "consult", -12, "16:00", 30, "done", { title: "Phone consult · Grace Kim" }),
  ]);

  /* ---------- Money ---------- */

  const line = (l: Lead, codes?: string[]) => l.services?.length
    ? l.services.map((x) => ({ id: sid("IL"), description: x.name, rate: x.price, qty: x.qty, taxable: true, rollCodes: codes }))
    : l.quote.lines.filter((q) => q.amount).map((q, i) => ({ id: sid("IL"), description: `${q.label}${q.note ? ` · ${q.note}` : ""}`, rate: q.amount, qty: 1, taxable: true, rollCodes: i ? undefined : codes }));
  const I = (id: string, number: string, l: Lead, issued: number, terms: Invoice["terms"], due: number, status: Invoice["status"], codes?: string[]): Invoice => ({
    id, number, leadId: l.id, contactId: l.contactId, lines: line(l, codes), taxRateId: s.invoices.defaultTaxRateId, terms,
    issuedAt: D(issued), dueAt: D(due), status, notes: s.invoices.notes, ...(status !== "draft" ? { sentAt: T(issued, 17) } : {}),
  });
  invoices.saveMany([
    I("IN-SMP01", "1001", J.ana, -1, "receipt", -1, "draft", ["10001", "10002", "10004"]),
    I("IN-SMP02", "1002", J.lindaCar, -5, "net15", 10, "sent", ["10001", "10002"]),
    I("IN-SMP03", "1003", J.fleetOld, -34, "net30", -4, "partial", ["10001", "10002"]),
    I("IN-SMP04", "1004", J.mariaBmw, -27, "receipt", -27, "paid", ["10001", "10002"]),
    I("IN-SMP05", "1005", J.brianTruck, -58, "receipt", -58, "paid", ["10002", "10003"]),
    I("IN-SMP06", "1006", J.lindaOld, -84, "receipt", -84, "paid"),
    I("IN-SMP07", "1007", J.fleetFirst, -95, "net7", -88, "paid"),
    I("IN-SMP08", "1008", J.mariaFirst, -146, "receipt", -146, "paid", ["10006"]),
  ]);
  const sum = (l: Lead) => line(l).reduce((a, x) => a + x.rate * x.qty, 0);
  const pay = (id: string, l: Lead, kind: Payment["kind"], amount: number, method: Payment["method"], n: number, extra: Partial<Payment> = {}): Payment =>
    ({ id, leadId: l.id, invoiceId: undefined, kind, amount, method, date: D(n), byId: OWNER_ID, ...extra });
  payments.saveMany([
    pay("PY-SMP01", J.grace, "deposit", Math.round(gracePrice * 0.25), "card", -3, { notes: "Deposit on proposal 2003" }),
    pay("PY-SMP02", J.maria, "deposit", Math.round(mariaPrice * 0.25), "card", -9, { notes: "Deposit on proposal 2004" }),
    pay("PY-SMP03", J.fleetOld, "deposit", 300, "check", -40, { notes: "Check #1042" }),
    pay("PY-SMP04", J.fleetOld, "payment", 400, "check", -20, { invoiceId: "IN-SMP03", notes: "Check #1077" }),
    pay("PY-SMP05", J.mariaBmw, "payment", sum(J.mariaBmw), "card", -27, { invoiceId: "IN-SMP04", tip: 40 }),
    pay("PY-SMP06", J.brianTruck, "payment", sum(J.brianTruck), "cash", -58, { invoiceId: "IN-SMP05" }),
    pay("PY-SMP07", J.lindaOld, "payment", sum(J.lindaOld), "zelle", -84, { invoiceId: "IN-SMP06" }),
    pay("PY-SMP08", J.fleetFirst, "payment", sum(J.fleetFirst), "check", -90, { invoiceId: "IN-SMP07" }),
    pay("PY-SMP09", J.mariaFirst, "payment", sum(J.mariaFirst), "card", -146, { invoiceId: "IN-SMP08", tip: 20 }),
  ]);
  leads.saveMany(Object.values(J));

  /* ---------- Notes & tasks ---------- */

  const reply = (body: string, authorId: string, n: number, readBy: string[]) => ({ id: sid("RP"), body, authorId, at: T(n, 16), readBy: [authorId, ...readBy] });
  const N = (id: string, body: string, authorId: string, n: number, extra: Partial<Note> = {}): Note => ({ id, body, authorId, createdAt: T(n, 11), replies: [], ...extra });
  notes.saveMany([
    N("NT-SMP01", "Tom asked how much cooler ceramic is than carbon. Call him Thursday with the heat numbers.", INSTALLER, -5,
      { leadId: J.tom.id, contactId: c.tom.id, task: { assigneeId: OWNER_ID, status: "open", due: D(2) }, replies: [reply("Will do, I'll bring the heat lamp demo too.", OWNER_ID, -4, [INSTALLER])] }),
    N("NT-SMP02", "Bring the 60\" roll: the Odyssey has a huge back glass.", OWNER_ID, -2,
      { leadId: J.maria.id, contactId: c.maria.id, task: { assigneeId: INSTALLER, status: "open", due: D(3) }, replies: [reply("Got it, loading it Thursday night.", INSTALLER, -1, [])] }),
    N("NT-SMP03", "Reorder Ceramic 35%: roll 10002 is under 15 ft.", TECH, -1, { rollId: "RL-SMP02", task: { assigneeId: null, status: "open", due: D(1) } }),
    N("NT-SMP04", "Call Grace to set her install date. She prefers mornings.", OWNER_ID, -3, { leadId: J.grace.id, contactId: c.grace.id, task: { assigneeId: null, status: "open", due: D(0) } }),
    N("NT-SMP05", "Send the 4Runner invoice.", OWNER_ID, -6, { leadId: J.lindaCar.id, contactId: c.linda.id, task: { assigneeId: OWNER_ID, status: "done", due: D(-5), doneAt: T(-5, 17) } }),
    N("NT-SMP06", "Gate code **4417**. Friendly dog in the backyard.", OWNER_ID, -4, { leadId: J.linda.id, contactId: c.linda.id }),
    N("NT-SMP07", "Fleet billing goes to accounts@example.com, net 30. Ask for Jake.", OWNER_ID, -90, { contactId: c.fleet.id }),
    N("NT-SMP08", "Take check-in photos of every fleet truck before starting.", OWNER_ID, -1,
      { leadId: J.fleet.id, contactId: c.fleet.id, task: { assigneeId: TECH, status: "open", due: D(0) }, replies: [reply("Truck #2 done and uploaded.", TECH, 0, [])] }),
  ]);

  /* ---------- Documents & reviews ---------- */

  docTemplates.saveMany([
    { id: "DT-SMP01", title: "Sample · Tint law waiver", requireName: true, showCustomer: true,
      body: "# Arizona tint law acknowledgement\n\nArizona requires front side windows to let in at least **33%** of light.\n\n- I asked for a shade darker than the legal limit.\n- I understand I may be cited and must remove the film at my cost.\n\nAxis Glass Tinting is not responsible for citations." },
    { id: "DT-SMP02", title: "Sample · Film care instructions", requireName: false, showCustomer: true,
      body: "# Caring for your new tint\n\n- Keep windows rolled up for **3–5 days**.\n- Haze or small water pockets are normal while the film cures.\n- Clean with a soft cloth and ammonia-free cleaner.\n\nQuestions? Text us any time." },
  ]);
  signedDocs.saveMany([
    { id: "SD-SMP01", templateId: "DT-SMP02", leadId: J.ana.id, title: "Sample · Film care instructions", body: "# Caring for your new tint\n\n- Keep windows rolled up for **3–5 days**.", status: "signed", sentAt: T(-1, 12), signedAt: T(-1, 12, 40), signedName: c.ana.name },
    { id: "SD-SMP02", templateId: "DT-SMP01", leadId: J.maria.id, title: "Sample · Tint law waiver", body: "# Arizona tint law acknowledgement", status: "sent", sentAt: T(-2, 10) },
  ]);
  reviews.saveMany([
    { id: "RV-SMP01", name: "Maria L. (Sample)", rating: 5, text: "Second car Axis has done for us. Spotless work and they came right to the house.", source: "Google", date: D(-25), leadId: J.mariaBmw.id, published: true, featured: true },
    { id: "RV-SMP02", name: "Brian H. (Sample)", rating: 5, text: "Truck stays way cooler and the 5% back looks great. Fair price, on time.", source: "Google", date: D(-56), leadId: J.brianTruck.id, published: true, featured: true },
    { id: "RV-SMP03", name: "Linda P. (Sample)", rating: 5, text: "Friendly crew and super clean install on our Outback.", source: "Facebook", date: D(-80), leadId: J.lindaOld.id, published: true, featured: false },
    { id: "RV-SMP04", name: "Plumbing Co (Sample)", rating: 4, text: "Quick turnaround on our work truck. Scheduling the rest of the fleet.", source: "Google", date: D(-88), leadId: J.fleetFirst.id, published: true, featured: false },
    { id: "RV-SMP05", name: "Jordan W. (Sample)", rating: 5, text: "Removed my old purple tint and the new ceramic is flawless.", source: "Direct", date: D(-120), published: true, featured: true },
    { id: "RV-SMP06", name: "Ana R. (Sample)", rating: 5, text: "Model 3 glass roof makes a huge difference already!", source: "Direct", date: D(0), leadId: J.ana.id, published: false, featured: false },
  ]);

  /* ---------- Messages & notifications ---------- */

  const msg = (l: Lead, key: TemplateKey, n: number, h = 10, extra: MergeContext = {}): MessageLog => ({
    id: sid("MG"), at: T(n, h), channel: "sms", to: l.contact.phone, kind: key, leadId: l.id, byId: OWNER_ID,
    body: fill(template(key), { name: l.contact.name, vehicle: l.vehicle?.ymm, link: "https://axisglasstinting.com", ...extra }),
  });
  const reviewLink = s.reviews.sites.find((x) => x.url)?.url || s.googleReviewUrl || "https://axisglasstinting.com/reviews";
  messages.saveMany([
    msg(J.mariaFirst, "review", -145, 18, { link: reviewLink }),
    msg(J.fleetFirst, "review", -89, 18, { link: reviewLink }),
    msg(J.lindaOld, "review", -83, 18, { link: reviewLink }),
    msg(J.brianTruck, "review", -57, 18, { link: reviewLink }),
    msg(J.fleetOld, "invoiceSend", -34, 17, { amount: 1050 }),
    msg(J.mariaBmw, "paymentThanks", -27, 16, { amount: sum(J.mariaBmw) }),
    msg(J.mariaBmw, "review", -26, 18, { link: reviewLink }),
    msg(J.grace, "proposalSend", -10, 9, { code: "2003" }),
    msg(J.maria, "proposalSend", -10, 9, { code: "2004" }),
    msg(J.maria, "confirm", -9, 9, { appointment: { date: D(3), start: "09:00" } }),
    msg(J.fleet, "confirm", -8, 9, { appointment: { date: D(-7), start: "08:00" } }),
    msg(J.brian, "proposalSend", -7, 9, { code: "2002" }),
    msg(J.tom, "proposalSend", -6, 9, { code: "2001" }),
    msg(J.lindaCar, "invoiceSend", -5, 17, { amount: sum(J.lindaCar) }),
    msg(J.ana, "onMyWay", -1, 8, { appointment: { date: D(-1), start: "09:00" } }),
  ]);
  const note = (kind: Notification["kind"], text: string, href: string, at: string) => ({ id: sid("NF"), at, kind, text, href, readBy: [] });
  notifications.saveMany([
    note("lead", `New lead: ${c.derek.name} · 2021 Jeep Grand Cherokee`, `/admin/jobs/${J.derek.id}`, J.derek.createdAt),
    note("review", "New 5★ review from Ana R. (Sample)", "/admin/reviews", T(0, 7)),
    note("task", "New pending task: Reorder Ceramic 35%", "/admin/tasks", T(-1, 11)),
    note("stock", "Ceramic 35% (10002) is low: about 14 ft left", "/admin/inventory", T(-1, 15)),
    note("document", `${c.ana.name} signed Film care instructions`, `/admin/jobs/${J.ana.id}`, T(-1, 12, 40)),
    note("proposal", `${c.grace.name} approved proposal 2003`, `/admin/jobs/${J.grace.id}`, T(-3, 11)),
    note("payment", `Deposit from ${c.grace.name}`, `/admin/jobs/${J.grace.id}`, T(-3, 11, 5)),
  ]);

  // Keep the human-facing sequences past the demo's numbers.
  patchSettings((cur) => ({ sequences: { invoice: Math.max(cur.sequences.invoice, 1009), roll: Math.max(cur.sequences.roll, 10007), proposal: Math.max(cur.sequences.proposal, 2005) } }));
}
