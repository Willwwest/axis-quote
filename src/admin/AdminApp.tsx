import { Suspense, lazy, useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, ExternalLink, Lock, LogOut, Menu, MoreHorizontal, Palette, X } from "lucide-react";
import { NotificationBell } from "../components/NotificationBell";
import { Avatar, Button, Input, Logo, Select, cx } from "../components/ui";
import { ROLES, setViewAs, signIn, signOut, useSession, type Perm } from "../lib/session";
import { useSettings } from "../lib/store";
import type { Role } from "../lib/types";
import { NAV } from "./nav";

// Each section is its own chunk so the dashboard opens fast on a phone.
const DashboardPage = lazy(() => import("./DashboardPage"));
const JobsPage = lazy(() => import("./jobs/JobsPage"));
const JobPage = lazy(() => import("./jobs/JobPage"));
const ContactsPage = lazy(() => import("./contacts/ContactsPage"));
const ContactPage = lazy(() => import("./contacts/ContactPage"));
const CalendarPage = lazy(() => import("./calendar/CalendarPage"));
const ProposalsPage = lazy(() => import("./proposals/ProposalsPage"));
const InvoicesPage = lazy(() => import("./invoices/InvoicesPage"));
const InvoiceEditor = lazy(() => import("./invoices/InvoiceEditor"));
const InventoryPage = lazy(() => import("./inventory/InventoryPage"));
const TasksPage = lazy(() => import("./tasks/TasksPage"));
const MessagesPage = lazy(() => import("./messages/MessagesPage"));
const DocumentsPage = lazy(() => import("./documents/DocumentsPage"));
const ReviewsPage = lazy(() => import("./reviews/ReviewsPage"));
const AnalyticsPage = lazy(() => import("./analytics/AnalyticsPage"));
const SettingsPage = lazy(() => import("./settings/SettingsPage"));
const DesignPage = lazy(() => import("./DesignPage"));

export default function AdminApp() {
  const session = useSession();
  const { theme } = useSettings();

  // The crew dashboard follows the theme setting; the customer app always stays dark.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    return () => { delete document.documentElement.dataset.theme; };
  }, [theme]);

  if (!session.user) return <PinGate />;
  return (
    <Shell>
      <Suspense fallback={<div className="py-24 text-center text-sm text-fg/40">Loading…</div>}>
      <Routes>
        <Route index element={<Gate perm="dashboard" fallback="/admin/calendar"><DashboardPage /></Gate>} />
        <Route path="jobs" element={<Gate perm="jobs"><JobsPage /></Gate>} />
        <Route path="jobs/:id/*" element={<Gate perm="jobs"><JobPage /></Gate>} />
        <Route path="job/:id" element={<LegacyJob />} />
        <Route path="contacts" element={<Gate perm="contacts"><ContactsPage /></Gate>} />
        <Route path="contacts/:id" element={<Gate perm="contacts"><ContactPage /></Gate>} />
        <Route path="calendar" element={<Gate perm="calendar"><CalendarPage /></Gate>} />
        <Route path="proposals" element={<Gate perm="proposals"><ProposalsPage /></Gate>} />
        <Route path="invoices" element={<Gate perm="invoices"><InvoicesPage /></Gate>} />
        <Route path="invoices/:id" element={<Gate perm="invoices"><InvoiceEditor /></Gate>} />
        <Route path="inventory/*" element={<Gate perm="inventory"><InventoryPage /></Gate>} />
        <Route path="tasks" element={<Gate perm="tasks"><TasksPage /></Gate>} />
        <Route path="messages" element={<Gate perm="messages"><MessagesPage /></Gate>} />
        <Route path="documents" element={<Gate perm="documents"><DocumentsPage /></Gate>} />
        <Route path="reviews" element={<Gate perm="reviews"><ReviewsPage /></Gate>} />
        <Route path="analytics" element={<Gate perm="analytics"><AnalyticsPage /></Gate>} />
        <Route path="settings/*" element={<Gate perm="settings"><SettingsPage /></Gate>} />
        <Route path="design" element={<DesignPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
      </Suspense>
    </Shell>
  );
}

function LegacyJob() {
  const { id } = useParams();
  return <Navigate to={`/admin/jobs/${id}`} replace />;
}

/** Route guard: shows a friendly wall (or redirects) when the current role can't see a section. */
export function Gate({ perm, children, fallback }: { perm: Perm; children: ReactNode; fallback?: string }) {
  const { can } = useSession();
  if (can(perm)) return <>{children}</>;
  if (fallback) return <Navigate to={fallback} replace />;
  return (
    <div className="grid place-items-center py-24 text-center">
      <Lock className="text-fg/30" size={32} />
      <p className="mt-3 font-display text-lg">Not available for your role</p>
      <p className="mt-1 text-sm text-fg/50">Ask the owner if you need access.</p>
    </div>
  );
}

