import { useState, type ReactNode } from "react";
import { AnimatePresence } from "framer-motion";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChevronRight, CircleAlert, ListTodo, LogIn, LogOut, Pencil, Printer, Scale, Scissors, Search, Trash2 } from "lucide-react";
import {
  Badge, Button, Card, CardHeader, EmptyState, Field, IconButton, KeyValue, PageHeader, Progress, Select, Sheet, Tabs, Textarea, Toggle,
} from "../../components/ui";
import {
  costOf, costPerSqft, feet, fullInches, ftNum, rollHealth, rollTag, sedansLeft, sqftOf, takeOff, typeLabel, weighInches,
} from "../../lib/film";
import { money, relative } from "../../lib/format";
import { personName, useSession } from "../../lib/session";
import { deleteRoll, leads, newId, notes, rolls } from "../../lib/store";
import type { FilmRoll } from "../../lib/types";
import { usePrintLabels } from "./Labels";
import { LogCut } from "./LogCut";
import { RollForm } from "./RollForm";
import { jobChoices, jobLabel, RollBadges, STATUS_META, UnitInput, UseRow, useStock, when } from "./shared";

type SheetKind = "cut" | "check" | "weigh" | "edit" | null;

export function RollPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { can } = useSession();
  const manage = can("inventory.manage");
  const { rolls: all, log, types, settings, leftOf } = useStock();
  const allLeads = leads.use();
  const [sheet, setSheet] = useState<SheetKind>(params.get("cut") ? "cut" : null);
  const [tab, setTab] = useState<"summary" | "advanced">("summary");
  const labels = usePrintLabels();
  const roll = all.find((r) => r.id === id);

  if (!roll) {
    return (
      <EmptyState icon={<Search size={32} />} title="Roll not found" actions={<Button variant="outline" onClick={() => nav("/admin/inventory/rolls")}>All rolls</Button>}>
        It may have been deleted.
      </EmptyState>
    );
  }

  const left = leftOf(roll);
  const full = fullInches(roll);
  const pct = full ? (Math.max(0, left) / full) * 100 : 0;
  const type = types.find((t) => t.id === roll.filmTypeId);
  const status = roll.status ?? "in";
  const health = rollHealth(roll, left);
  const history = log.filter((u) => u.rollId === roll.id).sort((a, b) => b.date.localeCompare(a.date));
  const reserved = allLeads.find((l) => l.id === roll.reservedLeadId);
  const perSqft = costPerSqft(roll);

  const markLost = () => {
    if (!confirm(`Mark ${rollTag(roll)} as lost? It stays on record but leaves stock until it's checked in again.`)) return;
    rolls.update(roll.id, { status: "lost" });
    takeOff({ rollId: roll.id, inches: 0, source: "adjust", label: "Marked lost" });
  };
  const remove = () => {
    if (!confirm(`Delete ${rollTag(roll)} and its whole history? Marking it lost keeps the record instead.`)) return;
    deleteRoll(roll.id);
    notes.all().filter((n) => n.rollId === roll.id).forEach((n) => notes.remove(n.id));
    nav("/admin/inventory/rolls");
  };

  return (
    <div>
      <nav className="mb-2 flex flex-wrap items-center gap-1 text-sm text-fg/50">
        <Link to="/admin/inventory/rolls" className="hover:text-fg">Inventory</Link>
        <ChevronRight size={14} className="text-fg/30" />
        {type ? <Link to={`/admin/inventory/types/${type.id}`} className="hover:text-fg">{typeLabel(type)}</Link> : <span>{roll.name}</span>}
      </nav>
      <PageHeader
        title={
          <span className="flex flex-wrap items-baseline gap-x-3">
            <span className="tabular-nums">{roll.code ?? "No code"}</span>
            <span className="text-lg font-normal text-fg/45 sm:text-xl">{roll.widthIn} × {roll.lengthFt} ({ftNum(Math.max(0, left))}) ft</span>
          </span>
        }
        sub={<span className="inline-flex flex-wrap items-center gap-2">{roll.name} <RollBadges roll={roll} left={left} /></span>}
        actions={
          <>
            <Button variant="outline" onClick={() => setSheet("cut")} disabled={status === "lost"}><Scissors size={16} /> Log a cut</Button>
            <Button onClick={() => setSheet("check")}>{status === "in" ? <><LogOut size={16} /> Check out</> : <><LogIn size={16} /> Check in</>}</Button>
          </>
        }
      />

      <Card className="mb-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-display text-2xl font-bold tabular-nums">{Math.round(sqftOf(roll.widthIn, left)).toLocaleString()} sq ft <span className="text-base font-medium text-fg/45">left</span></span>
          <span className="font-display tabular-nums text-fg/60">{pct.toFixed(2)}%</span>
        </div>
        <Progress value={pct} tone={health === "ok" ? "success" : health === "low" ? "warn" : "danger"} className="mt-3 h-3" />
        <div className="mt-2 text-xs text-fg/45">
          {feet(Math.max(0, left))} of {roll.lengthFt} ft
          {type?.category !== "flat" && health !== "empty" && ` · ≈ ${sedansLeft(roll, left, settings.filmWastePct)} full sedans`}
          {health === "low" && ` · warns at ${roll.lowFt} ft`}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <Card>
            <div className="-mt-1 flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1"><Tabs value={tab} onChange={setTab} tabs={[{ id: "summary", label: "Summary" }, { id: "advanced", label: "Advanced" }]} /></div>
              {manage && <Button variant="ghost" size="sm" onClick={() => setSheet("edit")}><Pencil size={14} /> Edit roll</Button>}
            </div>
            <dl className="-mt-2 divide-y divide-fg/5">
              {tab === "summary" ? (
                <>
                  <KeyValue k="Status">{STATUS_META[status].long}</KeyValue>
                  <KeyValue k="Roll width"><Num>{roll.widthIn}</Num> in</KeyValue>
                  <KeyValue k="Full length"><Num>{roll.lengthFt}</Num> ft</KeyValue>
                  <KeyValue k="Current length"><Num>{ftNum(Math.max(0, left), 2)}</Num> ft</KeyValue>
                  <KeyValue k="Sq ft full"><Num>{dec(sqftOf(roll.widthIn, full))}</Num> sq ft</KeyValue>
                  <KeyValue k="Sq ft left"><Num>{dec(sqftOf(roll.widthIn, left))}</Num> sq ft</KeyValue>
                  <KeyValue k="Roll cost">{roll.cost ? <Num>{money(roll.cost, true)}</Num> : <span className="text-fg/40">Not set</span>}</KeyValue>
                  <KeyValue k="Cost per sq ft">{perSqft ? <Num>{money(perSqft, true)}</Num> : <span className="text-fg/40">Set a roll cost</span>}</KeyValue>
                  {roll.cost ? <KeyValue k="Value left"><Num>{money(costOf(roll, Math.max(0, left)))}</Num></KeyValue> : null}
                </>
              ) : (
                <>
                  <KeyValue k="Code"><Num>{roll.code ?? "—"}</Num></KeyValue>
                  <KeyValue k="Film type">{type ? <Link to={`/admin/inventory/types/${type.id}`} className="underline-offset-2 hover:underline">{typeLabel(type)}</Link> : <span className="text-fg/50">{roll.name} (not in catalog)</span>}</KeyValue>
                  <KeyValue k="Shade">{roll.vlt != null ? `${roll.vlt}%` : "—"}</KeyValue>
                  <KeyValue k="Lot #">{roll.lot || "—"}</KeyValue>
                  <KeyValue k="Core weight">{roll.coreWeightLb != null ? `${roll.coreWeightLb} lb` : "—"}</KeyValue>
                  <KeyValue k="Full weight">{roll.fullWeightLb != null ? `${roll.fullWeightLb} lb` : "—"}</KeyValue>
                  <KeyValue k="Low alert">{roll.lowFt} ft</KeyValue>
                  <KeyValue k="Added">{when(roll.addedAt)}</KeyValue>
                </>
              )}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Update history" sub={history.length ? `${history.length} entr${history.length === 1 ? "y" : "ies"}` : undefined} />
            {history.length ? (
              <div className="-mx-4 divide-y divide-fg/5 sm:-mx-5">{history.map((u) => <UseRow key={u.id} use={u} />)}</div>
            ) : <p className="text-sm text-fg/50">Nothing logged yet. Cuts, check-ins and weigh-ins show up here.</p>}
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader title="Options" />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => setSheet("weigh")} disabled={status === "lost"}><Scale size={14} /> Weigh</Button>
              <Button variant="outline" size="sm" onClick={() => labels.print([{ roll, left }])} disabled={!roll.code}><Printer size={14} /> Print label</Button>
            </div>
            <Field label="Reserved for" className="mt-4">
              <Select value={roll.reservedLeadId ?? ""} disabled={!manage} onChange={(e) => rolls.update(roll.id, { reservedLeadId: e.target.value || undefined })} className="!py-2">
                <option value="">Not reserved</option>
                {jobChoices(allLeads).filter((l) => l.status !== "lost" && l.status !== "paid").map((l) => <option key={l.id} value={l.id}>{jobLabel(l)}</option>)}
              </Select>
            </Field>
            {reserved && <Link to={`/admin/jobs/${reserved.id}`} className="mt-1.5 block text-xs text-fg/50 underline-offset-2 hover:text-fg hover:underline">Open {reserved.contact.name}'s job</Link>}
            <div className="mt-4 text-xs text-fg/40">Added {when(roll.addedAt)}</div>
            {manage && (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-fg/10 pt-3">
                <Button variant="danger" size="sm" onClick={remove}><Trash2 size={14} /> Delete</Button>
                {status === "lost"
                  ? <Button variant="outline" size="sm" onClick={() => setSheet("check")}><LogIn size={14} /> Found it</Button>
                  : <Button variant="outline" size="sm" onClick={markLost}><CircleAlert size={14} /> Mark lost</Button>}
              </div>
            )}
          </Card>
          <RollNotes roll={roll} />
        </div>
      </div>

      <AnimatePresence>
        {sheet === "cut" && <LogCut key="cut" rollId={roll.id} onClose={() => setSheet(null)} />}
        {sheet === "check" && <CheckSheet key="check" roll={roll} left={left} onClose={() => setSheet(null)} />}
        {sheet === "weigh" && <WeighSheet key="weigh" roll={roll} left={left} onClose={() => setSheet(null)} />}
        {sheet === "edit" && <RollForm key="edit" roll={roll} onClose={() => setSheet(null)} />}
      </AnimatePresence>
      {labels.node}
    </div>
  );
}

