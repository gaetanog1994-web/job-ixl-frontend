import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/* =======================
   TYPES
======================= */

type Role = {
    id: string;
    name: string;
};

type Compatibility = {
    id: string;
    compatible_role_id: string;
    compatible_role_name: string;
};

/* =======================
   COMPONENT
======================= */

const AdminRolesManager = () => {
    const [roles, setRoles] = useState<Role[]>([]);
    const [compatMap, setCompatMap] = useState<Record<string, Compatibility[]>>({});
    const [newRoleName, setNewRoleName] = useState("");
    const [error, setError] = useState<string | null>(null);

    const [selectedCompat, setSelectedCompat] = useState<Record<string, string>>({});

    /* =======================
       LOADERS
    ======================= */

    const loadRoles = async () => {
        const { data, error } = await supabase
            .from("roles")
            .select("id, name")
            .order("name");

        if (!error) setRoles(data ?? []);
    };

    const loadAllCompatibilities = async () => {
        const { data, error } = await supabase
            .from("role_compatibilities")
            .select(`
                id,
                role_id,
                compatible_role_id,
                roles:compatible_role_id ( name )
            `);

        if (error) {
            setError(error.message);
            return;
        }

        const map: Record<string, Compatibility[]> = {};

        (data ?? []).forEach((c) => {
            if (!map[c.role_id]) map[c.role_id] = [];

            map[c.role_id].push({
                id: c.id,
                compatible_role_id: c.compatible_role_id,
                compatible_role_name: (Array.isArray(c.roles) ? c.roles[0]?.name : null) ?? "",
            });
        });

        setCompatMap(map);
    };

    useEffect(() => {
        const init = async () => {
            await loadRoles();
            await loadAllCompatibilities();
        };
        void init();
    }, []);

    /* =======================
       ACTIONS
    ======================= */

    const addRole = async () => {
        if (!newRoleName.trim()) return;

        setError(null);

        const { error } = await supabase
            .from("roles")
            .insert({ name: newRoleName.trim() });

        if (error) {
            setError(error.message);
            return;
        }

        setNewRoleName("");
        loadRoles();
    };

    const deleteRole = async (roleId: string) => {
        if (!confirm("Eliminare questo ruolo?")) return;

        const { error } = await supabase
            .from("roles")
            .delete()
            .eq("id", roleId);

        if (error) {
            setError(error.message);
            return;
        }

        loadRoles();
        loadAllCompatibilities();
    };

    const addCompatibility = async (roleId: string) => {
        const compatibleRoleId = selectedCompat[roleId];
        if (!compatibleRoleId) return;

        setError(null);

        const { error } = await supabase
            .from("role_compatibilities")
            .insert({
                role_id: roleId,
                compatible_role_id: compatibleRoleId,
            });

        if (error) {
            setError(error.message);
            return;
        }

        setSelectedCompat((prev) => ({ ...prev, [roleId]: "" }));
        loadAllCompatibilities();
    };

    const deleteCompatibility = async (id: string) => {
        const { error } = await supabase
            .from("role_compatibilities")
            .delete()
            .eq("id", id);

        if (error) {
            setError(error.message);
            return;
        }

        loadAllCompatibilities();
    };

    /* =======================
       UI
    ======================= */

    return (
        <div className="db-card">
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
                    Ruoli Aziendali ({roles.length})
                </h2>
            </div>

            {error && <div style={{ margin: "16px 20px", padding: "10px", background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: "8px", fontSize: "13px" }}>{error}</div>}

            {/* ADD ROLE */}
            <div style={{ padding: "16px 20px", background: "var(--surface)", borderBottom: "1px solid var(--border)", display: "flex", gap: "12px", alignItems: "center" }}>
                <input
                    className="db-filter-select"
                    style={{ flex: 1, maxWidth: "300px" }}
                    placeholder="Nome nuovo ruolo"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                />
                <button className="db-btn" style={{ background: "var(--brand)", color: "white" }} onClick={addRole}>
                    ➕ Aggiungi ruolo
                </button>
            </div>

            {/* ROLES TABLE */}
            <div style={{ overflowX: "auto" }}>
                <table className="db-apps-table" style={{ width: "100%", whiteSpace: "wrap" }}>
                    <thead>
                        <tr>
                            <th style={{ width: "20%" }}>Ruolo</th>
                            <th style={{ width: "30%" }}>Aggiungi compatibilità</th>
                            <th style={{ width: "40%" }}>Ruoli Compatibili (per incastri)</th>
                            <th style={{ width: "10%" }} align="right">Azioni</th>
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
                        {roles.map((r) => {
                            const compatibilities = compatMap[r.id] ?? [];

                            return (
                                <tr key={r.id}>
                                    <td><span style={{ fontWeight: 600 }}>{r.name}</span></td>

                                    <td>
                                        <div style={{ display: "flex", gap: "6px" }}>
                                            <select
                                                className="db-filter-select"
                                                style={{ height: "30px", fontSize: "12px", padding: "0 8px", width: "160px" }}
                                                value={selectedCompat[r.id] ?? ""}
                                                onChange={(e) =>
                                                    setSelectedCompat((prev) => ({
                                                        ...prev,
                                                        [r.id]: e.target.value,
                                                    }))
                                                }
                                            >
                                                <option value="">Seleziona ruolo</option>
                                                {roles
                                                    .filter((x) => x.id !== r.id && !compatibilities.find(c => c.compatible_role_id === x.id))
                                                    .map((x) => (
                                                        <option key={x.id} value={x.id}>
                                                            {x.name}
                                                        </option>
                                                    ))}
                                            </select>

                                            <button className="db-btn db-btn-outline" style={{ padding: "4px 10px", fontSize: "12px" }} onClick={() => addCompatibility(r.id)} disabled={!selectedCompat[r.id]}>
                                                Collega
                                            </button>
                                        </div>
                                    </td>

                                    <td>
                                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                            {compatibilities.length === 0 && <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Nessuna compatibilità impostata</span>}
                                            {compatibilities.map((c) => (
                                                <span
                                                    key={c.id}
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
                                                    {c.compatible_role_name}
                                                    <button
                                                        onClick={() => deleteCompatibility(c.id)}
                                                        style={{ border: "none", background: "transparent", cursor: "pointer", color: "#3b82f6", display: "flex", alignItems: "center", padding: 0 }}
                                                        title="Rimuovi compatibilità"
                                                    >
                                                        ✕
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    </td>

                                    <td align="right">
                                        <button className="db-action-btn db-action-btn-delete" onClick={() => deleteRole(r.id)}>
                                            Elimina
                                        </button>
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