function PinGate() {
  const [v, setV] = useState("");
  const [bad, setBad] = useState(false);
  return (
    <div className="grid min-h-screen place-items-center bg-bg px-4 text-fg">
      <form
        className="w-full max-w-xs text-center"
        onSubmit={(e) => {
          e.preventDefault();
          if (!signIn(v)) { setBad(true); setV(""); }
        }}
      >
        <Logo className="mx-auto h-14" />
        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-fg/50"><Lock size={14} /> Crew dashboard</div>
        <Input autoFocus type="password" inputMode="numeric" value={v} onChange={(e) => { setV(e.target.value); setBad(false); }} placeholder="Your PIN" aria-label="PIN" className={cx("mt-4 text-center text-2xl tracking-[.5em]", bad && "border-accent")} />
        {bad && <p className="mt-2 text-sm text-accent-fg">That PIN doesn't match anyone</p>}
        <Button className="mt-4 w-full" type="submit">Unlock</Button>
        {import.meta.env.VITE_DEMO ? (
          <p className="mt-6 text-xs text-fg/50">Demo PINs: owner <b className="text-fg/80">1234</b> · installer <b className="text-fg/80">2222</b> · technician <b className="text-fg/80">3333</b> · Valley installer <b className="text-fg/80">4444</b></p>
        ) : (
          <p className="mt-6 text-xs text-fg/35">Owner PIN is set in Settings → Business. Staff get their own PIN under Settings → Staff.</p>
        )}
      </form>
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const session = useSession();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  const items = NAV.filter((n) => session.can(n.perm));
  const primary = items.filter((n) => n.primary);

  return (
    <div className="min-h-screen bg-bg text-fg">
      {session.viewAs && (
        <div className="no-print sticky top-0 z-30 flex items-center justify-center gap-3 bg-warn/15 px-4 py-2 text-sm text-warn">
          <Eye size={15} /> Viewing as {ROLES.find((r) => r.id === session.viewAs)?.label}
          <button type="button" onClick={() => setViewAs(null)} className="font-semibold underline">Back to owner</button>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-fg/10 bg-sunken lg:flex">
        <SidebarBody items={items} />
      </aside>

      {/* Phone drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-scrim/60 lg:hidden" onClick={() => setOpen(false)} />
            <motion.aside initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-fg/10 bg-sunken lg:hidden">
              <button type="button" onClick={() => setOpen(false)} className="absolute right-3 top-4 rounded-lg p-2 text-fg/50 hover:text-fg" aria-label="Close menu"><X size={20} /></button>
              <SidebarBody items={items} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="lg:pl-60">
        <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-fg/10 bg-bg/85 px-4 backdrop-blur-xl sm:px-6">
          <button type="button" onClick={() => setOpen(true)} className="-ml-2 rounded-lg p-2 text-fg/60 hover:text-fg lg:hidden" aria-label="Open menu"><Menu size={20} /></button>
          <Logo flat className="h-8 lg:hidden" />
          <div className="flex-1" />
          <Link to="/" className="hidden items-center gap-1.5 text-sm text-fg/50 hover:text-fg sm:flex">Customer app <ExternalLink size={13} /></Link>
          <NotificationBell />
          <UserMenu />
        </header>
        <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:pb-12">{children}</main>
      </div>

      {/* Phone tab bar */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-20 flex border-t border-fg/10 bg-sunken/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        {primary.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === "/admin"} className={({ isActive }) => cx("flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]", isActive ? "text-accent-fg" : "text-fg/50")}>
            <n.icon size={20} /> {n.label}
          </NavLink>
        ))}
        <button type="button" onClick={() => setOpen(true)} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] text-fg/50"><MoreHorizontal size={20} /> More</button>
      </nav>
    </div>
  );
}

function SidebarBody({ items }: { items: typeof NAV }) {
  return (
    <>
      <div className="flex h-14 items-center px-5"><Logo flat className="h-8" /></div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
        {items.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === "/admin"}
            className={({ isActive }) => cx("flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition", isActive ? "bg-accent/15 font-medium text-fg" : "text-fg/60 hover:bg-fg/[.05] hover:text-fg")}>
            {({ isActive }) => <><n.icon size={17} className={isActive ? "text-accent-fg" : undefined} /> {n.label}</>}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-fg/10 p-3">
        <NavLink to="/admin/design" className={({ isActive }) => cx("flex items-center gap-3 rounded-lg px-3 py-2 text-xs transition", isActive ? "text-fg" : "text-fg/40 hover:text-fg")}>
          <Palette size={15} /> Design system
        </NavLink>
      </div>
    </>
  );
}

function UserMenu() {
  const { user, viewAs } = useSession();
  const [open, setOpen] = useState(false);
  if (!user) return null;
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-full p-0.5 hover:bg-fg/10" aria-label="Account">
        <Avatar name={user.name} color={user.color} size={30} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-64 rounded-2xl border border-fg/10 bg-surface p-3 shadow-pop">
            <div className="px-2 pb-3">
              <div className="font-semibold">{user.name}</div>
              <div className="text-xs text-fg/50">{ROLES.find((r) => r.id === user.role)?.label}</div>
            </div>
            {user.role === "owner" && (
              <label className="block px-2 pb-3">
                <span className="mb-1 flex items-center gap-1.5 text-xs text-fg/50"><Eye size={12} /> View as</span>
                <Select value={viewAs ?? ""} onChange={(e) => setViewAs((e.target.value || null) as Role | null)} className="!py-2 text-sm">
                  <option value="">Owner (me)</option>
                  {ROLES.filter((r) => r.id !== "owner").map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </Select>
              </label>
            )}
            <button type="button" onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg/70 hover:bg-fg/[.06] hover:text-fg"><LogOut size={15} /> Sign out</button>
          </div>
        </>
      )}
    </div>
  );
}
