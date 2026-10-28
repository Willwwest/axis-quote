import { createContext, useContext } from "react";
import type { Settings } from "../../data/config";
import type { Lead, Quote, QuoteState } from "../../lib/types";

export const INITIAL: QuoteState = {
  kind: null,
  vehicle: {
    body: "sedan",
    ymm: "",
    paint: "#141416",
    zones: ["frontSides", "rearSides", "rearWindshield", "visor"],
    film: "ceramic",
    frontVlt: 35,
    rearVlt: 20,
    removal: false,
  },
  home: {
    panes: { small: 0, standard: 6, large: 2, door: 1 },
    goals: ["heat"],
    film: "ultraview",
    shade: "Ultra View 25",
  },
  region: null,
  city: "",
  garage: null,
  appointment: null,
  contact: { name: "", phone: "", email: "", notes: "", sms: true },
  referral: "",
};

export interface QuoteCtx {
  q: QuoteState;
  set: (patch: Partial<QuoteState> | ((q: QuoteState) => Partial<QuoteState>)) => void;
  settings: Settings;
  quote: Quote;
  next: () => void;
  /** Saves the lead and moves to the confirmation screen. */
  submit: () => void;
  lead: Lead | null;
  restart: () => void;
}

export const Ctx = createContext<QuoteCtx | null>(null);
export const useQuote = () => useContext(Ctx)!;
