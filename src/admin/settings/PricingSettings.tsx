import { useState } from "react";
import { BODY_TYPES, REGIONS, ZONES, type BodyType, type Settings, type Zone } from "../../data/config";
import { Field, MoneyInput, Segmented, Table, Td } from "../../components/ui";
import { zoneLabel } from "../../lib/pricing";
import { getSettings, saveSettings, useSettings } from "../../lib/store";

export function PricingSettings() {
  const settings = useSettings();
  const [body, setBody] = useState<BodyType>("sedan");
  const patch = (fn: (s: Settings) => Settings) => saveSettings(fn(structuredClone(getSettings())));
  const setCell = (zone: Zone, film: "carbon" | "ceramic", value: string) =>
    patch((s) => { s.prices[body][zone][film] = value === "" ? null : Number(value); return s; });
  const sample = { body, ymm: "", paint: "", zones: [], film: "ceramic" as const, frontVlt: 35, rearVlt: 20, removal: false };

  return (
    <div className="max-w-4xl">
      <p className="mb-6 text-sm text-fg/50">Changes go live in the customer app immediately. Leave a cell blank to hide that option.</p>
      <div className="mb-4">
        <Segmented value={body} onChange={setBody} options={BODY_TYPES.map((b) => ({ value: b.id, label: b.label.split(" ")[0] }))} />
      </div>
      <Table head={["Window", "Carbon", "Ceramic"]}>
        {ZONES.map((z) => (
          <tr key={z.id}>
            <Td>{zoneLabel(z.id, sample)}</Td>
            {(["carbon", "ceramic"] as const).map((f) => (
              <Td key={f}>
                {z.id === "windshield" && f === "carbon" ? <span className="text-fg/30">Ceramic only</span> : (
                  <MoneyInput value={settings.prices[body][z.id][f]} onChange={(v) => setCell(z.id, f, v)} />
                )}
              </Td>
            ))}
          </tr>
        ))}
      </Table>

      <h3 className="mb-3 mt-10 font-display text-lg font-semibold">Extras & residential</h3>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Old tint removal"><MoneyInput value={settings.removalFee} onChange={(v) => patch((s) => ({ ...s, removalFee: Number(v) || 0 }))} /></Field>
        <Field label="Referral credit"><MoneyInput value={settings.referralCredit} onChange={(v) => patch((s) => ({ ...s, referralCredit: Number(v) || 0 }))} /></Field>
        <Field label="Residential minimum"><MoneyInput value={settings.homeMinimum} onChange={(v) => patch((s) => ({ ...s, homeMinimum: Number(v) || 0 }))} /></Field>
        <Field label="Ultra View · per sq ft"><MoneyInput value={settings.homeRatePerSqft.ultraview} onChange={(v) => patch((s) => ({ ...s, homeRatePerSqft: { ...s.homeRatePerSqft, ultraview: Number(v) || 0 } }))} /></Field>
        <Field label="Pristine · per sq ft"><MoneyInput value={settings.homeRatePerSqft.pristine} onChange={(v) => patch((s) => ({ ...s, homeRatePerSqft: { ...s.homeRatePerSqft, pristine: Number(v) || 0 } }))} /></Field>
      </div>
      <h3 className="mb-3 mt-10 font-display text-lg font-semibold">Travel fee by area</h3>
      <div className="grid gap-4 sm:grid-cols-3">
        {REGIONS.map((r) => (
          <Field key={r.id} label={r.label}><MoneyInput value={settings.travelFee[r.id]} onChange={(v) => patch((s) => ({ ...s, travelFee: { ...s.travelFee, [r.id]: Number(v) || 0 } }))} /></Field>
        ))}
      </div>
    </div>
  );
}
