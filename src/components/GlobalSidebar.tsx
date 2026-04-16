import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { appApi } from "../lib/appApi";
import { useSidebar } from "../lib/SidebarContext";
import { useAvailability } from "../lib/AvailabilityContext";
import { labelAccessRole, labelHighestRole } from "../lib/accessLabels";
import { buildPrimaryNavigationModel, type NavLeafItem } from "../lib/navigationModel";
import "../styles/dashboard.css";

type PlatformCompany = {
  id: string;
  name: string;
};

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
  isAdmin?: boolean;
  access?: AccessPayloadShape | null;
  [key: string]: unknown;
};

/**
 * GlobalSidebar — drawer a scomparsa, montato a livello di root (in main.tsx).
 * È completamente self-contained: carica i propri dati (user, isAdmin, availabilityStatus)
 * senza dipendere da props esterne. Funziona in ogni schermata dell'app.
 */
const GlobalSidebar: React.FC = () => {
  const { isOpen, close } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();

  const [userData, setUserData] = useState<Record<string, unknown> | null>(null);
  const [meData, setMeData] = useState<MeDataShape | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [ownerOpen, setOwnerOpen] = useState(true);
  const [superAdminOpen, setSuperAdminOpen] = useState(true);
  const [ownerCompanies, setOwnerCompanies] = useState<PlatformCompany[]>([]);
  const [superAdminPerimetersByCompany, setSuperAdminPerimetersByCompany] = useState<Record<string, Record<string, unknown>[]>>({});
  const { availabilityStatus, isAdmin, toggleAvailability } = useAvailability();

  /* ---- load user data ---- */
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
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
          const access = mePayload?.access ?? null;
          const companyMemberships = Array.isArray(access?.companies) ? access.companies : [];

          if (mePayload?.isOwner === true) {
            const companyRows = await appApi.platformGetCompanies();
            if (!cancelled) {
              setOwnerCompanies(
                (companyRows ?? []).map((company: Record<string, unknown>) => ({
                  id: String(company?.id ?? company?.company_id ?? ""),
                  name: String(company?.name ?? company?.company_name ?? "Company"),
                })).filter((company: PlatformCompany) => company.id)
              );
            }
          } else if (!cancelled) {
            setOwnerCompanies([]);
          }

          if (companyMemberships.length > 0) {
            const map: Record<string, Record<string, unknown>[]> = {};
            await Promise.all(
              companyMemberships.map(async (company: Record<string, unknown>) => {
                const companyId = String(company?.company_id ?? "");
                if (!companyId) return;
                try {
                  const rows = await appApi.platformGetPerimeters(companyId);
                  map[companyId] = rows ?? [];
                } catch {
                  map[companyId] = [];
                }
              })
            );
            if (!cancelled) setSuperAdminPerimetersByCompany(map);
          } else if (!cancelled) {
            setSuperAdminPerimetersByCompany({});
          }
        }
      } catch {
        // silently ignore — sidebar works even without data
      }
    };

    const handleTenantStructureChanged = () => {
      load();
    };

    load();
    window.addEventListener("tenant-structure-changed", handleTenantStructureChanged);

    return () => {
      cancelled = true;
      window.removeEventListener("tenant-structure-changed", handleTenantStructureChanged);
    };
  }, [location.pathname]);

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

  const activeAccess = meData?.access ?? null;
  const hasActivePerimeter = !!activeAccess?.currentPerimeterId;
  const isOwner = meData?.isOwner === true;
  const isSuperAdmin = meData?.isSuperAdmin === true;
  const accessCompanies = useMemo(
    () => (Array.isArray(activeAccess?.companies) ? activeAccess.companies : []),
    [activeAccess?.companies]
  );
  const accessRoleLabel = labelAccessRole(activeAccess?.accessRole);
  const highestRoleLabel = labelHighestRole(activeAccess?.highestRole);
  const primarySections = useMemo(() => buildPrimaryNavigationModel({
    pathname: location.pathname,
    currentCompanyId: activeAccess?.currentCompanyId ?? null,
    currentPerimeterId: activeAccess?.currentPerimeterId ?? null,
    hasActivePerimeter,
    isOwner,
    isSuperAdmin,
    isAdmin,
    ownerCompanies,
    accessCompanies,
    superAdminPerimetersByCompany,
  }), [
    location.pathname,
    activeAccess?.currentCompanyId,
    activeAccess?.currentPerimeterId,
    hasActivePerimeter,
    isOwner,
    isSuperAdmin,
    isAdmin,
    ownerCompanies,
    accessCompanies,
    superAdminPerimetersByCompany,
  ]);
  const dashboardSection = primarySections.find((section) => section.id === "dashboard");
  const ownerSection = primarySections.find((section) => section.id === "owner");
  const superAdminSection = primarySections.find((section) => section.id === "super_admin");
  const adminSection = primarySections.find((section) => section.id === "admin");
  const ownerItems = ownerSection?.items ?? [];
  const ownerHomeItem = ownerItems.find((item) => item.id === "owner-home") ?? null;
  const ownerCompanyItems = ownerItems.filter((item) => item.id !== "owner-home");
  const hasMultiTenantSection = Boolean(ownerSection || superAdminSection);

  const goToItem = (item: NavLeafItem) => {
    if (item.tenantContext) {
      appApi.setTenantContext(item.tenantContext);
    }
    go(item.path);
  };

  const fullName = typeof userData?.full_name === "string" ? userData.full_name : null;
  const initials = fullName
    ? fullName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
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

          {dashboardSection?.items[0] && (
            <button
              id="global-nav-dashboard"
              className={`db-nav-item ${dashboardSection.isActive ? "active" : ""}`}
              onClick={() => goToItem(dashboardSection.items[0])}
            >
              <span className="db-nav-icon">🗺️</span>
              <span className="db-nav-label">{dashboardSection.label}</span>
            </button>
          )}

          {hasMultiTenantSection && <div className="db-section-label" style={{ marginTop: 12 }}>Multi-tenant</div>}

          {ownerSection && ownerHomeItem && (
            <>
              <button
                id="global-nav-owner"
                className={`db-nav-item ${ownerSection.isActive ? "active" : ""}`}
                onClick={() => goToItem(ownerHomeItem)}
              >
                <span className="db-nav-icon">🏢</span>
                <span className="db-nav-label">{ownerSection.label}</span>
                <span className={`db-nav-chevron ${ownerOpen ? "open" : ""}`} onClick={(event) => { event.stopPropagation(); setOwnerOpen((prev) => !prev); }}>
                  ▶
                </span>
              </button>
              <div className="db-admin-submenu" style={{ maxHeight: ownerOpen ? "900px" : "0" }}>
                {ownerCompanyItems.map((item) => (
                  <button
                    key={item.id}
                    className="db-admin-sub-item db-super-sub-item"
                    onClick={() => goToItem(item)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {superAdminSection && (
            <>
              <button
                id="global-nav-super-admin-toggle"
                className="db-nav-item"
                onClick={() => setSuperAdminOpen((prev) => !prev)}
              >
                <span className="db-nav-icon">🧩</span>
                <span className="db-nav-label">{superAdminSection.label}</span>
                <span className={`db-nav-chevron ${superAdminOpen ? "open" : ""}`}>▶</span>
              </button>
              <div className="db-admin-submenu" style={{ maxHeight: superAdminOpen ? "900px" : "0" }}>
                {superAdminSection.items.map((item) => (
                  <button
                    key={item.id}
                    className={`db-admin-sub-item ${item.isActive ? "active" : ""}`}
                    onClick={() => goToItem(item)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {adminSection && (
            <>
              <div className="db-section-label" style={{ marginTop: 12 }}>Amministrazione</div>

              <button
                id="global-nav-admin-toggle"
                className="db-nav-item"
                onClick={() => setAdminOpen(o => !o)}
              >
                <span className="db-nav-icon">⚙️</span>
                <span className="db-nav-label">{adminSection.label}</span>
                <span className={`db-nav-chevron ${adminOpen ? "open" : ""}`}>▶</span>
              </button>

              <div
                className="db-admin-submenu"
                style={{ maxHeight: adminOpen ? "300px" : "0" }}
              >
                {adminSection.items.map((item) => (
                  <button
                    key={item.id}
                    className={`db-admin-sub-item ${item.isActive ? "active" : ""}`}
                    onClick={() => goToItem(item)}
                  >
                    {item.label}
                  </button>
                ))}
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
