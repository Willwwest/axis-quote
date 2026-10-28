import { useEffect, useMemo, type InputHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Car, LogIn, Pencil, Ruler, Scale, Scissors, LayoutGrid, Undo2 } from "lucide-react";
import { Badge, IconButton, Input, cx, type Tone } from "../../components/ui";
import { feet, inchesLeft, rollHealth, rollTag, seedFilmTypes } from "../../lib/film";
import { jobTitle } from "../../lib/project";
import { personName } from "../../lib/session";
import { filmLog, filmTypes, leads, rolls, useSettings } from "../../lib/store";
import type { FilmRoll, FilmUse, FilmUseSource, Lead } from "../../lib/types";

/** Everything the inventory screens read, with inches left worked out once per change. */
export function useStock() {
  const all = rolls.use();
  const log = filmLog.use();
  const types = filmTypes.use();
  const settings = useSettings();
  useEffect(seedFilmTypes, [types.length]);
  const left = useMemo(() => new Map(all.map((r) => [r.id, inchesLeft(r, log)])), [all, log]);
  return { rolls: all, log, types, settings, left, leftOf: (r: FilmRoll) => left.get(r.id) ?? inchesLeft(r, log) };
}

export const byCode = (a: FilmRoll, b: FilmRoll) => (a.code ?? "").localeCompare(b.code ?? "", undefined, { numeric: true }) || a.name.localeCompare(b.name);

export const STATUS_META: Record<NonNullable<FilmRoll["status"]>, { label: string; long: string; tone: Tone }> = {
  in: { label: "In", long: "Checked in", tone: "success" },
  out: { label: "Out", long: "Checked out", tone: "info" },
  lost: { label: "Lost", long: "Lost", tone: "danger" },
};

export function RollBadges({ roll, left }: { roll: FilmRoll; left: number }) {
  const s = STATUS_META[roll.status ?? "in"];
  const h = rollHealth(roll, left);
  return (
    <span className="inline-flex flex-wrap gap-1">
      <Badge tone={s.tone}>{s.label}</Badge>
      {roll.status !== "lost" && h !== "ok" && <Badge tone={h === "low" ? "warn" : "danger"}>{h === "low" ? "Low" : "Empty"}</Badge>}
      {roll.reservedLeadId && <Badge tone="accent">Reserved</Badge>}
    </span>
  );
}

/** Number input with a unit tucked inside the right edge. */
export function UnitInput({ unit, className, ...p }: InputHTMLAttributes<HTMLInputElement> & { unit: string }) {
  return (
    <div className={cx("relative", className)}>
      <Input type="number" inputMode="decimal" min={0} {...p} className="pr-11 tabular-nums" />
      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-fg/40">{unit}</span>
    </div>
  );
}

const SOURCE_ICON: Record<FilmUseSource, typeof Car> = {
  vehicle: Car, job: Car, measure: Ruler, manual: Scissors, adjust: LogIn, weigh: Scale, cutsheet: LayoutGrid,
};

export const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** One line of a roll's update history: what happened, who, when, which job, and an undo. */
export function UseRow({ use, roll, showRoll, extra }: { use: FilmUse; roll?: FilmRoll; showRoll?: boolean; extra?: ReactNode }) {
  const Icon = use.source === "adjust" && use.inches === 0 ? LogIn : use.source === "adjust" ? Pencil : SOURCE_ICON[use.source];
  const lead = leads.get(use.leadId);
  return (
    <div className="flex items-center gap-3 px-4 py-3 text-sm">
      <Icon size={15} className="shrink-0 text-fg/35" />
      <div className="min-w-0 flex-1">
        <div className="truncate">{use.label}</div>
        <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-fg/40">
          {showRoll && (roll ? <Link to={`/admin/inventory/rolls/${roll.id}`} className="hover:text-fg">{rollTag(roll)}</Link> : <span>Deleted roll</span>)}
          {use.byId && <span>{personName(use.byId)}</span>}
          <span>{when(use.date)}</span>
          {lead && <Link to={`/admin/jobs/${lead.id}`} className="text-fg/55 underline-offset-2 hover:text-fg hover:underline">{lead.contact.name}</Link>}
          {extra}
        </div>
      </div>
      {use.inches !== 0 && (
        <>
          <div className={cx("shrink-0 font-display font-semibold tabular-nums", use.inches < 0 && "text-success")}>
            {use.inches < 0 ? "+" : "−"}{feet(Math.abs(use.inches))}
          </div>
          <IconButton label="Undo (puts the film back)" onClick={() => confirm("Undo this entry?") && filmLog.remove(use.id)}><Undo2 size={15} /></IconButton>
        </>
      )}
    </div>
  );
}

export const jobLabel = (l: Lead) => `${l.contact.name || "No name"} · ${jobTitle(l)}`;

/** Jobs worth linking film to: open and recent work first, lost jobs last. */
export function jobChoices(all: Lead[]) {
  const rank = (l: Lead) => (l.status === "lost" ? 2 : l.status === "paid" ? 1 : 0);
  return [...all].sort((a, b) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt)).slice(0, 200);
}

/* ---------- Printing ---------- */

/**
 * Prints on white paper whatever the theme, then puts the theme back.
 * With a `portal` name, the app is hidden and only that <PrintPortal> prints (labels, work sheets, cut sheets).
 */
export function printLight(portal?: string) {
  const root = document.documentElement;
  const theme = root.dataset.theme;
  root.dataset.theme = "light";
  if (portal) document.body.dataset.axisPrint = portal;
  const restore = () => {
    if (theme) root.dataset.theme = theme; else delete root.dataset.theme;
    delete document.body.dataset.axisPrint;
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  setTimeout(() => window.print(), 60);
}

/** Print-only content, rendered beside the app root so nothing else lands on the page. */
export function PrintPortal({ name, children, pageCss = "" }: { name: string; children: ReactNode; pageCss?: string }) {
  const on = `body[data-axis-print="${name}"]`;
  return createPortal(
    <div className="axis-print bg-bg text-fg" data-print={name}>
      <style>{`.axis-print{display:none}@media print{body[data-axis-print]>#root{display:none!important}${on}>[data-print="${name}"]{display:block}${pageCss ? `${on}{margin:0}${pageCss}` : ""}}`}</style>
      {children}
    </div>,
    document.body,
  );
}
