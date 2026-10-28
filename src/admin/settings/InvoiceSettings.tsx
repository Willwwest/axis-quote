import { ExternalLink, Plus, Trash2 } from "lucide-react";
import type { Settings, TaxRate } from "../../data/config";
import { Button, Card, CardHeader, Chip, Field, IconButton, Input, Select, Textarea, Toggle } from "../../components/ui";
import { TERMS } from "../../lib/money";
import { invoices, newId, patchSettings, useSettings } from "../../lib/store";
import type { PaymentTerms } from "../../lib/types";

export function InvoiceSettings() {
  const s = useSettings();
  const cfg = s.invoices;
  const all = invoices.use();
  const set = (p: Partial<Settings["invoices"]>) => patchSettings((cur) => ({ invoices: { ...cur.invoices, ...p } }));
  const setRate = (id: string, p: Partial<TaxRate>) => set({ taxRates: cfg.taxRates.map((t) => (t.id === id ? { ...t, ...p } : t)) });
  const used = new Set(all.filter((i) => i.status !== "void").map((i) => i.taxRateId));
  const highest = Math.max(0, ...all.map((i) => Number(i.number)).filter(Number.isFinite));
  const next = s.sequences.invoice;
  const hasDefault = cfg.taxRates.some((t) => t.id === cfg.defaultTaxRateId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="New invoice defaults" sub="Applied when an invoice is created. Existing invoices keep their own." />
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Payment terms" hint="Sets the due date">
              <Select value={cfg.terms} onChange={(e) => set({ terms: e.target.value as PaymentTerms })}>
                {TERMS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </Select>
            </Field>
            <Field label="Next invoice number" hint={highest >= next ? `#${highest} is already used` : highest ? `Last used #${highest}` : undefined}>
              <Input type="number" inputMode="numeric" min={1} value={next}
                onChange={(e) => { const n = Math.floor(Number(e.target.value)); if (n > 0) patchSettings((cur) => ({ sequences: { ...cur.sequences, invoice: n } })); }} />
            </Field>
          </div>
          {highest >= next && <p className="-mt-2 text-xs text-warn">Numbers would repeat. Set it above #{highest} so QuickBooks doesn't merge invoices.</p>}
          <Field label="Invoice notes" hint="Printed at the bottom">
            <Textarea value={cfg.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Thank you for your business!" />
          </Field>
          <Toggle checked={cfg.showRollCodes} onChange={(v) => set({ showRollCodes: v })} label="Show film roll codes"
            hint="Adds the codes of the rolls cut for the job under the line, for warranty tracing." />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Sales tax"
          sub="Arizona TPT depends on the city. Add one rate per city you work in."
          actions={<Button variant="outline" size="sm" onClick={() => set({ taxRates: [...cfg.taxRates, { id: newId("TAX"), name: "", pct: 0 }] })}><Plus size={14} /> Add rate</Button>}
        />
        <div className="space-y-2">
          {cfg.taxRates.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-2 border-b border-fg/5 pb-2 last:border-0 sm:flex-nowrap sm:border-0 sm:pb-0">
              <Input value={t.name} onChange={(e) => setRate(t.id, { name: e.target.value })} placeholder="e.g. Prescott TPT" className="min-w-0 basis-full !py-2 sm:flex-1 sm:basis-0" aria-label="Rate name" />
              <div className="relative w-24 shrink-0">
                <Input type="number" inputMode="decimal" min={0} max={99.99} step="0.01" value={t.pct} aria-label="Percent" className="!py-2 !pl-3 pr-7 text-right tabular-nums"
                  onChange={(e) => { const n = Number(e.target.value); if (e.target.value !== "" && n >= 0 && n < 100) setRate(t.id, { pct: n }); }} />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-fg/40">%</span>
              </div>
              <Chip size="sm" selected={cfg.defaultTaxRateId === t.id} onClick={() => set({ defaultTaxRateId: t.id })}>Default</Chip>
              <span className="flex-1 sm:hidden" />
              <IconButton label={used.has(t.id) ? "In use on invoices" : cfg.defaultTaxRateId === t.id ? "Pick another default first" : "Delete rate"}
                disabled={used.has(t.id) || cfg.defaultTaxRateId === t.id}
                onClick={() => set({ taxRates: cfg.taxRates.filter((x) => x.id !== t.id) })}>
                <Trash2 size={15} />
              </IconButton>
            </div>
          ))}
          {!cfg.taxRates.length && <p className="text-sm text-fg/45">No rates. Invoices go out without tax.</p>}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Chip size="sm" selected={!hasDefault} onClick={() => set({ defaultTaxRateId: "" })}>No tax by default</Chip>
        </div>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-fg/45">
          <li>Tax-exempt customers: turn on Tax exempt on their contact. Their new invoices start with no tax.</li>
          <li>Editing a rate changes every invoice that uses it. When a city rate changes, add a new rate and make it the default.</li>
          <li>Each line has its own Tax tick, so untaxed items (a deposit-only line, a discount) can sit on a taxed invoice.</li>
        </ul>
      </Card>

      <Card>
        <CardHeader title="Online payments" sub="Shown as Pay now on the customer invoice." />
        <Field label="Pay link" hint="Stripe Payment Link, Square, PayPal…">
          <div className="flex gap-2">
            <Input value={cfg.payUrl} onChange={(e) => set({ payUrl: e.target.value.trim() })} placeholder="https://buy.stripe.com/…" className="min-w-0 flex-1" />
            {cfg.payUrl && <Button variant="outline" onClick={() => window.open(cfg.payUrl, "_blank", "noopener")}><ExternalLink size={15} /> Test</Button>}
          </div>
        </Field>
        <div className="mt-4 rounded-xl bg-fg/[.04] p-4 text-sm text-fg/65">
          <div className="mb-2 font-medium text-fg/85">Making a Stripe Payment Link</div>
          <ol className="list-decimal space-y-1 pl-5">
            <li>In the Stripe Dashboard open <b>Payment Links</b> → <b>New</b>.</li>
            <li>Add a product (e.g. "Axis Glass Tinting invoice") and pick <b>Customers choose what to pay</b>. A fixed price can't change per invoice.</li>
            <li>Create the link, copy it (it starts with buy.stripe.com) and paste it above.</li>
          </ol>
          <p className="mt-2 text-xs text-fg/45">
            The invoice page tells the customer the exact amount to enter, tip included. Axis adds the invoice number to Stripe links, so it shows on the payment in Stripe.
            Record the payment here once it lands. With no link, customers see Call and Text to pay instead.
          </p>
        </div>
      </Card>
    </div>
  );
}
