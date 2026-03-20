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

        (data ?? []).forEach((c: any) => {
            if (!map[c.role_id]) map[c.role_id] = [];

            map[c.role_id].push({
                id: c.id,
                compatible_role_id: c.compatible_role_id,
                compatible_role_name: c.roles?.name ?? "",
            });
        });

        setCompatMap(map);
    };

    useEffect(() => {
        loadRoles();
        loadAllCompatibilities();
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
        <div>
            <h4 style={{ marginTop: 0 }}>🧠 Gestione Ruoli</h4>

            {error && <div style={{ color: "red", marginBottom: "10px" }}>{error}</div>}

            {/* ADD ROLE */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
                <input
                    placeholder="Nuovo ruolo"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                />
                <button onClick={addRole}>➕ Aggiungi ruolo</button>
            </div>

            {/* ROLES TABLE */}
            <table width="100%" style={{ borderCollapse: "collapse" }}>
                <thead>
                    <tr>
                        <th align="left">Ruolo</th>
                        <th align="left">Aggiungi compatibilità</th>
                        <th align="left">Compatibili</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {roles.map((r) => {
                        const compatibilities = compatMap[r.id] ?? [];

                        return (
                            <tr key={r.id}>
                                <td>{r.name}</td>

                                <td>
                                    <div style={{ display: "flex", gap: "6px" }}>
                                        <select
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
                                                .filter((x) => x.id !== r.id)
                                                .map((x) => (
                                                    <option key={x.id} value={x.id}>
                                                        {x.name}
                                                    </option>
                                                ))}
                                        </select>

                                        <button onClick={() => addCompatibility(r.id)}>
                                            Inserisci
                                        </button>
                                    </div>
                                </td>

                                <td>
                                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                        {compatibilities.map((c) => (
                                            <span
                                                key={c.id}
                                                style={{
                                                    padding: "4px 8px",
                                                    border: "1px solid #444",
                                                    borderRadius: "12px",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "6px",
                                                }}
                                            >
                                                {c.compatible_role_name}
                                                <button
                                                    onClick={() => deleteCompatibility(c.id)}
                                                    style={{ border: "none", background: "transparent" }}
                                                >
                                                    ❌
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                </td>

                                <td width="40">
                                    <button onClick={() => deleteRole(r.id)}>❌</button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default AdminRolesManager;
