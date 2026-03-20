import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./lib/AuthContext";

import DashboardPage from "./pages/DashboardPage";
import AccountPage from "./pages/AccountPage";

import AdminHome from "./pages/AdminHome";
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

  if (loading) {
    return <p style={{ padding: "20px" }}>Caricamento...</p>;
  }

  return (
    <>
      {user && <TopBar />}

      <div style={{ paddingTop: user ? "60px" : "0" }}>
        <Routes>
          {/* ---------- PUBLIC ---------- */}
          {!user && (
            <>
              <Route path="/" element={<PreAuthPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/register" element={<SignupPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}

          {/* ---------- PROTECTED ---------- */}
          {user && (
            <>
              {/* User */}
              <Route path="/" element={<DashboardPage />} />
              <Route path="/account" element={<AccountPage />} />

              {/* Admin (guardato) */}
              <Route
                path="/admin"
                element={
                  <RequireAdmin>
                    <AdminHome />
                  </RequireAdmin>
                }
              />
              <Route
                path="/admin/candidatures"
                element={
                  <RequireAdmin>
                    <AdminCandidatures />
                  </RequireAdmin>
                }
              />
              <Route
                path="/admin/maps"
                element={
                  <RequireAdmin>
                    <AdminMaps />
                  </RequireAdmin>
                }
              />
              <Route
                path="/admin/interlocking"
                element={
                  <RequireAdmin>
                    <AdminInterlocking />
                  </RequireAdmin>
                }
              />
              <Route
                path="/admin/test-users"
                element={
                  <RequireAdmin>
                    <AdminTestUsers />
                  </RequireAdmin>
                }
              />

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
