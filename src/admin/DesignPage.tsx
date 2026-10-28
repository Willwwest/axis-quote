import { useState, type ReactNode } from "react";
import { AnimatePresence } from "framer-motion";
import { Bell, Layers, Plus, Scissors, Trash2 } from "lucide-react";
import {
  Avatar, Badge, Button, Card, CardHeader, Chip, Choice, Counter, Dot, EmptyState, Field, IconButton, Input, KeyValue, Kpi,
  Logo, MoneyInput, PageHeader, Progress, SearchInput, Segmented, Select, Sheet, Stars, Table, Tabs, Td, Textarea, Toggle,
  type Tone,
} from "../components/ui";
import { patchSettings, useSettings } from "../lib/store";

/** Living reference for the Axis design system. Everything here renders from the same tokens the app uses. */

const SWATCHES: { name: string; token: string; use: string }[] = [
  { name: "bg", token: "--c-bg", use: "Page background" },
  { name: "sunken", token: "--c-sunken", use: "Sidebar, wells" },
  { name: "surface", token: "--c-surface", use: "Cards, sheets" },
  { name: "raised", token: "--c-raised", use: "Elevated, gradient tops" },
  { name: "fg", token: "--c-fg", use: "Text, icons, hairlines (with opacity)" },
  { name: "accent", token: "--c-accent", use: "CTA, selection, focus" },
  { name: "accent-bright", token: "--c-accent-bright", use: "Gradient top, glow" },
  { name: "accent-deep", token: "--c-accent-deep", use: "Gradient bottom" },
  { name: "accent-fg", token: "--c-accent-fg", use: "Red text" },
  { name: "success", token: "--c-success", use: "Paid, done, healthy stock" },
  { name: "warn", token: "--c-warn", use: "Low stock, attention" },
  { name: "info", token: "--c-info", use: "New, consults" },
  { name: "danger", token: "--c-danger", use: "Errors, destructive" },
];

const BRAND = ["--axis-red", "--axis-red-bright", "--axis-red-deep", "--axis-red-tint", "--axis-black", "--axis-ink", "--axis-card", "--axis-muted", "--axis-border", "--axis-white"];

const TONES: Tone[] = ["neutral", "accent", "success", "warn", "info", "danger"];

