import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { Minus, Plus } from "lucide-react";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "outline"; size?: "md" | "lg" };

export function Button({ variant = "primary", size = "md", className, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-display font-semibold tracking-wide transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-axis-bright/70",
        size === "lg" ? "h-14 px-7 text-base" : "h-11 px-5 text-sm",
        variant === "primary" && "bg-gradient-to-b from-axis-bright to-axis-red text-white shadow-glow hover:brightness-110 active:scale-[.98]",
        variant === "outline" && "border border-white/15 bg-white/[.03] text-white hover:border-white/30 hover:bg-white/[.06]",
        variant === "ghost" && "text-white/70 hover:text-white",
        className,
      )}
    />
  );
}

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
          ? "border-axis-red bg-gradient-to-b from-axis-red/15 to-axis-red/[.03] shadow-[0_0_0_1px_rgba(218,40,27,.6),0_12px_40px_-16px_rgba(218,40,27,.7)]"
          : "border-white/10 bg-white/[.025] hover:border-white/25 hover:bg-white/[.05]",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cx(
        "rounded-full border px-4 py-2 text-sm font-medium transition-all",
        selected ? "border-axis-red bg-axis-red/15 text-white" : "border-white/12 text-white/70 hover:border-white/30 hover:text-white",
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
    <div className="inline-flex rounded-xl border border-white/10 bg-black/40 p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            "rounded-lg font-medium transition-all",
            size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
            value === o.value ? "bg-white text-black shadow" : "text-white/60 hover:text-white",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Counter({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const btn = "grid h-9 w-9 place-items-center rounded-lg border border-white/12 text-white/80 transition hover:border-white/30 hover:text-white disabled:opacity-30";
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

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-sm font-medium text-white/80">
        {label}
        {hint && <span className="text-xs font-normal text-white/40">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

const inputCls = "w-full rounded-xl border border-white/12 bg-white/[.04] px-4 py-3 text-white placeholder:text-white/30 outline-none transition focus:border-axis-red focus:bg-white/[.06] focus:ring-2 focus:ring-axis-red/30";

export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(inputCls, p.className)} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cx(inputCls, "min-h-[96px] resize-y", p.className)} />;

export function StepHeader({ eyebrow, title, sub }: { eyebrow: string; title: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-7">
      <div className="mb-2 font-display text-xs font-semibold uppercase tracking-[.25em] text-axis-bright">{eyebrow}</div>
      <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">{title}</h1>
      {sub && <p className="mt-3 max-w-xl text-white/60">{sub}</p>}
    </div>
  );
}

export function Logo({ className, flat }: { className?: string; flat?: boolean }) {
  return <img src={`${import.meta.env.BASE_URL}${flat ? "axis-logo-flat.png" : "axis-logo.png"}`} alt="Axis Glass Tinting" className={cx("h-10 w-auto select-none", className)} draggable={false} />;
}

export function Stars({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex gap-0.5 text-amber-400", className)} aria-label="5 stars">
      {"★★★★★".split("").map((s, i) => <span key={i}>{s}</span>)}
    </span>
  );
}
