import type { ReactNode } from "react";
import { Link, Navigate, Route, Routes, useParams } from "react-router-dom";
import { Briefcase, Lock } from "lucide-react";
import { AppointmentsCard } from "../../components/project/AppointmentsCard";
import { DocumentsCard } from "../../components/project/DocumentsCard";
import { FilmCard } from "../../components/project/FilmCard";
import { InvoiceCard } from "../../components/project/InvoiceCard";
import { MeasurementsCard } from "../../components/project/MeasurementsCard";
import { NotesCard } from "../../components/project/NotesCard";
import { ProposalCard } from "../../components/project/ProposalCard";
import { Button, EmptyState } from "../../components/ui";
import { useSession } from "../../lib/session";
import { appointments, leads } from "../../lib/store";
import type { Lead } from "../../lib/types";
import { AttachmentsCard } from "./AttachmentsCard";
import { ContactCard } from "./ContactCard";
import { DetailsCard } from "./DetailsCard";
import { JobHeader } from "./JobHeader";
import { OptionsCard } from "./OptionsCard";
import { QuoteCard } from "./QuoteCard";
import { WrapUpCard, WrapUpPage } from "./WrapUp";
import { techCanSee, useIsDesktop } from "./jobUtils";

export default function JobPage() {
  const { id } = useParams();
  const lead = leads.useOne(id);
  const appts = appointments.use();
  const session = useSession();

  if (!lead) {
    return (
      <EmptyState icon={<Briefcase size={36} />} title="Job not found" actions={<Link to="/admin/jobs"><Button variant="outline">Back to jobs</Button></Link>}>
        It may have been deleted, or it lives on another device.
      </EmptyState>
    );
  }
  if (!session.can("jobs.all") && !techCanSee(lead, session.user?.id, appts)) {
    return (
      <div className="grid place-items-center py-24 text-center">
        <Lock className="text-fg/30" size={32} />
        <p className="mt-3 font-display text-lg">This job isn't assigned to you</p>
        <Link to="/admin/jobs" className="mt-2 text-sm text-accent-fg">Back to your jobs</Link>
      </div>
    );
  }
  return (
    <Routes>
      <Route index element={<Hub lead={lead} />} />
      <Route path="wrapup" element={<WrapUpPage lead={lead} />} />
      <Route path="*" element={<Navigate to={`/admin/jobs/${lead.id}`} replace />} />
    </Routes>
  );
}

type CardId = "contact" | "details" | "quote" | "appts" | "measure" | "film" | "proposal" | "invoice" | "docs" | "notes" | "files" | "wrap" | "options";

// Desktop: the job itself on the left, what happens to it on the right. Phone: what the crew needs first, first.
const LEFT: CardId[] = ["contact", "details", "quote", "measure", "film", "files", "wrap"];
const RIGHT: CardId[] = ["appts", "proposal", "invoice", "docs", "notes", "options"];
const PHONE: CardId[] = ["contact", "appts", "details", "proposal", "quote", "measure", "invoice", "wrap", "film", "docs", "notes", "files", "options"];

function Hub({ lead }: { lead: Lead }) {
  const { can } = useSession();
  const desktop = useIsDesktop();
  const showMoney = can("proposals") || can("invoices");
  const cards: Record<CardId, ReactNode> = {
    contact: <ContactCard lead={lead} />,
    details: <DetailsCard lead={lead} />,
    quote: showMoney && <QuoteCard lead={lead} />,
    appts: <AppointmentsCard lead={lead} />,
    measure: lead.kind !== "vehicle" && <MeasurementsCard lead={lead} />,
    film: <FilmCard lead={lead} />,
    proposal: can("proposals") && <ProposalCard lead={lead} />,
    invoice: (can("invoices") || can("payments")) && <InvoiceCard lead={lead} />,
    docs: can("documents") && <DocumentsCard lead={lead} />,
    notes: <NotesCard lead={lead} />,
    files: <AttachmentsCard lead={lead} />,
    wrap: <WrapUpCard lead={lead} />,
    options: can("jobs.all") && <OptionsCard lead={lead} />,
  };
  const column = (ids: CardId[]) => <div className="min-w-0 space-y-4">{ids.filter((k) => cards[k]).map((k) => <div key={k}>{cards[k]}</div>)}</div>;

  return (
    <div>
      <JobHeader lead={lead} showMoney={showMoney} />
      {desktop ? <div className="grid grid-cols-2 items-start gap-4">{column(LEFT)}{column(RIGHT)}</div> : column(PHONE)}
    </div>
  );
}
