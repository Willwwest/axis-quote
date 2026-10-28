import { useState } from "react";
import { CheckSquare, Printer, Square, Tag } from "lucide-react";
import { Button, Choice, EmptyState, SearchInput, Segmented } from "../../components/ui";
import { feet, inStock } from "../../lib/film";
import { paperFor, RollLabel, usePrintLabels } from "./Labels";
import { byCode, useStock } from "./shared";

/** Batch label printing: pick rolls, pick the label size, print one label per page. */
export function LabelsTab() {
  const { rolls, settings, leftOf } = useStock();
  const [large, setLarge] = useState(settings.inventory.largeLabels);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const labels = usePrintLabels();
  const needle = q.trim().toLowerCase();
  const list = rolls.filter((r) => inStock(r) && r.code && (!needle || `${r.code} ${r.name}`.toLowerCase().includes(needle))).sort(byCode);
  const chosen = list.filter((r) => picked.has(r.id));
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const all = chosen.length === list.length && list.length > 0;

  if (!rolls.some(inStock)) return <EmptyState icon={<Tag size={32} />} title="No rolls to label">Add a roll and its QR label is ready to print.</EmptyState>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Code or film" className="w-full sm:w-56" />
        <Segmented size="sm" value={large ? "large" : "std"} onChange={(v) => setLarge(v === "large")} options={[{ value: "std", label: '1.1" × 3.5"' }, { value: "large", label: '2.4" × 3.9"' }]} />
        <Button variant="ghost" size="sm" onClick={() => setPicked(all ? new Set() : new Set(list.map((r) => r.id)))}>
          {all ? <CheckSquare size={14} /> : <Square size={14} />} {all ? "Select none" : "Select all"}
        </Button>
        <div className="flex-1" />
        <Button size="sm" disabled={!chosen.length} onClick={() => labels.print(chosen.map((roll) => ({ roll, left: leftOf(roll) })), large)}>
          <Printer size={14} /> Print {chosen.length || ""} label{chosen.length === 1 ? "" : "s"}
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((r) => (
          <Choice key={r.id} selected={picked.has(r.id)} onClick={() => toggle(r.id)} className="!p-3">
            <div className="flex items-center gap-3">
              {picked.has(r.id) ? <CheckSquare size={18} className="shrink-0 text-accent-fg" /> : <Square size={18} className="shrink-0 text-fg/30" />}
              <span className="w-14 shrink-0 font-display font-semibold tabular-nums">{r.code}</span>
              <span className="min-w-0 flex-1 truncate text-sm">{r.name}</span>
              <span className="shrink-0 text-xs tabular-nums text-fg/45">{feet(Math.max(0, leftOf(r)))}</span>
            </div>
          </Choice>
        ))}
      </div>

      {chosen.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-1 font-display text-lg font-semibold">Preview</h2>
          <p className="mb-3 text-sm text-fg/50">Actual size. Prints one label per page: pick the {large ? '62 × 100 mm' : '29 × 90 mm'} label in the print dialog (Brother QL-820NWB works over AirPrint).</p>
          <div className="-mx-4 overflow-x-auto px-4">
            <div className="flex w-max flex-col gap-3">
              {chosen.slice(0, 12).map((r) => <div key={r.id} className="rounded-sm shadow-pop"><RollLabel roll={r} left={leftOf(r)} large={large} paper={paperFor(settings.theme)} /></div>)}
            </div>
          </div>
          {chosen.length > 12 && <p className="mt-2 text-xs text-fg/40">and {chosen.length - 12} more</p>}
        </section>
      )}
      {labels.node}
    </div>
  );
}
