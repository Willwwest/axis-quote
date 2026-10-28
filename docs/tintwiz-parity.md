# Tint Wiz parity

All sources were public, as of 2026-10-27: Tint Wiz's help center (137 articles), its 12 feature pages and 59 tutorial videos. Nothing came from inside their app.

Detailed notes and about 550 screenshots are in `docs/reference/tintwiz/`. That folder is gitignored because the screenshots are Tint Wiz's.

**Status key**

- **Have:** built and working.
- **Device-only:** works, but the data stays on one device, or customers' replies come back by text, until a server is connected (see the README).
- **Skip:** deliberately not built.

## Where Axis now stands

| Area | Tint Wiz capability | Axis | Status |
|---|---|---|---|
| **Inventory** | Film type catalog with retail $/sqft | Catalog (brand / series / name / shade / category / $ per sq ft), pre-seeded with Axis Carbon/Ceramic and Edge Ultra View/Pristine | Have |
| | Rolls: code, width, length, core and full weight, cost, notes | All fields; auto codes from 10001 | Have |
| | In / Out / Lost, check-in/out with "length on roll" | Yes. The length change is logged | Have |
| | Weigh-to-measure | Remaining = full length × (now − core) / (full − core) | Have |
| | Sq ft left, cost per sq ft, progress bar, update history with user | Yes, plus value left and undo | Have |
| | Inventory summary per film type, search, print | Plus CSV export and stock value | Have |
| | QR labels (1.1×3.5" or 2.4×3.9"), Brother / AirPrint | Batch label sheets; the QR opens the roll | Have |
| | Scan a roll | Camera scan (Android Chrome), plus typed-code fallback | Have |
| | Assign rolls to jobs, roll code on the invoice | Job film card deducts per film and shade; roll codes print on invoice lines | Have |
| | Reserve rolls, scrap tracking | Reserve a roll for a job; remnants with a "what fits" finder | Have |
| | Low-stock alerts *(not documented by Tint Wiz)* | Per-roll threshold plus a notification | **Ahead** |
| | Reorder planning *(marketing claim only)* | Forecast: booked jobs' film needs vs stock, flagged as "short X ft" | **Ahead** |
| | **Cut Optimizer**: films, roll widths, trim, max length, rotate, mixed widths → to-scale cut sheet with waste % | All of it, then "take this off roll ___" | Have |
| | Flat-glass measurements by room: type, direction, panes, W×H, price, round-up, perimeter, work sheet | Yes | Have |
| **Leads & contacts** | Lead forms | The Axis quote app is the lead form, and a richer one (visualizer, instant price, legality) | Have |
| | Contacts: tags, CSV import, merge, opt-outs, tax-exempt | Yes, plus tag conversion % | Have |
| **Jobs** | Project hub, 9-stage status, application areas, services, attachments, tags, assignee | Yes | Have |
| | Work order / project sheet print | Measurements work sheet; job page prints | Have |
| **Proposals** | Several options, discounts, add-ons, select-together, room scope, canned templates, expiry, deposit % | Yes | Have |
| | Send by SMS/email, viewed/approved tracking, typed-name approval, approval message | Yes. Approval on another phone texts the shop | Device-only |
| | Auto follow-ups at 24h / 48h | Queued in the outbox for one-tap send | Device-only |
| **Money** | Deposits after approval, manual payments, refunds, tips | Yes | Have |
| | Invoices: lines, tax rates, terms, statuses, send, PDF, branding | Yes | Have |
| | Online card payments (TintWizPay / Stripe) | Pay link (Stripe Payment Link); the customer enters the amount | Device-only |
| | QuickBooks Online sync | CSV export in QuickBooks import format, not a live sync | Partial |
| | Card terminals | No | Skip |
| **Scheduling** | Calendar with team columns and filters; appointment fields, colors, recurring, check-in/out, cancel | Yes; route-days-by-region kept from Axis | Have |
| | Map panel | "Open in Maps" per stop, plus a day route link | Have |
| | Route planning *(Tint Wiz shows a map; it doesn't optimize)* | Routes: road drive times (OSRM), optimize the day across the whole crew, plan the week onto region route days, text each person a route link with turn-by-turn legs. Free and open source, no keys | **Ahead** |
| | Confirmation / 24h / 1h / cancel texts with editable templates | Templates plus outbox; one tap opens the phone's Messages app | Device-only |
| | Public appointment page with self-cancel | Yes | Device-only |
| **After the job** | Review requests, review sites, profile page, featured reviews, widget | Yes | Have |
| | Documents to sign | Templates (including an AZ dark-tint waiver), finger signature, stored on the job | Device-only |
| | Warranty certificate, referral program *(Tint Wiz has neither)* | Yes | **Ahead** |
| **Team** | Staff, roles, "View as", notifications per role | PIN per person; Owner / Admin / Installer / Technician; role matrix; targeted task alerts | Device-only |
| | Notes → tasks, pending pool, replies with read receipts | Yes | Have |
| | Dashboard KPIs, analytics with ~45 segments and period compare | 46 segments | Have |
| | Multiple businesses under one login | No | Skip |
| | Native iOS/Android apps | Mobile web app, phone tab bar | Partial |
| | Zapier | Webhook for new leads and every notification | Partial |

## What still needs a server

These are the "Device-only" rows. All of them are unlocked by replacing the storage adapter in `src/lib/store.ts`:

1. **Shared data and real logins** so every crew phone sees the same jobs and stock.
2. **Two-way customer pages.** Proposal approval, signatures, invoice views and appointment cancels would land straight in the dashboard.
3. **Automatic sending.** Twilio/SendGrid would send the outbox on schedule instead of by tap.
4. **Card payments** with exact amounts (Stripe Checkout with a server-created session).
5. **Live QuickBooks sync.**
