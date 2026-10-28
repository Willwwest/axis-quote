import { useEffect, useMemo, useState } from "react";
import { create } from "qrcode";
import { BUSINESS } from "../../data/config";
import { cx } from "../../components/ui";
import { ftNum, rollUrl, sqftOf } from "../../lib/film";
import { getSettings } from "../../lib/store";
import type { FilmRoll } from "../../lib/types";
import { PrintPortal, printLight } from "./shared";

/** QR as crisp SVG modules in the current text color, so it prints black on the label stock. */
export function Qr({ text, className }: { text: string; className?: string }) {
  const { d, n } = useMemo(() => {
    const m = create(text, { errorCorrectionLevel: "M" }).modules;
    let d = "";
    for (let y = 0; y < m.size; y++) for (let x = 0; x < m.size; x++) if (m.data[y * m.size + x]) d += `M${x} ${y}h1v1h-1z`;
    return { d, n: m.size };
  }, [text]);
  return (
    <svg viewBox={`-1 -1 ${n + 2} ${n + 2}`} className={className} shapeRendering="crispEdges" role="img" aria-label="QR code">
      <path d={d} className="fill-current" />
    </svg>
  );
}

/**
 * One roll label at physical size: 1.1" × 3.5" (Brother QL standard) or 2.4" × 3.9" (large).
 * `paper` picks colors that read as black-on-white in the current theme.
 */
export function RollLabel({ roll, left, large, paper }: { roll: FilmRoll; left: number; large: boolean; paper: string }) {
  const code = roll.code ?? "—";
  return (
    <div className={cx("flex shrink-0 items-center overflow-hidden font-body leading-tight", paper, large ? "h-[2.4in] w-[3.9in] gap-[0.14in] p-[0.14in]" : "h-[1.1in] w-[3.5in] gap-[0.08in] px-[0.1in] py-[0.06in]")}>
      <Qr text={rollUrl(code)} className={large ? "h-[2.05in] w-[2.05in] shrink-0" : "h-[0.98in] w-[0.98in] shrink-0"} />
      <div className="min-w-0 flex-1">
        <div className={cx("truncate border-b border-current font-semibold uppercase tracking-wider", large ? "pb-[2pt] text-[8pt]" : "pb-[1pt] text-[6pt]")}>{BUSINESS.name}</div>
        <div className={cx("font-display font-bold tabular-nums", large ? "mt-[4pt] text-[22pt]" : "mt-[2pt] text-[12pt]")}>{code}</div>
        <div className={cx("font-semibold", large ? "text-[11pt]" : "line-clamp-1 text-[8pt]")}>{roll.name}</div>
        <div className={cx(large ? "mt-[4pt] text-[10pt]" : "text-[7pt]")}><b>Width:</b> {roll.widthIn} in <b>Length:</b> {ftNum(Math.max(0, left))} ft</div>
        <div className={large ? "text-[10pt]" : "text-[7pt]"}><b>Available:</b> {Math.round(sqftOf(roll.widthIn, left))} sqft</div>
        {large && roll.lot && <div className="text-[9pt]"><b>Lot:</b> {roll.lot}</div>}
      </div>
    </div>
  );
}

/** Black ink on white paper in either theme (dark theme flips fg and bg). */
export const paperFor = (theme: string) => (theme === "light" ? "bg-bg text-fg" : "bg-fg text-bg");

/**
 * `print(list)` renders one label per page at the label size and opens the print dialog
 * (AirPrint to a Brother QL-820NWB, or any printer with the right stock).
 */
export function usePrintLabels() {
  const [job, setJob] = useState<{ list: { roll: FilmRoll; left: number }[]; large: boolean } | null>(null);
  useEffect(() => {
    if (!job) return;
    printLight("labels");
    const done = () => setJob(null);
    window.addEventListener("afterprint", done);
    return () => window.removeEventListener("afterprint", done);
  }, [job]);
  const print = (list: { roll: FilmRoll; left: number }[], large = getSettings().inventory.largeLabels) => list.length && setJob({ list, large });
  const node = job && (
    <PrintPortal name="labels" pageCss={`@page{size:${job.large ? "3.9in 2.4in" : "3.5in 1.1in"};margin:0}`}>
      {job.list.map(({ roll, left }, i) => (
        <div key={roll.id} style={{ breakAfter: i < job.list.length - 1 ? "page" : "auto" }}>
          <RollLabel roll={roll} left={left} large={job.large} paper="bg-bg text-fg" />
        </div>
      ))}
    </PrintPortal>
  );
  return { print, node };
}
