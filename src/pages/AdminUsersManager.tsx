import { useEffect, useState } from "react";
import { appApi } from "../lib/appApi";

/* =======================
   TYPES
======================= */

type User = {
    id: string;
    full_name: string | null;
    availability_status: "available" | "inactive" | null;
    location_id: string | null;
    fixed_location?: boolean | null;
    role_id?: string | null;
};

type Location = {
    id: string;
    name: string;
};

type Props = {
    users: User[];
    locations: Location[];
    onBack: () => void;
    onUpdateDone: () => void; // tipicamente ricarica lista da parent
};

/* =======================
   COMPONENT
======================= */

const AdminUsersManager = ({ users, locations, onBack, onUpdateDone }: Props) => {
    const [maxApplications, setMaxApplications] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);

    // Se vuoi, puoi passare maxApplications come prop dal parent.
    // Qui proviamo a leggerlo via backend (serve endpoint /api/admin/config oppure lo gestisci nel parent).
    // Per ora: lo lasciamo opzionale e lo mostriamo solo se c'è.
    useEffect(() => {
        (async () => {
            try {
                const cfg = await appApi.adminGetConfig();
                setMaxApplications(cfg?.max_applications ?? null);
            } catch (e) {
                console.error("LOAD CONFIG ERROR:", e);
                setMaxApplications(null);
            }
        })();
    }, []);


    const updateMax = async (value: number) => {
        try {
            setSaving(true);
            await appApi.adminUpdateMaxApplications(value);
            setMaxApplications(value);
            onUpdateDone();
        } catch (e: any) {
            alert("Errore aggiornamento configurazione: " + (e?.message ?? "unknown"));
        } finally {
            setSaving(false);
        }
    };

    const patchUser = async (userId: string, patch: Partial<User>) => {
        try {
            setSaving(true);

            // regola: se metti inactive, vuoi anche cleanup applications (già hai endpoint dedicato)
            if (patch.availability_status === "inactive") {
                await appApi.deactivateUserAndCleanup(userId);
            } else {
                await appApi.adminPatchUser(userId, patch);
            }

            onUpdateDone();
        } catch (e: any) {
            alert("Errore aggiornamento utente: " + (e?.message ?? "unknown"));
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div>
            <button onClick={onBack}>⬅ INDIETRO</button>

            <h4 style={{ marginTop: "20px" }}>🏢 Gestione Utenti</h4>

            {/* CONFIG GLOBALE */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    alignItems: "center",
                    gap: "10px",
                    marginBottom: "10px",
                    opacity: saving ? 0.7 : 1,
                }}
            >
                <span>
                    <b>Numero max candidature:</b>
                </span>

                <select
                    value={maxApplications ?? ""}
                    onChange={(e) => updateMax(Number(e.target.value))}
                    disabled={saving}
                >
                    <option value="" disabled>
                        —
                    </option>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <option key={n} value={n}>
                            {n}
                        </option>
                    ))}
                </select>
            </div>

            <p>Associa utenti alle sedi e gestisci lo stato (admin-only, via backend)</p>

            <table width="100%" style={{ marginTop: "10px" }}>
                <thead>
                    <tr>
                        <th align="left">Utente</th>
                        <th align="left">Stato</th>
                        <th align="left">Sede</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map((u) => (
                        <tr key={u.id}>
                            <td>{u.full_name ?? "—"}</td>

                            <td>
                                <select
                                    value={u.availability_status ?? "inactive"}
                                    onChange={(e) =>
                                        patchUser(u.id, {
                                            availability_status: e.target.value as "available" | "inactive",
                                        })
                                    }
                                    disabled={saving}
                                >
                                    <option value="inactive">inactive</option>
                                    <option value="available">available</option>
                                </select>
                            </td>

                            <td>
                                <select
                                    value={u.location_id ?? ""}
                                    onChange={(e) =>
                                        patchUser(u.id, {
                                            location_id: e.target.value || null,
                                        })
                                    }
                                    disabled={saving}
                                >
                                    <option value="">—</option>
                                    {locations.map((l) => (
                                        <option key={l.id} value={l.id}>
                                            {l.name}
                                        </option>
                                    ))}
                                </select>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default AdminUsersManager;
