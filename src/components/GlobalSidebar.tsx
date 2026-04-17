import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { appApi } from "../lib/appApi";
import { useSidebar } from "../lib/SidebarContext";
import { useAuth } from "../lib/AuthContext";
import { labelAccessRole, labelHighestRole } from "../lib/accessLabels";
import "../styles/dashboard.css";

type AccessPayloadShape = {
  currentCompanyId?: string | null;
  currentPerimeterId?: string | null;
  currentCompanyName?: string | null;
  currentPerimeterName?: string | null;
  accessRole?: string | null;
  highestRole?: string | null;
  companies?: Record<string, unknown>[];
  [key: string]: unknown;
};

type MeDataShape = {
  isOwner?: boolean;
  isSuperAdmin?: boolean;
  access?: AccessPayloadShape | null;
  [key: string]: unknown;
};

/**
 * GlobalSidebar — drawer a scomparsa, montato a livello di root (in main.tsx).
 * È completamente self-contained: carica i propri dati utente e contesto corrente
 * senza dipendere da props esterne. Funziona in ogni schermata dell'app.
 */
const GlobalSidebar: React.FC = () => {
  const { isOpen, close } = useSidebar();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [userData, setUserData] = useState<Record<string, unknown> | null>(null);
  const [meData, setMeData] = useState<MeDataShape | null>(null);

  /* ---- load user data ---- */
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!user?.id) {
        if (!cancelled) {
          setUserData(null);
          setMeData(null);
        }
        return;
      }
      try {
        const mePayload = await appApi.getMe() as MeDataShape;
        if (cancelled) return;
        setMeData(mePayload);

        const hasPerimeter = !!mePayload?.access?.currentPerimeterId;
        if (hasPerimeter) {
          try {
            const userInfo = await appApi.getMyUser();
            if (!cancelled) setUserData(userInfo);
          } catch {
            if (!cancelled) setUserData(null);
          }
        } else if (!cancelled) {
          setUserData(null);
        }

        if (mePayload) {
          setMeData(mePayload as MeDataShape);
        }
      } catch {
        // silently ignore — sidebar works even without data
      }
    };

    const handleTenantContextChanged = () => {
      void load();
    };
    const handleTenantStructureChanged = () => {
      void load();
    };

    void load();
    window.addEventListener("tenant-context-changed", handleTenantContextChanged);
    window.addEventListener("tenant-structure-changed", handleTenantStructureChanged);

    return () => {
      cancelled = true;
      window.removeEventListener("tenant-context-changed", handleTenantContextChanged);
      window.removeEventListener("tenant-structure-changed", handleTenantStructureChanged);
    };
  }, [user?.id]);

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

  const activeAccess = meData?.access ?? null;
  const accessRoleLabel = labelAccessRole(activeAccess?.accessRole);
  const highestRoleLabel = labelHighestRole(activeAccess?.highestRole);

  const fullName = typeof userData?.full_name === "string" ? userData.full_name : null;
  const initials = fullName
    ? fullName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "U";

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
            <div style={{ fontSize: 11, color: "#e2e8f0", fontWeight: 700 }}>Ambito corrente</div>
            <div style={{ fontSize: 11, color: "var(--sidebar-text)" }}>
              Company: {activeAccess?.currentCompanyName ?? "Non selezionata"}
            </div>
            <div style={{ fontSize: 11, color: "var(--sidebar-text)" }}>
              Perimeter: {activeAccess?.currentPerimeterName ?? "Non selezionato"}
            </div>
            <div style={{ fontSize: 11, color: "var(--sidebar-text)" }}>
              Access: {accessRoleLabel}
            </div>
          </div>
        </nav>

        {/* ---- Footer ---- */}
        <div style={{
          padding: "12px 10px 16px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}>
          {/* User box */}
          {userData && (
            <div className="db-user-box">
              <div className="db-user-avatar">{initials}</div>
              <div className="db-user-info">
                <div className="db-user-name">{fullName ?? "Utente"}</div>
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
