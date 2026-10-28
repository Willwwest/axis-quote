import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Check, Pencil, Plus, Puzzle, Undo2 } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, Field, IconButton, Input, Select, Sheet, Toggle } from "../../components/ui";
import { rollTag, typeLabel } from "../../lib/film";
import { shortDate } from "../../lib/format";
import { leads, newId, remnants } from "../../lib/store";
import type { FilmType, Remnant } from "../../lib/types";
import { byCode, jobChoices, jobLabel, UnitInput, useStock } from "./shared";

/** Does a w×h piece fit this offcut, either way round? */
export const fitsRemnant = (r: Remnant, w: number, h: number) => (w <= r.widthIn && h <= r.lengthIn) || (h <= r.widthIn && w <= r.lengthIn);

export function remnantFilm(r: Remnant, types: FilmType[]) {
  const t = types.find((x) => x.id === r.filmTypeId);
  return t ? typeLabel(t) : r.name;
}

/** Offcuts worth keeping for small windows, and a finder for "anything that fits a 20×30?". */
export function RemnantsTab() {
  const { types } = useStock();
  const all = remnants.use();
  const [edit, setEdit] = useState<Remnant | "new" | null>(null);
  const [use, setUse] = useState<Remnant | null>(null);
  const [showUsed, setShowUsed] = useState(false);
  const [fw, setFw] = useState("");
  const [fh, setFh] = useState("");
  const [fType, setFType] = useState("");

  const w = Number(fw), h = Number(fh);
  const finding = w > 0 && h > 0;
  const open = all.filter((r) => !r.usedAt);
  const list = (showUsed ? all : open)
    .filter((r) => !finding || (!r.usedAt && fitsRemnant(r, w, h) && (!fType || r.filmTypeId === fType)))
    // Smallest piece that fits first, so big offcuts are saved for big windows.
    .sort((a, b) => (finding ? a.widthIn * a.lengthIn - b.widthIn * b.lengthIn : b.createdAt.localeCompare(a.createdAt)));
  const usedTypes = types.filter((t) => open.some((r) => r.filmTypeId === t.id));

  return (
    <div>
      <Card className="mb-4">
        <CardHeader title="Find a remnant" sub="Enter the piece you need; only offcuts big enough show up." icon={<Puzzle size={16} />} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[120px_120px_1fr]">
          <Field label="Width"><UnitInput unit="in" value={fw} onChange={(e) => setFw(e.target.value)} /></Field>
          <Field label="Height"><UnitInput unit="in" value={fh} onChange={(e) => setFh(e.target.value)} /></Field>
          <Field label="Film" className="col-span-2 sm:col-span-1">
            <Select value={fType} onChange={(e) => setFType(e.target.value)}>
              <option value="">Any film</option>
              {usedTypes.map((t) => <option key={t.id} value={t.id}>{typeLabel(t)}</option>)}
            </Select>
          </Field>
        </div>
      </Card>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="font-display text-lg font-semibold">{finding ? `${list.length} that fit${list.length === 1 ? "s" : ""}` : `${open.length} on the shelf`}</h2>
        <div className="flex-1" />
        {!finding && all.length > open.length && <div className="w-40"><Toggle checked={showUsed} onChange={setShowUsed} label="Show used" /></div>}
        <Button size="sm" variant="outline" onClick={() => setEdit("new")}><Plus size={14} /> Remnant</Button>
      </div>

      {!all.length ? (
        <EmptyState icon={<Puzzle size={32} />} title="No remnants yet" actions={<Button onClick={() => setEdit("new")}>Add a remnant</Button>}>
          Log usable offcuts with their size and where they're kept. Next time a small window comes up, the finder shows what fits.
        </EmptyState>
      ) : list.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((r) => {
            const job = leads.get(r.usedLeadId);
            return (
              <Card key={r.id} className={r.usedAt ? "opacity-60" : undefined}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{remnantFilm(r, types)}</div>
                    <div className="font-display text-2xl font-bold tabular-nums">{r.widthIn}" × {r.lengthIn}"</div>
                    <div className="text-xs text-fg/45">{r.location || "No location"} · {shortDate(r.createdAt)}</div>
                  </div>
                  <IconButton label="Edit remnant" onClick={() => setEdit(r)}><Pencil size={15} /></IconButton>
                </div>
                {r.usedAt ? (
                  <div className="mt-3 flex items-center gap-2 text-xs text-fg/50">
                    <Badge tone="success">Used {shortDate(r.usedAt)}</Badge>
                    {job && <Link to={`/admin/jobs/${job.id}`} className="truncate hover:text-fg">{job.contact.name}</Link>}
                    <IconButton label="Put back on the shelf" onClick={() => remnants.update(r.id, { usedAt: undefined, usedLeadId: undefined })}><Undo2 size={14} /></IconButton>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => setUse(r)}><Check size={14} /> Used it</Button>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-fg/15 px-4 py-10 text-center text-sm text-fg/50">{finding ? "Nothing on the shelf is big enough. Cut it from a roll." : "No remnants on the shelf."}</p>
      )}

      <AnimatePresence>
        {edit && <RemnantSheet key="edit" remnant={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} />}
        {use && <UseSheet key="use" remnant={use} onClose={() => setUse(null)} />}
      </AnimatePresence>
    </div>
  );
}

export function RemnantSheet({ remnant, preset, onClose }: { remnant?: Remnant; preset?: Partial<Remnant>; onClose: () => void }) {
  const { rolls, types } = useStock();
  const [f, setF] = useState<Remnant>(remnant ?? { id: newId("RM"), name: "", widthIn: 0, lengthIn: 0, location: "", createdAt: new Date().toISOString(), ...preset });
  const set = (p: Partial<Remnant>) => setF((x) => ({ ...x, ...p }));
  const pickRoll = (id: string) => {
    const r = rolls.find((x) => x.id === id);
    set({ rollId: id || undefined, filmTypeId: r?.filmTypeId ?? f.filmTypeId, name: r ? r.name : f.name });
  };
  const valid = f.widthIn > 0 && f.lengthIn > 0 && (f.filmTypeId || f.name.trim());
  const save = () => {
    const t = types.find((x) => x.id === f.filmTypeId);
    remnants.save({ ...f, name: f.name.trim() || (t ? typeLabel(t) : "") });
    onClose();
  };
  return (
    <Sheet title={remnant ? "Edit remnant" : "Add a remnant"} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Cut from roll" hint="Optional">
          <Select value={f.rollId ?? ""} onChange={(e) => pickRoll(e.target.value)}>
            <option value="">Not sure / no roll</option>
            {[...rolls].sort(byCode).map((r) => <option key={r.id} value={r.id}>{rollTag(r)}</option>)}
          </Select>
        </Field>
        <Field label="Film">
          <Select value={f.filmTypeId ?? ""} onChange={(e) => set({ filmTypeId: e.target.value || undefined })}>
            <option value="">Not in the catalog</option>
            {types.map((t) => <option key={t.id} value={t.id}>{typeLabel(t)}</option>)}
          </Select>
        </Field>
        {!f.filmTypeId && <Field label="Film name"><Input value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ceramic 20%" /></Field>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Width"><UnitInput unit="in" value={f.widthIn || ""} onChange={(e) => set({ widthIn: Number(e.target.value) })} /></Field>
          <Field label="Length"><UnitInput unit="in" value={f.lengthIn || ""} onChange={(e) => set({ lengthIn: Number(e.target.value) })} /></Field>
        </div>
        <Field label="Where it's kept"><Input value={f.location} onChange={(e) => set({ location: e.target.value })} placeholder="Van, bin B" /></Field>
        <Button size="lg" className="w-full" disabled={!valid} onClick={save}>{remnant ? "Save" : "Add remnant"}</Button>
        {remnant && (
          <button type="button" onClick={() => { if (confirm("Delete this remnant?")) { remnants.remove(remnant.id); onClose(); } }} className="w-full py-2 text-xs text-fg/40 hover:text-danger">
            Delete remnant
          </button>
        )}
      </div>
    </Sheet>
  );
}

export function UseSheet({ remnant, leadId, onClose }: { remnant: Remnant; leadId?: string; onClose: () => void }) {
  const all = leads.use();
  const [job, setJob] = useState(leadId ?? "");
  return (
    <Sheet title={`Use ${remnant.widthIn}" × ${remnant.lengthIn}"`} onClose={onClose}>
      <div className="space-y-4">
        <Field label="On which job?" hint="Optional">
          <Select value={job} onChange={(e) => setJob(e.target.value)}>
            <option value="">No job</option>
            {jobChoices(all).map((l) => <option key={l.id} value={l.id}>{jobLabel(l)}</option>)}
          </Select>
        </Field>
        <Button size="lg" className="w-full" onClick={() => { remnants.update(remnant.id, { usedAt: new Date().toISOString(), usedLeadId: job || undefined }); onClose(); }}>
          <Check size={18} /> Mark used
        </Button>
      </div>
    </Sheet>
  );
}
