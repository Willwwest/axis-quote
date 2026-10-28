import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Briefcase, Check, CornerDownRight, Hand, Layers, ListTodo, RotateCcw, Send, Trash2, User } from "lucide-react";
import { Avatar, Badge, Button, Input, Select, Textarea, Toggle, cx } from "../../components/ui";
import { dayDate, relative, today } from "../../lib/format";
import { notify } from "../../lib/notify";
import { jobTitle } from "../../lib/project";
import { OWNER_ID, ownerUser, personName, useSession } from "../../lib/session";
import { contacts, leads, newId, notes, rolls, staff } from "../../lib/store";
import type { Note } from "../../lib/types";

/* ---------- Helpers shared by the tasks page, job page, contact page and dashboard ---------- */

/** Everyone a task can go to: the owner plus active staff. */
export function people() {
  return [{ id: OWNER_ID, name: ownerUser().name, color: ownerUser().color }, ...staff.all().filter((s) => s.active).map((s) => ({ id: s.id, name: s.name, color: s.color }))];
}

export const colorOf = (id?: string | null) => (id === OWNER_ID ? ownerUser().color : staff.get(id ?? undefined)?.color);

export const excerpt = (s: string, n = 60) => {
  const t = s.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

/** Where a note lives in the app: its job, else the notes page. */
export const noteHref = (n: Pick<Note, "id" | "leadId">) => (n.leadId ? `/admin/jobs/${n.leadId}` : `/admin/tasks?note=${n.id}`);

export const isOpenTask = (n: Note) => n.task?.status === "open";

/** Replies someone else wrote on a note this person wrote or is assigned, that they haven't seen. */
export function unreadReplies(n: Note, me: string) {
  if (n.authorId !== me && n.task?.assigneeId !== me) return 0;
  return n.replies.filter((r) => r.authorId !== me && !r.readBy.includes(me)).length;
}

/** Open tasks first (soonest due), then everything else newest first. */
export function sortNotes(list: Note[]) {
  return [...list].sort((a, b) => {
    const ao = isOpenTask(a), bo = isOpenTask(b);
    if (ao !== bo) return ao ? -1 : 1;
    if (ao && bo) return (a.task!.due ?? "9999").localeCompare(b.task!.due ?? "9999") || b.createdAt.localeCompare(a.createdAt);
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function assignTask(n: Note, assigneeId: string | null, by: string) {
  notes.update(n.id, (cur) => ({ task: { ...(cur.task ?? { status: "open" as const }), assigneeId } }));
  if (assigneeId && assigneeId !== by) notify("task", `${personName(by)} assigned ${personName(assigneeId)} a task: ${excerpt(n.body)}`, noteHref(n), [assigneeId]);
  if (!assigneeId) notify("task", `New pending task: ${excerpt(n.body)}`, "/admin/tasks?tab=pending");
}

export const setTaskDone = (n: Note, done: boolean) =>
  notes.update(n.id, (cur) => ({ task: cur.task && { ...cur.task, status: done ? "done" : "open", doneAt: done ? new Date().toISOString() : undefined } }));

/** Just enough markdown for crew notes: **bold**, kept line breaks. */
export function NoteBody({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <p className={cx("whitespace-pre-line break-words text-sm text-fg/85", className)}>
      {parts.map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={i} className="font-semibold text-fg">{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>))}
    </p>
  );
}

/* ---------- Composer ---------- */

export function NoteComposer({ leadId, contactId, pickJob, compact, onDone }: {
  leadId?: string; contactId?: string; pickJob?: boolean; compact?: boolean; onDone?: () => void;
}) {
  const { user } = useSession();
  const allLeads = leads.use();
  const [body, setBody] = useState("");
  const [job, setJob] = useState(leadId ?? "");
  const [asTask, setAsTask] = useState(false);
  const [assignee, setAssignee] = useState("");
  const [due, setDue] = useState("");
  const [open, setOpen] = useState(!compact);
  const jobs = useMemo(() => [...allLeads].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 60), [allLeads]);

  if (!user) return null;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-full rounded-xl border border-dashed border-fg/15 px-4 py-3 text-left text-sm text-fg/45 transition hover:border-fg/30 hover:text-fg/70">
        Write a note or task…
      </button>
    );
  }

  const submit = () => {
    const text = body.trim();
    if (!text) return;
    const lead = leads.get(job || undefined);
    const n: Note = {
      id: newId("NT"), body: text, authorId: user.id, createdAt: new Date().toISOString(), replies: [],
      leadId: lead?.id, contactId: contactId ?? lead?.contactId,
      ...(asTask ? { task: { assigneeId: assignee || null, status: "open" as const, due: due || undefined } } : {}),
    };
    notes.save(n);
    if (asTask) {
      if (!assignee) notify("task", `New pending task: ${excerpt(text)}`, "/admin/tasks?tab=pending");
      else if (assignee !== user.id) notify("task", `${user.name} assigned ${personName(assignee)} a task: ${excerpt(text)}`, noteHref(n), [assignee]);
    }
    setBody(""); setAsTask(false); setAssignee(""); setDue("");
    if (compact) setOpen(false);
    onDone?.();
  };

  return (
    <div className="space-y-3 rounded-xl border border-fg/10 bg-fg/[.02] p-3">
      <Textarea autoFocus={compact} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Gate codes, customer asks, reminders… **bold** works" aria-label="Note" className="!min-h-[72px]"
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }} />
      {pickJob && (
        <Select value={job} onChange={(e) => setJob(e.target.value)} aria-label="Link to a job" className="!py-2 text-sm">
          <option value="">Not linked to a job</option>
          {jobs.map((l) => <option key={l.id} value={l.id}>{l.contact.name} · {jobTitle(l)}</option>)}
        </Select>
      )}
      <Toggle checked={asTask} onChange={setAsTask} label="Create as task" hint="Assign it to someone, or leave it in Pending for anyone to take." />
      {asTask && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Select value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Assign to" className="!py-2 text-sm">
            <option value="">Unassigned (pending pool)</option>
            {people().map((p) => <option key={p.id} value={p.id}>{p.id === user.id ? `${p.name} (me)` : p.name}</option>)}
          </Select>
          <Input type="date" value={due} min={today()} onChange={(e) => setDue(e.target.value)} aria-label="Due date" className="!py-2 text-sm" />
        </div>
      )}
      <div className="flex justify-end gap-2">
        {compact && <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>}
        <Button size="sm" onClick={submit} disabled={!body.trim()}>{asTask ? <ListTodo size={14} /> : <Send size={14} />} {asTask ? "Add task" : "Add note"}</Button>
      </div>
    </div>
  );
}

