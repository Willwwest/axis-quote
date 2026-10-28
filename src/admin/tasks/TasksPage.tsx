import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ListTodo } from "lucide-react";
import { EmptyState, PageHeader, SearchInput, Tabs } from "../../components/ui";
import { useSession } from "../../lib/session";
import { notes } from "../../lib/store";
import type { Note } from "../../lib/types";
import { NoteComposer, NoteItem, isOpenTask, sortNotes } from "./notes";

type Tab = "mine" | "pending" | "open" | "done" | "notes";

const FILTERS: Record<Tab, (n: Note, me: string) => boolean> = {
  mine: (n, me) => isOpenTask(n) && n.task!.assigneeId === me,
  pending: (n) => isOpenTask(n) && !n.task!.assigneeId,
  open: (n) => isOpenTask(n),
  done: (n) => n.task?.status === "done",
  notes: () => true,
};

const EMPTY: Record<Tab, string> = {
  mine: "Nothing assigned to you. Nice.",
  pending: "No unassigned tasks waiting to be taken.",
  open: "No open tasks.",
  done: "No finished tasks yet.",
  notes: "No notes yet.",
};

export default function TasksPage() {
  const { user } = useSession();
  const me = user?.id ?? "";
  const all = notes.use();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "mine";
  const focus = params.get("note");
  const [q, setQ] = useState("");

  const counts = useMemo(() => Object.fromEntries((Object.keys(FILTERS) as Tab[]).map((t) => [t, all.filter((n) => FILTERS[t](n, me)).length])) as Record<Tab, number>, [all, me]);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return sortNotes(all.filter((n) => FILTERS[tab](n, me) && n.id !== focus && (!needle || n.body.toLowerCase().includes(needle) || n.replies.some((r) => r.body.toLowerCase().includes(needle)))));
  }, [all, tab, me, q, focus]);
  const focused = all.find((n) => n.id === focus);
  const setTab = (t: Tab) => setParams(t === "mine" ? {} : { tab: t });

  return (
    <div className="max-w-3xl">
      <PageHeader title="Notes & tasks" sub="Turn any note into a task. Unassigned tasks wait in Pending until someone takes them." />
      <div className="mb-6"><NoteComposer pickJob /></div>
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: "mine", label: "Your tasks", count: counts.mine },
        { id: "pending", label: "Pending", count: counts.pending },
        { id: "open", label: "All open", count: counts.open },
        { id: "done", label: "Done", count: counts.done },
        { id: "notes", label: "All notes", count: counts.notes },
      ]} />
      <SearchInput value={q} onChange={setQ} placeholder="Search notes and replies" className="mb-4" />
      {focused && <div className="mb-4"><NoteItem note={focused} highlight /></div>}
      {list.length ? (
        <div className="space-y-3">{list.map((n) => <NoteItem key={n.id} note={n} />)}</div>
      ) : !focused && (
        <EmptyState icon={<ListTodo size={32} />} title={q ? "No matches" : EMPTY[tab]}>
          {tab === "pending" && "Leave the assignee empty when creating a task to drop it here."}
        </EmptyState>
      )}
    </div>
  );
}
