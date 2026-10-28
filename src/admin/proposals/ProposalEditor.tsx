import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Copy, Eye, Pencil, Plus, Ruler, Star, Trash2, X } from "lucide-react";
import { Badge, Button, Chip, Field, IconButton, Input, MoneyInput, Segmented, Select, Sheet, Textarea, Toggle, cx } from "../../components/ui";
import { money } from "../../lib/format";
import { Markdown, MD_HINT } from "../../lib/markdown";
import { filmTypes, newId, useSettings } from "../../lib/store";
import type { FilmType, Lead, ProposalOption, QuoteLine, Room, ServiceLine } from "../../lib/types";
import { Menu } from "../jobs/Menu";
import { addonPrice, filmName, newOption, optionBefore, optionPrice, roomItems, roomSqft } from "./logic";

export interface ProposalDraft {
  options: ProposalOption[];
  addons: ServiceLine[];
  selectTogether: boolean;
  notes: string;
  depositPct: number;
}

const num = (v: string) => (v === "" ? 0 : Number(v) || 0);

function MarkdownField({ label, value, onChange, placeholder, rows = 4 }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  const [preview, setPreview] = useState(false);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-fg/80">{label}</span>
        <button type="button" onClick={() => setPreview(!preview)} className="flex items-center gap-1 text-xs text-fg/50 hover:text-fg">
          {preview ? <><Pencil size={12} /> Edit</> : <><Eye size={12} /> Preview</>}
        </button>
      </div>
      {preview ? (
        <div className="min-h-[96px] rounded-xl border border-fg/10 bg-fg/[.02] px-4 py-3">{value.trim() ? <Markdown text={value} /> : <span className="text-sm text-fg/30">Nothing yet</span>}</div>
      ) : (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} />
      )}
      <p className="mt-1 text-[11px] text-fg/35">{MD_HINT}</p>
    </div>
  );
}

function LinesEditor({ lines, onChange }: { lines: QuoteLine[]; onChange: (l: QuoteLine[]) => void }) {
  const set = (i: number, patch: Partial<QuoteLine>) => onChange(lines.map((l, n) => (n === i ? { ...l, ...patch } : l)));
  return (
    <div className="space-y-2">
      {lines.map((l, i) => (
        <div key={i} className="rounded-xl border border-fg/10 bg-fg/[.02] p-2">
          <div className="flex items-center gap-2">
            <Input value={l.label} onChange={(e) => set(i, { label: e.target.value })} placeholder="Line item" aria-label="Line item" className="!py-2" />
            <MoneyInput value={l.amount} onChange={(v) => set(i, { amount: num(v) })} className="w-28 shrink-0" />
            <IconButton label="Remove line" onClick={() => onChange(lines.filter((_, n) => n !== i))}><X size={16} /></IconButton>
          </div>
          <Input value={l.note ?? ""} onChange={(e) => set(i, { note: e.target.value || undefined })} placeholder="Note (film, shade, sq ft…)" aria-label="Line note" className="mt-1.5 !py-1.5 text-sm" />
        </div>
      ))}
      <Button size="sm" variant="ghost" onClick={() => onChange([...lines, { label: "", amount: 0 }])}><Plus size={14} /> Add line</Button>
    </div>
  );
}

