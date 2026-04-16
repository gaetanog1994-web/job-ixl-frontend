import { useEffect, useState } from "react";
import { appApi } from "../lib/appApi";

/* =======================
   TYPES
======================= */

type User = {
    id: string;
    full_name: string | null;
};

type Position = {
    id: string;
    title: string | null;
    occupant_name: string | null;
};

type Scenario = {
    id: string;
    name: string;
};

type ScenarioApplication = {
    id: string;
    user_id: string;
    position_id: string;
    priority: number;
};

type Props = {
    users: User[];
    positions: Position[];
    scenarios: Scenario[];
    reloadScenarios: () => Promise<void>;
    onScenarioDeleted: (scenarioId: string) => void;
    onScenarioRenamed: (scenarioId: string) => void;
};

const AdminScenariosManager = ({
    users,
    positions,
    scenarios,
    reloadScenarios,
    onScenarioDeleted,
    onScenarioRenamed,
}: Props) => {
    const [view, setView] = useState<"list" | "detail">("list");
    const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);

    const [applications, setApplications] = useState<ScenarioApplication[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState({
        user_id: "",
        position_id: "",
        priority: 1,
    });

    const loadApplications = async (scenarioId: string) => {
        setLoading(true);
        setError(null);
        try {
            const data = await appApi.adminGetScenarioApplications(scenarioId);
            setApplications(data ?? []);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    };


    useEffect(() => {
        if (view === "detail" && activeScenario?.id) {
            loadApplications(activeScenario.id);
        }
    }, [view, activeScenario?.id]);

    /* =======================
       SCENARIO ACTIONS
    ======================= */

    const addScenario = async () => {
        const name = prompt("Nome scenario");
        if (!name) return;

        setLoading(true);
        setError(null);

        try {
            const created = await appApi.createTestScenario(name);

            const sc: Scenario = { id: created.id, name: created.name };
            setActiveScenario(sc);
            setView("detail");
            setApplications([]);

            await reloadScenarios();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    };

    const openScenario = async (s: Scenario) => {
        setError(null);
        setActiveScenario(s);
        setView("detail");
        await loadApplications(s.id);
    };

    const renameScenario = async () => {
        if (!activeScenario) return;

        const newName = prompt("Nuovo nome scenario", activeScenario.name);
        if (!newName || newName.trim() === "" || newName === activeScenario.name) return;

        setLoading(true);
        setError(null);

        try {
            await appApi.adminRenameScenario(activeScenario.id, newName);


            setActiveScenario({ ...activeScenario, name: newName });

            await reloadScenarios();
            onScenarioRenamed(activeScenario.id);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    };

    const deleteScenario = async (scenarioId: string) => {
        if (!confirm("Eliminare questo scenario?")) return;

        setLoading(true);
        setError(null);

        try {
            await appApi.adminDeleteScenario(scenarioId);

            await reloadScenarios();
            onScenarioDeleted(scenarioId);

            if (activeScenario?.id === scenarioId) {
                setActiveScenario(null);
                setApplications([]);
                setView("list");
            }
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    };

    /* =======================
       APPLICATION ACTIONS
    ======================= */

    const addApplication = async () => {
        if (!activeScenario) return;
        if (!form.user_id || !form.position_id) {
            setError("Seleziona utente e posizione.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await appApi.insertTestScenarioApplication({
                scenarioId: activeScenario.id,
                user_id: form.user_id,
                position_id: form.position_id,
                priority: form.priority,
            });

            setForm({ user_id: "", position_id: "", priority: 1 });
            await loadApplications(activeScenario.id);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    };

    const deleteApplication = async (applicationId: string) => {
        if (!activeScenario) return;

        setLoading(true);
        setError(null);

        try {
            await appApi.adminDeleteScenarioApplication(activeScenario.id, applicationId);

            await loadApplications(activeScenario.id);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    };

    const deleteAllApplications = async () => {
        if (!activeScenario) return;
        if (!confirm("Eliminare TUTTE le candidature di questo scenario?")) return;

        setLoading(true);
        setError(null);

        try {
            await appApi.adminDeleteAllScenarioApplications(activeScenario.id);
            setApplications([]);

        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="db-card">
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
                    {view === "list" ? `Scenari (${scenarios.length})` : `Scenario: ${activeScenario?.name}`}
                </h2>
                {view === "list" && (
                    <button className="db-btn" style={{ background: "var(--brand)", color: "white" }} onClick={addScenario} disabled={loading}>
                        ➕ Nuovo scenario
                    </button>
                )}
                {view === "detail" && (
                    <div style={{ display: "flex", gap: "8px" }}>
                        <button className="db-btn db-btn-outline" onClick={async () => {
                            await reloadScenarios();
                            setView("list");
                            setActiveScenario(null);
                            setApplications([]);
                            setError(null);
                        }} disabled={loading}>
                            ← Indietro
                        </button>
                        <button className="db-btn db-btn-outline" onClick={renameScenario} disabled={loading}>
                            ✏️ Rinomina
                        </button>
                        <button className="db-btn db-btn-danger" onClick={() => { if(activeScenario) deleteScenario(activeScenario.id); }} disabled={loading}>
                            Elimina scenario
                        </button>
                    </div>
                )}
            </div>

            {error && <div style={{ margin: "16px 20px", padding: "10px", background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: "8px", fontSize: "13px" }}>{error}</div>}

            {/* LISTA SCENARI */}
            {view === "list" && (
                <div style={{ overflowX: "auto" }}>
                    <table className="db-apps-table" style={{ width: "100%", whiteSpace: "nowrap" }}>
                        <thead>
                            <tr>
                                <th>Nome Scenario</th>
                                <th align="right">Azioni</th>
                            </tr>
                        </thead>
                        <tbody>
                            {scenarios.length === 0 && (
                                <tr>
                                    <td colSpan={2} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                                        Nessuno scenario presente.
                                    </td>
                                </tr>
                            )}
                            {scenarios.map((s) => (
                                <tr key={s.id}>
                                    <td><span style={{ fontWeight: 600 }}>{s.name}</span></td>
                                    <td align="right">
                                        <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                                            <button className="db-btn db-btn-outline" onClick={() => openScenario(s)} disabled={loading}>
                                                Apri
                                            </button>
                                            <button className="db-action-btn db-action-btn-delete" onClick={() => deleteScenario(s.id)} disabled={loading}>
                                                Elimina
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* DETTAGLIO SCENARIO */}
            {view === "detail" && activeScenario && (
                <>
                    {/* INSERISCI CANDIDATURA MANUALE */}
                    <div style={{ padding: "16px 20px", background: "var(--surface)", borderBottom: "1px solid var(--border)", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                        <select
                            className="db-filter-select" style={{ flex: 1, minWidth: "150px" }}
                            value={form.user_id}
                            onChange={(e) => setForm({ ...form, user_id: e.target.value })}
                            disabled={loading}
                        >
                            <option value="">Seleziona Utente</option>
                            {users.map((u) => (
                                <option key={u.id} value={u.id}>
                                    {u.full_name}
                                </option>
                            ))}
                        </select>

                        <select
                            className="db-filter-select" style={{ flex: 1, minWidth: "220px" }}
                            value={form.position_id}
                            onChange={(e) => setForm({ ...form, position_id: e.target.value })}
                            disabled={loading}
                        >
                            <option value="">Si candida verso la posizione</option>
                            {positions.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.occupant_name} — {p.title}
                                </option>
                            ))}
                        </select>

                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}>Priorità:</span>
                            <input
                                className="db-filter-select"
                                style={{ width: "60px" }}
                                type="number"
                                min={1}
                                value={form.priority}
                                onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
                                disabled={loading}
                            />
                        </div>

                        <button className="db-btn" style={{ background: "var(--brand)", color: "white" }} onClick={addApplication} disabled={loading}>
                            Inserisci
                        </button>
                    </div>

                    <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>Candidature isolate in questo scenario</div>
                        {applications.length > 0 && (
                            <button className="db-btn db-btn-danger" onClick={deleteAllApplications} disabled={loading}>
                                🧹 Svuota scenario
                            </button>
                        )}
                    </div>

                    {/* TABELLA CANDIDATURE SCENARIO */}
                    <div style={{ overflowX: "auto" }}>
                        <table className="db-apps-table" style={{ width: "100%", whiteSpace: "nowrap" }}>
                            <thead>
                                <tr>
                                    <th>Candidato</th>
                                    <th>Posizione Target</th>
                                    <th align="center">Priorità</th>
                                    <th align="right">Azioni</th>
                                </tr>
                            </thead>
                            <tbody>
                                {applications.length === 0 && (
                                    <tr>
                                        <td colSpan={4} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                                            Nessuna candidatura presente in questo scenario.
                                        </td>
                                    </tr>
                                )}
                                {applications.map((a) => {
                                    const u = users.find((x) => x.id === a.user_id);
                                    const p = positions.find((x) => x.id === a.position_id);

                                    return (
                                        <tr key={a.id}>
                                            <td><span style={{ fontWeight: 600 }}>{u?.full_name}</span></td>
                                            <td>
                                                {p?.occupant_name && <span style={{ marginRight: "6px", color: "var(--text-secondary)" }}>{p.occupant_name}</span>}
                                                <span style={{ 
                                                    padding: "2px 6px", borderRadius: "4px", background: "var(--brand-light)", color: "var(--brand)", fontSize: "11px", fontWeight: 600
                                                }}>{p?.title}</span>
                                            </td>
                                            <td align="center">
                                                <span style={{ 
                                                    display: "inline-flex", width: 24, height: 24, borderRadius: "6px", alignItems: "center", justifyContent: "center", background: "#f1f5f9", fontWeight: 700, fontSize: "12px", color: "var(--text-primary)"
                                                }}>{a.priority}</span>
                                            </td>
                                            <td align="right">
                                                <button className="db-action-btn db-action-btn-delete" onClick={() => deleteApplication(a.id)} disabled={loading}>
                                                    Rimuovi
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
};

export default AdminScenariosManager;