/* ---------- One note with its task controls and replies ---------- */

export function NoteItem({ note, showLink = true, highlight }: { note: Note; showLink?: boolean; highlight?: boolean }) {
  const { user } = useSession();
  const me = user?.id ?? "";
  const [reply, setReply] = useState("");
  const task = note.task;
  const overdue = task?.status === "open" && !!task.due && task.due < today();

  // Viewing a note marks its replies read (the read receipt the author sees).
  useEffect(() => {
    if (!me || !note.replies.some((r) => !r.readBy.includes(me))) return;
    notes.update(note.id, (n) => ({ replies: n.replies.map((r) => (r.readBy.includes(me) ? r : { ...r, readBy: [...r.readBy, me] })) }));
  }, [me, note.id, note.replies]);

  const send = () => {
    const text = reply.trim();
    if (!text || !me) return;
    notes.update(note.id, (n) => ({ replies: [...n.replies, { id: newId("RP"), body: text, authorId: me, at: new Date().toISOString(), readBy: [me] }] }));
    notify("task", `${personName(me)} replied: ${excerpt(text)}`, noteHref(note), [...new Set([note.authorId, note.task?.assigneeId, ...note.replies.map((r) => r.authorId)].filter((id): id is string => !!id && id !== me))]);
    setReply("");
  };

  return (
    <article className={cx("rounded-xl border p-3 sm:p-4", highlight ? "border-accent/50 bg-accent/[.04]" : "border-fg/10 bg-fg/[.02]", task?.status === "done" && "opacity-70")}>
      <header className="flex items-start gap-3">
        <Avatar name={personName(note.authorId)} color={colorOf(note.authorId)} size={28} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg/45">
            <span className="font-medium text-fg/75">{personName(note.authorId)}</span>
            <span>{relative(note.createdAt)}</span>
            {task && (
              <Badge tone={task.status === "done" ? "success" : overdue ? "danger" : task.assigneeId ? "info" : "warn"} icon={task.status === "done" ? <Check size={11} /> : <ListTodo size={11} />}>
                {task.status === "done" ? "Done" : task.assigneeId ? `Task · ${personName(task.assigneeId)}` : "Pending task"}
              </Badge>
            )}
            {task?.due && task.status === "open" && <span className={cx(overdue && "font-medium text-danger")}>Due {task.due === today() ? "today" : dayDate(task.due)}</span>}
          </div>
          <NoteBody text={note.body} className="mt-1.5" />
          {showLink && <NoteLinks note={note} />}
        </div>
      </header>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 pl-10">
        {task?.status === "open" && !task.assigneeId && <Button size="sm" variant="outline" onClick={() => assignTask(note, me, me)}><Hand size={14} /> Take</Button>}
        {task?.status === "open" && <Button size="sm" variant="outline" onClick={() => setTaskDone(note, true)}><Check size={14} /> Close</Button>}
        {task?.status === "done" && <Button size="sm" variant="ghost" onClick={() => setTaskDone(note, false)}><RotateCcw size={14} /> Reopen</Button>}
        {task?.status === "open" && (
          <Select value={task.assigneeId ?? ""} onChange={(e) => assignTask(note, e.target.value || null, me)} aria-label="Assigned to" className="!h-9 !w-auto !rounded-xl !py-0 !pl-3 !pr-8 text-xs">
            <option value="">Unassigned</option>
            {people().map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        )}
        {!task && <Button size="sm" variant="ghost" onClick={() => assignTask(note, null, me)}><ListTodo size={14} /> Make task</Button>}
        {(note.authorId === me || me === OWNER_ID) && (
          <Button size="sm" variant="ghost" className="ml-auto !px-2 text-fg/40" aria-label="Delete note" onClick={() => confirm("Delete this note and its replies?") && notes.remove(note.id)}><Trash2 size={14} /></Button>
        )}
      </div>

      {note.replies.length > 0 && (
        <ul className="mt-3 space-y-2 border-l border-fg/10 pl-4 sm:ml-10">
          {note.replies.map((r) => {
            const seen = r.readBy.filter((id) => id !== r.authorId);
            return (
              <li key={r.id} className="text-sm">
                <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-fg/45">
                  <span className="font-medium text-fg/75">{personName(r.authorId)}</span>
                  <span>{relative(r.at)}</span>
                </div>
                <NoteBody text={r.body} />
                <div className="mt-0.5 text-[11px] text-fg/35">{seen.length ? `Seen by ${seen.map((id) => personName(id)).join(", ")}` : "Not seen yet"}</div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 flex gap-2 sm:pl-10">
        <CornerDownRight size={16} className="mt-2.5 hidden shrink-0 text-fg/25 sm:block" />
        <Input value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Reply" aria-label="Reply" className="!py-2 text-sm" />
        <Button size="sm" variant="outline" className="!h-10" onClick={send} disabled={!reply.trim()}>Reply</Button>
      </div>
    </article>
  );
}

function NoteLinks({ note }: { note: Note }) {
  const lead = leads.get(note.leadId);
  const contact = contacts.get(note.contactId);
  const roll = rolls.get(note.rollId);
  const chips: ReactNode[] = [];
  const chip = "inline-flex items-center gap-1.5 rounded-full border border-fg/10 px-2.5 py-1 text-xs text-fg/60 transition hover:border-fg/30 hover:text-fg";
  if (lead) chips.push(<Link key="j" to={`/admin/jobs/${lead.id}`} className={chip}><Briefcase size={12} /> {lead.contact.name} · {jobTitle(lead)}</Link>);
  else if (contact) chips.push(<Link key="c" to={`/admin/contacts/${contact.id}`} className={chip}><User size={12} /> {contact.name}</Link>);
  if (roll) chips.push(<Link key="r" to="/admin/inventory" className={chip}><Layers size={12} /> Roll {roll.code ?? roll.name}</Link>);
  return chips.length ? <div className="mt-2 flex flex-wrap gap-1.5">{chips}</div> : null;
}
