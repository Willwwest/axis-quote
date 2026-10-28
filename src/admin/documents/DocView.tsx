import { forwardRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { BUSINESS } from "../../data/config";
import { Logo } from "../../components/ui";
import { Markdown } from "../../lib/markdown";
import type { DocView } from "./docs";

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

/** A drawn signature. `bg-on-accent` is white in both themes, so it doubles as signing paper for the dark ink. */
export const SignatureImage = ({ src, className }: { src: string; className?: string }) => (
  <img src={src} alt="Signature" className={`h-24 w-full max-w-sm rounded-xl bg-on-accent object-contain p-2 ${className ?? ""}`} />
);

/** The document as the customer sees and signs it, and as it prints. */
export const DocBody = forwardRef<HTMLDivElement, { view: DocView; children?: ReactNode }>(function DocBody({ view, children }, ref) {
  const c = view.customer;
  return (
    <div ref={ref} className="space-y-5">
      <div className="flex items-start justify-between gap-4 border-b border-fg/10 pb-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold leading-tight">{view.title}</h1>
          <p className="mt-1 text-xs text-fg/45">{BUSINESS.legalName} · {BUSINESS.phone} · {BUSINESS.email}</p>
        </div>
        <Logo flat className="h-8 shrink-0" />
      </div>
      {view.showCustomer && c.name && (
        <dl className="grid gap-x-6 gap-y-1 rounded-xl bg-fg/[.04] px-4 py-3 text-sm sm:grid-cols-2">
          <div><dt className="inline text-fg/45">Name </dt><dd className="inline">{c.name}</dd></div>
          {c.phone && <div><dt className="inline text-fg/45">Phone </dt><dd className="inline">{c.phone}</dd></div>}
          {c.email && <div><dt className="inline text-fg/45">Email </dt><dd className="inline break-all">{c.email}</dd></div>}
          {c.address && <div><dt className="inline text-fg/45">Address </dt><dd className="inline">{c.address}</dd></div>}
        </dl>
      )}
      <Markdown text={view.body} className="text-[15px]" />
      {view.signature && (
        <div className="border-t border-fg/10 pt-4">
          <SignatureImage src={view.signature} />
          <p className="mt-2 text-sm"><span className="font-semibold">{view.signedName || "Signed"}</span>{view.signedAt && <span className="text-fg/50"> · signed {when(view.signedAt)}</span>}</p>
        </div>
      )}
      {children}
    </div>
  );
});

/** Prints in the light theme (paper is white) and puts the dark theme back afterwards. */
export function printLight() {
  const root = document.documentElement;
  const prev = root.dataset.theme;
  root.dataset.theme = "light";
  const restore = () => {
    if (prev) root.dataset.theme = prev;
    else delete root.dataset.theme;
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  window.print();
}

/** Renders `children` only on paper: the app is hidden while printing and this takes its place. */
export function PrintOnly({ children }: { children: ReactNode }) {
  return createPortal(
    <div className="hidden bg-bg p-2 text-fg print:block">
      <style>{"@media print { #root { display: none !important; } }"}</style>
      {children}
    </div>,
    document.body,
  );
}
