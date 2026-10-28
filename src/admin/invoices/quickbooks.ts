import { money, toCsv } from "../../lib/format";
import { KIND_LABEL, invoiceForLead, leadName, methodLabel, paymentValue, taxRateFor } from "../../lib/money";
import { jobKindLabel } from "../../lib/project";
import { invoices, leads } from "../../lib/store";
import type { Invoice, Payment, PaymentTerms } from "../../lib/types";

/*
 * CSV exports. The invoice file follows QuickBooks Online's invoice import (Sales → Invoices → Import):
 * one row per line, rows grouped by InvoiceNo, US dates. Items are named after the job type (Automotive /
 * Residential / Commercial), the same default Tint Wiz's QuickBooks sync uses.
 */

const us = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${m}/${d}/${y}`;
};

const QBO_TERMS: Record<PaymentTerms, string> = { receipt: "Due on receipt", net7: "Net 7", net15: "Net 15", net21: "Net 21", net30: "Net 30" };

/** Invoices QuickBooks should hold: sent, viewed, partial or paid. */
export const exportable = (list: Invoice[]) => list.filter((i) => i.status !== "draft" && i.status !== "void");

export function quickbooksInvoicesCsv(list: Invoice[]) {
  const rows: (string | number)[][] = [[
    "InvoiceNo", "Customer", "InvoiceDate", "DueDate", "Terms", "Item(Product/Service)", "ItemDescription",
    "ItemQuantity", "ItemRate", "ItemAmount", "Taxable", "TaxRate",
  ]];
  for (const inv of exportable(list)) {
    const lead = leads.get(inv.leadId);
    const item = lead ? jobKindLabel(lead) : "Services";
    const rate = taxRateFor(inv);
    for (const l of inv.lines) {
      const desc = [l.description.replace(/\s*\n\s*/g, " · "), l.rollCodes?.length ? `Film roll ${l.rollCodes.join(", ")}` : ""].filter(Boolean).join(" · ");
      rows.push([
        inv.number, leadName(inv.leadId), us(inv.issuedAt), us(inv.dueAt), QBO_TERMS[inv.terms], item, desc,
        l.qty, l.rate.toFixed(2), (l.rate * l.qty).toFixed(2), l.taxable ? "Y" : "N", l.taxable && rate ? rate.name : "",
      ]);
    }
  }
  return toCsv(rows);
}

export function paymentsCsv(list: Payment[]) {
  const rows: (string | number)[][] = [["Date", "Customer", "InvoiceNo", "Amount", "Method", "Reference/Notes"]];
  for (const p of [...list].sort((a, b) => a.date.localeCompare(b.date))) {
    const inv = invoices.get(p.invoiceId) ?? invoiceForLead(p.leadId);
    const note = [p.kind !== "payment" ? KIND_LABEL[p.kind] : "", p.notes ?? "", p.tip ? `Tip ${money(p.tip, true)}` : ""].filter(Boolean).join(" · ");
    rows.push([us(p.date), leadName(p.leadId), inv?.number ?? "", paymentValue(p).toFixed(2), methodLabel(p.method), note]);
  }
  return toCsv(rows);
}
