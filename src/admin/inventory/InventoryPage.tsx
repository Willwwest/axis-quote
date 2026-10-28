import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { Plus, Scissors, SearchX } from "lucide-react";
import { Button, Card, CardHeader, EmptyState, PageHeader, Tabs } from "../../components/ui";
import { codeOldRolls, findByCode, inStock, seedFilmTypes } from "../../lib/film";
import { useSession } from "../../lib/session";
import { remnants, rolls } from "../../lib/store";
import { FilmTypePage, FilmTypesTab } from "./FilmTypes";
import { ForecastTab } from "./ForecastTab";
import { LabelsTab } from "./LabelsTab";
import { LogCut } from "./LogCut";
import { RemnantsTab } from "./RemnantsTab";
import { RollForm } from "./RollForm";
import { RollPage } from "./RollPage";
import { RollsTab } from "./RollsTab";
import { ScanTab } from "./ScanTab";
import { SummaryTab } from "./SummaryTab";
import { UseRow, useStock } from "./shared";

type Tab = "summary" | "rolls" | "types" | "remnants" | "forecast" | "labels" | "scan";
const TABS: { id: Tab; label: string }[] = [
  { id: "summary", label: "Summary" }, { id: "rolls", label: "Rolls" }, { id: "types", label: "Film types" }, { id: "remnants", label: "Remnants" },
  { id: "forecast", label: "Forecast" }, { id: "labels", label: "Labels" }, { id: "scan", label: "Scan" },
];

/** Mounted at /admin/inventory/*. */
export default function InventoryPage() {
  useEffect(() => { seedFilmTypes(); codeOldRolls(); }, []);
  return (
    <Routes>
      <Route index element={<Home tab="summary" />} />
      {TABS.slice(1).map((t) => <Route key={t.id} path={t.id} element={<Home tab={t.id} />} />)}
      <Route path="rolls/:id" element={<RollPage />} />
      <Route path="types/:id" element={<FilmTypePage />} />
      <Route path="r/:code" element={<RollByCode />} />
      <Route path="*" element={<Navigate to="/admin/inventory" replace />} />
    </Routes>
  );
}

type SheetState = { kind: "roll" } | { kind: "cut"; rollId?: string } | null;

function Home({ tab }: { tab: Tab }) {
  const nav = useNavigate();
  const { can } = useSession();
  const { rolls: all, log } = useStock();
  const spare = remnants.use().filter((r) => !r.usedAt).length;
  const [sheet, setSheet] = useState<SheetState>(null);
  const add = can("inventory.manage") ? () => setSheet({ kind: "roll" }) : undefined;
  const cut = (rollId?: string) => setSheet({ kind: "cut", rollId });

  return (
    <div>
      <PageHeader
        title="Inventory"
        sub="Film on the shelf, what booked jobs will pull, and every cut taken off it."
        actions={
          <div className="no-print flex gap-2">
            {add && <Button variant="outline" onClick={add}><Plus size={16} /> Add roll</Button>}
            <Button onClick={() => cut()} disabled={!all.some(inStock)}><Scissors size={16} /> Log a cut</Button>
          </div>
        }
      />
      <div className="no-print">
        <Tabs value={tab} onChange={(t) => nav(t === "summary" ? "/admin/inventory" : `/admin/inventory/${t}`)}
          tabs={TABS.map((t) => ({ ...t, count: t.id === "rolls" ? all.filter(inStock).length || undefined : t.id === "remnants" ? spare || undefined : undefined }))} />
      </div>

      {tab === "summary" && (
        <>
          <SummaryTab onAdd={add} />
          {log.length > 0 && (
            <Card className="no-print mt-8">
              <CardHeader title="Recent activity" sub="Cuts, check-ins and weigh-ins across every roll" />
              <div className="-mx-4 divide-y divide-fg/5 sm:-mx-5">
                {[...log].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15).map((u) => (
                  <UseRow key={u.id} use={u} roll={all.find((r) => r.id === u.rollId)} showRoll />
                ))}
              </div>
            </Card>
          )}
        </>
      )}
      {tab === "rolls" && <RollsTab onCut={cut} onAdd={add} />}
      {tab === "types" && <FilmTypesTab />}
      {tab === "remnants" && <RemnantsTab />}
      {tab === "forecast" && <ForecastTab />}
      {tab === "labels" && <LabelsTab />}
      {tab === "scan" && <ScanTab />}

      <AnimatePresence>
        {sheet?.kind === "roll" && <RollForm key="roll" onClose={() => setSheet(null)} onSaved={(r) => nav(`/admin/inventory/rolls/${r.id}`)} />}
        {sheet?.kind === "cut" && <LogCut key="cut" rollId={sheet.rollId} onClose={() => setSheet(null)} />}
      </AnimatePresence>
    </div>
  );
}

/** Where a roll's QR label points: /admin/inventory/r/<code>. */
function RollByCode() {
  const { code = "" } = useParams();
  const nav = useNavigate();
  const roll = findByCode(code, rolls.use());
  if (roll) return <Navigate to={`/admin/inventory/rolls/${roll.id}`} replace />;
  return (
    <EmptyState icon={<SearchX size={32} />} title={`No roll with code ${code}`} actions={<Button variant="outline" onClick={() => nav("/admin/inventory/rolls")}>All rolls</Button>}>
      The label may belong to a roll that was deleted.
    </EmptyState>
  );
}
