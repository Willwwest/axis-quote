import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Check, Eye, Minus, Pencil, Send, Trash2, UserPlus } from "lucide-react";
import { BUSINESS } from "../../data/config";
import { Avatar, Badge, Button, Card, CardHeader, Choice, Field, Input, Sheet, Table, Td, Toggle, cx } from "../../components/ui";
import { firstName } from "../../lib/format";
import { sendSms } from "../../lib/messages";
import { OWNER_ID, PERMS, ROLES, ownerUser, type Perm } from "../../lib/session";
import { getSettings, newId, staff, useSettings } from "../../lib/store";
import type { Role, Staff } from "../../lib/types";

/** Calendar and avatar colors, all theme tokens. */
export const STAFF_COLORS = [
  { name: "Blue", value: "rgb(var(--c-info))" },
  { name: "Green", value: "rgb(var(--c-success))" },
  { name: "Amber", value: "rgb(var(--c-warn))" },
  { name: "Red", value: "rgb(var(--c-accent))" },
  { name: "Deep red", value: "rgb(var(--c-accent-deep))" },
  { name: "Gray", value: "rgb(var(--c-fg) / .5)" },
];

const PERM_LABELS: Record<Perm, string> = {
  dashboard: "Dashboard & stats", jobs: "Jobs (their own)", "jobs.all": "Every job", contacts: "Contacts",
  calendar: "Calendar (their appointments)", "calendar.all": "Whole team calendar", proposals: "Proposals", invoices: "Invoices",
  payments: "Payments & deposits", inventory: "Film stock: view and log cuts", "inventory.manage": "Film stock: add and edit rolls",
  tasks: "Notes & tasks", documents: "Documents", reviews: "Reviews", analytics: "Analytics", messages: "Messages & outbox",
  settings: "Settings", staff: "Staff & roles",
};

const STAFF_ROLES = ROLES.filter((r) => r.id !== "owner");
const roleLabel = (r: Role) => ROLES.find((x) => x.id === r)?.label ?? r;

export function StaffSettings() {
  const list = staff.use();
  const [edit, setEdit] = useState<Staff | null>(null);
  const owner = ownerUser();
  const blank = (): Staff => ({ id: "", name: "", email: "", phone: "", role: "installer", pin: "", color: STAFF_COLORS[list.length % STAFF_COLORS.length].value, active: true });
  const invite = (s: Staff) => sendSms(s.phone,
    `Hi ${firstName(s.name)}, you're set up on the ${BUSINESS.name} crew app. Open ${location.origin}${import.meta.env.BASE_URL}admin and sign in with your PIN: ${s.pin}`, "invite");

  return (
    <div className="max-w-4xl space-y-6">
      <p className="text-sm text-fg/50">Everyone signs in to the crew dashboard with their own PIN. Their role decides what they can see. Turn someone off instead of deleting them to keep their name on past jobs.</p>

      <Card>
        <CardHeader title="Team" actions={<Button size="sm" onClick={() => setEdit(blank())}><UserPlus size={15} /> Add</Button>} />
        <ul className="-mx-2 divide-y divide-fg/5">
          <li className="flex items-center gap-3 px-2 py-3">
            <Avatar name={owner.name} color={owner.color} size={36} />
            <div className="min-w-0 flex-1"><div className="font-medium">{owner.name}</div><div className="text-xs text-fg/45">Business PIN · set under Business</div></div>
            <Badge tone="accent">Owner</Badge>
          </li>
          {list.map((s) => (
            <li key={s.id} className={cx("flex flex-wrap items-center gap-3 px-2 py-3", !s.active && "opacity-60")}>
              <Avatar name={s.name} color={s.color} size={36} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{s.name}</div>
                <div className="truncate text-xs text-fg/45">{[s.phone, s.email].filter(Boolean).join(" · ") || "No contact info"}</div>
              </div>
              <Badge tone={s.active ? "info" : "neutral"}>{s.active ? roleLabel(s.role) : "Off"}</Badge>
              <div className="-mt-1 flex w-full items-center justify-end gap-1 sm:mt-0 sm:w-auto">
                <Button size="sm" variant="ghost" disabled={!s.phone || !s.active} onClick={() => invite(s)} title="Text them the link and their PIN"><Send size={14} /> Invite</Button>
                <Button size="sm" variant="ghost" onClick={() => setEdit(s)} aria-label={`Edit ${s.name}`}><Pencil size={14} /></Button>
              </div>
            </li>
          ))}
        </ul>
        {!list.length && <p className="pt-2 text-sm text-fg/45">No staff yet. Add installers and technicians so jobs and appointments can be assigned to them.</p>}
      </Card>

      <Card>
        <CardHeader title="View as" icon={<Eye size={16} />} />
        <p className="text-sm text-fg/60">To check what someone will see, open your account menu (your initials, top right) and pick a role under <span className="font-medium text-fg/80">View as</span>. A yellow bar shows while you're previewing; tap <span className="font-medium text-fg/80">Back to owner</span> to return.</p>
      </Card>

      <Card>
        <CardHeader title="What each role can do" />
        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          {ROLES.map((r) => <div key={r.id} className="rounded-xl bg-fg/[.03] px-3 py-2.5 text-sm"><span className="font-medium">{r.label}.</span> <span className="text-fg/55">{r.desc}</span></div>)}
        </div>
        <Table head={["Access", ...ROLES.map((r) => r.label)]}>
          {(Object.keys(PERM_LABELS) as Perm[]).map((p) => (
            <tr key={p}>
              <Td className="text-fg/75">{PERM_LABELS[p]}</Td>
              {ROLES.map((r) => (
                <Td key={r.id}>{PERMS[r.id].includes(p)
                  ? <Check size={16} className="text-success" aria-label="Yes" />
                  : <Minus size={16} className="text-fg/20" aria-label="No" />}</Td>
              ))}
            </tr>
          ))}
        </Table>
      </Card>

      <AnimatePresence>{edit && <StaffSheet key="edit" member={edit} onClose={() => setEdit(null)} />}</AnimatePresence>
    </div>
  );
}

