// Business facts pulled from axisglasstinting.com. Prices are placeholders the owner edits in /admin.

export const BUSINESS = {
  name: "Axis Glass Tinting",
  legalName: "Axis Glass Tinting LLC",
  phone: "(928) 227-8767",
  phoneHref: "tel:+19282278767",
  smsHref: "sms:+19282278767",
  email: "AxisGlassTinting@gmail.com",
  hours: "Mon–Fri, 9am–5pm",
  site: "https://www.axisglasstinting.com",
  instagram: "https://www.instagram.com/axisglasstinting/",
  facebook: "https://www.facebook.com/profile.php?id=61580062115375",
  tiktok: "https://www.tiktok.com/@axis.glass",
  projects: "1,500+",
  years: "5+",
  rating: "5.0",
};

export const REVIEWS = [
  { name: "Kim A.", text: "It needed removal of all the previous tint, which I've heard can be really difficult. They had no problem doing the removal, and the tint came out FLAWLESS. 10/10." },
  { name: "Gary B.", text: "You cannot go wrong hiring this company. The work is outstanding, and you can feel the difference in how much cooler your home feels." },
  { name: "Alejandra B.", text: "Incredible work! My car has never looked better. The tinting is flawless, and the customer service was top-notch." },
  { name: "Barbra C.", text: "I had three different companies come out before I chose Axis. Hank came with so many options and I was able to choose a tint that worked perfectly." },
  { name: "Isaac L.", text: "Great price, even better work, and fast and professional. Will be taking any of my cars to Axis." },
];

/* ---------- Vehicles ---------- */

export type BodyType = "coupe" | "sedan" | "suv" | "truck" | "minivan";

export const BODY_TYPES: { id: BodyType; label: string; hint: string }[] = [
  { id: "sedan", label: "Sedan", hint: "4 doors, trunk" },
  { id: "coupe", label: "Coupe", hint: "2 doors" },
  { id: "suv", label: "SUV / Crossover", hint: "Hatch + rear quarters" },
  { id: "truck", label: "Truck", hint: "Crew or extended cab" },
  { id: "minivan", label: "Minivan", hint: "Sliding doors" },
];

export type Zone = "frontSides" | "rearSides" | "rearWindshield" | "windshield" | "visor" | "sunroof";

export const ZONES: { id: Zone; label: string; desc: string }[] = [
  { id: "frontSides", label: "Front doors", desc: "Driver + passenger windows" },
  { id: "rearSides", label: "Rear sides", desc: "Rear doors and quarter glass" },
  { id: "rearWindshield", label: "Back glass", desc: "Rear windshield" },
  { id: "visor", label: "Visor strip", desc: "Sun strip across the top of the windshield" },
  { id: "windshield", label: "Full windshield", desc: "Clear ceramic heat shield" },
  { id: "sunroof", label: "Sunroof", desc: "Sunroof or panoramic roof" },
];

/** Zones that make up a "full vehicle" (earns the free visor strip). */
export const FULL_VEHICLE: Zone[] = ["frontSides", "rearSides", "rearWindshield"];

export const REAR_SIDE_LABEL: Record<BodyType, string> = {
  sedan: "Rear doors",
  coupe: "Rear quarter glass",
  suv: "Rear doors + quarters",
  truck: "Rear doors (crew cab)",
  minivan: "Sliders + quarters",
};

export type FilmTier = "carbon" | "ceramic";

export const FILMS: Record<FilmTier, {
  name: string; tagline: string; irr: number; uv: number; perks: string[];
}> = {
  carbon: {
    name: "Carbon",
    tagline: "Rich matte-black finish. Solid heat rejection at a great value.",
    irr: 45,
    uv: 99,
    perks: ["No dye, so it never fades purple", "Matte, non-reflective look", "Lifetime warranty"],
  },
  ceramic: {
    name: "Ceramic",
    tagline: "Nano-ceramic. Maximum heat rejection with zero signal interference.",
    irr: 90,
    uv: 99,
    perks: ["Blocks up to 90% of infrared heat", "Crystal-clear optics, day and night", "No interference with GPS, phone or keyless entry"],
  },
};

export const AUTO_SHADES = [
  { vlt: 5, name: "Limo" },
  { vlt: 15, name: "Private" },
  { vlt: 20, name: "Shadow" },
  { vlt: 35, name: "Classic" },
  { vlt: 50, name: "Light" },
  { vlt: 70, name: "Clear" },
] as const;

/** Arizona (A.R.S. 28-959.01): front side windows must let in at least 33% of light. */
export const AZ_FRONT_MIN_VLT = 33;

export const PAINTS = [
  { id: "black", name: "Obsidian", hex: "#141416" },
  { id: "white", name: "Glacier", hex: "#e6e7ea" },
  { id: "silver", name: "Silver", hex: "#9da2a8" },
  { id: "red", name: "Axis Red", hex: "#b0160d" },
  { id: "blue", name: "Midnight", hex: "#1d2d52" },
  { id: "tan", name: "Desert", hex: "#b59c76" },
] as const;

/* ---------- Residential / commercial ---------- */

