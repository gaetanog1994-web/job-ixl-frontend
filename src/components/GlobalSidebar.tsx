import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { appApi } from "../lib/appApi";
import { useSidebar } from "../lib/SidebarContext";
import "../styles/dashboard.css";

/**
 * GlobalSidebar — drawer a scomparsa, montato a livello di root (in main.tsx).
 * È completamente self-contained: carica i propri dati (user, isAdmin, availabilityStatus)
 * senza dipendere da props esterne. Funziona in ogni schermata dell'app.
 */
const GlobalSidebar: React.FC = () => {
  const { isOpen, close } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();

  const [userData, setUserData] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  /* ---- load user data ---- */
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [me, userInfo] = await Promise.allSettled([
          appApi.getMe(),
          appApi.getMyUser(),
        ]);
        if (cancelled) return;
        if (me.status === "fulfilled") setIsAdmin(!!me.value?.isAdmin);
        if (userInfo.status === "fulfilled") setUserData(userInfo.value);
      } catch {
        // silently ignore — sidebar works even without data
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  /* ---- availability toggle (self-contained) ---- */
  const handleToggleAvailability = async () => {
    if (!userData) return;
    try {
      if (userData.availability_status === "available") {
        await appApi.deactivateMe();
        setUserData({ ...userData, availability_status: "inactive" });
      } else {
        await appApi.activateMe();
        setUserData({ ...userData, availability_status: "available" });
      }
    } catch (e: any) {
      console.error("[GlobalSidebar] toggleAvailability error:", e?.message ?? e);
    }
  };

  /* ---- logout ---- */
  const handleLogout = async () => {
    close();
    await supabase.auth.signOut();
    navigate("/login");
  };

  /* ---- navigate + close ---- */
  const go = (path: string) => {
    close();
    navigate(path);
  };

  const isActive = (path: string) => location.pathname === path;

  const initials = userData?.full_name
    ? userData.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  const available = userData?.availability_status === "available";

  return (
    <>
      {/* ---- Backdrop ---- */}
      <div
        onClick={close}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15,23,42,0.45)",
          zIndex: 9998,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
          transition: "opacity 0.25s ease",
          backdropFilter: isOpen ? "blur(2px)" : "none",
        }}
      />

      {/* ---- Drawer ---- */}
      <aside
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: "var(--sidebar-width, 240px)",
          zIndex: 9999,
          transform: isOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)",
          display: "flex",
          flexDirection: "column",
          fontFamily: "var(--font, 'Inter', sans-serif)",
          background: "var(--sidebar-bg, #0f172a)",
          boxShadow: isOpen ? "4px 0 24px rgba(0,0,0,0.25)" : "none",
          overflowY: "auto",
        }}
      >
        {/* ---- Logo + Close ---- */}
        <div style={{
          padding: "20px 16px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, background: "#FFFFFF",
              borderRadius: 9, display: "flex", alignItems: "center",
              justifyContent: "center", flexShrink: 0,
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              overflow: "hidden"
            }}>
              <img src="/jip-logo-icon.jpg" alt="JIP Logo" style={{ width: "80%", height: "80%", objectFit: "contain" }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: "0.01em" }}>
                JIP
              </div>
              <div style={{ fontSize: 11, color: "var(--sidebar-text, #94a3b8)", marginTop: 1 }}>
                Mobility Platform
              </div>
            </div>
          </div>

          {/* Close X */}
          <button
            id="sidebar-close-btn"
            onClick={close}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "none",
              borderRadius: 8,
              width: 30, height: 30,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
              color: "var(--sidebar-text, #94a3b8)",
              fontSize: 16,
              flexShrink: 0,
              transition: "background 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
          >
            ✕
          </button>
        </div>

        {/* ---- Nav ---- */}
        <nav style={{ flex: 1, padding: "14px 10px", overflowY: "auto" }}>
          <div className="db-section-label">Principale</div>

          <button
            id="global-nav-dashboard"
            className={`db-nav-item ${isActive("/") ? "active" : ""}`}
            onClick={() => go("/")}
          >
            <span className="db-nav-icon">🗺️</span>
            <span className="db-nav-label">Dashboard</span>
          </button>

          {isAdmin && (
            <>
              <div className="db-section-label" style={{ marginTop: 12 }}>Amministrazione</div>

              <button
                id="global-nav-admin-toggle"
                className="db-nav-item"
                onClick={() => setAdminOpen(o => !o)}
              >
                <span className="db-nav-icon">⚙️</span>
                <span className="db-nav-label">Area Admin</span>
                <span className={`db-nav-chevron ${adminOpen ? "open" : ""}`}>▶</span>
              </button>

              <div
                className="db-admin-submenu"
                style={{ maxHeight: adminOpen ? "300px" : "0" }}
              >
                <button className="db-admin-sub-item" onClick={() => go("/admin/candidatures")} id="gn-cadidatures">Candidature</button>
                <button className="db-admin-sub-item" onClick={() => go("/admin/maps")} id="gn-maps">Mappe utenti</button>
                <button className="db-admin-sub-item" onClick={() => go("/admin/interlocking")} id="gn-interlocking">Interlocking</button>
                <button className="db-admin-sub-item" onClick={() => go("/admin/test-users")} id="gn-config">Configurazione</button>
              </div>
            </>
          )}
        </nav>

        {/* ---- Footer ---- */}
        <div style={{
          padding: "12px 10px 16px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}>
          {/* Availability */}
          <button
            id="global-sidebar-availability"
            className="db-sidebar-availability"
            onClick={handleToggleAvailability}
            title={available ? "Clicca per disattivarti" : "Clicca per attivarti"}
          >
            <div className={`db-avail-dot ${available ? "available" : "inactive"}`} />
            <span className={`db-avail-text ${available ? "available" : ""}`}>
              {available ? "Disponibile" : "Non disponibile"}
            </span>
          </button>

          {/* User box */}
          {userData && (
            <div className="db-user-box">
              <div className="db-user-avatar">{initials}</div>
              <div className="db-user-info">
                <div className="db-user-name">{userData.full_name ?? "Utente"}</div>
                <div className="db-user-role">{userData.email ?? ""}</div>
              </div>
            </div>
          )}

          {/* Logout */}
          <button className="db-logout-btn" onClick={handleLogout} id="global-logout-btn">
            <span style={{ fontSize: 14 }}>↩</span>
            Esci
          </button>
        </div>
      </aside>
    </>
  );
};

export default GlobalSidebar;
