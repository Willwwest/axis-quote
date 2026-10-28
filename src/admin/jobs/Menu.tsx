import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import { IconButton, cx } from "../../components/ui";

export interface MenuItem {
  label: ReactNode;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Draws a divider above this item. */
  divide?: boolean;
}

/**
 * Overflow menu. The panel is fixed-positioned in a portal so it isn't clipped by scrolling kanban columns or cards.
 */
export function Menu({ items, label = "More", trigger, className }: { items: (MenuItem | false | null | undefined)[]; label?: string; trigger?: ReactNode; className?: string }) {
  const [pos, setPos] = useState<{ top: number; right: number; up: boolean } | null>(null);
  const btn = useRef<HTMLDivElement>(null);
  const list = items.filter(Boolean) as MenuItem[];

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => { window.removeEventListener("resize", close); window.removeEventListener("scroll", close, true); };
  }, [pos]);

  const open = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const r = btn.current!.getBoundingClientRect();
    const up = r.bottom + Math.min(list.length * 40 + 16, 420) > window.innerHeight && r.top > window.innerHeight / 2;
    setPos({ top: up ? r.top - 4 : r.bottom + 4, right: Math.max(8, window.innerWidth - r.right), up });
  };

  return (
    <div ref={btn} className={cx("inline-flex", className)} onClick={(e) => e.stopPropagation()}>
      {trigger ? <span onClick={open}>{trigger}</span> : <IconButton label={label} onClick={open}><MoreHorizontal size={18} /></IconButton>}
      {pos && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setPos(null)} />
          <div role="menu" className={cx("fixed z-[61] max-h-[420px] w-60 overflow-y-auto rounded-2xl border border-fg/10 bg-surface p-1.5 shadow-pop", pos.up && "-translate-y-full")}
            style={{ top: pos.top, right: pos.right }}>
            {list.map((it, i) => (
              <div key={i}>
                {it.divide && i > 0 && <div className="my-1 h-px bg-fg/10" />}
                <button type="button" role="menuitem" disabled={it.disabled}
                  onClick={(e) => { e.stopPropagation(); setPos(null); it.onSelect(); }}
                  className={cx("flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition disabled:opacity-35",
                    it.danger ? "text-danger hover:bg-danger/10" : "text-fg/80 hover:bg-fg/[.06] hover:text-fg")}>
                  {it.icon && <span className={cx("shrink-0", !it.danger && "text-fg/45")}>{it.icon}</span>}
                  <span className="min-w-0 flex-1">{it.label}</span>
                </button>
              </div>
            ))}
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
