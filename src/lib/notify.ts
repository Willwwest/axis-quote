import { getSession, OWNER_ID } from "./session";
import { getSettings, newId, notifications, staff } from "./store";
import type { Notification } from "./types";

/** Adds an in-app notification for everyone whose role is set to receive this kind (Settings → Notifications). */
export function notify(kind: Notification["kind"], text: string, href?: string, forUserIds?: string[]) {
  notifications.save({ id: newId("N"), at: new Date().toISOString(), kind, text, href, forUserIds, readBy: [] });
  const hook = getSettings().leadWebhookUrl;
  if (hook) {
    fetch(hook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: `notify.${kind}`, text, href }) }).catch(() => {});
  }
}

/** Notifications the signed-in user should see. */
export function visibleTo(list: Notification[], userId: string | undefined) {
  if (!userId) return [];
  const role = userId === OWNER_ID ? "owner" : staff.get(userId)?.role;
  if (!role) return [];
  const want = getSettings().notify;
  return list.filter((n) => (n.forUserIds?.length ? n.forUserIds.includes(userId) : want[n.kind]?.includes(role)));
}

export function markAllRead(list: Notification[]) {
  const id = getSession().user?.id;
  if (!id) return;
  notifications.saveMany(list.filter((n) => !n.readBy.includes(id)).map((n) => ({ ...n, readBy: [...n.readBy, id] })));
}
