import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Bookmark, LayoutGrid, Layers, Plus, Scissors, X } from "lucide-react";
import { CutOptimizer } from "../../admin/inventory/CutOptimizer";
import { LogCut } from "../../admin/inventory/LogCut";
import { byCode, UnitInput, UseRow, useStock } from "../../admin/inventory/shared";
import {
  costOf, feet, inStock, jobNeeds, needInches, rollMatches, rollTag, suggestRoll, takeOff, type FilmNeed,
} from "../../lib/film";
import { money } from "../../lib/format";
import { useSession } from "../../lib/session";
import { leads, rolls as rollStore } from "../../lib/store";
import type { FilmRoll, Lead } from "../../lib/types";
import { Badge, Button, Card, CardHeader, IconButton, Select, Sheet } from "../ui";

type Pick = { rollId: string; ft: string | null };

/**
 * Film for a job: what it needs per film and shade, which roll to pull from (reserved ones first),
 * a one-tap deduction, and what's been taken off so far with its cost.
 */
export function FilmCard({ lead: initial }: { lead: Lead }) {
  const lead = leads.useOne(initial.id) ?? initial;
  const { rolls, log, types, settings, leftOf } = useStock();
  const { can } = useSession();
  // Room needs read film names from the catalog, so recompute when it changes.
  const needs = useMemo(() => jobNeeds(lead), [lead, types]);
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [sheet, setSheet] = useState<"cut" | "optimizer" | null>(null);
  const waste = settings.filmWastePct;
  const canLog = can("inventory");
  const manage = can("inventory.manage");

  const stock = rolls.filter((r) => inStock(r) && leftOf(r) > 0).sort(byCode);
  const logged = log.filter((u) => u.leadId === lead.id).sort((a, b) => b.date.localeCompare(a.date));
  const used = logged.filter((u) => u.inches !== 0);
  const rollOf = (id: string) => rolls.find((r) => r.id === id);
  const cost = used.reduce((s, u) => s + costOf(rollOf(u.rollId), u.inches), 0);
  const uncosted = used.some((u) => !rollOf(u.rollId)?.cost);
  const reserved = rolls.filter((r) => r.reservedLeadId === lead.id).sort(byCode);

  const pickFor = (n: FilmNeed): Pick => picks[n.key] ?? { rollId: suggestRoll(n, rolls, log, lead.id, types)?.id ?? "", ft: null };
  const ftFor = (n: FilmNeed) => {
    const p = pickFor(n);
    const roll = rollOf(p.rollId);
    return p.ft ?? (roll ? (needInches(n, roll, waste) / 12).toFixed(1) : "");
  };
  const setPick = (n: FilmNeed, patch: Partial<Pick>) => setPicks((s) => ({ ...s, [n.key]: { ...pickFor(n), ...patch } }));
  const ready = needs.filter((n) => pickFor(n).rollId && Number(ftFor(n)) > 0);

  const deduct = () => {
    takeOff(...ready.map((n) => ({
      rollId: pickFor(n).rollId, inches: Math.round(Number(ftFor(n)) * 12), source: "job" as const, label: `${lead.contact.name} · ${n.label}`, leadId: lead.id,
    })));
    setPicks({});
  };

  const flat = needs.some((n) => n.cut);

  return (
    <Card>
      <CardHeader
        title="Film"
        icon={<Layers size={16} />}
        sub={used.length ? `${feet(used.reduce((s, u) => s + u.inches, 0))} used${cost ? ` · ${money(cost, true)} of film${uncosted ? "+" : ""}` : ""}` : "Takes this job's film off your rolls so stock stays right"}
        actions={canLog && stock.length > 0 && <Button variant="ghost" size="sm" onClick={() => setSheet("cut")}><Scissors size={14} /> Log a cut</Button>}
      />

      {!rolls.length ? (
        <p className="rounded-xl bg-fg/[.04] px-4 py-3 text-sm text-fg/60">
          No rolls in stock yet. Add them under <Link to="/admin/inventory/rolls" className="underline underline-offset-2 hover:text-fg">Inventory</Link>.
        </p>
      ) : !used.length && needs.length > 0 && canLog ? (
        <>
          <div className="space-y-2">
            {needs.map((n) => {
              const p = pickFor(n);
              const roll = rollOf(p.rollId);
              const matching = stock.filter((r) => rollMatches(n, r, types));
              const others = stock.filter((r) => !matching.includes(r));
              const ftNow = Number(ftFor(n)) || 0;
              return (
                <div key={n.key} className="rounded-xl border border-fg/10 p-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{n.film}{n.vlt != null && !n.filmTypeId && ` ${n.vlt}%`}</div>
                      <div className="text-xs text-fg/45">{n.label}</div>
                    </div>
                    {roll?.reservedLeadId === lead.id && <Badge tone="accent" icon={<Bookmark size={11} />}>Reserved</Badge>}
                    {!matching.length && <Badge tone="warn">None in stock</Badge>}
                  </div>
                  <div className="mt-2 grid grid-cols-[1fr_104px] gap-2">
                    <Select value={p.rollId} onChange={(e) => setPick(n, { rollId: e.target.value, ft: null })} className="!py-2 text-sm" aria-label={`Roll for ${n.film}`}>
                      <option value="">Not from stock</option>
                      {matching.length > 0 && <optgroup label="Matching film">{matching.map((r) => <RollOption key={r.id} roll={r} left={leftOf(r)} />)}</optgroup>}
                      {others.length > 0 && <optgroup label="Other rolls">{others.map((r) => <RollOption key={r.id} roll={r} left={leftOf(r)} />)}</optgroup>}
                    </Select>
                    <UnitInput unit="ft" step="0.5" value={ftFor(n)} disabled={!p.rollId} onChange={(e) => setPick(n, { ft: e.target.value })} className="[&_input]:!py-2" aria-label="Feet used" />
                  </div>
                  {roll && (
                    <div className="mt-1.5 text-xs text-fg/40">
                      {n.cut ? `Cut layout on the ${roll.widthIn}" roll, trim included` : n.pieces ? `Typical cuts + ${waste}% waste on ${roll.widthIn}"` : `Area + ${waste}% waste on ${roll.widthIn}"`}
                      {roll.cost ? ` · ${money(costOf(roll, ftNow * 12), true)} of film` : ""}
                      {leftOf(roll) < ftNow * 12 && <span className="text-warn"> · only {feet(leftOf(roll))} left</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" className="flex-1" disabled={!ready.length} onClick={deduct}><Scissors size={16} /> Take it off the rolls</Button>
            {flat && <Button variant="ghost" onClick={() => setSheet("optimizer")}><LayoutGrid size={16} /> Cut sheet</Button>}
          </div>
        </>
      ) : !used.length ? (
        <p className="text-sm text-fg/50">{needs.length ? "Nothing taken off a roll for this job yet." : "Nothing logged yet. Log cuts as film comes off a roll."}</p>
      ) : null}

      {logged.length > 0 && (
        <div className="-mx-4 mt-3 divide-y divide-fg/5 border-t border-fg/10 sm:-mx-5">
          {logged.map((u) => {
            const r = rollOf(u.rollId);
            return <UseRow key={u.id} use={{ ...u, leadId: undefined }} roll={r} showRoll extra={r?.cost && u.inches > 0 ? <span>{money(costOf(r, u.inches), true)}</span> : undefined} />;
          })}
        </div>
      )}
      {used.length > 0 && canLog && stock.length > 0 && (
        <button type="button" onClick={() => setSheet("cut")} className="mt-3 flex items-center gap-1.5 text-sm text-fg/60 hover:text-fg"><Plus size={15} /> Log another cut</button>
      )}

      {(reserved.length > 0 || (manage && stock.length > 0 && lead.status !== "paid" && lead.status !== "lost")) && (
        <div className="mt-4 border-t border-fg/10 pt-3">
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-fg/45">Reserved for this job</div>
          {reserved.map((r) => (
            <div key={r.id} className="flex items-center gap-2 py-1 text-sm">
              <Bookmark size={14} className="shrink-0 text-accent-fg" />
              <Link to={`/admin/inventory/rolls/${r.id}`} className="min-w-0 flex-1 truncate hover:underline">{rollTag(r)}</Link>
              <span className="shrink-0 text-xs tabular-nums text-fg/45">{r.widthIn}" · {feet(Math.max(0, leftOf(r)))}</span>
              {manage && <IconButton label="Release reservation" onClick={() => rollStore.update(r.id, { reservedLeadId: undefined })}><X size={14} /></IconButton>}
            </div>
          ))}
          {manage && (
            <Select value="" onChange={(e) => e.target.value && rollStore.update(e.target.value, { reservedLeadId: lead.id })} className="mt-1 !py-2 text-sm" aria-label="Reserve a roll">
              <option value="">Reserve a roll…</option>
              {stock.filter((r) => !r.reservedLeadId).sort((a, b) => Number(needs.some((n) => rollMatches(n, b, types))) - Number(needs.some((n) => rollMatches(n, a, types)))).map((r) => (
                <RollOption key={r.id} roll={r} left={leftOf(r)} />
              ))}
            </Select>
          )}
        </div>
      )}

      <AnimatePresence>
        {sheet === "cut" && <LogCut key="cut" lead={lead} onClose={() => setSheet(null)} />}
        {sheet === "optimizer" && <Sheet key="opt" title="Cut optimizer" wide onClose={() => setSheet(null)}><CutOptimizer lead={lead} /></Sheet>}
      </AnimatePresence>
    </Card>
  );
}

const RollOption = ({ roll, left }: { roll: FilmRoll; left: number }) => (
  <option value={roll.id}>{rollTag(roll)} · {roll.widthIn}" · {feet(Math.max(0, left))} left</option>
);
