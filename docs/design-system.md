# Axis design system

Everything you see in the app comes from one token file and one component library. The live reference is `/admin/design`.

## Tokens: `src/styles/tokens.css`

There are two layers:

1. **Brand primitives** (`--axis-red`, `--axis-black`, `--axis-card`…). These are copied from `brand/brand-tokens.css`, which was taken from axisglasstinting.com. Components never use them directly.
2. **Semantic tokens** (`--c-bg`, `--c-surface`, `--c-fg`, `--c-accent`…). Components use these, through Tailwind.

Each color is stored as RGB channels, so Tailwind opacity modifiers work: `text-fg/50`, `border-fg/10`, `bg-accent/15`.

| Tailwind class root | Token | Use |
|---|---|---|
| `bg` | `--c-bg` | Page background (brand `#1a1a1a` in dark) |
| `sunken` | `--c-sunken` | Sidebar, wells, tab bars |
| `surface` | `--c-surface` | Cards, sheets, drawers |
| `raised` | `--c-raised` | Hover and elevated surfaces, gradient tops |
| `fg` | `--c-fg` | Text and icons. Shades come from opacity: `/90` body, `/60` secondary, `/45` labels, `/30` disabled. Hairlines: `border-fg/10`, `divide-fg/5`, `bg-fg/[.04]` |
| `accent` (`-bright`, `-deep`, `-fg`) | Axis red | CTAs, selection, focus. Use `text-accent-fg` for red *text*, which is lifted for contrast in each theme |
| `on-accent` | white | Text on solid accent |
| `success` / `warn` / `info` / `danger` | status | Paid, low stock, info, errors |
| `scrim` | black | Overlays: `bg-scrim/60` |

Other tokens:

- **Fonts:** `font-display` (Outfit) for headings and numbers, `font-body` (DM Sans) for everything else.
- **Radius:** `rounded-sm` (brand 0.5rem), `rounded-md`, `rounded-lg`/`xl`, `rounded-2xl`.
- **Shadows:** `shadow-glow` (primary buttons), `shadow-pop` (menus and dialogs).

**Themes:** dark is the default. Setting `data-theme="light"` on `<html>` swaps the semantic layer to the brand's light palette. The crew dashboard follows Settings → Business → Theme; the customer app always stays dark.

## Rules

- Don't use raw palette classes (`text-white`, `bg-black`, `emerald-400`, `amber-300`…) or hex colors in components.
  - `node scripts/tokenize.cjs --check` fails if any slip in.
  - `node scripts/tokenize.cjs` fixes most of them automatically.
  - Exempt: product data such as paint swatches, and illustration art in the visualizers.
- Build from `src/components/ui.tsx`. Don't hand-roll a button, input, card, badge or modal.
- Status color always comes from `Tone` (`neutral | accent | success | warn | info | danger`) through `<Badge tone>` and `<Dot tone>`.
- Numbers: `font-display tabular-nums`. Money: `money()` from `src/lib/format.ts`.
- Pages start with `<PageHeader title sub actions />`.
- Every layout must work at 390px wide with no sideways scrolling. Tables scroll inside `<Table>`.

## Components (`src/components/ui.tsx`)

| Group | Components |
|---|---|
| Actions | `Button` (primary / outline / ghost / danger · sm / md / lg), `IconButton` |
| Selection | `Choice` (big radio card), `Chip`, `Segmented`, `Toggle`, `Counter` |
| Forms | `Field` (label + hint), `Input`, `Select`, `Textarea`, `MoneyInput`, `SearchInput` |
| Layout | `PageHeader`, `Card` (tone), `CardHeader`, `StepHeader`, `EmptyState`, `KeyValue`, `Tabs` |
| Data | `Badge`, `Dot`, `Kpi` (tone, delta), `Progress`, `Avatar`, `Table` + `Td` |
| Overlays | `Sheet` (dialog / bottom sheet; wrap in `AnimatePresence`), `Drawer` |
| Brand | `Logo` (flips for the light theme), `Stars` |
