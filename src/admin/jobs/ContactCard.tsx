import { useEffect } from "react";
import { Link } from "react-router-dom";
import { BellOff, ExternalLink, Mail, MapPin, MessageSquareQuote, Phone, User } from "lucide-react";
import { Avatar, Card, CardHeader } from "../../components/ui";
import { digits } from "../../lib/format";
import { ensureContact } from "../../lib/project";
import { reach } from "../../lib/messages";
import { useSession } from "../../lib/session";
import { contacts, leads } from "../../lib/store";
import type { Lead } from "../../lib/types";
import { mapsUrl } from "./jobUtils";

export function ContactCard({ lead }: { lead: Lead }) {
  const { can } = useSession();
  // Quote-app leads arrive without a contact record; link (or create) one the first time the job is opened.
  useEffect(() => { const fresh = leads.get(lead.id); if (fresh && !contacts.get(fresh.contactId)) ensureContact(fresh); }, [lead.id]);
  const c = contacts.useOne(lead.contactId);
  const name = c?.name || lead.contact.name;
  const phone = c?.phone || lead.contact.phone;
  const email = c?.email || lead.contact.email;
  const address = lead.address || c?.address || c?.city || lead.city;
  const r = reach(lead);
  const row = "flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-fg/85 hover:bg-fg/[.04]";

  return (
    <Card>
      <CardHeader title="Customer" icon={<User size={16} />}
        actions={c && can("contacts") && <Link to={`/admin/contacts/${c.id}`} className="flex items-center gap-1 text-xs text-fg/50 hover:text-fg">Contact <ExternalLink size={12} /></Link>} />
      <div className="mb-2 flex items-center gap-3">
        <Avatar name={name} size={40} />
        <div className="min-w-0">
          {c && can("contacts") ? <Link to={`/admin/contacts/${c.id}`} className="block truncate font-semibold hover:text-accent-fg">{name}</Link> : <div className="truncate font-semibold">{name}</div>}
          {c?.company && <div className="truncate text-xs text-fg/50">{c.company}</div>}
        </div>
      </div>
      <div className="-mx-2">
        {phone && <a href={`tel:${digits(phone)}`} className={row}><Phone size={15} className="shrink-0 text-fg/40" /> {phone}</a>}
        {email && <a href={`mailto:${email}`} className={row}><Mail size={15} className="shrink-0 text-fg/40" /> <span className="truncate">{email}</span></a>}
        {address && <a href={mapsUrl(address)} target="_blank" rel="noreferrer" className={row}><MapPin size={15} className="shrink-0 text-fg/40" /> <span className="truncate">{address}</span></a>}
      </div>
      {(!r.smsOk || !r.emailOk) && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-warn"><BellOff size={13} /> Opted out of {[!r.smsOk && "texts", !r.emailOk && "email"].filter(Boolean).join(" and ")}</p>
      )}
      {lead.contact.notes && (
        <div className="mt-3 rounded-lg bg-fg/[.04] px-3 py-2 text-sm text-fg/75">
          <div className="mb-0.5 flex items-center gap-1 text-[11px] uppercase tracking-wider text-fg/40"><MessageSquareQuote size={12} /> From the customer</div>
          {lead.contact.notes}
        </div>
      )}
    </Card>
  );
}
