import { useMemo, useState } from "react";
import { ROLL_WIDTHS } from "../../data/config";
import { Button, Chip, Field, Input, MoneyInput, Select, Sheet, Textarea } from "../../components/ui";
import { CATEGORIES, claimCode, codeIssue, feet, inchesLeft, peekCode, takeOff, typeLabel } from "../../lib/film";
import { useSession } from "../../lib/session";
import { filmLog, filmTypes, newId, notes, rolls } from "../../lib/store";
import type { FilmRoll } from "../../lib/types";
import { UnitInput } from "./shared";

const num = (s: string) => (s.trim() === "" ? undefined : Number(s));

/** Create Roll / Edit Roll. Film comes from the catalog, or a free name for anything not in it. */
export function RollForm({ roll, filmTypeId, onClose, onSaved }: { roll?: FilmRoll; filmTypeId?: string; onClose: () => void; onSaved?: (r: FilmRoll) => void }) {
  const { user } = useSession();
  const all = rolls.use();
  const types = filmTypes.use();
  // Peeked, not taken: a cancelled form shouldn't burn a number.
  const auto = useMemo(() => peekCode(all), []);
  const [typeId, setTypeId] = useState(roll ? roll.filmTypeId ?? (roll.name ? "other" : "") : filmTypeId ?? "");
  const [name, setName] = useState(roll?.filmTypeId ? "" : roll?.name ?? "");
  const [vlt, setVlt] = useState(roll?.vlt?.toString() ?? "");
  const [code, setCode] = useState(roll?.code ?? auto);
  const [width, setWidth] = useState(roll?.widthIn ?? 60);
  const [length, setLength] = useState(String(roll?.lengthFt ?? 100));
  const [lowFt, setLowFt] = useState(String(roll?.lowFt ?? 15));
  const [lot, setLot] = useState(roll?.lot ?? "");
  const [cost, setCost] = useState(roll?.cost?.toString() ?? "");
  const [core, setCore] = useState(roll?.coreWeightLb?.toString() ?? "");
  const [fullWt, setFullWt] = useState(roll?.fullWeightLb?.toString() ?? "");
  const [note, setNote] = useState("");
  const [actual, setActual] = useState("");

  const type = types.find((t) => t.id === typeId);
  const issue = codeIssue(code.trim(), all, roll?.id);
  const filmName = type ? typeLabel(type) : name.trim();
  const valid = !!filmName && !issue && width > 0 && Number(length) > 0;
  const current = roll ? inchesLeft(roll, filmLog.all()) : 0;

  const save = () => {
    // "Ceramic 20%" already says the shade, so don't make the crew type it twice.
    const shade = type ? type.vlt : vlt !== "" ? Number(vlt) : Number(name.match(/(\d{1,2})\s*%?\s*$/)?.[1] ?? NaN);
    const next: FilmRoll = {
      ...roll,
      id: roll?.id ?? newId("R"),
      name: filmName,
      vlt: shade != null && Number.isFinite(shade) ? shade : null,
      filmTypeId: type?.id,
      code: code.trim(),
      widthIn: width,
      lengthFt: Number(length),
      lowFt: Number(lowFt) || 0,
      lot: lot.trim(),
      cost: num(cost),
      coreWeightLb: num(core),
      fullWeightLb: num(fullWt),
      addedAt: roll?.addedAt ?? new Date().toISOString(),
      status: roll?.status ?? "in",
    };
    rolls.save(next);
    if (!roll) claimCode(next.code!);
    if (note.trim()) notes.save({ id: newId("NT"), rollId: next.id, body: note.trim(), authorId: user?.id, createdAt: new Date().toISOString(), replies: [] });
    if (roll && actual !== "") {
      const diff = inchesLeft(next, filmLog.all()) - Math.round(Number(actual) * 12);
      if (diff) takeOff({ rollId: next.id, inches: diff, source: "adjust", label: `Measured what's left: ${actual} ft` });
    }
    onSaved?.(next);
    onClose();
  };

  return (
    <Sheet title={roll ? `Edit roll ${roll.code ?? ""}` : "Add a roll"} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Film type">
          <Select value={typeId} onChange={(e) => setTypeId(e.target.value)} autoFocus={!roll}>
            <option value="">Pick a film…</option>
            {CATEGORIES.map((c) => {
              const list = types.filter((t) => t.category === c.id);
              return list.length ? (
                <optgroup key={c.id} label={c.label}>
                  {list.map((t) => <option key={t.id} value={t.id}>{typeLabel(t)}</option>)}
                </optgroup>
              ) : null;
            })}
            <option value="other">Not in the catalog…</option>
          </Select>
        </Field>
        {typeId === "other" && (
          <div className="grid grid-cols-[1fr_96px] gap-3">
            <Field label="Film name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ceramic 20%" /></Field>
            <Field label="Shade %"><Input type="number" min={0} max={100} value={vlt} onChange={(e) => setVlt(e.target.value)} placeholder="20" /></Field>
          </div>
        )}

        <Field label="Inventory code" hint={issue ?? (roll ? "On the label" : "Next in sequence; edit if you like")}>
          <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))} maxLength={10} className="font-display tabular-nums tracking-wider" aria-invalid={!!issue} />
        </Field>

        <Field label="Roll width" hint="inches">
          <div className="flex flex-wrap gap-2">
            {ROLL_WIDTHS.map((w) => <Chip key={w} size="sm" selected={width === w} onClick={() => setWidth(w)}>{w}"</Chip>)}
          </div>
          <Input type="number" min={1} value={width || ""} onChange={(e) => setWidth(Number(e.target.value))} className="mt-2 !py-2" placeholder="Other width" aria-label="Width in inches" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Roll length"><UnitInput unit="ft" value={length} onChange={(e) => setLength(e.target.value)} /></Field>
          <Field label="Warn me at" hint="ft left"><UnitInput unit="ft" value={lowFt} onChange={(e) => setLowFt(e.target.value)} /></Field>
          <Field label="Roll cost" hint="Optional"><MoneyInput value={cost === "" ? null : Number(cost)} onChange={setCost} placeholder="0.00" /></Field>
          <Field label="Lot #" hint="Warranty"><Input value={lot} onChange={(e) => setLot(e.target.value)} className="!py-2" /></Field>
          <Field label="Core weight" hint="for the scale"><UnitInput unit="lb" step="0.001" value={core} onChange={(e) => setCore(e.target.value)} placeholder="0.000" /></Field>
          <Field label="Full weight" hint="as received"><UnitInput unit="lb" step="0.001" value={fullWt} onChange={(e) => setFullWt(e.target.value)} placeholder="0.000" /></Field>
        </div>
        {roll ? (
          <Field label="Actually left on the roll" hint={`App says ${feet(current)}`}>
            <UnitInput unit="ft" step="0.5" value={actual} onChange={(e) => setActual(e.target.value)} placeholder="If you measured it" />
          </Field>
        ) : (
          <Field label="Notes" hint="Optional"><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Any extra details on this roll" className="!min-h-[64px]" /></Field>
        )}
        <Button size="lg" className="w-full" disabled={!valid} onClick={save}>{roll ? "Save roll" : "Add roll"}</Button>
      </div>
    </Sheet>
  );
}
