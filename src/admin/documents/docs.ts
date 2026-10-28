import { contacts, docTemplates, leads, newId } from "../../lib/store";
import type { DocTemplate, SignedDoc } from "../../lib/types";

/** Everything the signing page shows. Rides in the link so it opens on the customer's phone. */
export interface DocView {
  id: string;
  leadId: string;
  title: string;
  body: string;
  requireName: boolean;
  showCustomer: boolean;
  customer: { name: string; phone?: string; email?: string; address?: string };
  sentAt: string;
  status: SignedDoc["status"];
  signedAt?: string;
  signedName?: string;
  signature?: string;
}

export function docView(d: SignedDoc): DocView {
  const t = docTemplates.get(d.templateId);
  const lead = leads.get(d.leadId);
  const c = contacts.get(lead?.contactId);
  return {
    id: d.id, leadId: d.leadId, title: d.title, body: d.body,
    requireName: t?.requireName ?? true, showCustomer: t?.showCustomer ?? true,
    customer: {
      name: c?.name || lead?.contact.name || "",
      phone: c?.phone || lead?.contact.phone,
      email: c?.email || lead?.contact.email,
      address: lead?.address || c?.address || lead?.city || c?.city,
    },
    sentAt: d.sentAt, status: d.status, signedAt: d.signedAt, signedName: d.signedName, signature: d.signature,
  };
}

/** The link copy: never carries a signature. */
export const docSnap = (d: SignedDoc): DocView => ({ ...docView(d), status: "sent", signedAt: undefined, signedName: undefined, signature: undefined });

export const DOC_FIELDS = ":customer_name, :first_name, :vehicle, :business and :phone are filled in when you send.";

const SEEDS: Omit<DocTemplate, "id">[] = [
  {
    title: "Dark tint waiver",
    requireName: true,
    showCustomer: true,
    body: `# Dark tint waiver

Arizona law (A.R.S. 28-959.01) requires the front side windows of a vehicle to let in at least 33% of visible light.

**Vehicle:** :vehicle

I asked :business to install window film on my front side windows that lets in **less than 33%** of visible light. I understand and agree that:

- The film I chose does not meet Arizona's legal limit for front side windows.
- I may be stopped, cited or fined, and I may have to remove the film at my own cost.
- :business is not responsible for any citation, fine, failed inspection or removal cost.
- If I hold a medical exemption, I'll keep the paperwork in the vehicle.
- This waiver covers this vehicle only and doesn't change the film warranty.

I have read this waiver and I'm choosing the darker film anyway.`,
  },
  {
    title: "Aftercare instructions",
    requireName: false,
    showCustomer: false,
    body: `# Caring for your new tint

Your film needs a few days to cure. In Arizona heat that's usually quick; in cooler months it can take a few weeks.

## Vehicles
- Keep the windows **rolled up for 3 to 5 days**.
- A little haze or small water pockets are normal while the film cures. Don't press them out; they disappear on their own.
- Hold off on the rear defroster for the first few days.
- Wait a week before cleaning the inside of the glass.
- Clean with an **ammonia-free** cleaner and a soft microfiber cloth. No razor blades, scrubbers or paper towels.
- Watch seat belt buckles and rings near the glass; they can nick the film.

## Homes and businesses
- Wait **30 days** before cleaning the film.
- Use mild soapy water or an ammonia-free cleaner with a soft cloth or rubber squeegee.
- Don't stick tape, suction cups or decals to the film.

Something doesn't look right? Text :phone and we'll come take a look. Your lifetime warranty covers peeling, bubbling and fading.`,
  },
  {
    title: "Residential install agreement",
    requireName: true,
    showCustomer: true,
    body: `# Residential window film agreement

This covers the window film installation in your approved proposal from :business.

## Scope and price
- We install the film in the rooms listed on your approved proposal, at the price shown there.
- Any deposit is credited to your final invoice. The balance is due when the install is complete.

## Before we arrive
- Please clear about 3 feet in front of each window and take down blinds or curtains where you can. We're happy to help.
- Keep pets in another room while we work.
- Tell us about gate codes, alarms or parking.

## Glass and film
- Film goes on the inside of the glass. On rare occasions glass can crack from heat stress, mostly when it's already chipped, very large, or factory-tinted. We'll point out any concerns before we start.
- Adding film can affect a window manufacturer's glass warranty. Our warranty covers the film and our labor.
- Tiny specks and a small gap at the edges are normal for professionally installed film.

## Scheduling
- Please give at least 24 hours' notice if you need to reschedule.

## Warranty
- Film is covered against peeling, bubbling, cracking and fading under the manufacturer's terms.

By signing below you approve this work and these terms.`,
  },
];

/** Starter documents for a new shop. */
export function seedDocTemplates() {
  docTemplates.saveMany(SEEDS.map((s) => ({ ...s, id: newId("DT") })));
}
