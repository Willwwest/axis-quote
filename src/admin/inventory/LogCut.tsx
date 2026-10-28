import { useState } from "react";
import { Car, Plus, Ruler, Scale, Scissors, X } from "lucide-react";
import { BODY_TYPES, FULL_VEHICLE, REAR_SIDE_LABEL, ZONES, type BodyType, type Zone } from "../../data/config";
import { Button, Chip, Field, IconButton, Input, Segmented, Select, Sheet } from "../../components/ui";
import { feet, pullInches, rollTag, takeOff, vehiclePieces, weighInches } from "../../lib/film";
import { leads, useSettings } from "../../lib/store";
import type { FilmUseSource, Lead } from "../../lib/types";
import { byCode, jobChoices, jobLabel, UnitInput, useStock } from "./shared";

type Mode = "vehicle" | "measure" | "manual" | "weigh";
type Row = { w: string; h: string; qty: string };

const zoneName = (z: (typeof ZONES)[number], body: BodyType) => (z.id === "rearSides" ? REAR_SIDE_LABEL[body] : z.label);

/** Log film pulled off a roll: by car, by cut sizes, in plain feet, or by weighing what's left. */
export function LogCut({ rollId, lead, onClose }: { rollId?: string; lead?: Lead; onClose: () => void }) {
  const { rolls, leftOf } = useStock();
  const allLeads = leads.use();
  const { filmWastePct: waste } = useSettings();
  const choices = [...rolls].filter((r) => r.status !== "lost" || r.id === rollId).sort(byCode);
  const [pick, setPick] = useState(rollId ?? choices.find((r) => leftOf(r) > 0)?.id ?? choices[0]?.id ?? "");
  const [mode, setMode] = useState<Mode>(lead?.vehicle || !lead ? "vehicle" : "measure");
  const [body, setBody] = useState<BodyType>(lead?.vehicle?.body ?? "sedan");
  const [zones, setZones] = useState<Zone[]>(lead?.vehicle?.zones ?? FULL_VEHICLE);
  const [rows, setRows] = useState<Row[]>([{ w: "", h: "", qty: "1" }]);
  const [manual, setManual] = useState("");
  const [weight, setWeight] = useState("");
  const [leadId, setLeadId] = useState(lead?.id ?? "");
  const [note, setNote] = useState("");

  const roll = rolls.find((r) => r.id === pick);
  const left = roll ? leftOf(roll) : 0;
  const pieces = rows.map((r) => ({ w: Number(r.w), h: Number(r.h), qty: Number(r.qty) }));
  const weighed = roll ? weighInches(roll, Number(weight)) : null;
  const inches = !roll ? 0
    : mode === "vehicle" ? pullInches(vehiclePieces(body, zones), roll.widthIn, waste)
    : mode === "measure" ? pullInches(pieces, roll.widthIn, waste)
    : mode === "weigh" ? (weight && weighed != null ? left - weighed : 0)
    : Math.round((Number(manual) || 0) * 12);

  const describe = () => {
    if (mode === "vehicle") return `${BODY_TYPES.find((b) => b.id === body)!.label} · ${ZONES.filter((z) => zones.includes(z.id)).map((z) => zoneName(z, body)).join(", ")}`;
    if (mode === "measure") {
      const n = pieces.reduce((s, p) => s + (p.w > 0 && p.h > 0 ? p.qty : 0), 0);
      return `${n} measured cut${n === 1 ? "" : "s"}`;
    }
    if (mode === "weigh") return `Weighed ${weight} lb → ${feet(weighed ?? 0)} on the roll`;
    return "Logged in feet";
  };
  const save = () => {
    const job = allLeads.find((l) => l.id === leadId);
    const who = note.trim() || job?.contact.name || "";
    const source: FilmUseSource = mode === "weigh" ? "weigh" : mode;
    takeOff({ rollId: pick, inches, source, label: who ? `${who} · ${describe()}` : describe(), leadId: leadId || undefined });
    onClose();
  };
  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, n) => (n === i ? { ...r, ...patch } : r)));
  const canWeigh = !!roll?.fullWeightLb;

  return (
    <Sheet title="Log a cut" onClose={onClose}>
      <div className="space-y-5">
        <Field label="Roll">
          <Select value={pick} onChange={(e) => setPick(e.target.value)}>
            {choices.map((r) => <option key={r.id} value={r.id}>{rollTag(r)} · {r.widthIn}" · {feet(Math.max(0, leftOf(r)))} left</option>)}
          </Select>
        </Field>

        <Segmented value={mode} onChange={setMode} size="sm" options={[
          { value: "vehicle", label: <span className="flex items-center gap-1.5"><Car size={14} /> By car</span> },
          { value: "measure", label: <span className="flex items-center gap-1.5"><Ruler size={14} /> Measured</span> },
          { value: "manual", label: "Feet" },
          { value: "weigh", label: <span className="flex items-center gap-1.5"><Scale size={14} /> Weigh</span> },
        ]} />

        {mode === "vehicle" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {BODY_TYPES.map((b) => <Chip key={b.id} size="sm" selected={body === b.id} onClick={() => setBody(b.id)}>{b.label}</Chip>)}
            </div>
            <div>
              <div className="mb-1.5 text-sm font-medium text-fg/80">Windows from this roll</div>
              <div className="flex flex-wrap gap-2">
                {ZONES.map((z) => (
                  <Chip key={z.id} size="sm" selected={zones.includes(z.id)} onClick={() => setZones((s) => (s.includes(z.id) ? s.filter((x) => x !== z.id) : [...s, z.id]))}>
                    {zoneName(z, body)}
                  </Chip>
                ))}
              </div>
              <p className="mt-2 text-xs text-fg/40">Fronts at a different shade? Untick them here and log them on their own roll.</p>
            </div>
          </div>
        )}

        {mode === "measure" && (
          <div>
            <div className="mb-1.5 grid grid-cols-[1fr_1fr_64px_36px] gap-2 text-xs text-fg/45"><span>Width (in)</span><span>Height (in)</span><span>Qty</span><span /></div>
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_64px_36px] items-center gap-2">
                  <Input type="number" inputMode="decimal" min={0} value={r.w} onChange={(e) => setRow(i, { w: e.target.value })} className="!px-3 !py-2" aria-label="Width in inches" />
                  <Input type="number" inputMode="decimal" min={0} value={r.h} onChange={(e) => setRow(i, { h: e.target.value })} className="!px-3 !py-2" aria-label="Height in inches" />
                  <Input type="number" inputMode="numeric" min={1} value={r.qty} onChange={(e) => setRow(i, { qty: e.target.value })} className="!px-3 !py-2" aria-label="Quantity" />
                  <IconButton label="Remove cut" disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((_, n) => n !== i))}><X size={15} /></IconButton>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setRows((rs) => [...rs, { w: "", h: "", qty: "1" }])} className="mt-3 flex items-center gap-1.5 text-sm text-fg/60 hover:text-fg"><Plus size={15} /> Add a cut</button>
          </div>
        )}

        {mode === "manual" && (
          <Field label="Feet pulled off the roll"><UnitInput unit="ft" step="0.5" value={manual} onChange={(e) => setManual(e.target.value)} autoFocus /></Field>
        )}

        {mode === "weigh" && (canWeigh ? (
          <Field label="Roll weighs now" hint={`Core ${roll!.coreWeightLb ?? 0} lb · full ${roll!.fullWeightLb} lb`}>
            <UnitInput unit="lb" step="0.001" value={weight} onChange={(e) => setWeight(e.target.value)} autoFocus placeholder="0.000" />
          </Field>
        ) : (
          <p className="rounded-xl bg-fg/[.04] px-4 py-3 text-sm text-fg/60">Add this roll's core and full weight (Edit roll) to work out what's left from the scale.</p>
        ))}

        {!lead && (
          <Field label="Job" hint="Optional">
            <Select value={leadId} onChange={(e) => setLeadId(e.target.value)}>
              <option value="">No job</option>
              {jobChoices(allLeads).map((l) => <option key={l.id} value={l.id}>{jobLabel(l)}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Note" hint="Optional"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={lead ? lead.contact.name : "Customer or car, e.g. 2022 Tacoma"} /></Field>

        {roll && (
          <div className="rounded-2xl border border-fg/10 bg-fg/[.03] p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-fg/60">{inches < 0 ? "Puts back on" : "Comes off"} {roll.code ?? roll.name}</span>
              <span className="font-display text-2xl font-bold tabular-nums">{feet(Math.abs(inches))}</span>
            </div>
            <div className="mt-1 text-xs text-fg/40">
              {(mode === "vehicle" || mode === "measure") && `Includes ${waste}% waste on a ${roll.widthIn}" roll · `}{feet(Math.max(0, left - inches))} left after
            </div>
            {left - inches < 0 && <p className="mt-2 text-xs text-warn">That's more than this roll has. Log what came off it, then log the rest on the next roll.</p>}
          </div>
        )}

        <Button size="lg" className="w-full" disabled={!roll || (mode === "weigh" ? !weight || weighed == null || inches === 0 : inches <= 0)} onClick={save}>
          <Scissors size={18} /> {mode === "weigh" ? "Update from the scale" : "Take it off the roll"}
        </Button>
      </div>
    </Sheet>
  );
}
