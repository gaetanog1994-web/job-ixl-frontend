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
        <div>
            <h4 style={{ marginTop: 0 }}>🏢 Gestione Sedi</h4>

            {error && <div style={{ color: "red", marginBottom: "10px" }}>{error}</div>}

            {/* ADD FORM */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                    gap: "8px",
                    maxWidth: "900px",
                    marginBottom: "16px",
                }}
            >
                <input
                    placeholder="Nome sede"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <input
                    placeholder="Regione"
                    value={form.region}
                    onChange={(e) => setForm({ ...form, region: e.target.value })}
                />
                <input
                    placeholder="Provincia"
                    value={form.province}
                    onChange={(e) => setForm({ ...form, province: e.target.value })}
                />
                <input
                    placeholder="Latitudine"
                    value={form.latitude}
                    onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                />
                <input
                    placeholder="Longitudine"
                    value={form.longitude}
                    onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                />
                <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <input
                        type="checkbox"
                        checked={form.fixed_location}
                        onChange={(e) =>
                            setForm({ ...form, fixed_location: e.target.checked })
                        }
                    />
                    Fissa
                </label>

                <button onClick={addLocation} disabled={loading}>
                    ➕ Aggiungi sede
                </button>
            </div>

            {/* LIST */}
            <table width="100%">
                <thead>
                    <tr>
                        <th align="left">Nome</th>
                        <th align="left">Regione</th>
                        <th align="left">Provincia</th>
                        <th align="left">Lat</th>
                        <th align="left">Lng</th>
                        <th align="center">Fissa</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {locations.map((l) => (
                        <tr key={l.id}>
                            <td>{l.name}</td>
                            <td>{l.region}</td>
                            <td>{l.province}</td>
                            <td>{l.latitude}</td>
                            <td>{l.longitude}</td>
                            <td align="center">{l.fixed_location ? "✓" : ""}</td>
                            <td>
                                <button
                                    onClick={() => deleteLocation(l.id)}
                                    disabled={loading}
                                >
                                    ❌
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default AdminLocationsManager;
