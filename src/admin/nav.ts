import {
  BarChart3, Briefcase, CalendarDays, FileSignature, FileText, Layers, LayoutDashboard, ListTodo, MessageSquare, Receipt,
  Settings, Star, Users, type LucideIcon,
} from "lucide-react";
import type { Perm } from "../lib/session";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  perm: Perm;
  /** Shown in the phone tab bar. */
  primary?: boolean;
}

export const NAV: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, perm: "dashboard", primary: true },
  { to: "/admin/jobs", label: "Jobs", icon: Briefcase, perm: "jobs", primary: true },
  { to: "/admin/calendar", label: "Calendar", icon: CalendarDays, perm: "calendar", primary: true },
  { to: "/admin/contacts", label: "Contacts", icon: Users, perm: "contacts" },
  { to: "/admin/proposals", label: "Proposals", icon: FileText, perm: "proposals" },
  { to: "/admin/invoices", label: "Invoices", icon: Receipt, perm: "invoices" },
  { to: "/admin/inventory", label: "Inventory", icon: Layers, perm: "inventory", primary: true },
  { to: "/admin/tasks", label: "Notes & tasks", icon: ListTodo, perm: "tasks" },
  { to: "/admin/messages", label: "Messages", icon: MessageSquare, perm: "messages" },
  { to: "/admin/documents", label: "Documents", icon: FileSignature, perm: "documents" },
  { to: "/admin/reviews", label: "Reviews", icon: Star, perm: "reviews" },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3, perm: "analytics" },
  { to: "/admin/settings", label: "Settings", icon: Settings, perm: "settings" },
];
