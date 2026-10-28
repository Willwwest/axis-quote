/*
 * Axis design system: the only place UI primitives are defined.
 * Every color comes from the semantic tokens in src/styles/tokens.css (bg-surface, text-fg, border-fg/10, accent, success…);
 * never use raw palette classes or hex values in components. `node scripts/tokenize.cjs --check` enforces it.
 * The living reference is /admin/design.
 */
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { DollarSign, Minus, Plus, Search, X } from "lucide-react";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* ---------- Actions ---------- */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "outline" | "ghost" | "danger"; size?: "sm" | "md" | "lg" };

export function Button({ variant = "primary", size = "md", className, type = "button", ...rest }: BtnProps) {
  return (
    <button
      type={type}
      {...rest}
      className={cx(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-display font-semibold tracking-wide transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright/70",
        size === "lg" ? "h-14 px-7 text-base" : size === "sm" ? "h-9 px-3.5 text-xs" : "h-11 px-5 text-sm",
        variant === "primary" && "bg-gradient-to-b from-accent-bright to-accent text-on-accent shadow-glow hover:brightness-110 active:scale-[.98]",
        variant === "outline" && "border border-fg/15 bg-fg/[.03] text-fg hover:border-fg/30 hover:bg-fg/[.06]",
        variant === "ghost" && "text-fg/70 hover:bg-fg/[.05] hover:text-fg",
        variant === "danger" && "border border-danger/40 text-danger hover:bg-danger/10",
        className,
      )}
    />
  );
}

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label} {...rest}
      className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-lg text-fg/50 transition hover:bg-fg/10 hover:text-fg disabled:opacity-30", className)}>
      {children}
    </button>
  );
}

/* ---------- Selection ---------- */

/** A large selectable card (radio-style). */
export function Choice({
  selected, onClick, children, className,
}: { selected: boolean; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cx(
        "group relative rounded-2xl border p-4 text-left transition-all duration-200",
        selected
          ? "border-accent bg-gradient-to-b from-accent/15 to-accent/[.03] shadow-[0_0_0_1px_rgb(var(--c-accent)_/_.6),0_12px_40px_-16px_rgb(var(--c-accent)_/_.7)]"
          : "border-fg/10 bg-fg/[.025] hover:border-fg/25 hover:bg-fg/[.05]",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Chip({ selected, onClick, children, size = "md" }: { selected: boolean; onClick: () => void; children: ReactNode; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cx(
        "rounded-full border font-medium transition-all",
        size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-2 text-sm",
        selected ? "border-accent bg-accent/15 text-fg" : "border-fg/12 text-fg/70 hover:border-fg/30 hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string | number>({
  value, options, onChange, size = "md",
}: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; size?: "sm" | "md" }) {
  return (
    <div className="inline-flex max-w-full overflow-x-auto rounded-xl border border-fg/10 bg-sunken p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            "shrink-0 rounded-lg font-medium transition-all",
            size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
            value === o.value ? "bg-fg text-bg shadow" : "text-fg/60 hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-2">
      <span>
        <span className="block text-sm font-medium text-fg/85">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-fg/45">{hint}</span>}
      </span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={cx("relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition", checked ? "bg-accent" : "bg-fg/15")}>
        <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-on-accent shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
      </button>
    </label>
  );
}

export function Counter({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const btn = "grid h-9 w-9 place-items-center rounded-lg border border-fg/12 text-fg/80 transition hover:border-fg/30 hover:text-fg disabled:opacity-30";
  return (
    <div className="flex items-center gap-3">
      <button type="button" className={btn} onClick={() => onChange(Math.max(0, value - 1))} disabled={!value} aria-label="Fewer">
        <Minus size={16} />
      </button>
      <span className="w-6 text-center font-display text-lg font-semibold tabular-nums">{value}</span>
      <button type="button" className={btn} onClick={() => onChange(value + 1)} aria-label="More">
        <Plus size={16} />
      </button>
    </div>
  );
}

/* ---------- Forms ---------- */

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-medium text-fg/80">
        {label}
        {hint && <span className="text-right text-xs font-normal text-fg/40">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

const inputCls = "w-full rounded-xl border border-fg/12 bg-fg/[.04] px-4 py-3 text-fg placeholder:text-fg/30 outline-none transition focus:border-accent focus:bg-fg/[.06] focus:ring-2 focus:ring-accent/30 disabled:opacity-50";

export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(inputCls, p.className)} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(inputCls, "appearance-none", p.className)} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cx(inputCls, "min-h-[96px] resize-y", p.className)} />;

/** Dollar amount input. Passes the raw string so callers decide how blank is treated. */
export function MoneyInput({ value, onChange, placeholder, className }: { value: number | null | undefined; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cx("relative", className)}>
      <DollarSign size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg/35" />
      <Input type="number" inputMode="decimal" min={0} step="0.01" value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="!py-2 pl-8 tabular-nums" />
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = "Search", className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cx("relative", className)}>
      <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg/35" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="!py-2.5 pl-10" />
    </div>
  );
}