function pinProblem(pin: string, id: string) {
  if (!/^\d{4,8}$/.test(pin)) return "Use 4 to 8 digits.";
  if (pin === getSettings().adminPin) return "That's the owner's PIN. Pick another.";
  if (staff.all().some((s) => s.id !== id && s.pin === pin)) return "Someone else already uses that PIN.";
  return null;
}

function StaffSheet({ member, onClose }: { member: Staff; onClose: () => void }) {
  useSettings();
  const [s, setS] = useState(member);
  const set = (p: Partial<Staff>) => setS({ ...s, ...p });
  const problem = s.pin ? pinProblem(s.pin, s.id) : "Give them a PIN to sign in with.";
  const save = () => {
    staff.save({ ...s, id: s.id || newId("ST"), name: s.name.trim() });
    onClose();
  };
  return (
    <Sheet title={member.id ? `Edit ${member.name}` : "Add staff member"} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Full name"><Input value={s.name} onChange={(e) => set({ name: e.target.value })} autoComplete="off" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mobile" hint="For the invite text"><Input type="tel" inputMode="tel" value={s.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
          <Field label="Email"><Input type="email" value={s.email} onChange={(e) => set({ email: e.target.value })} /></Field>
        </div>
        <div>
          <div className="mb-1.5 text-sm font-medium text-fg/80">Role</div>
          <div className="grid gap-2">
            {STAFF_ROLES.map((r) => (
              <Choice key={r.id} selected={s.role === r.id} onClick={() => set({ role: r.id })} className="!p-3">
                <div className="font-medium">{r.label}</div>
                <div className="text-xs text-fg/50">{r.desc}</div>
              </Choice>
            ))}
          </div>
        </div>
        <Field label="PIN" hint="4–8 digits, unique">
          <Input inputMode="numeric" autoComplete="off" value={s.pin} onChange={(e) => set({ pin: e.target.value.replace(/\D/g, "").slice(0, 8) })} className="tracking-[.3em]" />
        </Field>
        {s.pin && problem && <p className="-mt-2 text-xs text-danger">{problem}</p>}
        <div>
          <div className="mb-1.5 text-sm font-medium text-fg/80">Color</div>
          <div className="flex flex-wrap gap-2">
            {STAFF_COLORS.map((c) => (
              <button key={c.value} type="button" aria-label={c.name} aria-pressed={s.color === c.value} onClick={() => set({ color: c.value })}
                className={cx("grid h-9 w-9 place-items-center rounded-full ring-offset-2 ring-offset-surface transition", s.color === c.value && "ring-2 ring-fg")} style={{ background: c.value }}>
                {s.color === c.value && <Check size={16} className="text-on-accent" />}
              </button>
            ))}
          </div>
        </div>
        <Toggle checked={s.active} onChange={(active) => set({ active })} label="Active" hint="Off: they can't sign in and drop out of assignee lists." />
      </div>
      <div className="mt-6 flex items-center justify-between gap-2">
        {member.id && member.id !== OWNER_ID ? (
          <Button variant="danger" size="sm" onClick={() => { if (confirm(`Delete ${member.name}? Turning them off keeps their name on past jobs.`)) { staff.remove(member.id); onClose(); } }}><Trash2 size={14} /> Delete</Button>
        ) : <span />}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={!s.name.trim() || !!problem}>Save</Button>
        </div>
      </div>
    </Sheet>
  );
}
