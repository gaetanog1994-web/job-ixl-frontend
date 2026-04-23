import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./lib/AuthContext";

import MobilityDashboard from "./pages/MobilityDashboard";
import AccountPage from "./pages/AccountPage";
import HomeEntry from "./pages/HomeEntry";
import OwnerAreaPage from "./pages/OwnerAreaPage";
import CompanyPerimetersPage from "./pages/CompanyPerimetersPage";

import AdminCandidatures from "./pages/AdminCandidatures";
import AdminCampaigns from "./pages/AdminCampaigns";
import AdminMaps from "./pages/AdminMaps";
import AdminInterlocking from "./pages/AdminInterlocking";
import AdminTestUsers from "./pages/AdminTestUsers";

import TopBar from "./pages/TopBar";
import PreAuthPage from "./pages/PreAuthPage";
import LoginPage from "./pages/LoginPage";
import RequireAdmin from "./components/RequireAdmin";
import RequireOwner from "./components/RequireOwner";
import RequireCompanyAdmin from "./components/RequireCompanyAdmin";
import RequirePerimeterAccess from "./components/RequirePerimeterAccess";
import { ActiveContextProvider, useActiveContext } from "./lib/ActiveContextProvider";

function AppShell({ showTopBar }: { showTopBar: boolean }) {
  const { activeSelection, isBootstrappingContext, isContextResolved, contextError } = useActiveContext();
  const contextRouteKey = `${activeSelection?.profile ?? "none"}:${activeSelection?.companyId ?? "none"}:${activeSelection?.perimeterId ?? "none"}`;
  const waitingContext = showTopBar && (!isContextResolved || isBootstrappingContext);

  return (
    <>
      {showTopBar && <TopBar />}

      <div style={{ paddingTop: showTopBar ? "48px" : "0" }}>
        {waitingContext && (
          <div style={{ padding: "24px", fontFamily: "'Inter', sans-serif", color: contextError ? "#991b1b" : "#64748b" }}>
            {contextError ?? "Caricamento contesto..."}
          </div>
        )}
        {!waitingContext && (
        <Routes key={contextRouteKey}>
          {/* ---------- PUBLIC ---------- */}
          {!showTopBar && (
            <>
              <Route path="/" element={<PreAuthPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<Navigate to="/login" replace />} />
              <Route path="/register" element={<Navigate to="/login" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}

          {/* ---------- PROTECTED ---------- */}
          {showTopBar && (
            <>
              {/* Unified dashboard (replaces DashboardPage + AccountPage) */}
              <Route path="/" element={<HomeEntry />} />
              <Route path="/dashboard" element={<MobilityDashboard />} />

              <Route path="/owner" element={<RequireOwner><OwnerAreaPage /></RequireOwner>} />
              <Route
                path="/companies/:companyId/perimeters"
                element={
                  <RequireCompanyAdmin>
                    <CompanyPerimetersPage />
                  </RequireCompanyAdmin>
                }
              />

              <Route path="/account" element={<AccountPage />} />

              {/* Admin (guarded by RequireAdmin) */}
              <Route path="/admin" element={<Navigate to="/admin/interlocking" replace />} />
              <Route path="/admin/candidatures" element={<RequireAdmin><AdminCandidatures /></RequireAdmin>} />
              <Route path="/admin/campagne" element={<RequireAdmin><AdminCampaigns /></RequireAdmin>} />
              <Route path="/admin/maps" element={<RequireAdmin><AdminMaps /></RequireAdmin>} />
              <Route
                path="/admin/interlocking"
                element={
                  <RequirePerimeterAccess>
                    <AdminInterlocking />
                  </RequirePerimeterAccess>
                }
              />
              <Route path="/admin/test-users" element={<RequireAdmin><AdminTestUsers /></RequireAdmin>} />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Routes>
        )}
      </div>
    </>
  );
}

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: "flex", height: "100vh", alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
        color: "#64748b", fontSize: "14px", gap: "10px", background: "#f1f5f9",
      }}>
        <div style={{
          width: 18, height: 18,
          border: "2px solid #e2e8f0", borderTopColor: "#e8511a",
          borderRadius: "50%", animation: "spin 0.6s linear infinite",
        }} />
        Caricamento…
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const showTopBar = Boolean(user);

  return (
    <ActiveContextProvider>
      <AppShell showTopBar={showTopBar} />
    </ActiveContextProvider>
  );
}

export default App;