function OptionEditor({ option, index, count, lead, types, onChange, onMove, onDuplicate, onRemove }: {
  option: ProposalOption; index: number; count: number; lead?: Lead; types: FilmType[];
  onChange: (o: ProposalOption) => void; onMove: (d: -1 | 1) => void; onDuplicate: () => void; onRemove: () => void;
}) {
  const set = (patch: Partial<ProposalOption>) => onChange({ ...option, ...patch });
  const rooms: Room[] = (lead?.rooms ?? []).filter((r) => r.items.length);
  const film = types.find((t) => t.id === option.filmTypeId);
  const scope = option.roomIds?.length ? rooms.filter((r) => option.roomIds!.includes(r.id)) : rooms.filter((r) => r.approved !== false);
  const scopeSqft = scope.reduce((s, r) => s + roomSqft(r), 0);
  const before = optionBefore(option), price = optionPrice(option);

  const pickFilm = (id: string) => {
    const f = types.find((t) => t.id === id);
    set({ filmTypeId: id || undefined, ...(f && !option.description.trim() ? { description: f.description } : {}), ...(f && !option.title.trim() ? { title: filmName(f) } : {}) });
  };
  const toggleRoom = (id: string) => {
    const cur = option.roomIds ?? [];
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    set({ roomIds: next.length ? next : undefined });
  };
  const priceFromScope = () => {
    if (!film) return;
    set({ lines: scope.map((r) => ({ label: r.name || "Room", amount: Math.round(roomSqft(r) * film.pricePerSqft * 100) / 100, note: `${roomItems(r)} items · ~${Math.round(roomSqft(r))} sq ft · ${filmName(film)}` })) });
  };

  return (
    <div className={cx("rounded-2xl border p-4", option.recommended ? "border-accent/40 bg-accent/[.04]" : "border-fg/10")}>
      <div className="mb-3 flex items-center gap-2">
        <span className="font-display text-xs font-semibold uppercase tracking-[.2em] text-fg/45">Option {index + 1}</span>
        {option.recommended && <Badge tone="accent" icon={<Star size={11} />}>Recommended</Badge>}
        <div className="flex-1" />
        <span className="text-right font-display tabular-nums">
          {option.discountPct > 0 && <span className="mr-1.5 text-sm text-fg/35 line-through">{money(before)}</span>}
          <span className="font-semibold">{money(price)}</span>
        </span>
        <Menu label="Option actions" items={[
          { label: option.recommended ? "Not recommended" : "Mark recommended", icon: <Star size={15} />, onSelect: () => set({ recommended: !option.recommended }) },
          index > 0 && { label: "Move up", icon: <ArrowUp size={15} />, onSelect: () => onMove(-1) },
          index < count - 1 && { label: "Move down", icon: <ArrowDown size={15} />, onSelect: () => onMove(1) },
          { label: "Duplicate", icon: <Copy size={15} />, onSelect: onDuplicate },
          { label: "Delete option", icon: <Trash2 size={15} />, onSelect: onRemove, danger: true, divide: true },
        ]} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title"><Input value={option.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Better · Ceramic" className="!py-2.5" /></Field>
        {types.length > 0 ? (
          <Field label="Film">
            <Select value={option.filmTypeId ?? ""} onChange={(e) => pickFilm(e.target.value)} className="!py-2.5">
              <option value="">No specific film</option>
              {types.map((t) => <option key={t.id} value={t.id}>{filmName(t)}{t.pricePerSqft ? ` · $${t.pricePerSqft}/sq ft` : ""}</option>)}
            </Select>
          </Field>
        ) : <div className="hidden sm:block" />}
      </div>

      <div className="mt-3">
        <MarkdownField label="Description" value={option.description} onChange={(description) => set({ description })} placeholder="What makes this option worth it…" rows={3} />
      </div>

      {rooms.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-fg/80"><Ruler size={14} className="text-fg/45" /> Scope</div>
          <div className="flex flex-wrap gap-1.5">
            <Chip size="sm" selected={!option.roomIds?.length} onClick={() => set({ roomIds: undefined })}>Whole job</Chip>
            {rooms.map((r) => <Chip key={r.id} size="sm" selected={!!option.roomIds?.includes(r.id)} onClick={() => toggleRoom(r.id)}>{r.name || "Room"} · {Math.round(roomSqft(r))} sq ft</Chip>)}
          </div>
          {film && film.pricePerSqft > 0 && scopeSqft > 0 && (
            <button type="button" onClick={priceFromScope} className="mt-2 text-xs text-accent-fg hover:underline">
              Price from scope: {Math.round(scopeSqft)} sq ft × ${film.pricePerSqft} = {money(scopeSqft * film.pricePerSqft)}
            </button>
          )}
        </div>
      )}

      <div className="mt-4">
        <div className="mb-1.5 text-sm font-medium text-fg/80">What's included</div>
        <LinesEditor lines={option.lines} onChange={(lines) => set({ lines })} />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <span className="text-sm text-fg/60">Discount</span>
        <div className="relative w-24">
          <Input type="number" inputMode="decimal" min={0} max={100} value={option.discountPct || ""} onChange={(e) => set({ discountPct: Math.min(100, Math.max(0, num(e.target.value))) })} placeholder="0" className="!py-2 pr-7 tabular-nums" aria-label="Discount percent" />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-fg/40">%</span>
        </div>
        {option.discountPct > 0 && <span className="text-xs text-success">Saves {money(before - price)}</span>}
      </div>
    </div>
  );
}

