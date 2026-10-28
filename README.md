# Axis Quote

Instant quote, tint visualizer and booking app for Axis Glass Tinting, plus a crew dashboard.

| Route | Who | What |
|---|---|---|
| `/` | Customers | Vehicle / home / business quote flow: preview shades, live pricing, Arizona legality check, book a slot |
| `/?ref=CODE` | Referred friends | Same flow with the referral credit applied |
| `/admin` | Crew (PIN, default `1234`) | Lead pipeline, schedule + blocked days, pricing editor, settings, CSV export |
| `/admin/job/:id` | Crew, on site | Wrap-up checklist, photos, warranty + review + referral text |
| `/warranty#…` | Customers | Shareable warranty certificate (data lives in the link) |

## Run

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
```

## Before launch

- **Prices are placeholders.** Set real ones in `/admin` → Pricing (or `DEFAULT_SETTINGS` in `src/data/config.ts`).
- **Data is stored in the browser** (`src/lib/store.ts`). Leads only show up in the dashboard on the device that submitted them,
  so before going live either set a lead webhook in Settings (Zapier/Make → SMS/email/CRM) or swap the store for Supabase,
  which their current site already uses. The PIN gate is client-side only.
- Add the Google review link in `/admin` → Settings.
