import { useEffect, useMemo, useState } from "react";
import { appApi, type AdminRole } from "../lib/appApi";

type RoleDrafts = Record<string, string>;
type SelectedCompat = Record<string, string>;

const AdminRolesManager = () => {
    const [roles, setRoles] = useState<AdminRole[]>([]);
    const [newRoleName, setNewRoleName] = useState("");
    const [drafts, setDrafts] = useState<RoleDrafts>({});
    const [selectedCompat, setSelectedCompat] = useState<SelectedCompat>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const rolesById = useMemo(() => {
        const map = new Map<string, AdminRole>();
        for (const role of roles) map.set(role.id, role);
        return map;
    }, [roles]);

    const loadRoles = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await appApi.adminGetRoles();
            setRoles(data);
            setDrafts((prev) => {
                const next: RoleDrafts = {};
                for (const role of data) next[role.id] = prev[role.id] ?? role.name;
                return next;
            });
        } catch (e: any) {
            setError(e?.message ?? "Impossibile caricare i ruoli.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadRoles();
    }, []);

    const resetFeedback = () => {
        setError(null);
        setSuccess(null);
    };

    const addRole = async () => {
        const name = newRoleName.trim();
        if (!name) return;

        resetFeedback();
        setLoading(true);
        try {
            await appApi.adminCreateRole({ name });
            setNewRoleName("");
            setSuccess("Ruolo creato correttamente.");
            await loadRoles();
        } catch (e: any) {
            setError(e?.message ?? "Creazione ruolo fallita.");
        } finally {
            setLoading(false);
        }
    };

    const updateRole = async (roleId: string) => {
        const role = rolesById.get(roleId);
        if (!role) return;
        const nextName = (drafts[roleId] ?? "").trim();
        if (!nextName || nextName === role.name) return;

        resetFeedback();
        setLoading(true);
        try {
            await appApi.adminUpdateRole(roleId, { name: nextName });
            setSuccess("Ruolo aggiornato.");
            await loadRoles();
        } catch (e: any) {
            setError(e?.message ?? "Aggiornamento ruolo fallito.");
        } finally {
            setLoading(false);
        }
    };

    const deleteRole = async (roleId: string) => {
        const role = rolesById.get(roleId);
        if (!role) return;
        if (!window.confirm(`Eliminare il ruolo "${role.name}"?`)) return;

        resetFeedback();
        setLoading(true);
        try {
            await appApi.adminDeleteRole(roleId);
            setSuccess("Ruolo eliminato.");
            await loadRoles();
        } catch (e: any) {
            setError(e?.message ?? "Eliminazione ruolo fallita.");
        } finally {
            setLoading(false);
        }
    };

    const addCompatibility = async (roleId: string) => {
        const targetRoleId = (selectedCompat[roleId] ?? "").trim();
        if (!targetRoleId) return;

        resetFeedback();
        setLoading(true);
        try {
            await appApi.adminAddRoleCompatibility(roleId, targetRoleId);
            setSelectedCompat((prev) => ({ ...prev, [roleId]: "" }));
            setSuccess("Compatibilità aggiunta.");
            await loadRoles();
        } catch (e: any) {
            setError(e?.message ?? "Aggiunta compatibilità fallita.");
        } finally {
            setLoading(false);
        }
    };

    const deleteCompatibility = async (roleId: string, targetRoleId: string) => {
        resetFeedback();
        setLoading(true);
        try {
            await appApi.adminDeleteRoleCompatibility(roleId, targetRoleId);
            setSuccess("Compatibilità rimossa.");
            await loadRoles();
        } catch (e: any) {
            setError(e?.message ?? "Rimozione compatibilità fallita.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="db-card">
            <div
                style={{
                    padding: "16px 20px",
                    borderBottom: "1px solid var(--border)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "10px",
                }}
            >
                <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
                    Ruoli Aziendali ({roles.length})
                </h2>
                {loading && <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Aggiornamento in corso…</span>}
            </div>

            {error && (
                <div style={{ margin: "16px 20px", padding: "10px", background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: "8px", fontSize: "13px" }}>
                    {error}
                </div>
            )}

            {success && (
                <div style={{ margin: "16px 20px", padding: "10px", background: "#f0fdf4", color: "#166534", border: "1px solid #86efac", borderRadius: "8px", fontSize: "13px" }}>
                    {success}
                </div>
            )}

            <div
                style={{
                    padding: "16px 20px",
                    background: "var(--surface)",
                    borderBottom: "1px solid var(--border)",
                    display: "flex",
                    gap: "12px",
                    alignItems: "center",
                }}
            >
                <input
                    className="db-filter-select"
                    style={{ flex: 1, maxWidth: "320px" }}
                    placeholder="Nome nuovo ruolo"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    disabled={loading}
                />
                <button
                    className="db-btn"
                    style={{ background: "var(--brand)", color: "white" }}
                    onClick={addRole}
                    disabled={loading || !newRoleName.trim()}
                >
                    Crea ruolo
                </button>
            </div>

            <div style={{ overflowX: "auto" }}>
                <table className="db-apps-table" style={{ width: "100%", whiteSpace: "normal" }}>
                    <thead>
                        <tr>
                            <th style={{ width: "26%" }}>Ruolo</th>
                            <th style={{ width: "26%" }}>Aggiungi compatibilità</th>
                            <th style={{ width: "34%" }}>Compatibilità attive</th>
                            <th style={{ width: "14%" }} align="right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {roles.length === 0 && (
                            <tr>
                                <td colSpan={4} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                                    Nessun ruolo presente.
                                </td>
                            </tr>
                        )}
                        {roles.map((role) => {
                            const compatibilities = role.compatibilities ?? [];
                            const roleUsage = Number(role.assigned_users_count ?? 0);
                            const availableTargets = roles.filter(
                                (candidate) =>
                                    candidate.id !== role.id &&
                                    !compatibilities.some((entry) => entry.compatible_role_id === candidate.id)
                            );

                            return (
                                <tr key={role.id}>
                                    <td>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                            <input
                                                className="db-filter-select"
                                                value={drafts[role.id] ?? role.name}
                                                onChange={(e) => setDrafts((prev) => ({ ...prev, [role.id]: e.target.value }))}
                                                disabled={loading}
                                                aria-label={`Nome ruolo ${role.name}`}
                                            />
                                            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                                                Utenti assegnati: {roleUsage}
                                            </span>
                                        </div>
                                    </td>

                                    <td>
                                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                            <select
                                                className="db-filter-select"
                                                style={{ height: "34px", fontSize: "12px", padding: "0 8px", width: "100%" }}
                                                value={selectedCompat[role.id] ?? ""}
                                                onChange={(e) => setSelectedCompat((prev) => ({ ...prev, [role.id]: e.target.value }))}
                                                disabled={loading}
                                            >
                                                <option value="">Seleziona ruolo compatibile</option>
                                                {availableTargets.map((candidate) => (
                                                    <option key={candidate.id} value={candidate.id}>
                                                        {candidate.name}
                                                    </option>
                                                ))}
                                            </select>
                                            <button
                                                className="db-btn db-btn-outline"
                                                style={{ padding: "6px 10px", fontSize: "12px", whiteSpace: "nowrap" }}
                                                onClick={() => addCompatibility(role.id)}
                                                disabled={loading || !(selectedCompat[role.id] ?? "").trim()}
                                            >
                                                Aggiungi
                                            </button>
                                        </div>
                                    </td>

                                    <td>
                                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                            {compatibilities.length === 0 && (
                                                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Nessuna compatibilità</span>
                                            )}
                                            {compatibilities.map((compat) => (
                                                <span
                                                    key={`${role.id}-${compat.compatible_role_id}`}
                                                    style={{
                                                        padding: "4px 10px",
                                                        background: "#eff6ff",
                                                        color: "#2563eb",
                                                        border: "1px solid #bfdbfe",
                                                        borderRadius: "20px",
                                                        fontSize: "11px",
                                                        fontWeight: 600,
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: "6px",
                                                    }}
                                                >
                                                    {compat.compatible_role_name}
                                                    <button
                                                        onClick={() => deleteCompatibility(role.id, compat.compatible_role_id)}
                                                        style={{ border: "none", background: "transparent", cursor: "pointer", color: "#3b82f6", padding: 0 }}
                                                        title="Rimuovi compatibilità"
                                                        disabled={loading}
                                                    >
                                                        ✕
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    </td>

                                    <td align="right">
                                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                                            <button
                                                className="db-action-btn db-action-btn-edit"
                                                onClick={() => updateRole(role.id)}
                                                disabled={loading || !drafts[role.id]?.trim() || drafts[role.id]?.trim() === role.name}
                                            >
                                                Salva
                                            </button>
                                            <button
                                                className="db-action-btn db-action-btn-delete"
                                                onClick={() => deleteRole(role.id)}
                                                disabled={loading}
                                            >
                                                Elimina
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminRolesManager;
