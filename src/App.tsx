import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./lib/AuthContext";

import MobilityDashboard from "./pages/MobilityDashboard";

import AdminCandidatures from "./pages/AdminCandidatures";
import AdminMaps from "./pages/AdminMaps";
import AdminInterlocking from "./pages/AdminInterlocking";
import AdminTestUsers from "./pages/AdminTestUsers";

import TopBar from "./pages/TopBar";
import PreAuthPage from "./pages/PreAuthPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/RegisterPage";
import RequireAdmin from "./components/RequireAdmin";

function App() {
  const { user, loading } = useAuth();
  const location = useLocation();

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

  const isAdminRoute = location.pathname.startsWith("/admin");

  return (
    <>
      {/* TopBar only for admin routes (dashboard has its own inline topbar) */}
      {user && isAdminRoute && <TopBar />}

      <div style={{ paddingTop: user && isAdminRoute ? "64px" : "0" }}>
        <Routes>
          {/* ---------- PUBLIC ---------- */}
          {!user && (
            <>
              <Route path="/" element={<PreAuthPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<Navigate to="/login" replace />} />
              <Route path="/register" element={<Navigate to="/login" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}

          {/* ---------- PROTECTED ---------- */}
          {user && (
            <>
              {/* Unified dashboard (replaces DashboardPage + AccountPage) */}
              <Route path="/" element={<MobilityDashboard />} />

              {/* /account → redirect to unified dashboard */}
              <Route path="/account" element={<Navigate to="/" replace />} />

              {/* Admin (guarded by RequireAdmin) */}
              <Route path="/admin" element={<Navigate to="/admin/interlocking" replace />} />
              <Route path="/admin/candidatures" element={<RequireAdmin><AdminCandidatures /></RequireAdmin>} />
              <Route path="/admin/maps" element={<RequireAdmin><AdminMaps /></RequireAdmin>} />
              <Route path="/admin/interlocking" element={<RequireAdmin><AdminInterlocking /></RequireAdmin>} />
              <Route path="/admin/test-users" element={<RequireAdmin><AdminTestUsers /></RequireAdmin>} />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Routes>
      </div>
    </>
  );
}

export default App;