const Num = ({ children }: { children: ReactNode }) => <span className="font-display tabular-nums">{children}</span>;
const dec = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const ftInput = (inches: number) => String(Math.round((Math.max(0, inches) / 12) * 10) / 10);

/** Tint Wiz's check-in/out: say what's on the roll now, and the history records the change. */
function CheckSheet({ roll, left, onClose }: { roll: FilmRoll; left: number; onClose: () => void }) {
  const out = (roll.status ?? "in") === "in";
  const [ft, setFt] = useState(ftInput(left));
  const [text, setText] = useState("");
  const save = () => {
    const now = Math.round(Number(ft) * 12);
    const what = out ? "Checked out" : roll.status === "lost" ? "Found, checked in" : "Checked in";
    rolls.update(roll.id, { status: out ? "out" : "in" });
    takeOff({ rollId: roll.id, inches: left - now, source: "adjust", label: `${what} · ${ft} ft on the roll${text.trim() ? ` · ${text.trim()}` : ""}` });
    onClose();
  };
  return (
    <Sheet title={out ? "Check out" : "Check in"} onClose={onClose}>
      <p className="-mt-3 mb-5 text-sm text-fg/50">{out ? "Taking this roll out of the inventory." : "Dropping this roll off at the inventory."}</p>
      <div className="space-y-4">
        <Field label="Length of film on roll" hint="How much is left on it now">
          <UnitInput unit="ft" step="0.5" value={ft} onChange={(e) => setFt(e.target.value)} autoFocus />
        </Field>
        <Field label="Notes" hint="Optional"><Textarea value={text} onChange={(e) => setText(e.target.value)} className="!min-h-[72px]" /></Field>
        <Button size="lg" className="w-full" disabled={ft === "" || Number(ft) < 0} onClick={save}>Update roll</Button>
      </div>
    </Sheet>
  );
}

