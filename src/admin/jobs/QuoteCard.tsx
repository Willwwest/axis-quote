import { Calculator, Plus, X } from "lucide-react";
import { Button, Card, CardHeader, IconButton, Input, MoneyInput } from "../../components/ui";
import { money } from "../../lib/format";
import { jobValueLabel } from "../../lib/project";
import { leads, newId } from "../../lib/store";
import type { Lead, ServiceLine } from "../../lib/types";

/** Instant-quote lines, extra services, and the price the customer agreed to. */
export function QuoteCard({ lead }: { lead: Lead }) {
  const services = lead.services ?? [];
  const setServices = (next: ServiceLine[]) => leads.update(lead.id, { services: next });
  const setService = (i: number, p: Partial<ServiceLine>) => setServices(services.map((s, n) => (n === i ? { ...s, ...p } : s)));
  const quoteTotal = lead.quote.range ? lead.quote.range[0] : lead.quote.total;
  const servicesTotal = services.reduce((t, s) => t + s.price * (s.qty || 1), 0);
  const suggested = Math.round((quoteTotal + servicesTotal) * 100) / 100;

  return (
    <Card>
      <CardHeader title="Quote & services" icon={<Calculator size={16} />} sub={lead.price != null ? "Agreed price set" : "Priced from the instant quote"} />

      {lead.quote.lines.length > 0 ? (
        <div className="rounded-xl border border-fg/10 p-3">
          {lead.quote.lines.map((l, i) => (
            <div key={i} className="flex justify-between gap-3 py-1 text-sm">
              <span className="min-w-0 text-fg/75">{l.label}{l.note && <span className="text-fg/40"> · {l.note}</span>}</span>
              <span className="shrink-0 tabular-nums">{l.amount === 0 ? "Free" : money(l.amount)}</span>
            </div>
          ))}
          <div className="mt-1 flex justify-between border-t border-fg/10 pt-2 text-sm font-semibold">
            <span>Instant quote</span>
            <span className="tabular-nums">{lead.quote.range ? `${money(lead.quote.range[0])} – ${money(lead.quote.range[1])}` : money(lead.quote.total)}</span>
          </div>
        </div>
      ) : <p className="text-sm text-fg/45">No instant quote. Edit the details above, or add services.</p>}

      <div className="mt-4">
        <div className="mb-2 text-sm font-medium text-fg/80">Services</div>
        <div className="space-y-2">
          {services.map((s, i) => (
            <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-fg/10 p-2 sm:flex-nowrap sm:border-0 sm:p-0">
              <Input value={s.name} onChange={(e) => setService(i, { name: e.target.value })} placeholder="e.g. Ceramic coating, PPF hood" aria-label="Service" className="!py-2 basis-full sm:basis-auto" />
              <Input type="number" min={1} inputMode="numeric" value={s.qty} onChange={(e) => setService(i, { qty: Math.max(1, Number(e.target.value) || 1) })} aria-label="Quantity" className="!w-16 !px-3 !py-2 text-center tabular-nums" />
              <MoneyInput value={s.price} onChange={(v) => setService(i, { price: Number(v) || 0 })} className="flex-1 sm:w-28 sm:flex-none" />
              <IconButton label="Remove service" onClick={() => setServices(services.filter((_, n) => n !== i))}><X size={16} /></IconButton>
            </div>
          ))}
        </div>
        <Button size="sm" variant="ghost" className="mt-1" onClick={() => setServices([...services, { id: newId("S"), name: "", price: 0, qty: 1 }])}><Plus size={14} /> Add service</Button>
      </div>

      <div className="mt-4 rounded-xl bg-fg/[.04] p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Agreed price</div>
            <div className="text-xs text-fg/45">Set by proposal approval, or type one in.</div>
          </div>
          <MoneyInput value={lead.price} placeholder={String(suggested)} onChange={(v) => leads.update(lead.id, { price: v === "" ? undefined : Number(v) })} className="w-32" />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-fg/50">Quote {money(quoteTotal)}{servicesTotal ? ` + services ${money(servicesTotal)} = ${money(suggested)}` : ""}</span>
          {lead.price == null
            ? suggested > 0 && <button type="button" onClick={() => leads.update(lead.id, { price: suggested })} className="font-medium text-accent-fg hover:underline">Use {money(suggested)}</button>
            : <button type="button" onClick={() => leads.update(lead.id, { price: undefined })} className="text-fg/50 hover:text-fg">Clear (back to quote)</button>}
        </div>
        <div className="mt-2 flex justify-between border-t border-fg/10 pt-2 font-display font-semibold"><span>Job value</span><span className="tabular-nums">{jobValueLabel(lead)}</span></div>
      </div>
    </Card>
  );
}
