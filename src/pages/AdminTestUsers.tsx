import { useEffect, useState } from "react";
import AdminScenariosManager from "./AdminScenariosManager";
import AdminLocationsManager from "./AdminLocationsManager";
import AdminRolesManager from "./AdminRolesManager";
import { appApi } from "../lib/appApi";



/* =======================
   TYPES
======================= */

type User = {
    id: string;
    full_name: string | null;
    availability_status: string | null;
    location_id: string | null;
    fixed_location?: boolean | null;
    role_id?: string | null;
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

    // 🔵 scenario attualmente inizializzato (solo UI)
    const [activeScenarioLabel, setActiveScenarioLabel] = useState<string | null>(
        null
    );

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
            // backend ritorna solo id,title,occupied_by (ok)
            // occupant_name non lo hai nel backend: lo teniamo null
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


    const loadAll = async () => {
        // facciamo partire tutto in parallelo
        await Promise.all([
            loadUsers(),
            loadLocations(),
            loadPositions(),
            loadScenarios(),
            loadRoles(),
            loadAppConfig()
        ]);
    };

    // ✅ QUESTO È IL PUNTO CRITICO: useEffect deve stare qui, non dentro loadAll
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
        if (!confirm("Vuoi inizializzare questo scenario?")) return;

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
        if (!confirm("Vuoi resettare utenti attivi e svuotare la dashboard?")) return;

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
       UI HELPERS (UNCHANGED)
    ======================= */

    const cardStyle: React.CSSProperties = {
        cursor: "pointer",
        padding: "24px",
        borderRadius: "12px",
        background: "#1f1f1f",
        border: "1px solid #333",
        transition: "all 0.2s ease",
        userSelect: "none",
    };

    const cardHoverIn = (e: React.MouseEvent<HTMLDivElement>) => {
        e.currentTarget.style.background = "#262626";
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.borderColor = "#444";
    };

    const cardHoverOut = (e: React.MouseEvent<HTMLDivElement>) => {
        e.currentTarget.style.background = "#1f1f1f";
        e.currentTarget.style.transform = "translateY(0px)";
        e.currentTarget.style.borderColor = "#333";
    };

    /* =======================
       UI
    ======================= */

    console.log("USERS:", users);

    // ✅ Centralizza refresh: ogni update/delete ricarica users qui dentro
    const adminUpdateUser = async (userId: string, patch: Partial<User>) => {
        await appApi.adminPatchUser(userId, patch);
        await loadUsers(); // 👈 spostato qui
    };

    const adminDeleteUser = async (userId: string) => {
        await appApi.adminDeleteUser(userId);
        await loadUsers(); // 👈 spostato qui
    };


    return (
        <div style={{ padding: "30px" }}>
            {/* TITLE */}
            <div style={{ marginBottom: "10px" }}>
                <div
                    onClick={goHome}
                    style={{ fontSize: "18px", fontWeight: 700, cursor: "pointer" }}
                >
                    🧪 Pannello di Configurazione
                </div>
            </div>

            {/* TOP ACTIONS */}
            <div
                style={{
                    display: "flex",
                    gap: "10px",
                    alignItems: "center",
                    marginBottom: "14px",
                }}
            >
                <select
                    value={selectedScenarioId}
                    onChange={(e) => setSelectedScenarioId(e.target.value)}
                >
                    <option value="">Seleziona scenario</option>
                    {scenarios.map((s) => (
                        <option key={s.id} value={s.id}>
                            {s.name}
                        </option>
                    ))}
                </select>

                <button onClick={initializeScenario} disabled={loadingTop}>
                    ▶ Inizializza
                </button>

                <button onClick={resetActiveUsers} disabled={loadingTop}>
                    🔄 Reset utenti attivi
                </button>

                {/* 🟢 SCENARIO ATTIVO */}
                {activeScenarioLabel && (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            marginLeft: "8px",
                            color: "#2ecc71",
                            fontWeight: 600,
                            fontSize: "14px",
                        }}
                    >
                        <span
                            style={{
                                width: "10px",
                                height: "10px",
                                borderRadius: "50%",
                                background: "#2ecc71",
                                display: "inline-block",
                            }}
                        />
                        SCENARIO ATTIVO: {activeScenarioLabel}
                    </div>
                )}
                {/* CONFIG: NUMERO MAX CANDIDATURE */}
                <div
                    style={{
                        marginLeft: "auto",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        paddingLeft: "20px",
                        borderLeft: "1px solid #333",
                    }}
                >
                    <span style={{ fontWeight: 600 }}>
                        Numero max candidature:
                    </span>

                    <select
                        value={maxApplications ?? ""}
                        onChange={(e) =>
                            updateMaxApplications(Number(e.target.value))
                        }
                    >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                            <option key={n} value={n}>
                                {n}
                            </option>
                        ))}
                    </select>
                </div>

            </div>


            {errorTop && (
                <div style={{ color: "red", marginBottom: "14px" }}>{errorTop}</div>
            )}

            {view !== "home" && (
                <button onClick={goHome} style={{ marginBottom: "16px" }}>
                    ⬅ INDIETRO
                </button>
            )}

            {/* HOME */}
            {view === "home" && (
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                        gap: "30px",
                        marginTop: "20px",
                    }}
                >
                    <div
                        style={cardStyle}
                        onClick={() => setView("users")}
                        onMouseEnter={cardHoverIn}
                        onMouseLeave={cardHoverOut}
                    >
                        <h3 style={{ margin: 0, marginBottom: "10px" }}>
                            👤 Gestione Utenti
                        </h3>
                        <p style={{ margin: 0, opacity: 0.8 }}>
                            Modifica stato attivo/inattivo e sede degli utenti.
                        </p>
                    </div>

                    <div
                        style={cardStyle}
                        onClick={() => setView("scenarios")}
                        onMouseEnter={cardHoverIn}
                        onMouseLeave={cardHoverOut}
                    >
                        <h3 style={{ margin: 0, marginBottom: "10px" }}>
                            🧩 Gestione Scenari
                        </h3>
                        <p style={{ margin: 0, opacity: 0.8 }}>
                            Crea scenari e definisci candidature isolate.
                        </p>
                    </div>

                    <div
                        style={cardStyle}
                        onClick={() => setView("locations")}
                        onMouseEnter={cardHoverIn}
                        onMouseLeave={cardHoverOut}
                    >
                        <h3 style={{ margin: 0, marginBottom: "10px" }}>🏢 Gestione Sedi</h3>
                        <p style={{ margin: 0, opacity: 0.8 }}>
                            Visualizza, aggiungi o rimuovi sedi operative.
                        </p>
                    </div>

                    <div
                        style={cardStyle}
                        onClick={() => setView("roles")}
                        onMouseEnter={cardHoverIn}
                        onMouseLeave={cardHoverOut}
                    >
                        <h3 style={{ margin: 0, marginBottom: "10px" }}>🧠 Gestione Ruoli</h3>
                        <p style={{ margin: 0, opacity: 0.8 }}>
                            Definisci i ruoli aziendali e le loro compatibilità.
                        </p>
                    </div>
                </div>
            )}

            {/* USERS */}
            {view === "users" && (
                <>
                    <div style={{ marginBottom: "12px" }}>
                        <button
                            onClick={async () => {
                                const fullName = prompt("Nome completo utente:");
                                const email = prompt("Email utente:");
                                if (!fullName || !email) return;

                                try {
                                    await appApi.adminCreateUser({ full_name: fullName, email });
                                    await loadUsers();
                                } catch (e: any) {
                                    alert(e?.message ?? "Errore creazione utente");
                                    console.error(e);
                                }
                            }}
                        >
                            ➕ Aggiungi utente
                        </button>

                    </div>
                    <table width="100%">
                        <thead>
                            <tr>
                                <th align="left">Nome</th>
                                <th align="left">Stato</th>
                                <th align="left">Sede</th>
                                <th align="center">Vincolante</th>
                                <th align="left">Ruolo attuale</th>
                                <th align="left">Skills</th>
                                <th></th>
                            </tr>
                        </thead>

                        <tbody>
                            {users.map((u) => (
                                <tr key={u.id}>
                                    {/* Nome */}
                                    <td>{u.full_name}</td>

                                    {/* Stato */}
                                    <td>
                                        <select
                                            value={u.availability_status ?? "inactive"}
                                            onChange={async (e) => {
                                                const newStatus = e.target.value;

                                                try {
                                                    if (newStatus === "inactive") {
                                                        await appApi.deactivateUserAndCleanup(u.id);
                                                        await loadUsers(); // 👈 qui serve ancora perché NON passa da adminUpdateUser
                                                    } else {
                                                        await adminUpdateUser(u.id, { availability_status: "available" }); // 👈 ricarica già da sola
                                                    }


                                                    await loadUsers();
                                                } catch (err: any) {
                                                    alert(err?.message ?? "Errore aggiornamento stato utente");
                                                    console.error(err);
                                                }
                                            }}

                                        >
                                            <option value="inactive">inactive</option>
                                            <option value="available">available</option>
                                        </select>

                                    </td>

                                    {/* Sede */}
                                    <td>
                                        <select
                                            value={u.location_id ?? ""}
                                            onChange={async (e) => {
                                                try {
                                                    await adminUpdateUser(u.id, { location_id: e.target.value || null });

                                                } catch (err: any) {
                                                    alert(err?.message ?? "Errore aggiornamento sede");
                                                    console.error(err);
                                                }
                                            }}

                                        >
                                            <option value="">—</option>
                                            {locations.map((l) => (
                                                <option key={l.id} value={l.id}>
                                                    {l.name}
                                                </option>
                                            ))}
                                        </select>
                                    </td>


                                    {/* Sede vincolante */}
                                    <td align="center">
                                        <input
                                            type="checkbox"
                                            checked={!!u.fixed_location}
                                            onChange={async (e) => {
                                                try {
                                                    await adminUpdateUser(u.id, { fixed_location: e.target.checked });

                                                } catch (err: any) {
                                                    alert(err?.message ?? "Errore aggiornamento vincolo sede");
                                                    console.error(err);
                                                }
                                            }}

                                        />
                                    </td>

                                    {/* Ruolo attuale */}
                                    <td>
                                        <select
                                            value={u.role_id ?? ""}
                                            onChange={async (e) => {
                                                try {
                                                    await adminUpdateUser(u.id, { role_id: e.target.value || null });

                                                } catch (err: any) {
                                                    alert(err?.message ?? "Errore aggiornamento ruolo");
                                                    console.error(err);
                                                }
                                            }}

                                        >

                                            <option value="">—</option>
                                            {roles.map((r) => (
                                                <option key={r.id} value={r.id}>
                                                    {r.name}
                                                </option>
                                            ))}
                                        </select>
                                    </td>

                                    {/* Skills */}
                                    <td>
                                        <span style={{ opacity: 0.5 }}>—</span>
                                    </td>

                                    {/* Elimina */}
                                    <td>
                                        <button
                                            onClick={async () => {
                                                if (!confirm("Eliminare questo utente?")) return;

                                                try {
                                                    await adminDeleteUser(u.id);

                                                } catch (err: any) {
                                                    alert(err?.message ?? "Errore eliminazione utente");
                                                    console.error(err);
                                                }
                                            }}

                                        >
                                            ❌
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            )}

            {/* SCENARIOS */}
            {view === "scenarios" && (
                <AdminScenariosManager
                    key="scenarios"
                    users={users.map((u) => ({ id: u.id, full_name: u.full_name }))}
                    positions={positions.map((p) => ({
                        id: p.id,
                        title: p.title,
                        occupant_name: p.occupant_name,
                    }))}
                    scenarios={scenarios}
                    reloadScenarios={loadScenarios}
                    onScenarioDeleted={handleScenarioDeleted}
                    onScenarioRenamed={handleScenarioRenamed}
                />
            )}

            {/* LOCATIONS */}
            {view === "locations" && <AdminLocationsManager />}

            {/* ROLES */}
            {view === "roles" && <AdminRolesManager />}
        </div>


    );
};

export default AdminTestUsers;
