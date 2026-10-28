import { INITIAL } from "../pages/quote/context";
import { buildQuote } from "./pricing";
import { isoDate } from "./schedule";
import { getSettings, newId } from "./store";
import type { Lead, QuoteState } from "./types";

// Clearly-labelled demo data so the owner can try the dashboard before real leads arrive.

export function sampleLeads(): Lead[] {
  const s = getSettings();
  const day = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    return isoDate(d);
  };
  const make = (q: Partial<QuoteState>, status: Lead["status"], hoursAgo: number): Lead => {
    const full: QuoteState = { ...INITIAL, ...q, contact: { ...INITIAL.contact, ...q.contact } };
    const { vehicle, home, ...rest } = full;
    return {
      ...rest,
      id: newId("AX"),
      createdAt: new Date(Date.now() - hoursAgo * 3600_000).toISOString(),
      status,
      ...(full.kind === "vehicle" ? { vehicle } : { home }),
      quote: buildQuote(s, full),
    };
  };

  return [
    make({ kind: "vehicle", vehicle: { ...INITIAL.vehicle, body: "truck", ymm: "2023 Ford F-150", paint: "#1d2d52" }, region: "quad", city: "Prescott Valley", garage: "yes",
      appointment: { date: day(2), slot: "9:00 AM" }, contact: { ...INITIAL.contact, name: "Sample Customer A", phone: "(928) 555-0101" } }, "booked", 5),
    make({ kind: "vehicle", vehicle: { ...INITIAL.vehicle, body: "suv", ymm: "2021 Jeep Grand Cherokee", paint: "#e6e7ea", film: "carbon", rearVlt: 5 }, region: "phx", city: "Scottsdale", garage: "no",
      contact: { ...INITIAL.contact, name: "Sample Customer B", phone: "(480) 555-0144" } }, "new", 2),
    make({ kind: "home", region: "quad", city: "Prescott", contact: { ...INITIAL.contact, name: "Sample Customer C", phone: "(928) 555-0177", notes: "West-facing living room gets brutal in the afternoon" } }, "contacted", 30),
    make({ kind: "vehicle", vehicle: { ...INITIAL.vehicle, body: "sedan", ymm: "2020 Honda Accord", zones: ["frontSides"], removal: true }, region: "quad", city: "Chino Valley", garage: "yes",
      contact: { ...INITIAL.contact, name: "Sample Customer D", phone: "(928) 555-0190" } }, "new", 20),
  ];
}