export default function DesignPage() {
  const { theme } = useSettings();
  const [seg, setSeg] = useState("week");
  const [chip, setChip] = useState(true);
  const [choice, setChoice] = useState(1);
  const [toggle, setToggle] = useState(true);
  const [count, setCount] = useState(2);
  const [tab, setTab] = useState<"a" | "b" | "c">("a");
  const [sheet, setSheet] = useState(false);
  const [q, setQ] = useState("");

  return (
    <div className="space-y-12">
      <PageHeader
        eyebrow="Axis brand kit"
        title="Design system"
        sub="Tokens in src/styles/tokens.css, components in src/components/ui.tsx. Rules: docs/design-system.md."
        actions={<Segmented value={theme} onChange={(t) => patchSettings({ theme: t })} options={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }]} />}
      />

      <Section title="Logo">
        <div className="flex flex-wrap items-center gap-8">
          <Logo className="h-16" />
          <Logo flat className="h-10" />
        </div>
      </Section>

      <Section title="Semantic color tokens" sub="What components use. Each is RGB channels, so opacity modifiers work: text-fg/50, border-fg/10, bg-accent/15.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {SWATCHES.map((s) => (
            <div key={s.name} className="overflow-hidden rounded-xl border border-fg/10">
              <div className="h-14" style={{ background: `rgb(var(${s.token}))` }} />
              <div className="bg-surface p-3">
                <div className="font-mono text-xs font-semibold">{s.name}</div>
                <div className="mt-0.5 text-xs text-fg/45">{s.use}</div>
              </div>
            </div>
          ))}
        </div>
        <h3 className="mb-2 mt-6 text-sm font-medium text-fg/70">Foreground scale (opacity on fg)</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          {["text-fg", "text-fg/90", "text-fg/70", "text-fg/60", "text-fg/45", "text-fg/30"].map((c) => <span key={c} className={c}>{c}</span>)}
        </div>
      </Section>

      <Section title="Brand primitives" sub="From brand/brand-tokens.css (axisglasstinting.com). Never used directly in components.">
        <div className="flex flex-wrap gap-2">
          {BRAND.map((t) => (
            <div key={t} className="flex items-center gap-2 rounded-full border border-fg/10 py-1 pl-1 pr-3">
              <span className="h-6 w-6 rounded-full border border-fg/10" style={{ background: `rgb(var(${t}))` }} />
              <span className="font-mono text-xs text-fg/60">{t}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type" sub="Outfit for display and numbers, DM Sans for body.">
        <div className="space-y-3">
          <div className="font-display text-4xl font-semibold tracking-tight">See your tint before you buy</div>
          <div className="font-display text-2xl font-semibold">Section heading</div>
          <div className="font-display text-lg font-semibold">Card heading</div>
          <p className="max-w-prose text-fg/80">Body copy in DM Sans. Ceramic film blocks up to 90% of infrared heat with crystal-clear optics and no signal interference.</p>
          <p className="text-sm text-fg/50">Secondary text, hints and metadata.</p>
          <div className="font-display text-3xl font-bold tabular-nums">$1,280 · 84.5 ft</div>
          <div className="font-display text-xs font-semibold uppercase tracking-[.25em] text-accent-fg">Eyebrow</div>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button><Plus size={16} /> Primary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger"><Trash2 size={15} /> Danger</Button>
          <Button size="sm">Small</Button>
          <Button size="lg"><Scissors size={18} /> Large</Button>
          <Button disabled>Disabled</Button>
          <IconButton label="Notifications"><Bell size={18} /></IconButton>
        </div>
      </Section>

      <Section title="Selection">
        <div className="space-y-5">
          <Segmented value={seg} onChange={setSeg} options={[{ value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "agenda", label: "Agenda" }]} />
          <div className="flex flex-wrap gap-2">
            <Chip selected={chip} onClick={() => setChip(!chip)}>Front doors</Chip>
            <Chip selected={!chip} onClick={() => setChip(!chip)}>Back glass</Chip>
            <Chip size="sm" selected onClick={() => {}}>Small chip</Chip>
          </div>
          <div className="grid max-w-xl gap-3 sm:grid-cols-2">
            {["Carbon", "Ceramic"].map((f, i) => (
              <Choice key={f} selected={choice === i} onClick={() => setChoice(i)}>
                <div className="font-display text-lg font-semibold">{f}</div>
                <div className="text-sm text-fg/50">{i ? "Max heat rejection" : "Great value"}</div>
              </Choice>
            ))}
          </div>
          <div className="max-w-sm"><Toggle checked={toggle} onChange={setToggle} label="Send 24h reminder" hint="Texts the customer the day before" /></div>
          <Counter value={count} onChange={setCount} />
        </div>
      </Section>

      <Section title="Forms">
        <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
          <Field label="Customer name"><Input placeholder="Jane Doe" /></Field>
          <Field label="Film" hint="From the catalog"><Select><option>Ceramic 20%</option><option>Carbon 35%</option></Select></Field>
          <Field label="Price"><MoneyInput value={450} onChange={() => {}} /></Field>
          <Field label="Search"><SearchInput value={q} onChange={setQ} placeholder="Name, phone, VIN" /></Field>
          <Field label="Notes" className="sm:col-span-2"><Textarea placeholder="Gate code, pets, parking…" /></Field>
        </div>
      </Section>

      <Section title="Status & data">
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">{TONES.map((t) => <Badge key={t} tone={t}><Dot tone={t} /> {t}</Badge>)}</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Leads · this week" value="14" delta={27} sub="Month to date 41" />
            <Kpi label="Collected · month" value="$8,420" tone="success" />
            <Kpi label="Rolls running low" value="2" tone="warn" />
            <Kpi label="Past due" value="$640" tone="danger" delta={-12} />
          </div>
          <div className="max-w-sm space-y-2">
            <Progress value={72} />
            <Progress value={18} tone="warn" />
            <Progress value={4} tone="danger" />
          </div>
          <div className="flex items-center gap-3"><Avatar name="Sample Installer" /><Avatar name="Owner" color="rgb(var(--c-accent))" size={36} /><Stars rating={4} /></div>
          <Table head={["Roll", "Film", "Left", "Status"]}>
            <tr><Td className="font-mono">10001</Td><Td>Ceramic 20%</Td><Td className="tabular-nums">84.5 ft</Td><Td><Badge tone="success">In</Badge></Td></tr>
            <tr><Td className="font-mono">10002</Td><Td>Carbon 35%</Td><Td className="tabular-nums">12 ft</Td><Td><Badge tone="warn">Low</Badge></Td></tr>
          </Table>
        </div>
      </Section>

      <Section title="Layout">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Card" icon={<Layers size={16} />} sub="Surface with a hairline border" actions={<Button size="sm" variant="outline">Action</Button>} />
            <dl className="divide-y divide-fg/5">
              <KeyValue k="Vehicle">2023 Ford F-150</KeyValue>
              <KeyValue k="Film">Ceramic · fronts 35% · rear 20%</KeyValue>
            </dl>
          </Card>
          <div className="grid gap-3">
            <Card tone="accent">Tone accent</Card>
            <Card tone="warn">Tone warn</Card>
          </div>
        </div>
        <div className="mt-6">
          <Tabs value={tab} onChange={setTab} tabs={[{ id: "a", label: "Summary" }, { id: "b", label: "Rolls", count: 6 }, { id: "c", label: "Film types" }]} />
          <EmptyState icon={<Layers size={32} />} title="Nothing here yet" actions={<Button onClick={() => setSheet(true)}>Open a sheet</Button>}>
            Empty states explain what goes here and offer the next step.
          </EmptyState>
        </div>
      </Section>

      <AnimatePresence>
        {sheet && (
          <Sheet title="Sheet" onClose={() => setSheet(false)}>
            <p className="text-sm text-fg/60">Centered dialog on desktop, bottom sheet on phones.</p>
            <Button className="mt-5 w-full" onClick={() => setSheet(false)}>Done</Button>
          </Sheet>
        )}
      </AnimatePresence>
    </div>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      {sub && <p className="mt-1 text-sm text-fg/50">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
