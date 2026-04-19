import { useEffect, useState } from "react";
import { appApi } from "../lib/appApi";
import { useAvailability } from "../lib/AvailabilityContext";

/* =======================
   TYPES
======================= */

type User = {
    id: string;
    full_name: string | null;
    availability_status: "available" | "inactive" | null;
    user_state?: "available" | "reserved" | "inactive" | null;
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
    const { reload } = useAvailability();
    const [maxApplications, setMaxApplications] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);

    const [inviteFullName, setInviteFullName] = useState("");
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteLocationId, setInviteLocationId] = useState<string>("");
    const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

    const handleInvite = async () => {
        if (!inviteEmail.trim() || !inviteFullName.trim()) {
            alert("Nome e email sono obbligatori.");
            return;
        }
        try {
            setSaving(true);
            setInviteSuccess(null);
            await appApi.adminInviteUser({
                email: inviteEmail.trim(),
                full_name: inviteFullName.trim(),
                location_id: inviteLocationId || null,
            });
            setInviteSuccess(`Invito inviato a ${inviteEmail.trim()}`);
            setInviteFullName("");
            setInviteEmail("");
            setInviteLocationId("");
            onUpdateDone();
        } catch (e: unknown) {
            alert("Errore invito: " + (e instanceof Error ? e.message : "unknown"));
        } finally {
            setSaving(false);
        }
    };

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
        } catch (e: unknown) {
            alert("Errore aggiornamento configurazione: " + (e instanceof Error ? e.message : "unknown"));
        } finally {
            setSaving(false);
        }
    };

    const patchUser = async (userId: string, patch: Partial<User>) => {
        try {
            setSaving(true);
            await appApi.adminPatchUser(userId, patch);

            onUpdateDone();
            await reload();
        } catch (e: unknown) {
            alert("Errore aggiornamento utente: " + (e instanceof Error ? e.message : "unknown"));
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

            {/* INVITA UTENTE */}
            <div style={{ marginBottom: "20px", padding: "14px", border: "1px solid #ddd", borderRadius: "8px" }}>
                <h5 style={{ margin: "0 0 10px 0" }}>Invita utente</h5>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-end" }}>
                    <input
                        type="text"
                        placeholder="Nome completo"
                        value={inviteFullName}
                        onChange={(e) => setInviteFullName(e.target.value)}
                        disabled={saving}
                        style={{ padding: "6px 8px", minWidth: "160px" }}
                    />
                    <input
                        type="email"
                        placeholder="Email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        disabled={saving}
                        style={{ padding: "6px 8px", minWidth: "200px" }}
                    />
                    <select
                        value={inviteLocationId}
                        onChange={(e) => setInviteLocationId(e.target.value)}
                        disabled={saving}
                        style={{ padding: "6px 8px" }}
                    >
                        <option value="">Sede (opzionale)</option>
                        {locations.map((l) => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                    </select>
                    <button onClick={handleInvite} disabled={saving}>
                        Invia invito
                    </button>
                </div>
                {inviteSuccess && (
                    <p style={{ color: "green", margin: "8px 0 0 0", fontSize: "13px" }}>{inviteSuccess}</p>
                )}
            </div>

            <p>Associa utenti alle sedi. Lo stato è gestito dal lifecycle prenotazioni/campagna.</p>

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
                                {u.user_state === "available"
                                    ? "Disponibile"
                                    : u.user_state === "reserved"
                                        ? "Prenotato"
                                        : "Inattivo"}
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
