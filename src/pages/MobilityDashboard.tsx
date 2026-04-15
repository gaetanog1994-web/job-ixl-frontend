import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { appApi } from "../lib/appApi";
import { useAvailability } from "../lib/AvailabilityContext";

import MapPanel from "../components/dashboard/MapPanel";
import FiltersCard from "../components/dashboard/FiltersCard";
import type { MapFilters } from "../components/dashboard/FiltersCard";
import UserStatsCard from "../components/dashboard/UserStatsCard";
import MyApplicationsPanel from "../components/dashboard/MyApplicationsPanel";
import type { MapLocation } from "../components/PositionsMap";
import TenantContextStrip from "../components/TenantContextStrip";

import "../styles/dashboard.css";

const MobilityDashboard: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const { availabilityStatus, isAdmin } = useAvailability();

  /* ---------- data state ---------- */
  const [userData, setUserData] = useState<any>(null);
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [maxApplications, setMaxApplications] = useState<number>(10);

  /* ---------- map state ---------- */
  const [mapLocations, setMapLocations] = useState<MapLocation[]>([]);
  const [mapFilters, setMapFilters] = useState<MapFilters>({
    locationName: "",
    roleName: "",
    onlyNonFixed: false,
  });
  /* ---------- campaign status ---------- */
  const [campaignStatus, setCampaignStatus] = useState<"open" | "closed" | null>(null);

  const handleCampaignStatusLoaded = useCallback((status: "open" | "closed") => {
    setCampaignStatus(status);
  }, []);

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
        if (userInfo.status === "fulfilled") setUserData(userInfo.value);
        if (cfg.status === "fulfilled" && cfg.value?.maxApplications != null) {
          setMaxApplications(cfg.value.maxApplications);
        }
        if (apps.status === "fulfilled") setMyApplications(apps.value ?? []);
      } catch (e: any) {
        if (cancelled) return;
        console.error("[MobilityDashboard] load error:", e?.message ?? e);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user]);

  /* ---------- sync availabilityStatus → userData (admin may change it externally) ---------- */
  useEffect(() => {
    if (availabilityStatus !== null && userData) {
      setUserData((prev: any) => ({ ...prev, availability_status: availabilityStatus }));
    }
  }, [availabilityStatus]);

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

  /* ---------- render ---------- */
  return (
    <div className="db-shell" style={{ flexDirection: "column" }}>
      {/* ===== CONTENT ===== */}
      <div className="db-content" style={{ flex: 1 }}>
        <TenantContextStrip sectionLabel="Dashboard utente" />

        {/* ---- Campaign closed banner ---- */}
        {campaignStatus === "closed" && (
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
            ⚠️ Campagna di mobilità non attiva. Le candidature sono sospese.
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
            onCampaignStatusLoaded={handleCampaignStatusLoaded}
            isAdmin={isAdmin}
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
