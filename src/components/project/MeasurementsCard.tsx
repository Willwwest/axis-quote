import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ChevronRight, LayoutGrid, Pencil, Plus, Printer, Ruler, Trash2 } from "lucide-react";
import { CutOptimizer } from "../../admin/inventory/CutOptimizer";
import { PrintPortal, UnitInput, printLight } from "../../admin/inventory/shared";
import { CATEGORIES, itemLinearFt, itemSqft, seedFilmTypes, typeLabel } from "../../lib/film";
import { money } from "../../lib/format";
import { jobKindLabel, jobTitle } from "../../lib/project";
import { filmTypes, leads, newId } from "../../lib/store";
import type { FilmType, Lead, Measurement, Room } from "../../lib/types";
import { Badge, Button, Card, CardHeader, Chip, Field, IconButton, Input, MoneyInput, Select, Sheet, Textarea, Toggle, cx } from "../ui";

const KINDS: Measurement["type"][] = ["window", "door", "transom", "skylight", "sidelight", "wall", "other"];
const DIRS: NonNullable<Measurement["direction"]>[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const n2 = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const n1 = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

const isVehicle = (l: Lead) => l.kind === "vehicle" || (!l.kind && !!l.vehicle);

function totals(rooms: Room[], roundUp: boolean) {
  const live = rooms.filter((r) => r.approved);
  const items = live.flatMap((r) => r.items);
  return {
    sqft: items.reduce((s, m) => s + itemSqft(m, roundUp), 0),
    ln: items.reduce((s, m) => s + itemLinearFt(m), 0),
    panes: items.reduce((s, m) => s + m.qty, 0),
    price: items.reduce((s, m) => s + (m.price ?? 0), 0),
    rooms: live.length,
  };
}

/** Flat-glass rooms and window measurements: the work order, the proposal's scope and the cut optimizer's input. */
export function MeasurementsCard({ lead: initial }: { lead: Lead }) {
  const lead = leads.useOne(initial.id) ?? initial;
  const types = filmTypes.use();
  useEffect(seedFilmTypes, [types.length]);
  const [roundUp, setRoundUp] = useState(false);
  const [showLn, setShowLn] = useState(true);
  const [names, setNames] = useState("");
  const [roomFilm, setRoomFilm] = useState("");
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [item, setItem] = useState<{ roomId: string; m?: Measurement } | null>(null);
  const [roomEdit, setRoomEdit] = useState<Room | null>(null);
  const [optimizer, setOptimizer] = useState(false);
  if (isVehicle(lead)) return null;

  const rooms = lead.rooms ?? [];
  const t = totals(rooms, roundUp);
  const save = (fn: (rooms: Room[]) => Room[]) => leads.update(lead.id, (l) => ({ rooms: fn(l.rooms ?? []) }));
  const filmName = (id?: string) => { const f = types.find((x) => x.id === id); return f ? typeLabel(f) : ""; };

  const addRooms = () => {
    const list = names.split(",").map((s) => s.trim()).filter(Boolean);
    if (!list.length) return;
    save((rs) => [...rs, ...list.map((name) => ({ id: newId("RM"), name, filmTypeId: roomFilm || undefined, approved: true, items: [] }))]);
    setNames("");
  };
  const quickAdd = (roomId: string, m: Omit<Measurement, "id">) => save((rs) => rs.map((r) => (r.id === roomId ? { ...r, items: [...r.items, { ...m, id: newId("MS") }] } : r)));

  return (
    <Card>
      <CardHeader
        title="Measurements"
        icon={<Ruler size={16} />}
        sub={rooms.length ? `${n2(t.sqft)} sq ft · ${n1(t.ln)} ln ft · ${t.panes} pane${t.panes === 1 ? "" : "s"} · ${t.rooms} room${t.rooms === 1 ? "" : "s"}` : "Measure each window for exact pricing and cutting"}
        actions={rooms.length > 0 && <IconButton label="Print work sheet" onClick={() => printLight("worksheet")}><Printer size={16} /></IconButton>}
      />

      {!rooms.length && lead.home && (
        <p className="mb-3 rounded-xl bg-fg/[.04] px-3 py-2 text-xs text-fg/55">The instant quote estimated by pane size. Add rooms and measurements here for an exact work order and cut sheet.</p>
      )}

      <div className="space-y-3">
        {rooms.map((room) => {
          const live = room.items.reduce((s, m) => s + itemSqft(m, roundUp), 0);
          const isClosed = closed.has(room.id);
          return (
            <div key={room.id} className={cx("rounded-xl border", room.approved ? "border-fg/10" : "border-dashed border-fg/15")}>
              <div className="flex items-center gap-2 px-3 py-2.5">
                <button type="button" onClick={() => setClosed((s) => { const n = new Set(s); n.has(room.id) ? n.delete(room.id) : n.add(room.id); return n; })} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <ChevronRight size={15} className={cx("shrink-0 text-fg/35 transition", !isClosed && "rotate-90")} />
                  <span className={cx("truncate font-semibold", !room.approved && "text-fg/50")}>{room.name}</span>
                  {!room.approved && <Badge>Not approved</Badge>}
                  {room.filmTypeId && <span className="hidden truncate text-xs text-fg/45 sm:inline">{filmName(room.filmTypeId)}</span>}
                </button>
                <span className="shrink-0 font-display text-sm tabular-nums text-fg/60">{room.items.length ? `${n2(live)} sq ft` : "No items"}</span>
                <IconButton label={`Edit ${room.name}`} onClick={() => setRoomEdit(room)}><Pencil size={14} /></IconButton>
              </div>
              {!isClosed && (
                <div className="border-t border-fg/5">
                  {room.filmTypeId && <div className="px-3 pt-2 text-xs text-fg/45 sm:hidden">{filmName(room.filmTypeId)}</div>}
                  {room.items.map((m) => (
                    <button key={m.id} type="button" onClick={() => setItem({ roomId: room.id, m })} className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-fg/[.03]">
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          {cap(m.type)}
                          {m.direction && <Badge tone="info">{m.direction}</Badge>}
                          <span className="text-fg/45">×{m.qty}</span>
                        </span>
                        {(m.notes || m.filmTypeId || m.price) && (
                          <span className="block truncate text-xs text-fg/40">{[m.filmTypeId && filmName(m.filmTypeId), m.price ? money(m.price) : "", m.notes].filter(Boolean).join(" · ")}</span>
                        )}
                      </span>
                      <span className="shrink-0 text-right font-display tabular-nums">
                        <span className="block">{n1(m.w)} × {n1(m.h)}</span>
                        <span className="block text-xs text-fg/45">{n2(itemSqft(m, roundUp))} sq ft{showLn && ` · ${n1(itemLinearFt(m))} ln`}</span>
                      </span>
                    </button>
                  ))}
                  <QuickAdd onAdd={(m) => quickAdd(room.id, m)} onMore={() => setItem({ roomId: room.id })} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 rounded-xl border border-dashed border-fg/15 p-3">
        <Input value={names} onChange={(e) => setNames(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addRooms()} placeholder="Room name(s): Living Room, Kitchen" className="!py-2" aria-label="Room names" />
        <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
          <FilmSelect types={types} value={roomFilm} onChange={setRoomFilm} empty="Room film (optional)" />
          <Button size="sm" variant="outline" className="!h-auto py-2" disabled={!names.trim()} onClick={addRooms}><Plus size={14} /> Add room</Button>
        </div>
        <p className="mt-1.5 text-xs text-fg/40">Separate names with commas to add several at once.</p>
      </div>

      {rooms.some((r) => r.items.length) && (
        <>
          <div className="mt-3 grid gap-x-6 sm:grid-cols-2">
            <Toggle checked={roundUp} onChange={setRoundUp} label="Round up areas" hint="Each entry to the next whole sq ft" />
            <Toggle checked={showLn} onChange={setShowLn} label="Show linear feet" hint="Perimeter, 2 × (W + H) × qty" />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-fg/[.04] px-4 py-3">
            <div>
              <div className="font-display text-xl font-bold tabular-nums">{n2(t.sqft)} sq ft</div>
              <div className="text-xs text-fg/45">{showLn && `${n1(t.ln)} ln ft · `}{t.panes} panes in {t.rooms} approved room{t.rooms === 1 ? "" : "s"}{t.price ? ` · ${money(t.price)} itemized` : ""}</div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => printLight("worksheet")}><Printer size={14} /> Sheet</Button>
              <Button size="sm" onClick={() => setOptimizer(true)}><LayoutGrid size={14} /> Cut optimizer</Button>
            </div>
          </div>
        </>
      )}

      <WorkSheet lead={lead} types={types} roundUp={roundUp} showLn={showLn} />
      <AnimatePresence>
        {item && <ItemSheet key="item" lead={lead} roomId={item.roomId} item={item.m} types={types} roundUp={roundUp} onClose={() => setItem(null)} />}
        {roomEdit && <RoomSheet key="room" lead={lead} room={roomEdit} types={types} onClose={() => setRoomEdit(null)} />}
        {optimizer && <Sheet key="opt" title="Cut optimizer" wide onClose={() => setOptimizer(false)}><CutOptimizer lead={lead} /></Sheet>}
      </AnimatePresence>
    </Card>
  );
}

function FilmSelect({ types, value, onChange, empty }: { types: FilmType[]; value: string; onChange: (v: string) => void; empty: string }) {
  // Flat-glass films first: these are house jobs.
  const order = [...CATEGORIES].sort((a, b) => Number(b.id === "flat") - Number(a.id === "flat"));
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} className="!py-2 text-sm" aria-label="Film">
      <option value="">{empty}</option>
      {order.map((c) => {
        const list = types.filter((t) => t.category === c.id);
        return list.length ? <optgroup key={c.id} label={c.label}>{list.map((t) => <option key={t.id} value={t.id}>{typeLabel(t)}</option>)}</optgroup> : null;
      })}
    </Select>
  );
}

/** Fast entry on a ladder: width, height, qty, add. Type and the rest go in the full form. */
function QuickAdd({ onAdd, onMore }: { onAdd: (m: Omit<Measurement, "id">) => void; onMore: () => void }) {
  const [w, setW] = useState("");
  const [h, setH] = useState("");
  const [qty, setQty] = useState("1");
  const ok = Number(w) > 0 && Number(h) > 0 && Number(qty) > 0;
  const add = () => { if (!ok) return; onAdd({ type: "window", w: Number(w), h: Number(h), qty: Number(qty) }); setW(""); setH(""); setQty("1"); };
  return (
    <form className="grid grid-cols-[1fr_1fr_52px_auto] items-center gap-2 border-t border-fg/5 px-3 py-2.5" onSubmit={(e) => { e.preventDefault(); add(); }}>
      <Input type="number" inputMode="decimal" step="0.125" min={0} value={w} onChange={(e) => setW(e.target.value)} placeholder="W in" className="!px-3 !py-2" aria-label="Width in inches" />
      <Input type="number" inputMode="decimal" step="0.125" min={0} value={h} onChange={(e) => setH(e.target.value)} placeholder="H in" className="!px-3 !py-2" aria-label="Height in inches" />
      <Input type="number" inputMode="numeric" min={1} value={qty} onChange={(e) => setQty(e.target.value)} className="!px-2 !py-2 text-center" aria-label="Quantity" />
      <div className="flex">
        <IconButton label="Add window" type="submit" disabled={!ok} className="text-accent-fg"><Plus size={18} /></IconButton>
        <IconButton label="Add with details" onClick={onMore}><Pencil size={14} /></IconButton>
      </div>
    </form>
  );
}

function ItemSheet({ lead, roomId, item, types, roundUp, onClose }: { lead: Lead; roomId: string; item?: Measurement; types: FilmType[]; roundUp: boolean; onClose: () => void }) {
  const blank = (): Measurement => ({ id: newId("MS"), type: "window", qty: 1, w: 0, h: 0 });
  const [m, setM] = useState<Measurement>(item ?? blank());
  const set = (p: Partial<Measurement>) => setM((x) => ({ ...x, ...p }));
  const room = lead.rooms?.find((r) => r.id === roomId);
  const ok = m.w > 0 && m.h > 0 && m.qty > 0;
  const write = (rs: Room[], fn: (items: Measurement[]) => Measurement[]) => rs.map((r) => (r.id === roomId ? { ...r, items: fn(r.items) } : r));
  const save = (again = false) => {
    const clean = { ...m, notes: m.notes?.trim() || undefined };
    leads.update(lead.id, (l) => ({ rooms: write(l.rooms ?? [], (items) => (items.some((x) => x.id === m.id) ? items.map((x) => (x.id === m.id ? clean : x)) : [...items, clean])) }));
    if (again) setM({ ...blank(), type: m.type, direction: m.direction, filmTypeId: m.filmTypeId });
    else onClose();
  };
  const remove = () => { leads.update(lead.id, (l) => ({ rooms: write(l.rooms ?? [], (items) => items.filter((x) => x.id !== m.id)) })); onClose(); };

  return (
    <Sheet title={item ? "Edit measurement" : `New measurement · ${room?.name ?? ""}`} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Type">
          <div className="flex flex-wrap gap-2">{KINDS.map((k) => <Chip key={k} size="sm" selected={m.type === k} onClick={() => set({ type: k })}>{cap(k)}</Chip>)}</div>
        </Field>
        <Field label="Direction" hint="Which way the glass faces">
          <div className="flex flex-wrap gap-1.5">{DIRS.map((d) => <Chip key={d} size="sm" selected={m.direction === d} onClick={() => set({ direction: m.direction === d ? undefined : d })}>{d}</Chip>)}</div>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Panes"><Input type="number" inputMode="numeric" min={1} value={m.qty || ""} onChange={(e) => set({ qty: Number(e.target.value) })} className="!py-2" /></Field>
          <Field label="Width"><UnitInput unit="in" step="0.125" value={m.w || ""} onChange={(e) => set({ w: Number(e.target.value) })} autoFocus={!item} /></Field>
          <Field label="Height"><UnitInput unit="in" step="0.125" value={m.h || ""} onChange={(e) => set({ h: Number(e.target.value) })} /></Field>
        </div>
        <div className="flex justify-between rounded-xl bg-fg/[.04] px-4 py-2.5 text-sm">
          <span className="text-fg/55">Area</span>
          <span className="font-display tabular-nums">{ok ? `${n2(itemSqft(m, roundUp))} sq ft · ${n1(itemLinearFt(m))} ln ft` : "—"}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Film" hint="Optional"><FilmSelect types={types} value={m.filmTypeId ?? ""} onChange={(v) => set({ filmTypeId: v || undefined })} empty={room?.filmTypeId ? "Room's film" : "Not picked"} /></Field>
          <Field label="Price" hint="Optional"><MoneyInput value={m.price ?? null} onChange={(v) => set({ price: v === "" ? undefined : Number(v) })} /></Field>
        </div>
        <Field label="Notes / instructions" hint="Optional"><Textarea value={m.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} placeholder="Removal needed, tempered, ladder…" className="!min-h-[64px]" /></Field>
        <div className="grid grid-cols-2 gap-2">
          {!item && <Button variant="outline" disabled={!ok} onClick={() => save(true)}>Save & add another</Button>}
          <Button className={item ? "col-span-2" : undefined} disabled={!ok} onClick={() => save()}>Save measurement</Button>
        </div>
        {item && <button type="button" onClick={remove} className="flex w-full items-center justify-center gap-2 py-1 text-xs text-fg/40 hover:text-danger"><Trash2 size={13} /> Delete measurement</button>}
      </div>
    </Sheet>
  );
}

function RoomSheet({ lead, room, types, onClose }: { lead: Lead; room: Room; types: FilmType[]; onClose: () => void }) {
  const [r, setR] = useState(room);
  const save = () => { leads.update(lead.id, (l) => ({ rooms: (l.rooms ?? []).map((x) => (x.id === room.id ? { ...x, name: r.name.trim() || x.name, filmTypeId: r.filmTypeId, approved: r.approved } : x)) })); onClose(); };
  const remove = () => {
    if (!confirm(`Delete ${room.name} and its ${room.items.length} measurement${room.items.length === 1 ? "" : "s"}? Unapprove keeps it on file instead.`)) return;
    leads.update(lead.id, (l) => ({ rooms: (l.rooms ?? []).filter((x) => x.id !== room.id) }));
    onClose();
  };
  return (
    <Sheet title={`Edit ${room.name}`} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Room name"><Input value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} /></Field>
        <Field label="Room film" hint="Items can override it"><FilmSelect types={types} value={r.filmTypeId ?? ""} onChange={(v) => setR({ ...r, filmTypeId: v || undefined })} empty="Not picked" /></Field>
        <Toggle checked={r.approved} onChange={(v) => setR({ ...r, approved: v })} label="Approved" hint="Unapproved rooms stay on the sheet but are left out of totals, pricing and cutting." />
        <Button size="lg" className="w-full" onClick={save}>Save room</Button>
        <button type="button" onClick={remove} className="flex w-full items-center justify-center gap-2 py-1 text-xs text-fg/40 hover:text-danger"><Trash2 size={13} /> Delete room</button>
      </div>
    </Sheet>
  );
}

/** The printable project sheet the installer takes on site (Tint Wiz's "Sheet"). */
function WorkSheet({ lead, types, roundUp, showLn }: { lead: Lead; types: FilmType[]; roundUp: boolean; showLn: boolean }) {
  const rooms = lead.rooms ?? [];
  const t = totals(rooms, roundUp);
  const film = (id?: string) => { const f = types.find((x) => x.id === id); return f ? typeLabel(f) : "—"; };
  const th = "border-b border-fg/30 px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider";
  const td = "border-b border-fg/10 px-2 py-1.5 align-top";
  return (
    <PrintPortal name="worksheet">
      <div className="font-body text-[11px] leading-snug">
        <div className="mb-3 flex items-end justify-between gap-4 border-b-2 border-fg pb-2">
          <div>
            <div className="font-display text-lg font-bold">{lead.contact.name} · {jobTitle(lead)}</div>
            <div>{[lead.address, lead.city, lead.contact.phone].filter(Boolean).join(" · ")}</div>
          </div>
          <div className="text-right text-[10px]">Printed {new Date().toLocaleDateString()}</div>
        </div>
        <div className="mb-3 font-display text-sm font-semibold">
          {jobKindLabel(lead)} – Total: {n2(t.sqft)} sq ft{showLn && ` (${n1(t.ln)} ln ft)`} – {t.rooms} room{t.rooms === 1 ? "" : "s"} – {t.panes} pane{t.panes === 1 ? "" : "s"}
        </div>
        {rooms.map((room) => {
          const rt = totals([{ ...room, approved: true }], roundUp);
          return (
            <table key={room.id} className="mb-4 w-full border-collapse break-inside-avoid">
              <caption className="pb-1 text-left font-display text-[13px] font-semibold">
                {room.name}{!room.approved && " (not approved)"} – {room.items.length} item{room.items.length === 1 ? "" : "s"} ({rt.panes} panes)
              </caption>
              <thead><tr><th className={th}>Description</th><th className={th}>Film</th><th className={th}>Qty</th><th className={th}>Dims</th>{showLn && <th className={th}>Ln ft</th>}<th className={th}>Sq ft</th></tr></thead>
              <tbody>
                {room.items.map((m) => (
                  <tr key={m.id}>
                    <td className={td}>{cap(m.type)}{m.direction && ` (${m.direction})`}{m.notes && <div className="text-[10px] italic">{m.notes}</div>}</td>
                    <td className={td}>{film(m.filmTypeId ?? room.filmTypeId)}</td>
                    <td className={td}>{m.qty}</td>
                    <td className={td}>{n1(m.w)} × {n1(m.h)}</td>
                    {showLn && <td className={td}>{n1(itemLinearFt(m))}</td>}
                    <td className={td}>{n2(itemSqft(m, roundUp))}</td>
                  </tr>
                ))}
                <tr className="font-semibold"><td className={td} colSpan={4}>Room total</td>{showLn && <td className={td}>{n1(rt.ln)}</td>}<td className={td}>{n2(rt.sqft)}</td></tr>
              </tbody>
            </table>
          );
        })}
        <div className="flex justify-between border-t-2 border-fg pt-2 font-display text-sm font-bold">
          <span>Project total</span><span>{n2(t.sqft)} sq ft{showLn && ` · ${n1(t.ln)} ln ft`}</span>
        </div>
      </div>
    </PrintPortal>
  );
}
