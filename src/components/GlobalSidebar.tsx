import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { appApi } from "../lib/appApi";
import { useSidebar } from "../lib/SidebarContext";
import { useAvailability } from "../lib/AvailabilityContext";
import { labelAccessRole, labelHighestRole } from "../lib/accessLabels";
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
  const [meData, setMeData] = useState<any>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const { availabilityStatus, isAdmin, toggleAvailability } = useAvailability();

  /* ---- load user data ---- */
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [userInfo, me] = await Promise.allSettled([
          appApi.getMyUser(),
          appApi.getMe(),
        ]);
        if (cancelled) return;
        if (userInfo.status === "fulfilled") {
          setUserData(userInfo.value);
        }
        if (me.status === "fulfilled") {
          setMeData(me.value);
        }
      } catch {
        // silently ignore — sidebar works even without data
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (location.pathname.startsWith("/admin")) {
      setAdminOpen(true);
    }
  }, [location.pathname]);

  /* ---- logout ---- */
  const handleLogout = async () => {
    close();
    appApi.clearTenantContext();
    await supabase.auth.signOut();
    navigate("/login");
  };

  /* ---- navigate + close ---- */
  const go = (path: string) => {
    close();
    navigate(path);
  };

  const isActive = (path: string) => location.pathname === path;
  const activeAccess = meData?.access ?? null;
  const hasActivePerimeter = !!activeAccess?.currentPerimeterId;
  const activeCompanyId = activeAccess?.currentCompanyId ?? null;
  const isOwner = meData?.isOwner === true;
  const isSuperAdmin = meData?.isSuperAdmin === true;
  const accessRoleLabel = labelAccessRole(activeAccess?.accessRole);
  const highestRoleLabel = labelHighestRole(activeAccess?.highestRole);

  const initials = userData?.full_name
    ? userData.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  const available = availabilityStatus === "available";

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
          <div
            style={{
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.03)",
              borderRadius: 10,
              padding: "8px 10px",
              marginBottom: 10,
              display: "grid",
              gap: 3,
            }}
          >
            <div style={{ fontSize: 11, color: "#e2e8f0", fontWeight: 700 }}>Contesto attivo</div>
            <div style={{ fontSize: 11, color: "var(--sidebar-text)" }}>
              Company: {activeAccess?.currentCompanyName ?? "Non selezionata"}
            </div>
            <div style={{ fontSize: 11, color: "var(--sidebar-text)" }}>
              Perimeter: {activeAccess?.currentPerimeterName ?? "Non selezionato"}
            </div>
            <div style={{ fontSize: 11, color: "var(--sidebar-text)" }}>
              Access: {accessRoleLabel}
            </div>
            <button
              className="db-nav-item"
              style={{
                marginTop: 4,
                marginBottom: 0,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.02)",
                color: "#e2e8f0",
                padding: "7px 9px",
                fontSize: 12,
              }}
              onClick={() => go("/select-context")}
              id="global-nav-change-context"
            >
              <span className="db-nav-icon">🔄</span>
              <span className="db-nav-label">Cambia contesto</span>
            </button>
          </div>

          <div className="db-section-label">Principale</div>

          {hasActivePerimeter && (
            <button
              id="global-nav-dashboard"
              className={`db-nav-item ${isActive("/dashboard") ? "active" : ""}`}
              onClick={() => go("/dashboard")}
            >
              <span className="db-nav-icon">🗺️</span>
              <span className="db-nav-label">Dashboard</span>
            </button>
          )}

          {(isOwner || isSuperAdmin) && (
            <>
              <div className="db-section-label" style={{ marginTop: 12 }}>Multi-tenant</div>

              {isOwner && (
                <button
                  id="global-nav-owner"
                  className={`db-nav-item ${isActive("/owner") ? "active" : ""}`}
                  onClick={() => go("/owner")}
                >
                  <span className="db-nav-icon">🏢</span>
                  <span className="db-nav-label">Owner Area</span>
                </button>
              )}

              {activeCompanyId && (
                <button
                  id="global-nav-company-perimeters"
                  className={`db-nav-item ${location.pathname.includes("/perimeters") ? "active" : ""}`}
                  onClick={() => go(`/companies/${activeCompanyId}/perimeters`)}
                >
                  <span className="db-nav-icon">📍</span>
                  <span className="db-nav-label">Company / Perimeters</span>
                </button>
              )}
            </>
          )}

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
            disabled={!isAdmin}
            onClick={isAdmin ? toggleAvailability : undefined}
            title={isAdmin ? (available ? "Clicca per disattivarti" : "Clicca per attivarti") : "Solo gli admin possono modificare la disponibilità"}
            style={!isAdmin ? { cursor: "default", opacity: 0.7 } : undefined}
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
                <div className="db-user-role">
                  {highestRoleLabel} · {accessRoleLabel}
                </div>
                <div className="db-user-role">
                  {activeAccess?.currentCompanyName ?? "-"}
                  {activeAccess?.currentPerimeterName ? ` / ${activeAccess.currentPerimeterName}` : " / -"}
                </div>
              </div>
            </div>
          )}

          {/* Account */}
          <button
            className="db-nav-item"
            onClick={() => { go("/account"); }}
            id="global-nav-account"
          >
            <span className="db-nav-icon">🔑</span>
            <span className="db-nav-label">Profilo & Sicurezza</span>
          </button>

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
