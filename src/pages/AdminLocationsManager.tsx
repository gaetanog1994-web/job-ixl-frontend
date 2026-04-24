import { useEffect, useState } from "react";
import { appApi } from "../lib/appApi";

type Location = {
    id: string;
    name: string;
    latitude: number | null;
    longitude: number | null;
};

const AdminLocationsManager = () => {
    const [locations, setLocations] = useState<Location[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState({
        name: "",
        latitude: "",
        longitude: "",
    });

    const loadLocations = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await appApi.adminGetLocations();
            setLocations(data ?? []);
        } catch (e: any) {
            setError(e?.message ?? "Impossibile caricare le sedi.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadLocations();
    }, []);

    const addLocation = async () => {
        const name = form.name.trim();
        if (!name) {
            setError("Il nome sede è obbligatorio.");
            return;
        }

        setLoading(true);
        setError(null);
        try {
            await appApi.adminCreateLocation({
                name,
                latitude: form.latitude.trim() ? Number(form.latitude) : null,
                longitude: form.longitude.trim() ? Number(form.longitude) : null,
            });
            setForm({ name: "", latitude: "", longitude: "" });
            await loadLocations();
        } catch (e: any) {
            setError(e?.message ?? "Creazione sede fallita.");
        } finally {
            setLoading(false);
        }
    };

    const deleteLocation = async (id: string) => {
        if (!window.confirm("Eliminare questa sede?")) return;
        setLoading(true);
        setError(null);
        try {
            await appApi.adminDeleteLocation(id);
            await loadLocations();
        } catch (e: any) {
            setError(e?.message ?? "Eliminazione sede fallita.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="db-card">
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
                    Sedi Aziendali ({locations.length})
                </h2>
            </div>

            {error && <div style={{ margin: "16px 20px", padding: "10px", background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: "8px", fontSize: "13px" }}>{error}</div>}

            <div style={{ padding: "16px 20px", background: "var(--surface)", borderBottom: "1px solid var(--border)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "10px", alignItems: "center" }}>
                <input className="db-filter-select" placeholder="Nome sede*" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <input className="db-filter-select" placeholder="Latitudine" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
                <input className="db-filter-select" placeholder="Longitudine" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
                <button className="db-btn" style={{ background: "var(--brand)", color: "white" }} onClick={addLocation} disabled={loading}>
                    Aggiungi
                </button>
            </div>

            <div style={{ overflowX: "auto" }}>
                <table className="db-apps-table" style={{ width: "100%", whiteSpace: "nowrap" }}>
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>Latitudine</th>
                            <th>Longitudine</th>
                            <th>Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {locations.length === 0 && (
                            <tr>
                                <td colSpan={4} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                                    Nessuna sede configurata.
                                </td>
                            </tr>
                        )}
                        {locations.map((location) => (
                            <tr key={location.id}>
                                <td><span style={{ fontWeight: 600 }}>{location.name}</span></td>
                                <td style={{ color: "var(--text-secondary)" }}>{location.latitude ?? "—"}</td>
                                <td style={{ color: "var(--text-secondary)" }}>{location.longitude ?? "—"}</td>
                                <td>
                                    <button className="db-action-btn db-action-btn-delete" onClick={() => deleteLocation(location.id)} disabled={loading}>
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
