import { useEffect, useState } from "react";
import AdminScenariosManager from "./AdminScenariosManager";
import AdminLocationsManager from "./AdminLocationsManager";
import AdminRolesManager from "./AdminRolesManager";
import { AppApiError, appApi } from "../lib/appApi";
import { canManageCampaignInCurrentPerimeter } from "../lib/operationalAccess";
import "../styles/dashboard.css";


/* =======================
   TYPES
======================= */

type User = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
  availability_status: string | null;
  is_reserved?: boolean | null;
  user_state?: "inactive" | "reserved" | "available" | null;
  location_id: string | null;
  location_name?: string | null;
  fixed_location?: boolean | null;
  role_id?: string | null;
  role_name?: string | null;
  access_role?: "user" | "admin" | "admin_user" | null;
};

type Location = {
  id: string;
  name: string;
};

type Position = {
  id: string;
  title: string | null;
  occupied_by: string;
  occupant_name: string | null;
};

type Scenario = {
  id: string;
  name: string;
};

type BulkImportResult = {
  total: number;
  imported: number;
  errors: { row: number; email: string; error: string }[];
};

/* =======================
   COMPONENT
======================= */

const AdminTestUsers = () => {
  const initialSection = (() => {
    if (typeof window === "undefined") return "home";
    const section = new URLSearchParams(window.location.search).get("section");
    if (section === "users" || section === "scenarios" || section === "locations" || section === "roles") {
      return section;
    }
    return "home";
  })();
  const [view, setView] = useState<
    "home" | "users" | "scenarios" | "locations" | "roles"
  >(initialSection);


  const [users, setUsers] = useState<User[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("");
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [loadingTop, setLoadingTop] = useState(false);
  const [errorTop, setErrorTop] = useState<string | null>(null);
  const [maxApplications, setMaxApplications] = useState<number | null>(null);
  const [campaignStatus, setCampaignStatus] = useState<"open" | "closed" | null>(null);
  const [reservationsStatus, setReservationsStatus] = useState<"open" | "closed" | null>(null);
  const [reservedUsersCount, setReservedUsersCount] = useState(0);
  const [canManageCampaign, setCanManageCampaign] = useState(false);
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteAccessRole, setInviteAccessRole] = useState<"user" | "admin" | "admin_user">("user");

  const [filterName, setFilterName] = useState("");
  const [filterSurname, setFilterSurname] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterAccessRole, setFilterAccessRole] = useState("");

  const [activeScenarioLabel, setActiveScenarioLabel] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importingUsers, setImportingUsers] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  /* =======================
     LOADERS
  ======================= */

  const loadUsers = async () => {
    try {
      const data = await appApi.adminGetUsers();
      setUsers(data ?? []);
    } catch (e) {
      console.error("LOAD USERS ERROR:", e);
      setUsers([]);
    }
  };

  const loadLocations = async () => {
    try {
      const data = await appApi.adminGetLocations();
      setLocations(data ?? []);
    } catch (e) {
      console.error("LOAD LOCATIONS ERROR:", e);
      setLocations([]);
    }
  };

  const loadPositions = async () => {
    try {
      const data = await appApi.adminGetPositions();
      const mapped = (data ?? []).map((p: Record<string, unknown>) => ({
        id: p.id,
        title: p.title ?? null,
        occupied_by: p.occupied_by,
        occupant_name: null,
      }));
      setPositions(mapped);
    } catch (e) {
      console.error("LOAD POSITIONS ERROR:", e);
      setPositions([]);
    }
  };

  const loadScenarios = async () => {
    try {
      const data = await appApi.adminGetScenarios();
      setScenarios(data ?? []);
    } catch (e) {
      console.error("LOAD SCENARIOS ERROR:", e);
      setScenarios([]);
    }
  };

  const loadRoles = async () => {
    try {
      const data = await appApi.adminGetRoles();
      setRoles(data ?? []);
    } catch (e) {
      console.error("LOAD ROLES ERROR:", e);
      setRoles([]);
    }
  };

  const loadAppConfig = async () => {
    try {
      const cfg = await appApi.adminGetConfig();
      setMaxApplications(cfg?.max_applications ?? null);
    } catch (e) {
      console.error("LOAD CONFIG ERROR:", e);
      setMaxApplications(null);
    }
  };

  const loadCampaignStatus = async () => {
    try {
      const data = await appApi.adminGetCampaignStatus();
      setCampaignStatus(data.campaign_status);
      setReservationsStatus(data.reservations_status);
      setReservedUsersCount(data.reserved_users_count ?? 0);
    } catch (e) {
      console.error("LOAD CAMPAIGN STATUS ERROR:", e);
      setCampaignStatus(null);
      setReservationsStatus(null);
      setReservedUsersCount(0);
    }
  };

  const loadCampaignPermission = async () => {
    try {
      const me = await appApi.getMe();
      const canManage = canManageCampaignInCurrentPerimeter(me);
      setCanManageCampaign(canManage);
      return canManage;
    } catch {
      setCanManageCampaign(false);
      return false;
    }
  };

  const runLifecycleAction = async (action: "openReservations" | "closeReservations" | "openCampaign" | "closeCampaign") => {
    try {
      const data =
        action === "openReservations"
          ? await appApi.adminOpenReservations()
          : action === "closeReservations"
            ? await appApi.adminCloseReservations()
            : action === "openCampaign"
              ? await appApi.adminOpenCampaign()
              : await appApi.adminCloseCampaign();
      setCampaignStatus(data.campaign_status);
      setReservationsStatus(data.reservations_status);
      setReservedUsersCount(data.reserved_users_count ?? 0);
      await loadUsers();
    } catch (e: unknown) {
      alert("Errore aggiornamento lifecycle: " + (e instanceof Error ? e.message : "unknown"));
    }
  };


  const loadAll = async () => {
    const canManage = await loadCampaignPermission();
    await Promise.all([
      loadUsers(),
      loadLocations(),
      loadPositions(),
      loadScenarios(),
      loadRoles(),
      loadAppConfig(),
      canManage ? loadCampaignStatus() : Promise.resolve(),
    ]);
    if (!canManage) {
      setCampaignStatus(null);
      setReservationsStatus(null);
      setReservedUsersCount(0);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadAll(); }, []);

  /* =======================
     NAVIGATION
  ======================= */

  const goHome = async () => {
    setErrorTop(null);
    await loadAll();
    setView("home");
  };

  /* =======================
     TOP ACTIONS
  ======================= */

  const initializeScenario = async () => {
    if (!selectedScenarioId) return;
    if (campaignStatus !== "open") {
      setErrorTop("Disponibile solo quando la campagna è aperta.");
      return;
    }
    if (!window.confirm("Vuoi inizializzare questo scenario?")) return;

    setLoadingTop(true);
    setErrorTop(null);

    try {
      await appApi.initializeTestScenario(selectedScenarioId);
      await loadAll();
      const scenario = scenarios.find((s) => s.id === selectedScenarioId);
      if (scenario) setActiveScenarioLabel(scenario.name);
    } catch (e: unknown) {
      if (e instanceof AppApiError && e.status === 409 && e.code === "CAMPAIGN_NOT_OPEN") {
        setErrorTop("Impossibile inizializzare lo scenario: disponibile solo quando la campagna è aperta.");
      } else {
        setErrorTop(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setLoadingTop(false);
    }
  };


  const resetActiveUsers = async () => {
    if (!window.confirm("Vuoi resettare utenti attivi e svuotare la dashboard?")) return;
    setLoadingTop(true);
    setErrorTop(null);

    try {
      await appApi.resetActiveUsers();
      await loadAll();
      setActiveScenarioLabel(null);
    } catch (e: unknown) {
      setErrorTop(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingTop(false);
    }
  };


  /* =======================
     SCENARIO SYNC
  ======================= */

  const handleScenarioDeleted = async (deletedScenarioId: string) => {
    await loadScenarios();
    if (selectedScenarioId === deletedScenarioId) {
      setSelectedScenarioId("");
    }
    setView("home");
  };

  const handleScenarioRenamed = async (scenarioId: string) => {
    await loadScenarios();
    setSelectedScenarioId(scenarioId);
  };

  const updateMaxApplications = async (value: number) => {
    try {
      await appApi.adminUpdateMaxApplications(value);
      setMaxApplications(value);
    } catch (e: unknown) {
      alert("Errore aggiornamento configurazione: " + (e instanceof Error ? e.message : "unknown"));
      console.error(e);
    }
  };

  /* =======================
     USERS HELPERS
  ======================= */

  const adminUpdateUser = async (userId: string, patch: Partial<User>) => {
    await appApi.adminPatchUser(userId, patch);
    await loadUsers();
  };

  const adminDeleteUser = async (userId: string) => {
    await appApi.adminDeleteUser(userId);
    await loadUsers();
  };

  const usersFiltered = users.filter((u) => {
    const name = (u.first_name ?? "").toLowerCase();
    const surname = (u.last_name ?? "").toLowerCase();
    const status = (u.user_state ?? (u.availability_status ?? "")).toLowerCase();
    const accessRole = (u.access_role ?? "").toLowerCase();

    const byName = !filterName.trim() || name.includes(filterName.trim().toLowerCase());
    const bySurname = !filterSurname.trim() || surname.includes(filterSurname.trim().toLowerCase());
    const byStatus = !filterStatus || status === filterStatus.toLowerCase();
    const byLocation = !filterLocation || String(u.location_id ?? "") === filterLocation;
    const byAccessRole = !filterAccessRole || accessRole === filterAccessRole.toLowerCase();

    return byName && bySurname && byStatus && byLocation && byAccessRole;
  });

  const accessRoleLabel = (role: string | null | undefined) => {
    if (role === "admin") return "Admin";
    if (role === "admin_user") return "Admin + User";
    return "User";
  };

  const handleDownloadImportTemplate = async () => {
    try {
      setDownloadingTemplate(true);
      const fileBlob = await appApi.adminDownloadUsersImportTemplate();
      const downloadUrl = URL.createObjectURL(fileBlob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "template_importazione_utenti.xlsx";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    } catch (e: unknown) {
      setImportError(e instanceof Error ? e.message : "Errore download template");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleImportUsers = async () => {
    if (!importFile) return;
    try {
      setImportingUsers(true);
      setImportError(null);
      const result = await appApi.adminImportUsersFromExcel(importFile);
      setImportResult(result);
      await loadUsers();
    } catch (e: unknown) {
      setImportResult(null);
      setImportError(e instanceof Error ? e.message : "Errore durante importazione utenti");
    } finally {
      setImportingUsers(false);
    }
  };


  /* =======================
     RENDER
  ======================= */

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--surface, #f1f5f9)",
      fontFamily: "var(--font, 'Inter', sans-serif)",
      padding: "24px",
    }}>

      {/* Page title */}
      <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
        {view !== "home" && (
          <button 
            onClick={goHome} 
            className="db-btn db-btn-outline"
            style={{ padding: "6px 10px", fontSize: "14px" }}
          >
            ← 
          </button>
        )}
        <h1 
          className="db-card-title" 
          style={{ margin: 0, fontSize: "22px", cursor: view !== "home" ? "pointer" : "default" }}
          onClick={view !== "home" ? goHome : undefined}
        >
          {view === "home" && "Configurazione della Piattaforma"}
          {view === "users" && "Gestione Utenti"}
          {view === "scenarios" && "Gestione Scenari"}
          {view === "locations" && "Gestione Sedi"}
          {view === "roles" && "Gestione Ruoli"}
        </h1>
      </div>

      {/* ---- TOP ACTIONS BAR ---- */}
      {(view === "home" || view === "users" || view === "scenarios") && (
        <div className="db-card" style={{ padding: "16px 20px", marginBottom: "20px", display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
          
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
              Test Scenario
            </span>
            <select
              className="db-filter-select"
              style={{ minWidth: "180px", height: "34px", padding: "0 10px" }}
              value={selectedScenarioId}
              onChange={(e) => setSelectedScenarioId(e.target.value)}
            >
              <option value="">Seleziona scenario…</option>
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button
              className="db-btn db-btn-outline"
              onClick={initializeScenario}
              disabled={loadingTop || !selectedScenarioId || campaignStatus !== "open"}
              title={campaignStatus !== "open" ? "Disponibile solo quando la campagna è aperta" : undefined}
            >
              ▶ Inizializza
            </button>
            {campaignStatus !== "open" && (
              <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                Disponibile solo quando la campagna è aperta
              </span>
            )}
          </div>

          <div style={{ width: "1px", height: "30px", background: "var(--border)", margin: "0 4px" }} />

          <button className="db-btn db-btn-outline" onClick={resetActiveUsers} disabled={loadingTop} style={{ color: "#ef4444", borderColor: "#fca5a5", background: "#fef2f2" }}>
            🔄 Reset utenti attivi
          </button>

          {activeScenarioLabel && (
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px", color: "#10b981", fontSize: "12px", fontWeight: 700, padding: "4px 10px", background: "#ecfdf5", borderRadius: "8px" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
              SCENARIO ATTIVO: {activeScenarioLabel.toUpperCase()}
            </div>
          )}

          {view === "home" && (
            <div style={{ marginLeft: activeScenarioLabel ? "0" : "auto", display: "flex", alignItems: "center", gap: "8px", borderLeft: "1px solid var(--border)", paddingLeft: "20px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                Max candidature/utente:
              </span>
              <select
                className="db-filter-select"
                style={{ height: "34px", minWidth: "60px", padding: "0 8px" }}
                value={maxApplications ?? ""}
                onChange={(e) => updateMaxApplications(Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {errorTop && (
        <div style={{ marginBottom: "20px", padding: "12px", background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: "8px", fontSize: "13px" }}>
          ❌ {errorTop}
        </div>
      )}

      {/* ---- HOME VIEW (GRID) ---- */}
      {view === "home" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
          
          <div className="db-card" style={{ cursor: "pointer", transition: "transform 0.15s", border: "2px solid transparent", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "24px" }} 
            onClick={() => setView("users")}
            onMouseEnter={e => e.currentTarget.style.borderColor = "var(--brand-light)"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "transparent"}
          >
            <div style={{ fontSize: "38px", marginBottom: "16px" }}>👤</div>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", color: "var(--text-primary)" }}>Gestione Utenti</h3>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Modifica stato attivo/inattivo, ruolo e sede degli utenti.
            </p>
          </div>

          <div className="db-card" style={{ cursor: "pointer", transition: "transform 0.15s", border: "2px solid transparent", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "24px" }} 
            onClick={() => setView("scenarios")}
            onMouseEnter={e => e.currentTarget.style.borderColor = "var(--brand-light)"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "transparent"}
          >
            <div style={{ fontSize: "38px", marginBottom: "16px" }}>🧩</div>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", color: "var(--text-primary)" }}>Gestione Scenari</h3>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Crea scenari e definisci candidature isolate per simulazioni.
            </p>
          </div>

          <div className="db-card" style={{ cursor: "pointer", transition: "transform 0.15s", border: "2px solid transparent", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "24px" }} 
            onClick={() => setView("locations")}
            onMouseEnter={e => e.currentTarget.style.borderColor = "var(--brand-light)"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "transparent"}
          >
            <div style={{ fontSize: "38px", marginBottom: "16px" }}>🏢</div>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", color: "var(--text-primary)" }}>Gestione Sedi</h3>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Visualizza, aggiungi o rimuovi sedi operative sulla mappa.
            </p>
          </div>

          <div className="db-card" style={{ cursor: "pointer", transition: "transform 0.15s", border: "2px solid transparent", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "24px" }}
            onClick={() => setView("roles")}
            onMouseEnter={e => e.currentTarget.style.borderColor = "var(--brand-light)"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "transparent"}
          >
            <div style={{ fontSize: "38px", marginBottom: "16px" }}>🧠</div>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", color: "var(--text-primary)" }}>Gestione Ruoli</h3>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Definisci i ruoli aziendali per gli utenti e per le posizioni.
            </p>
          </div>

          {/* Campaign lifecycle card */}
          <div className="db-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "24px", gap: "12px" }}>
            <div style={{ fontSize: "38px" }}>📣</div>
            <h3 style={{ margin: 0, fontSize: "16px", color: "var(--text-primary)" }}>Lifecycle campagna</h3>
            {!canManageCampaign ? (
              <span style={{ fontSize: "12px", color: "var(--text-secondary)", textAlign: "center" }}>
                Solo admin del perimeter possono gestire prenotazioni e campagna.
              </span>
            ) : campaignStatus !== null && reservationsStatus !== null ? (
              <>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  padding: "4px 12px", borderRadius: "999px", fontSize: "13px", fontWeight: 700,
                  background: campaignStatus === "open" ? "#ecfdf5" : "#eff6ff",
                  color: campaignStatus === "open" ? "#059669" : "#1d4ed8",
                  border: `1px solid ${campaignStatus === "open" ? "#a7f3d0" : "#93c5fd"}`,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: campaignStatus === "open" ? "#10b981" : "#3b82f6" }} />
                  Campagna: {campaignStatus === "open" ? "Aperta" : "Chiusa"}
                </div>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  padding: "4px 12px", borderRadius: "999px", fontSize: "13px", fontWeight: 700,
                  background: reservationsStatus === "open" ? "#ecfdf5" : "#f3f4f6",
                  color: reservationsStatus === "open" ? "#059669" : "#374151",
                  border: `1px solid ${reservationsStatus === "open" ? "#a7f3d0" : "#d1d5db"}`,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: reservationsStatus === "open" ? "#10b981" : "#6b7280" }} />
                  Prenotazioni: {reservationsStatus === "open" ? "Aperte" : "Chiuse"}
                </div>
                <span style={{ fontSize: "12px", color: "#6B7280", fontWeight: 500 }}>
                  {reservedUsersCount} prenotat{reservedUsersCount === 1 ? "o" : "i"}
                </span>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
                  {campaignStatus === "closed" && reservationsStatus === "closed" && (
                    <button className="db-btn db-btn-outline" onClick={() => runLifecycleAction("openReservations")}>
                      Apri prenotazioni
                    </button>
                  )}
                  {campaignStatus === "closed" && reservationsStatus === "open" && (
                    <button className="db-btn db-btn-outline" onClick={() => runLifecycleAction("closeReservations")}>
                      Chiudi prenotazioni
                    </button>
                  )}
                  {campaignStatus === "closed" && reservationsStatus === "closed" && (
                    <button className="db-btn db-btn-outline" onClick={() => runLifecycleAction("openCampaign")}>
                      Apri campagna
                    </button>
                  )}
                  {campaignStatus === "open" && (
                    <button className="db-btn db-btn-outline" onClick={() => runLifecycleAction("closeCampaign")}>
                      Chiudi campagna
                    </button>
                  )}
                </div>
              </>
            ) : (
              <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Caricamento…</span>
            )}
          </div>

        </div>
      )}

      {/* ---- USERS VIEW ---- */}
      {view === "users" && (
        <>
          <div className="db-card" style={{ marginBottom: "16px", padding: "16px 20px" }}>
            <h2 style={{ margin: "0 0 12px 0", fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
              Importazione utenti
            </h2>

            <div
              style={{
                background: "#fef9c3",
                border: "1px solid #facc15",
                borderRadius: "8px",
                padding: "12px",
                marginBottom: "14px",
                color: "#713f12",
                fontSize: "13px",
                lineHeight: 1.45,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: "8px" }}>
                ⚠️ Prima di importare utenti, assicurati di aver configurato correttamente tutti i Ruoli e le Sedi del perimetro. I valori nel template devono corrispondere esattamente a quelli configurati.
              </div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <a
                  className="db-btn db-btn-outline"
                  style={{ padding: "6px 10px", fontSize: "12px" }}
                  href="/admin/test-users?section=roles"
                  onClick={(event) => {
                    event.preventDefault();
                    setView("roles");
                    window.history.replaceState({}, "", "/admin/test-users?section=roles");
                  }}
                >
                  Gestisci Ruoli
                </a>
                <a
                  className="db-btn db-btn-outline"
                  style={{ padding: "6px 10px", fontSize: "12px" }}
                  href="/admin/test-users?section=locations"
                  onClick={(event) => {
                    event.preventDefault();
                    setView("locations");
                    window.history.replaceState({}, "", "/admin/test-users?section=locations");
                  }}
                >
                  Gestisci Sedi
                </a>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "16px",
                alignItems: "start",
              }}
            >
              <div style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "12px" }}>
                <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "10px", color: "var(--text-primary)" }}>
                  Download template
                </div>
                <button
                  className="db-btn db-btn-outline"
                  onClick={handleDownloadImportTemplate}
                  disabled={downloadingTemplate}
                  type="button"
                >
                  {downloadingTemplate ? "Scaricamento..." : "📥 Scarica template Excel"}
                </button>
                <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                  Il template contiene i ruoli e le sedi attualmente configurati. Riscaricare il template se si aggiungono nuovi ruoli o sedi.
                </div>
              </div>

              <div style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "12px" }}>
                <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "10px", color: "var(--text-primary)" }}>
                  Upload e importazione
                </div>

                <input
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(event) => {
                    const selectedFile = event.target.files?.[0] ?? null;
                    if (!selectedFile) {
                      setImportFile(null);
                      return;
                    }
                    if (!selectedFile.name.toLowerCase().endsWith(".xlsx")) {
                      setImportFile(null);
                      setImportError("Formato non valido: seleziona un file .xlsx");
                      return;
                    }
                    setImportError(null);
                    setImportResult(null);
                    setImportFile(selectedFile);
                  }}
                />

                {importFile && (
                  <div style={{ marginTop: "8px", fontSize: "12px", color: "#166534" }}>
                    {importFile.name} — ✅ File pronto
                  </div>
                )}

                <button
                  className="db-btn db-btn-outline"
                  style={{ marginTop: "10px" }}
                  disabled={!importFile || importingUsers}
                  onClick={handleImportUsers}
                  type="button"
                >
                  {importingUsers ? "Importazione in corso..." : "🚀 Inizializza importazione"}
                </button>
              </div>
            </div>

            {importResult && (
              <div style={{ marginTop: "14px", display: "grid", gap: "10px" }}>
                <div
                  style={{
                    background: "#ecfdf5",
                    border: "1px solid #86efac",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    color: "#166534",
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                >
                  ✅ {importResult.imported} utenti importati con successo
                </div>

                {importResult.errors.length > 0 && (
                  <div
                    style={{
                      background: "#fff7ed",
                      border: "1px solid #fdba74",
                      borderRadius: "8px",
                      padding: "10px 12px",
                      color: "#9a3412",
                      fontSize: "13px",
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: "6px" }}>
                      Errori rilevati ({importResult.errors.length} su {importResult.total} righe)
                    </div>
                    <ul style={{ margin: 0, paddingLeft: "18px", display: "grid", gap: "4px" }}>
                      {importResult.errors.map((item, index) => (
                        <li key={`${item.row}-${item.email}-${index}`}>
                          Riga {item.row} ({item.email || "email vuota"}): {item.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {importError && (
              <div
                style={{
                  marginTop: "12px",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  color: "#b91c1c",
                  fontSize: "13px",
                }}
              >
                ❌ {importError}
              </div>
            )}
          </div>

          <div className="db-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>Lista Utenti ({usersFiltered.length})</h2>
            </div>

            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", background: "#fafafa" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>
                Aggiungi utente
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "10px" }}>
                <input
                  className="db-filter-select"
                  style={{ height: "34px" }}
                  value={inviteFirstName}
                  onChange={(e) => setInviteFirstName(e.target.value)}
                  placeholder="Nome"
                />
                <input
                  className="db-filter-select"
                  style={{ height: "34px" }}
                  value={inviteLastName}
                  onChange={(e) => setInviteLastName(e.target.value)}
                  placeholder="Cognome"
                />
                <input
                  className="db-filter-select"
                  style={{ height: "34px" }}
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Email"
                  type="email"
                />
                <select
                  className="db-filter-select"
                  style={{ height: "34px" }}
                  value={inviteAccessRole}
                  onChange={(e) => setInviteAccessRole(e.target.value as "user" | "admin" | "admin_user")}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="admin_user">Admin + User</option>
                </select>
                <button
                  className="db-btn db-btn-outline"
                  onClick={async () => {
                    const firstName = inviteFirstName.trim();
                    const lastName = inviteLastName.trim();
                    const email = inviteEmail.trim().toLowerCase();
                    if (!firstName || !lastName || !email) {
                      alert("Compila Nome, Cognome ed Email.");
                      return;
                    }
                    try {
                      await appApi.adminInviteUser({
                        first_name: firstName,
                        last_name: lastName,
                        full_name: `${firstName} ${lastName}`.trim(),
                        email,
                        location_id: null,
                        access_role: inviteAccessRole,
                      });
                      setInviteFirstName("");
                      setInviteLastName("");
                      setInviteEmail("");
                      setInviteAccessRole("user");
                      await loadUsers();
                    } catch (e: unknown) {
                      alert(e instanceof Error ? e.message : "Errore aggiunta utente");
                    }
                  }}
                >
                  ➕ Aggiungi utente
                </button>
              </div>
            </div>

            <div style={{ overflowX: "auto", padding: "0" }}>
              <table className="db-apps-table" style={{ width: "100%", whiteSpace: "nowrap" }}>
                <thead>
                  <tr>
                    <th>
                      <input
                        className="db-filter-select"
                        style={{ height: "30px", fontSize: "12px", minWidth: "120px" }}
                        placeholder="Filtro cognome"
                        value={filterSurname}
                        onChange={(e) => setFilterSurname(e.target.value)}
                      />
                    </th>
                    <th>
                      <input
                        className="db-filter-select"
                        style={{ height: "30px", fontSize: "12px", minWidth: "120px" }}
                        placeholder="Filtro nome"
                        value={filterName}
                        onChange={(e) => setFilterName(e.target.value)}
                      />
                    </th>
                    <th />
                    <th>
                      <select
                        className="db-filter-select"
                        style={{ height: "30px", fontSize: "12px", minWidth: "120px" }}
                        value={filterAccessRole}
                        onChange={(e) => setFilterAccessRole(e.target.value)}
                      >
                        <option value="">Tutti</option>
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                        <option value="admin_user">Admin + User</option>
                      </select>
                    </th>
                    <th>
                      <select
                        className="db-filter-select"
                        style={{ height: "30px", fontSize: "12px", minWidth: "120px" }}
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                      >
                        <option value="">Tutti</option>
                        <option value="available">Disponibile</option>
                        <option value="reserved">Prenotato</option>
                        <option value="inactive">Inattivo</option>
                      </select>
                    </th>
                    <th>
                      <select
                        className="db-filter-select"
                        style={{ height: "30px", fontSize: "12px", minWidth: "120px" }}
                        value={filterLocation}
                        onChange={(e) => setFilterLocation(e.target.value)}
                      >
                        <option value="">Tutte le sedi</option>
                        {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </th>
                    <th />
                    <th />
                    <th />
                  </tr>
                  <tr>
                    <th>Cognome</th>
                    <th>Nome</th>
                    <th>Email</th>
                    <th>Ruolo accesso</th>
                    <th>Stato</th>
                    <th>Sede</th>
                    <th align="center">Vincolante</th>
                    <th>Ruolo attuale</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {usersFiltered.map((u) => (
                    <tr key={u.id}>
                      <td><span style={{ fontWeight: 600 }}>{u.last_name ?? "—"}</span></td>
                      <td><span style={{ fontWeight: 600 }}>{u.first_name ?? "—"}</span></td>
                      <td>{u.email ?? "—"}</td>
                      <td>
                        <select
                          className="db-filter-select"
                          style={{ height: "30px", fontSize: "12px", minWidth: "125px" }}
                          value={u.access_role ?? "user"}
                          onChange={async (e) => {
                            try {
                              await adminUpdateUser(u.id, { access_role: e.target.value as "user" | "admin" | "admin_user" });
                              await loadUsers();
                            } catch (err: unknown) {
                              alert(err instanceof Error ? err.message : "Errore ruolo accesso");
                            }
                          }}
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                          <option value="admin_user">Admin + User</option>
                        </select>
                        <div className="db-cell-secondary">{accessRoleLabel(u.access_role)}</div>
                      </td>
                      
                      {/* Stato */}
                      <td>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "4px 10px",
                            borderRadius: "999px",
                            fontSize: "12px",
                            fontWeight: 700,
                            border: "1px solid #d1d5db",
                            background:
                              (u.user_state ?? "inactive") === "available"
                                ? "#ecfdf5"
                                : (u.user_state ?? "inactive") === "reserved"
                                  ? "#fffbeb"
                                  : "#f3f4f6",
                            color:
                              (u.user_state ?? "inactive") === "available"
                                ? "#065f46"
                                : (u.user_state ?? "inactive") === "reserved"
                                  ? "#92400e"
                                  : "#374151",
                          }}
                        >
                          {(u.user_state ?? "inactive") === "available"
                            ? "Disponibile"
                            : (u.user_state ?? "inactive") === "reserved"
                              ? "Prenotato"
                              : "Inattivo"}
                        </span>
                      </td>

                      {/* Sede */}
                      <td>
                        <select
                          className="db-filter-select"
                          style={{ height: "30px", fontSize: "12px", minWidth: "140px" }}
                          value={u.location_id ?? ""}
                          onChange={async (e) => {
                            try { await adminUpdateUser(u.id, { location_id: e.target.value || null }); }
                            catch (err: unknown) { alert(err instanceof Error ? err.message : "Errore sede"); }
                          }}
                        >
                          <option value="">— Nessuna —</option>
                          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                      </td>

                      {/* Sede vincolante */}
                      <td align="center">
                        <input
                          type="checkbox"
                          checked={!!u.fixed_location}
                          onChange={async (e) => {
                            try { await adminUpdateUser(u.id, { fixed_location: e.target.checked }); }
                            catch (err: unknown) { alert(err instanceof Error ? err.message : "Errore vincolo"); }
                          }}
                          style={{ accentColor: "var(--brand)", width: "16px", height: "16px", cursor: "pointer" }}
                        />
                      </td>

                      {/* Ruolo */}
                      <td>
                        <select
                          className="db-filter-select"
                          style={{ height: "30px", fontSize: "12px", minWidth: "140px" }}
                          value={u.role_id ?? ""}
                          onChange={async (e) => {
                            try { await adminUpdateUser(u.id, { role_id: e.target.value || null }); }
                            catch (err: unknown) { alert(err instanceof Error ? err.message : "Errore ruolo"); }
                          }}
                        >
                          <option value="">— Nessuno —</option>
                          {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                      </td>

                      {/* Delete */}
                      <td>
                        <button className="db-action-btn db-action-btn-delete" onClick={async () => {
                          if (!window.confirm("Eliminare definitivamente questo utente?")) return;
                          try { await adminDeleteUser(u.id); }
                          catch (err: unknown) { alert(err instanceof Error ? err.message : "Errore eliminazione"); }
                        }}>
                          Elimina
                        </button>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ---- OTHERS ---- */}
      <div style={{ paddingBottom: "40px" }}>
        {view === "scenarios" && (
          <AdminScenariosManager
            key="scenarios"
            users={users.map((u) => ({ id: u.id, full_name: u.full_name }))}
            positions={positions.map((p) => ({ id: p.id, title: p.title, occupant_name: p.occupant_name }))}
            scenarios={scenarios}
            reloadScenarios={loadScenarios}
            onScenarioDeleted={handleScenarioDeleted}
            onScenarioRenamed={handleScenarioRenamed}
          />
        )}
        {view === "locations" && <AdminLocationsManager />}
        {view === "roles" && <AdminRolesManager />}
      </div>

    </div>
  );
};

export default AdminTestUsers;
