import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, ChevronRight, Download, Layers, Printer } from "lucide-react";
import { Button, EmptyState, Kpi, SearchInput, Select, Table, Td, cx } from "../../components/ui";
import { costOf, feet, inStock, rollHealth, sqftLabel, sqftOf, summarize, type TypeSummary } from "../../lib/film";
import { downloadFile, money, toCsv } from "../../lib/format";
import { printLight, useStock } from "./shared";

type Key = "name" | "installs" | "price" | "rolls" | "sqft" | "inches" | "value";
const VALUE: Record<Key, (r: TypeSummary) => number | string> = {
  name: (r) => r.name.toLowerCase(), installs: (r) => r.installs, price: (r) => r.pricePerSqft ?? -1, rolls: (r) => r.rolls.length,
  sqft: (r) => r.sqft, inches: (r) => r.inches, value: (r) => r.value,
};

/** Stock and pricing for every film type, Tint Wiz's Summary tab with stock value added. */
export function SummaryTab({ onAdd }: { onAdd?: () => void }) {
  const { rolls, log, types, left, leftOf } = useStock();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: "sqft", dir: -1 });

  const stats = useMemo(() => {
    const stock = rolls.filter(inStock);
    const monthAgo = Date.now() - 30 * 864e5;
    const recent = log.filter((u) => u.source !== "adjust" && u.inches > 0 && +new Date(u.date) > monthAgo);
    return {
      count: stock.length,
      out: stock.filter((r) => r.status === "out").length,
      inches: stock.reduce((s, r) => s + Math.max(0, leftOf(r)), 0),
      sqft: stock.reduce((s, r) => s + sqftOf(r.widthIn, leftOf(r)), 0),
      low: stock.filter((r) => rollHealth(r, leftOf(r)) !== "ok").length,
      used: recent.reduce((s, u) => s + u.inches, 0),
      usedSqft: recent.reduce((s, u) => s + sqftOf(rolls.find((r) => r.id === u.rollId)?.widthIn ?? 0, u.inches), 0),
      cuts: recent.length,
      value: stock.reduce((s, r) => s + costOf(r, Math.max(0, leftOf(r))), 0),
      costed: stock.filter((r) => r.cost).length,
    };
  }, [rolls, log, left]); // leftOf reads `left`

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = summarize(types, rolls, log).filter((r) => !needle || `${r.name} ${r.type?.series ?? ""}`.toLowerCase().includes(needle));
    const v = VALUE[sort.key];
    return list.sort((a, b) => { const x = v(a), y = v(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir; });
  }, [types, rolls, log, q, sort]);

  if (!rolls.length) {
    return (
      <EmptyState icon={<Layers size={36} />} title="No rolls yet" actions={onAdd && <Button onClick={onAdd}>Add your first roll</Button>}>
        Add each roll on the shelf with its film, width and length. Partly used? Enter the full length, then check it in with what's actually left.
      </EmptyState>
    );
  }

  const head = (key: Key, label: string) => (
    <button type="button" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (-s.dir as 1 | -1) : key === "name" ? 1 : -1 }))}
      className={cx("inline-flex items-center gap-1 uppercase tracking-wider hover:text-fg", sort.key === key && "text-fg/80")}>
      {label}{sort.key === key && (sort.dir > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
    </button>
  );
  const open = (r: TypeSummary) => nav(r.type ? `/admin/inventory/types/${r.type.id}` : `/admin/inventory/rolls?q=${encodeURIComponent(r.name)}`);
  const exportCsv = () => downloadFile("axis-inventory.csv", toCsv([
    ["Film type", "Installs", "$/sq ft", "Rolls", "Stock sq ft", "Stock ft", "Value"],
    ...rows.map((r) => [r.name, r.installs, r.pricePerSqft ?? "", r.rolls.length, r.sqft.toFixed(2), (r.inches / 12).toFixed(1), r.value.toFixed(2)]),
  ]), "text/csv");

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Rolls in stock" value={String(stats.count)} sub={stats.out ? `${stats.out} checked out` : undefined} />
        <Kpi label="Film on hand" value={feet(stats.inches)} sub={sqftLabel(stats.sqft)} />
        <Kpi label="Running low" value={String(stats.low)} tone={stats.low ? "warn" : undefined} />
        <Kpi label={`Used · 30 days · ${stats.cuts} cut${stats.cuts === 1 ? "" : "s"}`} value={feet(stats.used)} sub={sqftLabel(stats.usedSqft)} />
        <Kpi label="Stock value" value={money(stats.value)} sub={stats.costed < stats.count ? `${stats.count - stats.costed} roll${stats.count - stats.costed === 1 ? "" : "s"} without a cost` : "At roll cost"} />
      </div>

      <div className="no-print mb-3 flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search film types" className="w-full sm:w-72" />
        <Select value={`${sort.key}:${sort.dir}`} onChange={(e) => { const [key, dir] = e.target.value.split(":"); setSort({ key: key as Key, dir: Number(dir) as 1 | -1 }); }}
          className="!w-auto !py-2 text-sm sm:hidden" aria-label="Sort by">
          <option value="sqft:-1">Most stock</option>
          <option value="sqft:1">Least stock</option>
          <option value="installs:-1">Most installs</option>
          <option value="value:-1">Highest value</option>
          <option value="name:1">Name</option>
        </Select>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={exportCsv}><Download size={14} /> CSV</Button>
        <Button variant="outline" size="sm" onClick={() => printLight()}><Printer size={14} /> Print</Button>
      </div>
      <h2 className="mb-2 hidden font-display text-lg font-semibold print:block">Inventory summary · {new Date().toLocaleDateString()}</h2>

      {/* Phones get a list; the full table scrolls sideways there and buries the numbers. */}
      <div className="divide-y divide-fg/5 overflow-hidden rounded-2xl border border-fg/10 sm:hidden print:hidden">
        {rows.map((r) => (
          <button key={r.key} type="button" onClick={() => open(r)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-fg/[.03]">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{r.name}</span>
              <span className="block truncate text-xs text-fg/45">
                {r.rolls.length} roll{r.rolls.length === 1 ? "" : "s"} · {r.installs} install{r.installs === 1 ? "" : "s"}{r.pricePerSqft ? ` · ${money(r.pricePerSqft, true)}/sq ft` : ""}
                {r.low > 0 && <span className="text-warn"> · {r.low} low</span>}
              </span>
            </span>
            <span className="shrink-0 text-right font-display tabular-nums">
              <span className="block">{Math.round(r.sqft).toLocaleString()} sq ft</span>
              <span className="block text-xs text-fg/45">{feet(r.inches)}{r.value ? ` · ${money(r.value)}` : ""}</span>
            </span>
          </button>
        ))}
        {!rows.length && <p className="px-4 py-6 text-center text-sm text-fg/50">No film types match.</p>}
      </div>
      <div className="hidden sm:block print:block">
      <Table head={[head("name", "Film type"), head("installs", "Installs"), head("price", "$ / sq ft"), head("rolls", "Rolls"), head("sqft", "Stock"), head("inches", "Feet"), head("value", "Value"), ""]}
        empty={!rows.length && <p className="px-4 py-6 text-center text-sm text-fg/50">No film types match.</p>}>
        {rows.map((r) => {
          return (
            <tr key={r.key} onClick={() => open(r)} className="cursor-pointer hover:bg-fg/[.03]">
              <Td>
                <div className="font-medium">{r.type ? <><span className="font-semibold">{r.type.brand}</span> {r.type.name}</> : r.name}</div>
                {!r.type && <div className="text-xs text-fg/40">Not in the catalog</div>}
                {r.low > 0 && <div className="text-xs text-warn">{r.low} roll{r.low === 1 ? "" : "s"} running low</div>}
              </Td>
              <Td className="font-display tabular-nums">{r.installs}</Td>
              <Td className="font-display tabular-nums">{r.pricePerSqft ? <span className="text-success">{money(r.pricePerSqft, true)}</span> : <span className="text-fg/35">—</span>}</Td>
              <Td className="font-display tabular-nums">{r.rolls.length}</Td>
              <Td className="whitespace-nowrap font-display tabular-nums">{r.sqft.toLocaleString("en-US", { maximumFractionDigits: 2 })} sq ft</Td>
              <Td className="whitespace-nowrap font-display tabular-nums text-fg/70">{feet(r.inches)}</Td>
              <Td className="font-display tabular-nums text-fg/70">{r.value ? money(r.value) : "—"}</Td>
              <Td className="no-print w-8 text-fg/30"><ChevronRight size={16} /></Td>
            </tr>
          );
        })}
      </Table>
      </div>
      <p className="no-print mt-3 text-xs text-fg/40">
        Stock leaves out lost rolls. Installs counts jobs that took film off a roll of that type. Set prices under <Link to="/admin/inventory/types" className="underline underline-offset-2 hover:text-fg">Film types</Link>.
      </p>
    </div>
  );
}
