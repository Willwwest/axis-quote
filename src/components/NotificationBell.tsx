import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { Bell, CalendarDays, CheckCheck, CreditCard, FileSignature, FileText, ListTodo, Package, Settings, Star, UserPlus, type LucideIcon } from "lucide-react";
import { relative } from "../lib/format";
import { markAllRead, visibleTo } from "../lib/notify";
import { useSession } from "../lib/session";
import { notifications, useSettings } from "../lib/store";
import type { Notification } from "../lib/types";
import { IconButton, cx, type Tone } from "./ui";

const KIND: Record<Notification["kind"], { icon: LucideIcon; tone: Tone }> = {
  lead: { icon: UserPlus, tone: "info" },
  proposal: { icon: FileText, tone: "warn" },
  payment: { icon: CreditCard, tone: "success" },
  document: { icon: FileSignature, tone: "info" },
  task: { icon: ListTodo, tone: "neutral" },
  stock: { icon: Package, tone: "warn" },
  appointment: { icon: CalendarDays, tone: "accent" },
  review: { icon: Star, tone: "warn" },
};

const ICON_TONE: Record<Tone, string> = {
  neutral: "bg-fg/10 text-fg/70", accent: "bg-accent/15 text-accent-fg", success: "bg-success/15 text-success",
  warn: "bg-warn/15 text-warn", info: "bg-info/15 text-info", danger: "bg-danger/15 text-danger",
};

export function NotificationBell() {
  const { user, can } = useSession();
  const all = notifications.use();
  useSettings(); // re-filter when Settings → Notifications changes
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const list = useMemo(() => visibleTo(all, user?.id).sort((a, b) => b.at.localeCompare(a.at)), [all, user?.id]);
  if (!user) return null;
  const unread = list.filter((n) => !n.readBy.includes(user.id));

  const go = (n: Notification) => {
    if (!n.readBy.includes(user.id)) notifications.update(n.id, { readBy: [...n.readBy, user.id] });
    setOpen(false);
    if (n.href) nav(n.href);
  };

  return (
    <div className="relative">
      <IconButton label={unread.length ? `${unread.length} unread notifications` : "Notifications"} onClick={() => setOpen(!open)} className="relative">
        <Bell size={19} />
        {unread.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 font-display text-[10px] font-bold tabular-nums text-on-accent">
            {unread.length > 99 ? "99+" : unread.length}
          </span>
        )}
      </IconButton>
      {/* Portalled: the sticky header has a backdrop filter, which would trap fixed children inside it. */}
      {open && createPortal(
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-2 top-16 z-40 flex max-h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-2xl border border-fg/10 bg-surface text-fg shadow-pop sm:left-auto sm:right-4 sm:w-96">
            <div className="flex items-center justify-between gap-2 border-b border-fg/10 px-4 py-3">
              <span className="font-display font-semibold">Notifications</span>
              {unread.length > 0 && (
                <button type="button" onClick={() => markAllRead(list)} className="inline-flex items-center gap-1 text-xs text-fg/55 hover:text-fg"><CheckCheck size={14} /> Mark all read</button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {list.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-fg/45">You're all caught up.</p>
              ) : (
                list.slice(0, 60).map((n) => {
                  const k = KIND[n.kind] ?? KIND.task;
                  const isUnread = !n.readBy.includes(user.id);
                  return (
                    <button key={n.id} type="button" onClick={() => go(n)} className={cx("flex w-full items-start gap-3 border-b border-fg/5 px-4 py-3 text-left transition hover:bg-fg/[.04]", isUnread && "bg-accent/[.05]")}>
                      <span className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-full", ICON_TONE[k.tone])}><k.icon size={15} /></span>
                      <span className="min-w-0 flex-1">
                        <span className={cx("block text-sm", isUnread ? "text-fg" : "text-fg/65")}>{n.text}</span>
                        <span className="mt-0.5 block text-xs text-fg/40">{relative(n.at)}</span>
                      </span>
                      {isUnread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent-bright" />}
                    </button>
                  );
                })
              )}
            </div>
            {can("settings") && (
              <Link to="/admin/settings/notifications" onClick={() => setOpen(false)} className="flex items-center gap-2 border-t border-fg/10 px-4 py-2.5 text-xs text-fg/50 hover:text-fg">
                <Settings size={13} /> Notification settings
              </Link>
            )}
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
