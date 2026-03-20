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
        } catch (e: any) {
            setError(e?.message ?? String(e));
        } finally {
            setLoading(false);
        }
    };


    useEffect(() => {
        if (view === "detail" && activeScenario?.id) {
            loadApplications(activeScenario.id);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
        } catch (e: any) {
            setError(e.message);
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
        } catch (e: any) {
            setError(e.message);
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
        } catch (e: any) {
            setError(e.message);
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
        } catch (e: any) {
            setError(e.message);
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
        } catch (e: any) {
            setError(e.message);
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

        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <h4 style={{ marginTop: 0 }}>🧩 Gestione Scenari</h4>

            {error && <div style={{ color: "red", marginBottom: "10px" }}>{error}</div>}

            {view === "list" && (
                <>
                    <button onClick={addScenario} disabled={loading}>
                        ➕ Aggiungi scenario
                    </button>

                    {scenarios.length === 0 ? (
                        <p style={{ marginTop: "12px" }}>Nessuno scenario definito.</p>
                    ) : (
                        <ul style={{ marginTop: "14px" }}>
                            {scenarios.map((s) => (
                                <li
                                    key={s.id}
                                    style={{ display: "flex", gap: "10px", alignItems: "center" }}
                                >
                                    <span style={{ flex: 1 }}>{s.name}</span>

                                    <button onClick={() => openScenario(s)} disabled={loading}>
                                        Apri
                                    </button>

                                    <button
                                        onClick={() => deleteScenario(s.id)}
                                        disabled={loading}
                                        title="Elimina scenario"
                                    >
                                        ❌
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}

            {view === "detail" && activeScenario && (
                <>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "10px" }}>
                        <button
                            onClick={async () => {
                                await reloadScenarios();
                                setView("list");
                                setActiveScenario(null);
                                setApplications([]);
                                setError(null);
                            }}
                            disabled={loading}
                        >
                            ⬅ Torna alla lista scenari
                        </button>

                        <button onClick={renameScenario} disabled={loading}>
                            ✏️ Rinomina
                        </button>

                        <button onClick={() => deleteScenario(activeScenario.id)} disabled={loading}>
                            ❌ Elimina scenario
                        </button>
                    </div>

                    <h4 style={{ marginTop: "10px" }}>📌 Scenario: {activeScenario.name}</h4>

                    <div style={{ display: "flex", gap: "10px", margin: "10px 0 16px 0" }}>
                        <button onClick={deleteAllApplications} disabled={loading}>
                            🧹 Elimina tutti gli utenti dallo scenario
                        </button>
                    </div>

                    <div style={{ display: "grid", gap: "8px", maxWidth: "460px" }}>
                        <select
                            value={form.user_id}
                            onChange={(e) => setForm({ ...form, user_id: e.target.value })}
                            disabled={loading}
                        >
                            <option value="">Utente A</option>
                            {users.map((u) => (
                                <option key={u.id} value={u.id}>
                                    {u.full_name}
                                </option>
                            ))}
                        </select>

                        <select
                            value={form.position_id}
                            onChange={(e) => setForm({ ...form, position_id: e.target.value })}
                            disabled={loading}
                        >
                            <option value="">Si candida verso</option>
                            {positions.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.occupant_name} — {p.title}
                                </option>
                            ))}
                        </select>

                        <input
                            type="number"
                            min={1}
                            value={form.priority}
                            onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
                            disabled={loading}
                        />

                        <button onClick={addApplication} disabled={loading}>
                            Inserisci candidatura
                        </button>
                    </div>

                    <h4 style={{ marginTop: "20px" }}>📋 Candidature nello scenario</h4>

                    {applications.length === 0 ? (
                        <p>Nessuna candidatura nello scenario.</p>
                    ) : (
                        <table width="100%" style={{ marginTop: "10px" }}>
                            <thead>
                                <tr>
                                    <th align="left">Utente</th>
                                    <th align="left">Target</th>
                                    <th align="left">Priorità</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {applications.map((a) => {
                                    const u = users.find((x) => x.id === a.user_id);
                                    const p = positions.find((x) => x.id === a.position_id);

                                    return (
                                        <tr key={a.id}>
                                            <td>{u?.full_name}</td>
                                            <td>
                                                {p?.occupant_name} — {p?.title}
                                            </td>
                                            <td>{a.priority}</td>
                                            <td>
                                                <button
                                                    onClick={() => deleteApplication(a.id)}
                                                    disabled={loading}
                                                    title="Rimuovi"
                                                >
                                                    ❌
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </>
            )}
        </div>
    );
};

export default AdminScenariosManager;