/* ---------- Layout ---------- */

export function PageHeader({ title, sub, actions, eyebrow }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 font-display text-xs font-semibold uppercase tracking-[.2em] text-accent-fg">{eyebrow}</div>}
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-fg/50">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className, tone }: { children: ReactNode; className?: string; tone?: "accent" | "warn" | "success" | "danger" }) {
  return (
    <div className={cx(
      "rounded-2xl border bg-surface p-4 sm:p-5",
      tone === "accent" ? "border-accent/40" : tone === "warn" ? "border-warn/40" : tone === "success" ? "border-success/40" : tone === "danger" ? "border-danger/50" : "border-fg/10",
      className,
    )}>
      {children}
    </div>
  );
}

export function CardHeader({ title, icon, actions, sub }: { title: ReactNode; icon?: ReactNode; actions?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold">{icon && <span className="text-fg/45">{icon}</span>}{title}</h2>
        {sub && <p className="mt-0.5 text-xs text-fg/45">{sub}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  );
}

export function StepHeader({ eyebrow, title, sub }: { eyebrow: string; title: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-7">
      <div className="mb-2 font-display text-xs font-semibold uppercase tracking-[.25em] text-accent-fg">{eyebrow}</div>
      <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-fg sm:text-4xl">{title}</h1>
      {sub && <p className="mt-3 max-w-xl text-fg/60">{sub}</p>}
    </div>
  );
}

export function EmptyState({ icon, title, children, actions }: { icon: ReactNode; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-fg/15 px-6 py-12 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center text-fg/30">{icon}</div>
      <p className="mt-3 font-display text-xl">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-fg/50">{children}</div>}
      {actions && <div className="mt-6 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}

/** Label / value rows, e.g. inside a detail card. */
export function KeyValue({ k, children }: { k: ReactNode; children: ReactNode }) {
  return (
    <div className="flex gap-4 py-2.5 text-sm">
      <dt className="w-28 shrink-0 text-fg/45">{k}</dt>
      <dd className="min-w-0 flex-1 text-fg/90">{children}</dd>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { id: T; label: ReactNode; count?: number }[] }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_rgb(var(--c-fg)/0.1)]">
      {tabs.map((t) => (
        <button key={t.id} type="button" onClick={() => onChange(t.id)}
          className={cx("flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition", value === t.id ? "border-accent text-fg" : "border-transparent text-fg/50 hover:text-fg")}>
          {t.label}
          {t.count != null && <span className="rounded-full bg-fg/10 px-1.5 text-[11px] tabular-nums text-fg/60">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------- Data display ---------- */

export type Tone = "neutral" | "accent" | "success" | "warn" | "info" | "danger";

const TONE_BADGE: Record<Tone, string> = {
  neutral: "bg-fg/10 text-fg/70",
  accent: "bg-accent/15 text-accent-fg",
  success: "bg-success/15 text-success",
  warn: "bg-warn/15 text-warn",
  info: "bg-info/15 text-info",
  danger: "bg-danger/15 text-danger",
};

export const TONE_DOT: Record<Tone, string> = {
  neutral: "bg-fg/30", accent: "bg-accent-bright", success: "bg-success", warn: "bg-warn", info: "bg-info", danger: "bg-danger",
};

export function Badge({ tone = "neutral", children, icon, className }: { tone?: Tone; children: ReactNode; icon?: ReactNode; className?: string }) {
  return <span className={cx("inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", TONE_BADGE[tone], className)}>{icon}{children}</span>;
}

export function Dot({ tone = "neutral" }: { tone?: Tone }) {
  return <span className={cx("inline-block h-2 w-2 shrink-0 rounded-full", TONE_DOT[tone])} />;
}

export function Kpi({ label, value, tone, delta, sub }: { label: string; value: string; tone?: "warn" | "success" | "danger"; delta?: number | null; sub?: ReactNode }) {
  return (
    <div className={cx("rounded-2xl border bg-gradient-to-b from-fg/[.04] to-transparent p-4", tone === "warn" ? "border-warn/40" : tone === "danger" ? "border-danger/40" : tone === "success" ? "border-success/40" : "border-fg/10")}>
      <div className="flex items-baseline gap-2">
        <span className={cx("font-display text-2xl font-bold tabular-nums", tone === "warn" && "text-warn", tone === "danger" && "text-danger", tone === "success" && "text-success")}>{value}</span>
        {delta != null && Number.isFinite(delta) && (
          <span className={cx("text-xs font-medium tabular-nums", delta > 0 ? "text-success" : delta < 0 ? "text-danger" : "text-fg/40")}>{delta > 0 ? "▲" : delta < 0 ? "▼" : "•"} {Math.abs(Math.round(delta))}%</span>
        )}
      </div>
      <div className="mt-1 text-xs text-fg/45">{label}</div>
      {sub && <div className="mt-1 text-xs text-fg/35">{sub}</div>}
    </div>
  );
}

export function Progress({ value, tone = "success", className }: { value: number; tone?: Tone; className?: string }) {
  return (
    <div className={cx("h-2 overflow-hidden rounded-full bg-fg/10", className)}>
      <div className={cx("h-full rounded-full transition-all", TONE_DOT[tone])} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Avatar({ name, color, size = 28 }: { name: string; color?: string; size?: number }) {
  const initials = name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-fg/10 font-display font-semibold text-fg/80"
      style={{ width: size, height: size, fontSize: size * 0.38, ...(color ? { background: color, color: "rgb(var(--c-on-accent))" } : {}) }}>
      {initials}
    </span>
  );
}

/** Simple responsive table. Rows scroll sideways on phones rather than squashing. */
export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-fg/10">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-fg/[.04] text-left text-xs uppercase tracking-wider text-fg/45">
          <tr>{head.map((h, i) => <th key={i} className="whitespace-nowrap px-4 py-3 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-fg/5">{children}</tbody>
      </table>
      {empty}
    </div>
  );
}

export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => <td className={cx("px-4 py-3 align-middle", className)}>{children}</td>;

/* ---------- Overlays ---------- */

/** Centered dialog on desktop, bottom sheet on phones. Wrap the conditional render in <AnimatePresence>. */
export function Sheet({ title, onClose, children, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-scrim/60 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        role="dialog" aria-modal="true"
        initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className={cx("max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-fg/10 bg-surface p-6 shadow-pop sm:rounded-3xl", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          <IconButton label="Close" onClick={onClose}><X size={20} /></IconButton>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

/** Right-hand panel for quick record details. */
export function Drawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-scrim/60 backdrop-blur-sm" onClick={onClose} />
          <motion.aside
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-lg overflow-y-auto border-l border-fg/10 bg-surface p-6"
          >
            {children}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

/* ---------- Brand ---------- */

export function Logo({ className, flat }: { className?: string; flat?: boolean }) {
  return <img src={`${import.meta.env.BASE_URL}${flat ? "axis-logo-flat.png" : "axis-logo.png"}`} alt="Axis Glass Tinting" className={cx("axis-logo h-10 w-auto select-none", className)} draggable={false} />;
}

export function Stars({ className, rating = 5 }: { className?: string; rating?: number }) {
  return (
    <span className={cx("inline-flex gap-0.5", className)} aria-label={`${rating} stars`}>
      {[1, 2, 3, 4, 5].map((i) => <span key={i} className={i <= rating ? "text-warn" : "text-fg/20"}>★</span>)}
    </span>
  );
}
