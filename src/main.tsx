import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./styles.css";
import QuotePage from "./pages/Quote";
import AdminPage from "./pages/Admin";
import JobCompletePage from "./pages/JobComplete";
import WarrantyPage from "./pages/Warranty";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/job/:id" element={<JobCompletePage />} />
        <Route path="/warranty" element={<WarrantyPage />} />
        <Route path="*" element={<QuotePage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
