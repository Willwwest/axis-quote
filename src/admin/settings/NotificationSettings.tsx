import { Bell } from "lucide-react";
import { Card, Chip } from "../../components/ui";
import { ROLES } from "../../lib/session";
import { patchSettings, useSettings } from "../../lib/store";
import type { Notification, Role } from "../../lib/types";

const EVENTS: { kind: Notification["kind"]; label: string; hint: string }[] = [
  { kind: "lead", label: "New leads", hint: "A quote comes in from the app, or someone adds a job" },
  { kind: "proposal", label: "Proposals", hint: "Sent, viewed and approved" },
  { kind: "payment", label: "Payments", hint: "Deposits, payments, refunds, paid in full" },
  { kind: "document", label: "Documents", hint: "A customer signs a document" },
  { kind: "task", label: "Notes & tasks", hint: "Assigned tasks, new pending tasks, replies" },
  { kind: "stock", label: "Low stock", hint: "A roll drops under its low-stock line" },
  { kind: "appointment", label: "Appointments", hint: "Booked, changed, cancelled, checked in and out" },
  { kind: "review", label: "Reviews", hint: "A new review is logged" },
];

export function NotificationSettings() {
  const { notify } = useSettings();
  const toggle = (kind: Notification["kind"], role: Role) =>
    patchSettings((s) => {
      const cur = s.notify[kind] ?? [];
      return { notify: { ...s.notify, [kind]: cur.includes(role) ? cur.filter((r) => r !== role) : [...cur, role] } };
    });

  return (
    <div className="max-w-3xl">
      <p className="mb-6 flex items-start gap-2 text-sm text-fg/50"><Bell size={16} className="mt-0.5 shrink-0" /> Who sees each event in the bell. These show in the app for now; texts, email and push need a server. A connected automation webhook (Business) gets every event either way.</p>
      <Card className="!p-0">
        <ul className="divide-y divide-fg/5">
          {EVENTS.map((e) => (
            <li key={e.kind} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{e.label}</div>
                <div className="text-xs text-fg/45">{e.hint}</div>
              </div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={`${e.label}: who is notified`}>
                {ROLES.map((r) => <Chip key={r.id} size="sm" selected={!!notify[e.kind]?.includes(r.id)} onClick={() => toggle(e.kind, r.id)}>{r.label}</Chip>)}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
