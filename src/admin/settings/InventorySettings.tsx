import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Layers, Tag } from "lucide-react";
import { Card, CardHeader, Field, PageHeader, Toggle } from "../../components/ui";
import { UnitInput } from "../inventory/shared";
import { patchSettings, useSettings } from "../../lib/store";

export function InventorySettings() {
  const s = useSettings();
  const inv = (p: Partial<typeof s.inventory>) => patchSettings((x) => ({ inventory: { ...x.inventory, ...p } }));
  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader title="Inventory" sub="Film estimates, roll labels and the stock forecast." />

      <Card>
        <CardHeader title="Estimates" icon={<Layers size={16} />} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Waste allowance" hint="added to estimates">
            <NumField unit="%" value={s.filmWastePct} min={0} max={100} onCommit={(n) => patchSettings({ filmWastePct: n })} />
          </Field>
          <Field label="Forecast window" hint="days ahead">
            <NumField unit="days" value={s.inventory.forecastDays} min={1} max={90} onCommit={(n) => inv({ forecastDays: n })} />
          </Field>
        </div>
        <p className="mt-3 text-xs text-fg/45">
          Waste covers trimming, mistakes and recuts on estimates from typical cut sizes or square feet. Measured jobs laid out by the cut optimizer already include their trim.
          The forecast compares booked installs in this window with what's on the shelf.
        </p>
      </Card>

      <Card>
        <CardHeader title="Roll labels" icon={<Tag size={16} />} />
        <Toggle checked={s.inventory.largeLabels} onChange={(v) => inv({ largeLabels: v })}
          label="Use large labels" hint={s.inventory.largeLabels ? '2.4" × 3.9" (62 × 100 mm)' : 'Standard 1.1" × 3.5" (29 × 90 mm). Turn on for 2.4" × 3.9" (62 × 100 mm).'} />
        <p className="mt-1 text-xs text-fg/45">Changes what's printed from now on, not labels already on rolls. Print a test label after switching.</p>
      </Card>

      <Card className="!p-0">
        <Link to="/admin/inventory/types" className="flex items-center gap-3 p-4 hover:bg-fg/[.03] sm:p-5">
          <div className="min-w-0 flex-1">
            <div className="font-display font-semibold">Film catalog</div>
            <div className="text-xs text-fg/45">Brands, shades and retail $ per sq ft for proposals</div>
          </div>
          <ChevronRight size={16} className="text-fg/35" />
        </Link>
      </Card>
    </div>
  );
}

/** Saves while typing whenever the number is in range; a blank or bad entry snaps back on blur. */
function NumField({ value, min, max, unit, onCommit }: { value: number; min: number; max: number; unit: string; onCommit: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <UnitInput unit={unit} min={min} max={max} value={text} onBlur={() => setText(String(value))}
      onChange={(e) => {
        setText(e.target.value);
        const n = Math.round(Number(e.target.value));
        if (e.target.value !== "" && n >= min && n <= max) onCommit(n);
      }} />
  );
}
