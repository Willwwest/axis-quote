import { useEffect, type ReactNode } from "react";
import { BUSINESS } from "../../data/config";
import { Logo, cx } from "../../components/ui";
import { money } from "../../lib/format";
import { termsLabel, type InvoiceView } from "../../lib/money";
import { prettyDate } from "../../lib/schedule";

const long = (iso: string) => prettyDate(iso, { month: "short", day: "numeric", year: "numeric" });

/** Prints on the light palette (ink-friendly) whatever theme is on screen, then puts it back. */
export function usePrintLight() {
  useEffect(() => {
    const root = document.documentElement;
    let prev: string | undefined;
    const before = () => { prev = root.dataset.theme; root.dataset.theme = "light"; };
    const after = () => { if (prev) root.dataset.theme = prev; else delete root.dataset.theme; };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => { window.removeEventListener("beforeprint", before); window.removeEventListener("afterprint", after); };
  }, []);
}

const Label = ({ children }: { children: ReactNode }) => <div className="mb-1 text-[11px] font-semibold uppercase tracking-[.18em] text-fg/40">{children}</div>;

function Row({ k, v, strong }: { k: ReactNode; v: ReactNode; strong?: boolean }) {
  return (
    <div className={cx("flex items-baseline justify-between gap-4", strong ? "pt-1 text-base font-semibold text-fg" : "text-fg/65")}>
      <dt>{k}</dt>
      <dd className={cx("font-display tabular-nums", strong && "text-xl")}>{v}</dd>
    </div>
  );
}

/** The branded invoice: customer page, and the editor's print/PDF layout. */
export function InvoiceDocument({ view, className }: { view: InvoiceView; className?: string }) {
  const { totals } = view;
  const stamp = view.status === "paid" ? "Paid" : view.status === "void" ? "Void" : null;
  return (
    <article className={cx("rounded-3xl border border-fg/10 bg-surface p-5 sm:p-8 print:rounded-none print:border-0 print:bg-transparent print:p-0", className)}>
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Logo flat className="h-10" />
          <address className="mt-3 text-sm not-italic leading-relaxed text-fg/60">
            <div className="font-medium text-fg/85">{BUSINESS.name}</div>
            {view.address && <div>{view.address}</div>}
            <div>{BUSINESS.phone}</div>
            <div>{BUSINESS.email}</div>
          </address>
        </div>
        <div className="sm:text-right">
          <div className="font-display text-xs font-semibold uppercase tracking-[.2em] text-accent-fg">Invoice</div>
          <div className="font-display text-3xl font-semibold tabular-nums">#{view.number}</div>
          <dl className="mt-2 space-y-0.5 text-sm">
            <div><dt className="inline text-fg/45">Issued </dt><dd className="inline">{long(view.issuedAt)}</dd></div>
            <div><dt className="inline text-fg/45">Due </dt><dd className="inline">{view.terms === "receipt" ? "On receipt" : long(view.dueAt)}</dd></div>
            {view.terms !== "receipt" && <div className="text-xs text-fg/40">{termsLabel(view.terms)}</div>}
          </dl>
        </div>
      </header>

      <section className="mt-6 grid gap-5 border-t border-fg/10 pt-5 sm:grid-cols-2">
        <div className="text-sm leading-relaxed">
          <Label>Bill to</Label>
          <div className="font-medium text-fg">{view.customer.name}</div>
          {view.customer.company && <div className="text-fg/70">{view.customer.company}</div>}
          {view.customer.address && <div className="text-fg/60">{view.customer.address}</div>}
          {view.customer.phone && <div className="text-fg/60">{view.customer.phone}</div>}
          {view.customer.email && <div className="break-all text-fg/60">{view.customer.email}</div>}
        </div>
        {view.job && (
          <div className="text-sm leading-relaxed sm:text-right">
            <Label>Job</Label>
            <div className="text-fg/85">{view.job}</div>
            {view.site && <div className="text-fg/60">{view.site}</div>}
          </div>
        )}
      </section>

      <section className="mt-6">
        <div className="flex justify-between border-b border-fg/10 pb-2 text-[11px] font-semibold uppercase tracking-[.18em] text-fg/40">
          <span>Description</span><span>Amount</span>
        </div>
        <ul className="divide-y divide-fg/5">
          {view.lines.map((l, i) => (
            <li key={i} className="flex gap-4 py-3 print:break-inside-avoid">
              <div className="min-w-0 flex-1">
                <div className="whitespace-pre-line text-sm text-fg/90">{l.description || "Item"}</div>
                {l.qty !== 1 && <div className="mt-0.5 text-xs tabular-nums text-fg/45">{l.qty} × {money(l.rate, true)}</div>}
                {l.rollCodes && <div className="mt-0.5 text-[11px] tabular-nums text-fg/40">Film roll {l.rollCodes.join(", ")}</div>}
              </div>
              <div className={cx("shrink-0 font-display text-sm tabular-nums", l.rate < 0 && "text-success")}>{money(l.rate * l.qty, true)}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-2 flex flex-col-reverse gap-6 border-t border-fg/10 pt-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex justify-center sm:block">
          {stamp && (
            <div className={cx(
              "-rotate-12 select-none rounded-xl border-4 px-5 py-1 font-display text-3xl font-bold uppercase tracking-[.25em]",
              stamp === "Paid" ? "border-success/70 text-success" : "border-fg/30 text-fg/40",
            )}>{stamp}</div>
          )}
        </div>
        <dl className="w-full space-y-1.5 text-sm sm:w-72">
          <Row k="Subtotal" v={money(totals.subtotal, true)} />
          {view.tax ? <Row k={<>{view.tax.name} {view.tax.pct}%{totals.taxable !== totals.subtotal && <span className="text-fg/40"> on {money(totals.taxable, true)}</span>}</>} v={money(totals.tax, true)} />
            : view.taxExempt && <Row k="Tax" v="Exempt" />}
          <div className="border-t border-fg/10 pt-1.5"><Row k="Total" v={money(totals.total, true)} strong /></div>
          {view.paid !== 0 && <Row k="Paid" v={`−${money(view.paid, true)}`} />}
          {view.status !== "void" && (
            <div className="mt-2 flex items-baseline justify-between gap-4 rounded-xl bg-fg/[.05] px-3 py-2.5">
              <dt className="font-medium text-fg/80">Balance due</dt>
              <dd className={cx("font-display text-2xl font-bold tabular-nums", view.balance > 0 ? "text-fg" : "text-success")}>{money(view.balance, true)}</dd>
            </div>
          )}
        </dl>
      </section>

      {view.notes && <p className="mt-8 whitespace-pre-line border-t border-fg/10 pt-4 text-sm text-fg/60">{view.notes}</p>}
    </article>
  );
}
