import { useMemo, useState } from "react";
import { StickyNote } from "lucide-react";
import { NoteComposer, NoteItem, isOpenTask, sortNotes } from "../../admin/tasks/notes";
import { notes } from "../../lib/store";
import type { Lead } from "../../lib/types";
import { Badge, Button, Card, CardHeader } from "../ui";

/** Job page: notes and tasks hanging off this job. */
export function NotesCard({ lead }: { lead: Lead }) {
  const all = notes.use();
  const [more, setMore] = useState(false);
  const list = useMemo(() => sortNotes(all.filter((n) => n.leadId === lead.id)), [all, lead.id]);
  const open = list.filter(isOpenTask).length;
  const shown = more ? list : list.slice(0, 4);

  return (
    <Card>
      <CardHeader title="Notes & tasks" icon={<StickyNote size={16} />} actions={open > 0 && <Badge tone="warn">{open} open</Badge>} />
      <NoteComposer leadId={lead.id} contactId={lead.contactId} compact />
      {shown.length > 0 && <div className="mt-3 space-y-2">{shown.map((n) => <NoteItem key={n.id} note={n} showLink={false} />)}</div>}
      {list.length > shown.length && <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setMore(true)}>Show {list.length - shown.length} more</Button>}
    </Card>
  );
}
