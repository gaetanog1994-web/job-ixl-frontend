import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { appApi } from "../lib/appApi";
import type { UserLifecycleState } from "../lib/appApi";
import { useAvailability } from "../lib/AvailabilityContext";
import type { RawApplication } from "../lib/appApi";
import type { DepartmentOption } from "../lib/appApi";

import MapPanel from "../components/dashboard/MapPanel";
import FiltersCard from "../components/dashboard/FiltersCard";
import type { MapFilters } from "../components/dashboard/FiltersCard";
import UserStatsCard from "../components/dashboard/UserStatsCard";
import MyApplicationsPanel from "../components/dashboard/MyApplicationsPanel";
import type { MapLocation } from "../components/PositionsMap";

import "../styles/dashboard.css";

const MobilityDashboard: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const { isAdmin } = useAvailability();

  /* ---------- data state ---------- */
  const [userData, setUserData] = useState<{ id: string; [key: string]: unknown } | null>(null);
  const [myApplications, setMyApplications] = useState<RawApplication[]>([]);
  const [maxApplications, setMaxApplications] = useState<number>(10);

  /* ---------- map state ---------- */
  const [mapLocations, setMapLocations] = useState<MapLocation[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [mapFilters, setMapFilters] = useState<MapFilters>({
    locationName: "",
    roleName: "",
    departmentId: "",
    onlyNonFixed: false,
  });
  /* ---------- campaign status ---------- */
  const [campaignStatus, setCampaignStatus] = useState<"open" | "closed" | null>(null);
  const [reservationsStatus, setReservationsStatus] = useState<"open" | "closed" | null>(null);
  const [userState, setUserState] = useState<UserLifecycleState | null>(null);

  const handleLifecycleStatusLoaded = useCallback((status: {
    campaign_status: "open" | "closed";
    reservations_status: "open" | "closed";
    user_state: UserLifecycleState;
  }) => {
    setCampaignStatus(status.campaign_status);
    setReservationsStatus(status.reservations_status);
    setUserState(status.user_state);
  }, []);

  /* ---------- map highlight from URL ---------- */
  // single source of truth for highlightPositionId
  const highlightPositionId = searchParams.get("highlightPositionId") ?? undefined;

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
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const [userInfo, cfg, apps] = await Promise.allSettled([
          appApi.getMyUser(),
          appApi.getConfig(),
          appApi.getMyApplications(),
        ]);
        if (cancelled) return;
        if (userInfo.status === "fulfilled") setUserData(userInfo.value as { id: string; [key: string]: unknown });
        if (cfg.status === "fulfilled" && cfg.value?.maxApplications != null) {
          setMaxApplications(cfg.value.maxApplications);
        }
        if (apps.status === "fulfilled") setMyApplications(apps.value ?? []);
      } catch (e: unknown) {
        if (cancelled) return;
        console.error("[MobilityDashboard] load error:", e instanceof Error ? e.message : e);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = isAdmin
          ? await appApi.adminGetDepartments()
          : await appApi.publicGetDepartments();
        if (!cancelled) setDepartments(Array.isArray(rows) ? rows : []);
      } catch (e: unknown) {
        console.error("[MobilityDashboard] load departments:", e instanceof Error ? e.message : e);
        if (!cancelled) setDepartments([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, isAdmin]);

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
      const departmentName = occupant?.org_unit_name ?? "";
      const locationName = locObj?.name ?? "";
      keys.add(`${locationName}__${roleName}__${departmentName}`);
    }
    return keys.size;
  }, [myApplications]);

  /* ---------- reload applications (used when map updates) ---------- */
  const handleApplicationUpdate = useCallback(async () => {
    try {
      const apps = await appApi.getMyApplications();
      setMyApplications(apps ?? []);
    } catch (e: unknown) {
      console.error("[MobilityDashboard] reload apps:", e instanceof Error ? e.message : e);
    }
  }, []);

  const toggleReservation = useCallback(async () => {
    if (campaignStatus !== "closed" || reservationsStatus !== "open" || userState === null) {
      return;
    }
    try {
      const out = userState === "reserved" ? await appApi.unreserveMe() : await appApi.reserveMe();
      setCampaignStatus(out.campaign_status);
      setReservationsStatus(out.reservations_status);
      setUserState(out.user_state);
      await handleApplicationUpdate();
    } catch (e: unknown) {
      console.error("[MobilityDashboard] toggleReservation:", e instanceof Error ? e.message : e);
    }
  }, [campaignStatus, reservationsStatus, userState, handleApplicationUpdate]);

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

  /* ---------- render ---------- */
  return (
    <div className="db-shell" style={{ flexDirection: "column" }}>
      {/* ===== CONTENT ===== */}
      <div className="db-content" style={{ flex: 1 }}>
        {/* ---- Lifecycle banner ---- */}
        {campaignStatus === "closed" && reservationsStatus === "closed" && userState !== "reserved" && (
          <div className="db-card" style={{
            marginBottom: "16px",
            padding: "12px 16px",
            background: "#eff6ff",
            border: "1px solid #93c5fd",
            borderRadius: "10px",
            color: "#1e3a8a",
            fontSize: "13px",
            fontWeight: 600,
          }}>
            Campagna chiusa. Le prenotazioni non sono ancora aperte.
          </div>
        )}

        {campaignStatus === "closed" && reservationsStatus === "open" && (
          <div className="db-card" style={{
            marginBottom: "16px",
            padding: "12px 16px",
            background: "#ecfdf5",
            border: "1px solid #6ee7b7",
            borderRadius: "10px",
            color: "#065f46",
            fontSize: "13px",
            fontWeight: 600,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
          }}>
            <span>
              {userState === "reserved"
                ? "Sei prenotato per la prossima campagna."
                : "Prenotazioni aperte: puoi prenotarti per la prossima campagna."}
            </span>
            <button className="db-btn db-btn-outline" onClick={toggleReservation}>
              {userState === "reserved" ? "Annulla prenotazione" : "Prenotati per la prossima campagna"}
            </button>
          </div>
        )}

        {campaignStatus === "closed" && reservationsStatus === "closed" && userState === "reserved" && (
          <div className="db-card" style={{
            marginBottom: "16px",
            padding: "12px 16px",
            background: "#fffbeb",
            border: "1px solid #fcd34d",
            borderRadius: "10px",
            color: "#92400e",
            fontSize: "13px",
            fontWeight: 600,
          }}>
            Prenotazioni chiuse: la tua scelta è congelata fino all'apertura campagna.
          </div>
        )}

        {campaignStatus === "open" && userState === "inactive" && (
          <div className="db-card" style={{
            marginBottom: "16px",
            padding: "12px 16px",
            background: "#fff7ed",
            border: "1px solid #fdba74",
            borderRadius: "10px",
            color: "#9a3412",
            fontSize: "13px",
            fontWeight: 600,
          }}>
            ⚠️ La campagna di mobilità è attualmente aperta, ma non hai effettuato la prenotazione. Non puoi candidarti per questa campagna.
          </div>
        )}

        {campaignStatus === "open" && userState !== "inactive" && (
          <div className="db-card" style={{
            marginBottom: "16px",
            padding: "12px 16px",
            background: "#f8fafc",
            border: "1px solid #cbd5e1",
            borderRadius: "10px",
            color: "#0f172a",
            fontSize: "13px",
            fontWeight: 600,
          }}>
            Campagna aperta. Stato utente: {userState === "available" ? "AVAILABLE" : "INACTIVE"}.
          </div>
        )}

        {/* ---- Top row: Map + Right Panel ---- */}
        <div className="db-content-row">
          {/* Map Panel */}
          <MapPanel
            highlightPositionId={highlightPositionId}
            filters={mapFilters}
            onLocationsLoaded={handleLocationsLoaded}
            onApplicationUpdate={handleApplicationUpdate}
            onLifecycleStatusLoaded={handleLifecycleStatusLoaded}
            isAdmin={isAdmin}
          />

          {/* Right column */}
          <div className="db-right-panel">
            <FiltersCard
              filters={mapFilters}
              onFiltersChange={setMapFilters}
              mapLocations={mapLocations}
              departments={departments}
            />

            <UserStatsCard
              applicationsCount={aggregatedApplicationsCount}
              maxApplications={maxApplications}
              userState={userState}
              locationsCount={locationsCount}
              roleName={(userData?.role_name as string | null | undefined) ?? null}
              departmentName={(userData?.org_unit_name as string | null | undefined) ?? null}
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
