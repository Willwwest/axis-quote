import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./styles.css";
import QuotePage from "./pages/Quote";

// Customers only download the quote app; the crew dashboard and customer link pages load on demand.
const AdminApp = lazy(() => import("./admin/AdminApp"));
const WarrantyPage = lazy(() => import("./pages/Warranty"));
const ProposalPage = lazy(() => import("./public/ProposalPage"));
const InvoicePage = lazy(() => import("./public/InvoicePage"));
const SignPage = lazy(() => import("./public/SignPage"));
const AppointmentPage = lazy(() => import("./public/AppointmentPage"));
const ReviewsPage = lazy(() => import("./public/ReviewsPage"));
const RoutePage = lazy(() => import("./public/RoutePage"));

// The shared demo site (npm run build:pages) gives each browser the sample data once, the first time it opens the
// dashboard or reviews page. The flag sits outside the axis.* keys, so "Reset all data" really does leave it empty.
async function seedDemo() {
  try {
    if (!import.meta.env.VITE_DEMO || !/\/(admin|reviews)/.test(location.pathname) || localStorage.getItem("axisDemoSeeded")) return;
    (await import("./lib/samples")).loadDemoData();
    localStorage.setItem("axisDemoSeeded", new Date().toISOString());
  } catch (e) {
    // Storage blocked (private window) or a broken sample: the app still runs, just without the demo data.
    console.warn("Demo data not loaded", e);
  }
}

seedDemo().finally(() =>
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Suspense fallback={<div className="min-h-screen bg-bg" />}>
          <Routes>
            <Route path="/admin/*" element={<AdminApp />} />
            <Route path="/warranty" element={<WarrantyPage />} />
            <Route path="/p/:id" element={<ProposalPage />} />
            <Route path="/i/:id" element={<InvoicePage />} />
            <Route path="/s/:id" element={<SignPage />} />
            <Route path="/a/:id" element={<AppointmentPage />} />
            <Route path="/reviews" element={<ReviewsPage />} />
            <Route path="/route/:id" element={<RoutePage />} />
            <Route path="*" element={<QuotePage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </StrictMode>,
  ),
);
