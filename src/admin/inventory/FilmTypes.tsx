import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronRight, Pencil, Plus, Search, Trash2 } from "lucide-react";
import {
  Badge, Button, Card, CardHeader, EmptyState, Field, Input, KeyValue, MoneyInput, PageHeader, SearchInput, Segmented, Select, Sheet, Table, Td, Textarea,
} from "../../components/ui";
import { CATEGORIES, inStock, rollHealth, sqftOf, summarize, typeLabel } from "../../lib/film";
import { money } from "../../lib/format";
import { useSession } from "../../lib/session";
import { filmTypes, newId } from "../../lib/store";
import type { FilmType } from "../../lib/types";
import { RollForm } from "./RollForm";
import { byCode, RollBadges, useStock } from "./shared";

type Cat = FilmType["category"] | "all";

/** The film catalog: every shade is its own type with its own retail $/sq ft (used on flat-glass proposals). */
export function FilmTypesTab() {
  const { types, rolls, log } = useStock();
  const { can } = useSession();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Cat>("all");
  const [edit, setEdit] = useState<FilmType | "new" | null>(null);
  const stock = useMemo(() => new Map(summarize(types, rolls, log).map((s) => [s.key, s])), [types, rolls, log]);
  const needle = q.trim().toLowerCase();
  const list = types
    .filter((t) => (cat === "all" || t.category === cat) && (!needle || `${t.brand} ${t.series} ${t.name}`.toLowerCase().includes(needle)))
    .sort((a, b) => `${a.brand} ${a.name}`.localeCompare(`${b.brand} ${b.name}`, undefined, { numeric: true }));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Brand, series or shade" className="w-full sm:w-64" />
        <Segmented size="sm" value={cat} onChange={setCat} options={[{ value: "all" as Cat, label: "All" }, ...CATEGORIES.map((c) => ({ value: c.id as Cat, label: c.label }))]} />
        <div className="flex-1" />
        {can("inventory.manage") && <Button size="sm" variant="outline" onClick={() => setEdit("new")}><Plus size={14} /> Film type</Button>}
      </div>
      <div className="divide-y divide-fg/5 overflow-hidden rounded-2xl border border-fg/10 sm:hidden">
        {list.map((t) => {
          const s = stock.get(t.id);
          return (
            <Link key={t.id} to={`/admin/inventory/types/${t.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-fg/[.03]">
              <span className="min-w-0 flex-1">
                <span className="block truncate"><span className="font-semibold">{t.brand}</span> {t.name}</span>
                <span className="block text-xs text-fg/45">{t.series}{s?.rolls.length ? ` · ${s.rolls.length} roll${s.rolls.length === 1 ? "" : "s"} · ${Math.round(s.sqft)} sq ft` : " · none in stock"}</span>
              </span>
              <span className="shrink-0 font-display tabular-nums">{t.pricePerSqft ? <span className="text-success">{money(t.pricePerSqft, true)}</span> : <span className="text-fg/35">—</span>}</span>
            </Link>
          );
        })}
        {!list.length && <p className="px-4 py-6 text-center text-sm text-fg/50">No film types match.</p>}
      </div>
      <div className="hidden sm:block">
      <Table head={["Film type", "Series", "Shade", "$ / sq ft", "Rolls", "Stock", ""]}
        empty={!list.length && <p className="px-4 py-6 text-center text-sm text-fg/50">No film types match.</p>}>
        {list.map((t) => {
          const s = stock.get(t.id);
          return (
            <tr key={t.id} onClick={() => nav(`/admin/inventory/types/${t.id}`)} className="cursor-pointer hover:bg-fg/[.03]">
              <Td><span className="font-semibold">{t.brand}</span> {t.name}</Td>
              <Td className="text-fg/60">{t.series}</Td>
              <Td className="font-display tabular-nums">{t.vlt != null ? `${t.vlt}%` : "—"}</Td>
              <Td className="font-display tabular-nums">{t.pricePerSqft ? <span className="text-success">{money(t.pricePerSqft, true)}</span> : <span className="text-fg/35">—</span>}</Td>
              <Td className="font-display tabular-nums">{s?.rolls.length ?? 0}</Td>
              <Td className="whitespace-nowrap font-display tabular-nums text-fg/70">{s?.sqft ? `${Math.round(s.sqft)} sq ft` : "—"}</Td>
              <Td className="w-8 text-fg/30"><ChevronRight size={16} /></Td>
            </tr>
          );
        })}
      </Table>
      </div>
      <AnimatePresence>{edit && <TypeSheet key="type" type={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} />}</AnimatePresence>
    </div>
  );
}

export function TypeSheet({ type, onClose, onDeleted }: { type?: FilmType; onClose: () => void; onDeleted?: () => void }) {
  const { rolls } = useStock();
  const [f, setF] = useState<FilmType>(type ?? { id: newId("FT"), brand: "", series: "", name: "", vlt: null, category: "flat", pricePerSqft: 0, description: "" });
  const set = (p: Partial<FilmType>) => setF((x) => ({ ...x, ...p }));
  const using = rolls.filter((r) => r.filmTypeId === f.id).length;
  const save = () => { filmTypes.save({ ...f, brand: f.brand.trim(), series: f.series.trim(), name: f.name.trim() }); onClose(); };
  const remove = () => {
    if (!confirm(using ? `${using} roll${using === 1 ? " uses" : "s use"} this film type. They keep their name but leave the catalog. Delete?` : `Delete ${typeLabel(f)}?`)) return;
    filmTypes.remove(f.id);
    onDeleted?.();
    onClose();
  };
  return (
    <Sheet title={type ? `Edit ${typeLabel(type)}` : "Add a film type"} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Brand"><Input value={f.brand} onChange={(e) => set({ brand: e.target.value })} placeholder="Edge" autoFocus={!type} /></Field>
          <Field label="Series"><Input value={f.series} onChange={(e) => set({ series: e.target.value })} placeholder="Pristine" /></Field>
        </div>
        <div className="grid grid-cols-[1fr_96px] gap-3">
          <Field label="Name" hint="Every shade is its own type"><Input value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Pristine 40" /></Field>
          <Field label="VLT %"><Input type="number" min={0} max={100} value={f.vlt ?? ""} onChange={(e) => set({ vlt: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Select value={f.category} onChange={(e) => set({ category: e.target.value as FilmType["category"] })} className="!py-2">
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
          </Field>
          <Field label="Retail $ / sq ft" hint="Proposals"><MoneyInput value={f.pricePerSqft || null} onChange={(v) => set({ pricePerSqft: Number(v) || 0 })} placeholder="0.00" /></Field>
        </div>
        <Field label="Description" hint="Specs and warranty, for proposals"><Textarea value={f.description} onChange={(e) => set({ description: e.target.value })} /></Field>
        <Button size="lg" className="w-full" disabled={!f.name.trim()} onClick={save}>{type ? "Save film type" : "Add film type"}</Button>
        {type && (
          <button type="button" onClick={remove} className="flex w-full items-center justify-center gap-2 py-2 text-xs text-fg/40 hover:text-danger">
            <Trash2 size={13} /> Delete film type
          </button>
        )}
      </div>
    </Sheet>
  );
}

/** Film type overview: its rolls on the left, details and price on the right. */
export function FilmTypePage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { can } = useSession();
  const { types, rolls, leftOf } = useStock();
  const [sheet, setSheet] = useState<"edit" | "roll" | null>(null);
  const [q, setQ] = useState("");
  const type = types.find((t) => t.id === id);
  if (!type) {
    return <EmptyState icon={<Search size={32} />} title="Film type not found" actions={<Button variant="outline" onClick={() => nav("/admin/inventory/types")}>Catalog</Button>} />;
  }
  const mine = rolls.filter((r) => r.filmTypeId === type.id && (!q || (r.code ?? "").includes(q))).sort(byCode);
  const stocked = mine.filter(inStock);
  const sqft = stocked.reduce((s, r) => s + sqftOf(r.widthIn, leftOf(r)), 0);
  return (
    <div>
      <nav className="mb-2 flex items-center gap-1 text-sm text-fg/50">
        <Link to="/admin/inventory/types" className="hover:text-fg">Inventory</Link><ChevronRight size={14} className="text-fg/30" /><span>Film types</span>
      </nav>
      <PageHeader title={<><span className="font-bold">{type.brand}</span> <span className="font-normal">{type.name}</span></>}
        sub={`${stocked.length} roll${stocked.length === 1 ? "" : "s"} · ${Math.round(sqft)} sq ft in stock`}
        actions={can("inventory.manage") && <Button onClick={() => setSheet("roll")}><Plus size={16} /> Add roll</Button>} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="min-w-0">
          <CardHeader title="Rolls" actions={mine.length > 6 && <SearchInput value={q} onChange={setQ} placeholder="Code" className="w-32" />} />
          {mine.length ? (
            <div className="-mx-4 divide-y divide-fg/5 sm:-mx-5">
              {mine.map((r) => {
                const left = leftOf(r);
                return (
                  <Link key={r.id} to={`/admin/inventory/rolls/${r.id}`} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-fg/[.03] sm:px-5">
                    <span className="w-16 shrink-0 font-display font-semibold tabular-nums">{r.code ?? "—"}</span>
                    <span className="min-w-0 flex-1 truncate text-fg/55">{r.widthIn}" × {r.lengthFt} ft</span>
                    <RollBadges roll={r} left={left} />
                    <span className="w-20 shrink-0 text-right font-display tabular-nums">{Math.round(sqftOf(r.widthIn, left))} sq ft</span>
                  </Link>
                );
              })}
            </div>
          ) : <p className="text-sm text-fg/50">No rolls of this film yet.</p>}
        </Card>
        <Card>
          <CardHeader title="Film details" actions={can("inventory.manage") && <Button variant="ghost" size="sm" onClick={() => setSheet("edit")}><Pencil size={14} /> Edit</Button>} />
          <dl className="divide-y divide-fg/5">
            <KeyValue k="Price per sq ft">{type.pricePerSqft ? <span className="font-display tabular-nums text-success">{money(type.pricePerSqft, true)}</span> : <span className="text-fg/40">Not set</span>}</KeyValue>
            <KeyValue k="Brand">{type.brand || "—"}</KeyValue>
            <KeyValue k="Series">{type.series || "—"}</KeyValue>
            <KeyValue k="Name">{type.name}</KeyValue>
            <KeyValue k="VLT">{type.vlt != null ? `${type.vlt}%` : "—"}</KeyValue>
            <KeyValue k="Category"><Badge>{CATEGORIES.find((c) => c.id === type.category)?.label}</Badge></KeyValue>
            <KeyValue k="Description">{type.description ? <span className="whitespace-pre-wrap">{type.description}</span> : <span className="text-fg/40">None yet</span>}</KeyValue>
          </dl>
          {stocked.some((r) => rollHealth(r, leftOf(r)) !== "ok") && <p className="mt-3 text-xs text-warn">Some rolls of this film are running low.</p>}
        </Card>
      </div>
      <AnimatePresence>
        {sheet === "edit" && <TypeSheet key="edit" type={type} onClose={() => setSheet(null)} onDeleted={() => nav("/admin/inventory/types")} />}
        {sheet === "roll" && <RollForm key="roll" filmTypeId={type.id} onClose={() => setSheet(null)} onSaved={(r) => nav(`/admin/inventory/rolls/${r.id}`)} />}
      </AnimatePresence>
    </div>
  );
}
