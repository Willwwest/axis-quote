import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Layers, Scissors } from "lucide-react";
import { Button, Card, EmptyState, SearchInput, Segmented, Select, Progress } from "../../components/ui";
import { feet, rollHealth, sqftOf, typeLabel } from "../../lib/film";
import { leads } from "../../lib/store";
import type { FilmRoll } from "../../lib/types";
import { byCode, RollBadges, useStock } from "./shared";

type Filter = "active" | "in" | "out" | "low" | "lost";

export function RollsTab({ onCut, onAdd }: { onCut: (rollId: string) => void; onAdd?: () => void }) {
  const { rolls, types, leftOf } = useStock();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<Filter>("active");
  const [typeId, setTypeId] = useState("");
  const q = params.get("q") ?? "";
  const setQ = (v: string) => setParams(v ? { q: v } : {}, { replace: true });

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rolls.filter((r) => {
      const s = r.status ?? "in";
      if (filter === "lost" ? s !== "lost" : s === "lost") return false;
      if (filter === "in" && s !== "in") return false;
      if (filter === "out" && s !== "out") return false;
      if (filter === "low" && rollHealth(r, leftOf(r)) === "ok") return false;
      if (typeId && r.filmTypeId !== typeId) return false;
      return !needle || `${r.code ?? ""} ${r.name} ${r.lot} ${r.widthIn}"`.toLowerCase().includes(needle);
    }).sort(byCode);
  }, [rolls, filter, typeId, q, leftOf]);

  if (!rolls.length) {
    return (
      <EmptyState icon={<Layers size={36} />} title="No rolls yet" actions={onAdd && <Button onClick={onAdd}>Add your first roll</Button>}>
        Each roll gets a code and a QR label, so the crew can scan it and log cuts in seconds.
      </EmptyState>
    );
  }

  const usedTypes = types.filter((t) => rolls.some((r) => r.filmTypeId === t.id));
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Code, film, lot…" className="w-full sm:w-64" />
        <Segmented size="sm" value={filter} onChange={setFilter} options={[
          { value: "active", label: "All" }, { value: "in", label: "In" }, { value: "out", label: "Out" }, { value: "low", label: "Low" }, { value: "lost", label: "Lost" },
        ]} />
        {usedTypes.length > 1 && (
          <Select value={typeId} onChange={(e) => setTypeId(e.target.value)} className="!w-auto !py-2 text-sm" aria-label="Film type">
            <option value="">Every film</option>
            {usedTypes.map((t) => <option key={t.id} value={t.id}>{typeLabel(t)}</option>)}
          </Select>
        )}
      </div>
      {list.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((r) => <RollCard key={r.id} roll={r} left={leftOf(r)} onCut={() => onCut(r.id)} />)}
        </div>
      ) : <p className="rounded-2xl border border-dashed border-fg/15 px-4 py-10 text-center text-sm text-fg/50">No rolls match.</p>}
    </div>
  );
}

export function RollCard({ roll, left, onCut }: { roll: FilmRoll; left: number; onCut?: () => void }) {
  const health = rollHealth(roll, left);
  const pct = (Math.max(0, left) / (roll.lengthFt * 12)) * 100;
  const job = leads.get(roll.reservedLeadId);
  return (
    <Card tone={roll.status === "lost" ? undefined : health === "low" ? "warn" : health === "empty" ? "danger" : undefined} className="flex flex-col">
      <Link to={`/admin/inventory/rolls/${roll.id}`} className="-m-1 block flex-1 rounded-xl p-1 transition hover:bg-fg/[.03]">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="font-display text-xs font-semibold tabular-nums tracking-wider text-fg/45">{roll.code ?? "No code"}</div>
            <div className="truncate font-semibold">{roll.name}</div>
            <div className="text-xs text-fg/45">{roll.widthIn}" × {roll.lengthFt} ft{roll.lot && ` · Lot ${roll.lot}`}</div>
          </div>
          <RollBadges roll={roll} left={left} />
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="font-display text-3xl font-bold tabular-nums">{feet(Math.max(0, left))}</span>
          <span className="text-sm text-fg/40">· {Math.round(sqftOf(roll.widthIn, left))} sq ft</span>
        </div>
        <Progress value={pct} tone={health === "ok" ? "success" : health === "low" ? "warn" : "danger"} className="mt-2" />
        {job && <div className="mt-2 truncate text-xs text-accent-fg">For {job.contact.name}</div>}
      </Link>
      {onCut && roll.status !== "lost" && (
        <Button variant="outline" size="sm" className="mt-4 w-full" onClick={onCut} disabled={left <= 0}><Scissors size={14} /> Log a cut</Button>
      )}
    </Card>
  );
}
