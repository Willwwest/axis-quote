import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { PageHeader, cx } from "../../components/ui";
import { useSession, type Perm } from "../../lib/session";
import { BusinessSettings } from "./BusinessSettings";
import { CalendarSettings } from "./CalendarSettings";
import { DataSettings } from "./DataSettings";
import { InventorySettings } from "./InventorySettings";
import { InvoiceSettings } from "./InvoiceSettings";
import { MessageSettings } from "./MessageSettings";
import { NotificationSettings } from "./NotificationSettings";
import { PricingSettings } from "./PricingSettings";
import { ProposalSettings } from "./ProposalSettings";
import { RoutingSettings } from "./RoutingSettings";
import { StaffSettings } from "./StaffSettings";

const SECTIONS: { path: string; label: string; el: () => JSX.Element; perm?: Perm }[] = [
  { path: "business", label: "Business", el: BusinessSettings },
  { path: "pricing", label: "Pricing", el: PricingSettings },
  { path: "proposals", label: "Proposals & deposits", el: ProposalSettings },
  { path: "invoices", label: "Invoices & tax", el: InvoiceSettings },
  { path: "calendar", label: "Calendar & booking", el: CalendarSettings },
  { path: "routing", label: "Routing", el: RoutingSettings },
  { path: "messages", label: "Message templates", el: MessageSettings },
  { path: "inventory", label: "Inventory", el: InventorySettings },
  { path: "staff", label: "Staff & roles", el: StaffSettings, perm: "staff" },
  { path: "notifications", label: "Notifications", el: NotificationSettings },
  { path: "data", label: "Data & integrations", el: DataSettings },
];

export default function SettingsPage() {
  const { can } = useSession();
  const sections = SECTIONS.filter((s) => !s.perm || can(s.perm));
  return (
    <div>
      <PageHeader title="Settings" />
      <div className="grid gap-8 lg:grid-cols-[200px_1fr]">
        <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0">
          {sections.map((s) => (
            <NavLink key={s.path} to={`/admin/settings/${s.path}`}
              className={({ isActive }) => cx("shrink-0 rounded-lg px-3 py-2 text-sm transition", isActive ? "bg-fg/10 text-fg" : "text-fg/55 hover:text-fg")}>
              {s.label}
            </NavLink>
          ))}
        </nav>
        <div className="min-w-0">
          <Routes>
            <Route index element={<Navigate to="business" replace />} />
            {sections.map((s) => <Route key={s.path} path={s.path} element={<s.el />} />)}
            <Route path="*" element={<Navigate to="business" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
