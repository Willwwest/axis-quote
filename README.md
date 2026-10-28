# Axis

The shop app for Axis Glass Tinting. It has two halves:

- a customer quote, visualizer and booking flow;
- a crew dashboard that runs the business: jobs, calendar, proposals, invoices, film inventory with a cut optimizer, messages, reviews and analytics.

It's built to match Tint Wiz feature for feature (see [docs/tintwiz-parity.md](docs/tintwiz-parity.md)), on the Axis brand design system (see [docs/design-system.md](docs/design-system.md)).

## Run

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
node scripts/tokenize.cjs --check   # fails if any UI color is off the design tokens
```

To try everything with realistic data: open `/admin`, enter PIN `1234`, then go to **Settings → Data & integrations → Load demo data**.

### Shared demo (GitHub Pages)

Every push to `main` deploys https://willwwest.github.io/axis-quote/ via `.github/workflows/pages.yml` (`npm run build:pages`).
That build uses `--mode demo` (`.env.demo`), which:

- loads the sample data the first time a browser opens `/admin` or `/reviews`. That is about 55 jobs across the Quad Cities, the Valley and Northern Arizona, with rolls, invoices, reviews and route-day appointments.
- lists the demo PINs on the sign-in screen: owner `1234`, installer `2222`, technician `3333`, Valley installer `4444`.

A plain `npm run build` has neither.

## Customer side

| Route | What |
|---|---|
| `/` | Vehicle / home / business quote: preview shades, live pricing, Arizona legality check, book a slot. Creates the job, contact and appointment. |
| `/?ref=CODE` | Same flow with a referral credit applied |
| `/p/:id` | Proposal: pick Good/Better/Best and add-ons, type name, approve, pay deposit |
| `/i/:id` | Invoice: lines, tax, balance, tip, Pay now |
| `/s/:id` | Document to sign (waivers, care sheets) with a finger signature |
| `/a/:id` | Appointment: details, add to calendar, self-cancel |
| `/reviews` | Public reviews page (`?embed=1` for the website widget) |
| `/warranty#…` | Warranty certificate |

## Crew dashboard (`/admin`)

Sign in with a PIN. The owner PIN is set in Settings → Business; staff get their own under Settings → Staff.
Roles are Owner, Admin, Installer and Technician. The owner can preview any role with **View as** in the account menu.

| Section | What |
|---|---|
| Dashboard | This week vs last week (leads, consults, installs, $ scheduled), tasks, today's schedule, outbox, money, low stock |
| Jobs | 9-stage pipeline board and list. The job page is the hub: contact, vehicle/property, quote and services, appointments, measurements, film used, proposal, invoice, documents, notes, attachments, wrap-up and warranty |
| Calendar | Agenda / day (team columns) / week. Recurring appointments, check-in/out, blocked days, route links |
| Contacts | CRM with tags and conversion %, CSV import/export, merge duplicates, per-contact message opt-outs |
| Proposals | Good/Better/Best options, add-ons, deposits, expiry, canned templates, follow-up flags |
| Invoices | Invoices from approved proposals, tax rates, terms, deposits, payments and refunds, QuickBooks CSV export |
| Inventory | Film catalog and rolls with codes, In/Out/Lost, check-in/out, weigh-to-measure, QR labels and scanning, remnants, shortage forecast from booked jobs, film cost per job |
| Cut optimizer | On flat-glass jobs: rooms and measurements → to-scale cut sheets per roll width with waste %, then deduct from a roll |
| Notes & tasks | Notes on anything; turn one into a task, assign it or leave it in the pending pool; replies with read receipts |
| Messages | Outbox of due texts (confirmations, 24h/1h reminders, proposal follow-ups, review requests, past-due nudges), sent log, compose. Templates use `:first_name`-style merge fields |
| Documents | Templates (dark-tint waiver, aftercare…) sent for signature and stored on the job |
| Reviews | Log and feature reviews, request reviews, review sites, embed widget |
| Analytics | 46 segments, date presets, compare to the previous period or last year |
| Settings | Business, pricing, proposals, invoices and tax, calendar and booking, message templates, inventory, staff and roles, notifications, data |
| `/admin/design` | Living design-system reference (tokens, components, light/dark) |

## Code map

- `src/styles/tokens.css` holds the brand primitives and semantic tokens. `src/components/ui.tsx` is the component library.
- `src/lib/types.ts` is the domain model. `src/lib/store.ts` holds every collection and is the one place storage is touched.
- `src/lib/`: film/cutopt (inventory and packing), money, outbox, messages, session (roles), notify, links, project, pricing.
- `src/admin/` has one folder per section. `src/components/project/` has the cards shown on the job page. `src/public/` has the customer link pages.

## Before launch

- **Data lives in the browser.** Each device keeps its own copy, and the PIN gate runs client-side.
  - To share data across the crew's phones, replace the `adapter` in `src/lib/store.ts` with a server (e.g. one Supabase table of `{collection, id, data}`) and move sign-in to real auth.
  - Customer links carry a snapshot so they open on any phone. Approvals, signatures and cancellations made on a customer's phone only reach the shop once a server exists; until then the page texts the shop instead.
- **Texts and emails open the crew phone's Messages / Mail app** with the message filled in, and are logged. Nothing sends by itself. A Twilio hook in `src/lib/messages.ts` would make reminders automatic.
- **Payments:** set a Stripe Payment Link (or any pay URL) in Settings → Invoices; the customer enters the amount shown. Deposits and payments taken in person are recorded by hand.
- **Prices and cut sizes are placeholders:** set them in Settings → Pricing, and tune `CUTS` in `src/data/config.ts` to the crew's real patterns.
- Add the Google review link and review sites in Settings → Business / Reviews.
