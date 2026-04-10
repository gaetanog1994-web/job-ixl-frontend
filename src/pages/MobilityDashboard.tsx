import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { appApi } from "../lib/appApi";
import { useSidebar } from "../lib/SidebarContext";

import MapPanel from "../components/dashboard/MapPanel";
import FiltersCard from "../components/dashboard/FiltersCard";
import type { MapFilters } from "../components/dashboard/FiltersCard";
import UserStatsCard from "../components/dashboard/UserStatsCard";
import MyApplicationsPanel from "../components/dashboard/MyApplicationsPanel";
import type { MapLocation } from "../components/PositionsMap";

import "../styles/dashboard.css";

const MobilityDashboard: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { toggle: toggleSidebar } = useSidebar();
  const [searchParams, setSearchParams] = useSearchParams();

  /* ---------- data state ---------- */
  const [userData, setUserData] = useState<any>(null);
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [maxApplications, setMaxApplications] = useState<number>(10);

  const [dataLoading, setDataLoading] = useState(true);

  /* ---------- map state ---------- */
  const [mapLocations, setMapLocations] = useState<MapLocation[]>([]);
  const [mapFilters, setMapFilters] = useState<MapFilters>({
    locationName: "",
    roleName: "",
  });

  /* ---------- map highlight from URL ---------- */
  const [highlightPositionId, setHighlightPositionId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const id = searchParams.get("highlightPositionId") ?? undefined;
    setHighlightPositionId(id);
  }, [searchParams]);

  const handleHighlightPosition = (positionId: string) => {
    setSearchParams({ highlightPositionId: positionId });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* ---------- callback stable reference ---------- */
  const handleLocationsLoaded = useCallback((locs: MapLocation[]) => {
    setMapLocations(locs);
  }, []);

  /* ---------- data loading ---------- */
  useEffect(() => {
    if (!user) {
      setDataLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setDataLoading(true);
      try {
        const [userInfo, cfg, apps] = await Promise.allSettled([
          appApi.getMyUser(),
          appApi.getConfig(),
          appApi.getMyApplications(),
        ]);
        if (cancelled) return;
        if (userInfo.status === "fulfilled") setUserData(userInfo.value);
        if (cfg.status === "fulfilled" && cfg.value?.maxApplications != null) {
          setMaxApplications(cfg.value.maxApplications);
        }
        if (apps.status === "fulfilled") setMyApplications(apps.value ?? []);
      } catch (e: any) {
        if (cancelled) return;
        console.error("[MobilityDashboard] load error:", e?.message ?? e);
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user]);

  /* ---------- unique locations count for UserStats ---------- */
  const locationsCount = useMemo(
    () => (mapLocations.length > 0 ? mapLocations.length : undefined),
    [mapLocations]
  );

  /* ---------- aggregated applications count (by role+location) ---------- */
  const aggregatedApplicationsCount = useMemo(() => {
    const keys = new Set<string>();
    for (const app of myApplications) {
      const position = Array.isArray(app.positions) ? app.positions[0] : app.positions;
      const occupant = position?.users;
      const locObj = Array.isArray(occupant?.locations) ? occupant.locations?.[0] : occupant?.locations;
      const roleName = occupant?.roles?.name ?? "";
      const locationName = locObj?.name ?? "";
      keys.add(`${locationName}__${roleName}`);
    }
    return keys.size;
  }, [myApplications]);

  /* ---------- availability toggle ---------- */
  const handleToggleAvailability = async () => {
    if (!userData) return;
    try {
      if (userData.availability_status === "available") {
        await appApi.deactivateMe();
        setUserData({ ...userData, availability_status: "inactive" });
        setMyApplications([]);
      } else {
        await appApi.activateMe();
        setUserData({ ...userData, availability_status: "available" });
      }
    } catch (e: any) {
      console.error("[MobilityDashboard] toggleAvailability:", e?.message ?? e);
    }
  };

  /* ---------- reload applications (used when map updates) ---------- */
  const handleApplicationUpdate = useCallback(async () => {
    try {
      const apps = await appApi.getMyApplications();
      setMyApplications(apps ?? []);
    } catch (e: any) {
      console.error("[MobilityDashboard] reload apps:", e?.message ?? e);
    }
  }, []);

  /* ---------- loading guard ---------- */
  if (authLoading) {
    return (
      <div style={{
        display: "flex", height: "100vh", alignItems: "center",
        justifyContent: "center", fontFamily: "'Inter', sans-serif", background: "#f1f5f9",
      }}>
        <div className="db-loading">
          <div className="db-spinner" />
          Caricamento…
        </div>
      </div>
    );
  }

  const availabilityStatus = userData?.availability_status ?? null;
  const initials = userData?.full_name
    ? userData.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  /* ---------- render ---------- */
  return (
    <div className="db-shell" style={{ flexDirection: "column" }}>

      {/* ===== TOP BAR (hamburger + title + actions) ===== */}
      <header className="db-topbar" style={{ flexShrink: 0 }}>
        <div className="db-topbar-left">

          {/* Hamburger */}
          <button
            id="dashboard-hamburger"
            onClick={toggleSidebar}
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              width: 38, height: 38,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", fontSize: "18px", flexShrink: 0,
              transition: "background 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--surface)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            title="Apri menu"
          >
            ☰
          </button>

          <span className="db-topbar-title">My Mobility Dashboard</span>
        </div>

        <div className="db-topbar-right">
          {/* Availability badge */}
          <button
            onClick={handleToggleAvailability}
            id="topbar-availability-toggle"
            style={{
              display: "flex", alignItems: "center", gap: "7px",
              padding: "6px 12px",
              borderRadius: "10px",
              fontSize: "13px", fontWeight: 600,
              fontFamily: "var(--font)",
              cursor: "pointer", transition: "all 0.15s",
              border: availabilityStatus === "available"
                ? "1.5px solid #a7f3d0"
                : "1.5px solid var(--border)",
              background: availabilityStatus === "available" ? "#f0fdf4" : "var(--surface)",
              color: availabilityStatus === "available"
                ? "var(--available-color)"
                : "var(--text-secondary)",
            }}
          >
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: availabilityStatus === "available"
                ? "var(--available-color)"
                : "var(--inactive-color)",
              boxShadow: availabilityStatus === "available"
                ? "0 0 0 3px rgba(16,185,129,0.2)"
                : "none",
            }} />
            {availabilityStatus === "available" ? "Disponibile" : "Non disponibile"}
          </button>

          {dataLoading && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-secondary)", fontSize: "13px" }}>
              <div className="db-spinner" style={{ width: 14, height: 14 }} />
              Aggiornamento…
            </div>
          )}

          {/* User avatar */}
          <div style={{
            width: 34, height: 34,
            borderRadius: "9px",
            background: "var(--brand)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "13px", fontWeight: 700, color: "white",
            flexShrink: 0, cursor: "pointer",
          }}
            title={userData?.full_name ?? "Utente"}
            onClick={toggleSidebar}
            id="topbar-user-avatar"
          >
            {initials}
          </div>
        </div>
      </header>

      {/* ===== CONTENT ===== */}
      <div className="db-content" style={{ flex: 1 }}>

        {/* ---- Top row: Map + Right Panel ---- */}
        <div className="db-content-row">
          {/* Map Panel */}
          <MapPanel
            highlightPositionId={highlightPositionId}
            filters={mapFilters}
            onLocationsLoaded={handleLocationsLoaded}
            onApplicationUpdate={handleApplicationUpdate}
          />

          {/* Right column */}
          <div className="db-right-panel">
            <FiltersCard
              filters={mapFilters}
              onFiltersChange={setMapFilters}
              mapLocations={mapLocations}
            />

            <UserStatsCard
              applicationsCount={aggregatedApplicationsCount}
              maxApplications={maxApplications}
              availabilityStatus={availabilityStatus}
              locationsCount={locationsCount}
            />
          </div>
        </div>

        {/* ---- Bottom: Applications panel ---- */}
        <MyApplicationsPanel
          userData={userData}
          myApplications={myApplications}
          maxApplications={maxApplications}
          onApplicationsChange={setMyApplications}
          onHighlightPosition={handleHighlightPosition}
        />
      </div>
    </div>
  );
};

export default MobilityDashboard;