const num = (s: string) => (s.trim() === "" ? undefined : Number(s));

/** Weigh the roll and let the scale say what's left. */
function WeighSheet({ roll, left, onClose }: { roll: FilmRoll; left: number; onClose: () => void }) {
  const [core, setCore] = useState(roll.coreWeightLb?.toString() ?? "");
  const [fullWt, setFullWt] = useState(roll.fullWeightLb?.toString() ?? "");
  const [w, setW] = useState("");
  const draft = { ...roll, coreWeightLb: num(core), fullWeightLb: num(fullWt) };
  const remaining = w ? weighInches(draft, Number(w)) : null;
  const badWeights = !!fullWt && Number(fullWt) <= (Number(core) || 0);
  const save = () => {
    if (remaining == null) return;
    if (draft.coreWeightLb !== roll.coreWeightLb || draft.fullWeightLb !== roll.fullWeightLb) rolls.update(roll.id, { coreWeightLb: draft.coreWeightLb, fullWeightLb: draft.fullWeightLb });
    takeOff({ rollId: roll.id, inches: left - remaining, source: "weigh", label: `Weighed ${w} lb → ${feet(remaining)} on the roll` });
    onClose();
  };
  return (
    <Sheet title={`Weigh ${roll.code ?? roll.name}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Core weight" hint="empty core"><UnitInput unit="lb" step="0.001" value={core} onChange={(e) => setCore(e.target.value)} placeholder="0.000" /></Field>
          <Field label="Full weight" hint="as received"><UnitInput unit="lb" step="0.001" value={fullWt} onChange={(e) => setFullWt(e.target.value)} placeholder="0.000" /></Field>
        </div>
        {badWeights && <p className="text-xs text-warn">Full weight has to be more than the core.</p>}
        <Field label="Weighs now"><UnitInput unit="lb" step="0.001" value={w} onChange={(e) => setW(e.target.value)} autoFocus={!!roll.fullWeightLb} placeholder="0.000" /></Field>
        <div className="rounded-2xl border border-fg/10 bg-fg/[.03] p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-fg/60">On the roll</span>
            <span className="font-display text-2xl font-bold tabular-nums">{remaining != null ? feet(remaining) : "—"}</span>
          </div>
          <p className="mt-1 text-xs text-fg/40">Full length × (weight − core) ÷ (full weight − core). App says {feet(Math.max(0, left))} now.</p>
        </div>
        <Button size="lg" className="w-full" disabled={remaining == null || badWeights} onClick={save}><Scale size={18} /> Update from the scale</Button>
      </div>
    </Sheet>
  );
}

/** Notes and tasks about a roll (reorder it, it's creased near the end…). */
function RollNotes({ roll }: { roll: FilmRoll }) {
  const { user, can } = useSession();
  const list = notes.use().filter((n) => n.rollId === roll.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const [body, setBody] = useState("");
  const [task, setTask] = useState(false);
  const add = () => {
    notes.save({
      id: newId("NT"), rollId: roll.id, body: body.trim(), authorId: user?.id, createdAt: new Date().toISOString(), replies: [],
      ...(task ? { task: { assigneeId: null, status: "open" as const } } : {}),
    });
    setBody("");
    setTask(false);
  };
  return (
    <Card>
      <CardHeader title="Notes" sub={list.length ? undefined : "Anything the crew should know about this roll"} />
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a note…" className="!min-h-[64px]" />
      <div className="mt-1 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1"><Toggle checked={task} onChange={setTask} label="Make it a task" /></div>
        <Button size="sm" disabled={!body.trim()} onClick={add}>Add note</Button>
      </div>
      {list.length > 0 && (
        <div className="mt-3 divide-y divide-fg/5 border-t border-fg/10">
          {list.map((n) => (
            <div key={n.id} className="flex gap-2 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap break-words text-fg/90">{n.body}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-fg/40">
                  {n.authorId && <span>{personName(n.authorId)}</span>}
                  <span>{relative(n.createdAt)}</span>
                  {n.task && (
                    <button type="button" onClick={() => notes.update(n.id, { task: { ...n.task!, status: n.task!.status === "open" ? "done" : "open", doneAt: n.task!.status === "open" ? new Date().toISOString() : undefined } })}>
                      <Badge tone={n.task.status === "open" ? "warn" : "success"} icon={<ListTodo size={11} />}>{n.task.status === "open" ? "Open task" : "Done"}</Badge>
                    </button>
                  )}
                </div>
              </div>
              {(n.authorId === user?.id || can("inventory.manage")) && (
                <IconButton label="Delete note" onClick={() => confirm("Delete this note?") && notes.remove(n.id)}><Trash2 size={14} /></IconButton>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