function AddonsEditor({ addons, onChange }: { addons: ServiceLine[]; onChange: (a: ServiceLine[]) => void }) {
  const set = (i: number, patch: Partial<ServiceLine>) => onChange(addons.map((a, n) => (n === i ? { ...a, ...patch } : a)));
  return (
    <div className="space-y-2">
      {addons.map((a, i) => (
        <div key={a.id} className="flex items-center gap-2">
          <Input value={a.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="e.g. Sunroof, PPF door edges" aria-label="Add-on" className="!py-2" />
          <MoneyInput value={a.price} onChange={(v) => set(i, { price: num(v) })} className="w-28 shrink-0" />
          <IconButton label="Remove add-on" onClick={() => onChange(addons.filter((_, n) => n !== i))}><X size={16} /></IconButton>
        </div>
      ))}
      <Button size="sm" variant="ghost" onClick={() => onChange([...addons, { id: newId("S"), name: "", price: 0, qty: 1 }])}><Plus size={14} /> Add-on</Button>
    </div>
  );
}

/** The whole builder: options, add-ons, deposit and notes. Expiry / naming live in the wrapping sheet. */
export function ProposalEditor({ draft, onChange, lead }: { draft: ProposalDraft; onChange: (d: ProposalDraft) => void; lead?: Lead }) {
  const settings = useSettings();
  const allTypes = filmTypes.use();
  const types = useMemo(() => {
    const want = lead?.kind === "vehicle" ? ["auto", "ppf", "other"] : lead ? ["flat", "other"] : null;
    const list = want ? allTypes.filter((t) => want.includes(t.category)) : allTypes;
    return list.length ? list : allTypes;
  }, [allTypes, lead]);
  const set = (patch: Partial<ProposalDraft>) => onChange({ ...draft, ...patch });
  const setOption = (i: number, o: ProposalOption) => {
    // Only one option can be the recommended one.
    const turnedOn = o.recommended && !draft.options[i].recommended;
    set({ options: draft.options.map((x, n) => (n === i ? o : turnedOn ? { ...x, recommended: false } : x)) });
  };
  const move = (i: number, d: -1 | 1) => {
    const next = [...draft.options];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    set({ options: next });
  };
  const deposits = [...new Set([...settings.proposals.depositOptions, draft.depositPct])].sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        {draft.options.map((o, i) => (
          <OptionEditor key={o.id} option={o} index={i} count={draft.options.length} lead={lead} types={types}
            onChange={(next) => setOption(i, next)} onMove={(d) => move(i, d)}
            onDuplicate={() => set({ options: [...draft.options.slice(0, i + 1), { ...structuredClone(o), id: newId("O"), title: `${o.title} (copy)`, recommended: false }, ...draft.options.slice(i + 1)] })}
            onRemove={() => set({ options: draft.options.filter((_, n) => n !== i) })} />
        ))}
        <Button variant="outline" className="w-full border-dashed" onClick={() => set({ options: [...draft.options, newOption(`Option ${draft.options.length + 1}`)] })}><Plus size={16} /> Add option</Button>
        <Toggle checked={draft.selectTogether} onChange={(selectTogether) => set({ selectTogether })}
          label="Let the customer pick more than one" hint="For combos like tint + windshield, or one option per room." />
      </section>

      <section>
        <h3 className="mb-1 font-display font-semibold">Add-ons</h3>
        <p className="mb-2 text-xs text-fg/45">Optional extras the customer can tick on top of their option.</p>
        <AddonsEditor addons={draft.addons} onChange={(addons) => set({ addons })} />
      </section>

      <section>
        <div className="mb-1.5 text-sm font-medium text-fg/80">Deposit due on approval</div>
        <Segmented size="sm" value={draft.depositPct} onChange={(depositPct) => set({ depositPct })} options={deposits.map((d) => ({ value: d, label: d ? `${d}%` : "None" }))} />
      </section>

      <MarkdownField label="Notes to the customer" value={draft.notes} onChange={(notes) => set({ notes })} placeholder="Intro, what's included, how long it takes…" />
    </div>
  );
}

/** Running total shown in the sheet footer. */
export function draftSummary(d: ProposalDraft) {
  const prices = d.options.map(optionPrice);
  const addons = d.addons.reduce((s, a) => s + addonPrice(a), 0);
  return { count: d.options.length, lo: prices.length ? Math.min(...prices) : 0, hi: prices.length ? Math.max(...prices) : 0, addons };
}

export function EditorSheet({ title, onClose, onSave, children, footer }: { title: string; onClose: () => void; onSave: () => void; children: ReactNode; footer?: ReactNode }) {
  return (
    <Sheet title={title} onClose={onClose} wide>
      {children}
      <div className="sticky -bottom-6 -mx-6 mt-6 flex items-center gap-3 border-t border-fg/10 bg-surface px-6 py-4">
        <div className="min-w-0 flex-1 text-sm text-fg/55">{footer}</div>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={onSave}>Save</Button>
      </div>
    </Sheet>
  );
}