export const HOME_FILMS = {
  ultraview: {
    name: "Edge Ultra View",
    kind: "Dual reflective",
    tagline: "Mirror-like daytime privacy outside, a clear view inside. Maximum heat rejection.",
    shades: [
      { name: "Ultra View 5", vlt: 6, vlrExt: 56, vlrInt: 15, tser: 80, irr: 94, shgc: "0.20" },
      { name: "Ultra View 15", vlt: 14, vlrExt: 48, vlrInt: 21, tser: 75, irr: 91, shgc: "0.25" },
      { name: "Ultra View 25", vlt: 27, vlrExt: 27, vlrInt: 14, tser: 60, irr: 81, shgc: "0.40" },
      { name: "Ultra View 35", vlt: 38, vlrExt: 13, vlrInt: 8, tser: 45, irr: 50, shgc: "0.55" },
    ],
  },
  pristine: {
    name: "Edge Pristine",
    kind: "Architectural",
    tagline: "Low-reflective, natural look that keeps the glass looking untouched.",
    shades: [
      { name: "Pristine 30", vlt: 30 },
      { name: "Pristine 40", vlt: 40 },
      { name: "Pristine 50", vlt: 50 },
      { name: "Pristine 70", vlt: 70 },
      { name: "Pristine 80", vlt: 80 },
    ],
  },
} as const;

export type HomeFilm = keyof typeof HOME_FILMS;

export type PaneSize = "small" | "standard" | "large" | "door";

export const PANES: { id: PaneSize; label: string; hint: string; sqft: number }[] = [
  { id: "small", label: "Small", hint: "Bathroom, accent", sqft: 8 },
  { id: "standard", label: "Standard", hint: "Bedroom, kitchen", sqft: 15 },
  { id: "large", label: "Large / picture", hint: "Living room view", sqft: 32 },
  { id: "door", label: "Sliding door", hint: "Patio slider", sqft: 40 },
];

export const HOME_GOALS = [
  { id: "heat", label: "Cut the heat" },
  { id: "privacy", label: "Daytime privacy" },
  { id: "glare", label: "Kill the glare" },
  { id: "fade", label: "Stop fading" },
  { id: "view", label: "Keep it bright" },
] as const;

export type HomeGoal = (typeof HOME_GOALS)[number]["id"];

/* ---------- Service areas ---------- */

export type RegionId = "quad" | "phx" | "other";

export const REGIONS: { id: RegionId; label: string; cities: string }[] = [
  { id: "quad", label: "Prescott & Quad Cities", cities: "Prescott · Prescott Valley · Chino Valley · Dewey-Humboldt" },
  { id: "phx", label: "Phoenix & the Valley", cities: "Phoenix · Scottsdale · Tempe · Maricopa County" },
  { id: "other", label: "Elsewhere in Arizona", cities: "Northern Arizona and statewide" },
];

/* ---------- Owner-editable settings ---------- */

export type PriceCell = { carbon: number | null; ceramic: number | null };
export type PriceTable = Record<BodyType, Record<Zone, PriceCell>>;

export interface Settings {
  prices: PriceTable;
  removalFee: number;
  homeRatePerSqft: Record<HomeFilm, number>;
  homeMinimum: number;
  travelFee: Record<RegionId, number>;
  referralCredit: number;
  /** Weekdays (0 = Sun) each region is scheduled. */
  regionDays: Record<RegionId, number[]>;
  slots: string[];
  blockedDates: string[];
  googleReviewUrl: string;
  leadWebhookUrl: string;
  adminPin: string;
}

const p = (carbon: number | null, ceramic: number | null): PriceCell => ({ carbon, ceramic });

export const DEFAULT_SETTINGS: Settings = {
  prices: {
    sedan: { frontSides: p(100, 150), rearSides: p(95, 140), rearWindshield: p(100, 150), windshield: p(null, 280), visor: p(45, 45), sunroof: p(60, 90) },
    coupe: { frontSides: p(110, 160), rearSides: p(50, 70), rearWindshield: p(95, 140), windshield: p(null, 260), visor: p(45, 45), sunroof: p(60, 90) },
    suv: { frontSides: p(100, 150), rearSides: p(140, 210), rearWindshield: p(110, 160), windshield: p(null, 300), visor: p(45, 45), sunroof: p(80, 120) },
    truck: { frontSides: p(100, 150), rearSides: p(90, 130), rearWindshield: p(75, 110), windshield: p(null, 280), visor: p(45, 45), sunroof: p(60, 90) },
    minivan: { frontSides: p(100, 150), rearSides: p(160, 240), rearWindshield: p(110, 160), windshield: p(null, 320), visor: p(45, 45), sunroof: p(90, 130) },
  },
  removalFee: 120,
  homeRatePerSqft: { ultraview: 11, pristine: 13 },
  homeMinimum: 500,
  travelFee: { quad: 0, phx: 0, other: 75 },
  referralCredit: 25,
  regionDays: { quad: [1, 3, 5], phx: [2, 4], other: [1, 2, 3, 4, 5] },
  slots: ["9:00 AM", "1:00 PM"],
  blockedDates: [],
  googleReviewUrl: "",
  leadWebhookUrl: "",
  adminPin: "1234",
};
