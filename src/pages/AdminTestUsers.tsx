import { useEffect, useState } from "react";
import AdminScenariosManager from "./AdminScenariosManager";
import AdminLocationsManager from "./AdminLocationsManager";
import AdminRolesManager from "./AdminRolesManager";
import { appApi } from "../lib/appApi";
import { canManageCampaignInCurrentPerimeter } from "../lib/operationalAccess";
import TenantContextStrip from "../components/TenantContextStrip";
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

/* =======================
   COMPONENT
======================= */

const AdminTestUsers = () => {
  const [view, setView] = useState<
    "home" | "users" | "scenarios" | "locations" | "roles"
  >("home");


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
      const mapped = (data ?? []).map((p: any) => ({
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
    } catch (e) {
      console.error("LOAD CAMPAIGN STATUS ERROR:", e);
      setCampaignStatus(null);
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

  const toggleCampaignStatus = async () => {
    const next = campaignStatus === "open" ? "closed" : "open";
    try {
      const data = await appApi.adminSetCampaignStatus(next);
      setCampaignStatus(data.campaign_status);
    } catch (e: any) {
      alert("Errore aggiornamento campagna: " + (e?.message ?? "unknown"));
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
    if (!canManage) setCampaignStatus(null);
  };

  useEffect(() => {
    loadAll();
  }, []);

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
    if (!window.confirm("Vuoi inizializzare questo scenario?")) return;

    setLoadingTop(true);
    setErrorTop(null);

    try {
      await appApi.initializeTestScenario(selectedScenarioId);
      await loadAll();
      const scenario = scenarios.find((s) => s.id === selectedScenarioId);
      if (scenario) setActiveScenarioLabel(scenario.name);
    } catch (e: any) {
      setErrorTop(e.message);
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
    } catch (e: any) {
      setErrorTop(e.message);
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
    } catch (e: any) {
      alert("Errore aggiornamento configurazione: " + (e?.message ?? "unknown"));
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
    const status = (u.availability_status ?? "").toLowerCase();
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

      <TenantContextStrip sectionLabel="Admin / Configurazione e utenti" />


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
            <button className="db-btn db-btn-outline" onClick={initializeScenario} disabled={loadingTop || !selectedScenarioId}>
              ▶ Inizializza
            </button>
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

          {/* Campaign status toggle card */}
          <div className="db-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "24px", gap: "12px" }}>
            <div style={{ fontSize: "38px" }}>📣</div>
            <h3 style={{ margin: 0, fontSize: "16px", color: "var(--text-primary)" }}>Campagna di mobilità</h3>
            {!canManageCampaign ? (
              <span style={{ fontSize: "12px", color: "var(--text-secondary)", textAlign: "center" }}>
                Solo admin del perimeter possono aprire o chiudere la campagna.
              </span>
            ) : campaignStatus !== null ? (
              <>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  padding: "4px 12px", borderRadius: "999px", fontSize: "13px", fontWeight: 700,
                  background: campaignStatus === "open" ? "#ecfdf5" : "#fef2f2",
                  color: campaignStatus === "open" ? "#059669" : "#dc2626",
                  border: `1px solid ${campaignStatus === "open" ? "#a7f3d0" : "#fca5a5"}`,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: campaignStatus === "open" ? "#10b981" : "#ef4444" }} />
                  {campaignStatus === "open" ? "Aperta" : "Chiusa"}
                </div>
                <button
                  className="db-btn db-btn-outline"
                  style={campaignStatus === "open"
                    ? { color: "#dc2626", borderColor: "#fca5a5", background: "#fef2f2" }
                    : { color: "#059669", borderColor: "#a7f3d0", background: "#ecfdf5" }}
                  onClick={toggleCampaignStatus}
                >
                  {campaignStatus === "open" ? "Chiudi campagna" : "Apri campagna"}
                </button>
              </>
            ) : (
              <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Caricamento…</span>
            )}
          </div>

        </div>
      )}

      {/* ---- USERS VIEW ---- */}
      {view === "users" && (
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
                  } catch (e: any) {
                    alert(e?.message ?? "Errore aggiunta utente");
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
                            await adminUpdateUser(u.id, { access_role: e.target.value as any });
                            await loadUsers();
                          } catch (err: any) {
                            alert(err?.message ?? "Errore ruolo accesso");
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
                      <select
                        className="db-priority-select"
                        style={{ width: "auto", minWidth: "100px" }}
                        value={u.availability_status ?? "inactive"}
                        onChange={async (e) => {
                          const newStatus = e.target.value;
                          try {
                            if (newStatus === "inactive") {
                              await appApi.deactivateUserAndCleanup(u.id);
                              await loadUsers();
                            } else {
                              await adminUpdateUser(u.id, { availability_status: "available" });
                            }
                          } catch (err: any) {
                            alert(err?.message ?? "Errore aggiornamento");
                          }
                        }}
                      >
                        <option value="inactive">Inattivo (⚪)</option>
                        <option value="available">Disponibile (🟢)</option>
                      </select>
                    </td>

                    {/* Sede */}
                    <td>
                      <select
                        className="db-filter-select"
                        style={{ height: "30px", fontSize: "12px", minWidth: "140px" }}
                        value={u.location_id ?? ""}
                        onChange={async (e) => {
                          try { await adminUpdateUser(u.id, { location_id: e.target.value || null }); }
                          catch (err: any) { alert(err?.message ?? "Errore sede"); }
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
                          catch (err: any) { alert(err?.message ?? "Errore vincolo"); }
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
                          catch (err: any) { alert(err?.message ?? "Errore ruolo"); }
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
                        catch (err: any) { alert(err?.message ?? "Errore eliminazione"); }
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
