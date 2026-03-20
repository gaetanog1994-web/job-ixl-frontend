import { useEffect, useState } from "react";
import PositionsMap from "../components/PositionsMap";
import { appApi } from "../lib/appApi";

type ActiveUser = {
    id: string;
    full_name: string;
};

const AdminMaps = () => {
    const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [mode, setMode] = useState<"from" | "to">("from");

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const users = await appApi.adminGetActiveUsers();
                if (!cancelled) setActiveUsers(users ?? []);
            } catch (e: any) {
                console.error("[AdminMaps] load error:", e?.message ?? e);
                if (!cancelled) setActiveUsers([]);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div style={{ padding: "30px" }}>
            <h3 style={{ marginTop: "20px" }}>B. Mappe utenti attivi</h3>

            <div style={{ display: "flex", gap: "20px", marginTop: "20px" }}>
                {/* SIDEBAR */}
                <div style={{ width: "260px" }}>
                    {/* SELETTORE DA / VERSO */}
                    <div style={{ marginBottom: "12px" }}>
                        <label style={{ fontSize: "13px", opacity: 0.8 }}>Modalità</label>
                        <select
                            value={mode}
                            onChange={(e) => setMode(e.target.value as "from" | "to")}
                            style={{ width: "100%", marginTop: "4px" }}
                        >
                            <option value="from">DA (candidature fatte da)</option>
                            <option value="to">VERSO (candidature ricevute da)</option>
                        </select>
                    </div>

                    {/* LISTA UTENTI */}
                    <ul
                        style={{
                            listStyle: "none",
                            padding: 0,
                            margin: 0,
                            maxHeight: "520px",
                            overflowY: "auto",
                        }}
                    >
                        {activeUsers.map((u) => (
                            <li
                                key={u.id}
                                style={{
                                    cursor: "pointer",
                                    fontWeight: selectedUserId === u.id ? "bold" : "normal",
                                    marginBottom: "6px",
                                }}
                                onClick={() => setSelectedUserId(u.id)}
                            >
                                {u.full_name}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* MAPPA */}
                <div
                    style={{
                        flex: 1,
                        height: "600px",
                        border: "1px solid #333",
                        borderRadius: "8px",
                        overflow: "hidden",
                    }}
                >
                    {selectedUserId ? (
                        <PositionsMap viewerUserId={selectedUserId} mode={mode} interaction="read" />
                    ) : (
                        <div
                            style={{
                                height: "100%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                opacity: 0.6,
                            }}
                        >
                            Seleziona un utente
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminMaps;
