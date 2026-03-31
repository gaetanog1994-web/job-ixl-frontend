import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/* =======================
   TYPES
======================= */

type Location = {
    id: string;
    name: string;
    region: string | null;
    province: string | null;
    latitude: number | null;
    longitude: number | null;
    fixed_location: boolean;
};

/* =======================
   COMPONENT
======================= */

const AdminLocationsManager = () => {
    const [locations, setLocations] = useState<Location[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState({
        name: "",
        region: "",
        province: "",
        latitude: "",
        longitude: "",
        fixed_location: true,
    });

    /* =======================
       LOAD
    ======================= */

    const loadLocations = async () => {
        const { data, error } = await supabase
            .from("locations")
            .select("*")
            .order("name");

        if (error) {
            setError(error.message);
            return;
        }

        setLocations(data ?? []);
    };

    useEffect(() => {
        loadLocations();
    }, []);

    /* =======================
       ACTIONS
    ======================= */

    const addLocation = async () => {
        if (!form.name || !form.latitude || !form.longitude) {
            setError("Nome, latitudine e longitudine sono obbligatori.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { error } = await supabase.from("locations").insert({
                name: form.name,
                region: form.region || null,
                province: form.province || null,
                latitude: Number(form.latitude),
                longitude: Number(form.longitude),
                fixed_location: form.fixed_location,
            });

            if (error) throw new Error(error.message);

            setForm({
                name: "",
                region: "",
                province: "",
                latitude: "",
                longitude: "",
                fixed_location: true,
            });

            await loadLocations();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const deleteLocation = async (id: string) => {
        if (!confirm("Eliminare questa sede?")) return;

        setLoading(true);
        setError(null);

        try {
            const { error } = await supabase
                .from("locations")
                .delete()
                .eq("id", id);

            if (error) throw new Error(error.message);

            await loadLocations();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    /* =======================
       UI
    ======================= */

    return (
        <div className="db-card">
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
                    Sedi Aziendali ({locations.length})
                </h2>
            </div>

            {error && <div style={{ margin: "16px 20px", padding: "10px", background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: "8px", fontSize: "13px" }}>{error}</div>}

            {/* ADD FORM */}
            <div style={{ padding: "16px 20px", background: "var(--surface)", borderBottom: "1px solid var(--border)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px", alignItems: "center" }}>
                <input className="db-filter-select" placeholder="Nome sede*" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <input className="db-filter-select" placeholder="Regione" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
                <input className="db-filter-select" placeholder="Provincia" value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} />
                <input className="db-filter-select" placeholder="Latitudine*" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
                <input className="db-filter-select" placeholder="Longitudine*" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--text-primary)", fontWeight: 600 }}>
                    <input type="checkbox" checked={form.fixed_location} onChange={(e) => setForm({ ...form, fixed_location: e.target.checked })} style={{ width: "16px", height: "16px", accentColor: "var(--brand)" }} />
                    Fissa
                </label>
                <button className="db-btn" style={{ background: "var(--brand)", color: "white" }} onClick={addLocation} disabled={loading}>
                    ➕ Aggiungi
                </button>
            </div>

            {/* LIST */}
            <div style={{ overflowX: "auto" }}>
                <table className="db-apps-table" style={{ width: "100%", whiteSpace: "nowrap" }}>
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>Regione</th>
                            <th>Provincia</th>
                            <th>Latitudine</th>
                            <th>Longitudine</th>
                            <th align="center">Sede Fissa</th>
                            <th>Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {locations.length === 0 && (
                            <tr>
                                <td colSpan={7} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                                    Nessuna sede configurata.
                                </td>
                            </tr>
                        )}
                        {locations.map((l) => (
                            <tr key={l.id}>
                                <td><span style={{ fontWeight: 600 }}>{l.name}</span></td>
                                <td>{l.region || "—"}</td>
                                <td>{l.province || "—"}</td>
                                <td style={{ color: "var(--text-secondary)" }}>{l.latitude}</td>
                                <td style={{ color: "var(--text-secondary)" }}>{l.longitude}</td>
                                <td align="center">
                                    {l.fixed_location ? (
                                        <span style={{ color: "#10b981", fontSize: "16px" }}>✓</span>
                                    ) : (
                                        <span style={{ color: "var(--border)" }}>—</span>
                                    )}
                                </td>
                                <td>
                                    <button className="db-action-btn db-action-btn-delete" onClick={() => deleteLocation(l.id)} disabled={loading}>
                                        Elimina
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminLocationsManager;
