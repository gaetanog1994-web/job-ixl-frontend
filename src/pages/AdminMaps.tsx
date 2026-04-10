import { useEffect, useState } from "react";
import PositionsMap from "../components/PositionsMap";
import { appApi } from "../lib/appApi";
import "../styles/dashboard.css";

type ActiveUser = {
  id: string;
  full_name: string;
};

const AdminMaps = () => {
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [mode, setMode] = useState<"from" | "to">("from");
  const [search, setSearch] = useState("");

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
    return () => { cancelled = true; };
  }, []);

  const filteredUsers = activeUsers.filter(u => 
    u.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--surface, #f1f5f9)",
      fontFamily: "var(--font, 'Inter', sans-serif)",
      padding: "24px",
    }}>

      {/* Page title */}
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{
          fontSize: "22px", fontWeight: 700,
          color: "var(--text-primary, #0f172a)",
          margin: 0,
        }}>
          Mappe Utenti
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
          Esplora la mappa interattiva per ciascun utente attivo, simulando il suo punto di vista.
        </p>
      </div>

      <div style={{ display: "flex", gap: "24px", alignItems: "flex-start", flexWrap: "wrap" }}>
        
        {/* ---- LEFT COLUMN: Controls ---- */}
        <div style={{ width: "100%", maxWidth: "300px", display: "flex", flexDirection: "column", gap: "16px" }}>
          
          <div className="db-card" style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "12px" }}>
              Modalità di visualizzazione
            </div>
            <select
              className="db-filter-select"
              value={mode}
              onChange={(e) => setMode(e.target.value as "from" | "to")}
              style={{ width: "100%" }}
            >
              <option value="from">DA (candidature fatte da)</option>
              <option value="to">VERSO (candidature ricevute da)</option>
            </select>
          </div>

          <div className="db-card" style={{ display: "flex", flexDirection: "column", maxHeight: "600px" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "12px" }}>
                Utenti Attivi ({activeUsers.length})
              </div>
              <div style={{
                display: "flex", alignItems: "center", gap: "8px",
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: "8px", padding: "0 10px", height: "32px",
              }}>
                <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>🔍</span>
                <input
                  type="text"
                  placeholder="Cerca utente…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    border: "none", background: "transparent", outline: "none",
                    fontSize: "12px", fontFamily: "var(--font)", color: "var(--text-primary)", flex: 1,
                  }}
                />
              </div>
            </div>

            <div style={{ overflowY: "auto", flex: 1, padding: "8px 0" }}>
              {filteredUsers.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                  Nessun utente trovato.
                </div>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {filteredUsers.map((u) => {
                    const isSelected = selectedUserId === u.id;
                    return (
                      <li
                        key={u.id}
                        onClick={() => setSelectedUserId(u.id)}
                        style={{
                          padding: "10px 20px",
                          cursor: "pointer",
                          fontSize: "13px",
                          fontWeight: isSelected ? 600 : 400,
                          color: isSelected ? "var(--brand)" : "var(--text-primary)",
                          background: isSelected ? "var(--brand-light)" : "transparent",
                          borderLeft: isSelected ? "3px solid var(--brand)" : "3px solid transparent",
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.background = "#fafafa";
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.background = "transparent";
                        }}
                      >
                        {u.full_name}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* ---- RIGHT COLUMN: Map ---- */}
        <div style={{ flex: 1, minWidth: "400px" }}>
          <div className="db-card" style={{ height: "680px", display: "flex", flexDirection: "column" }}>
            <div style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                Vista Mappa
              </div>
              <div className="db-map-legend" style={{ margin: 0 }}>
                <div className="db-map-legend-item">
                  <div className="db-map-legend-dot" style={{ background: "#22c55e" }} /> Disponibile
                </div>
                <div className="db-map-legend-item">
                  <div className="db-map-legend-dot" style={{ background: "#ef4444" }} /> Candidato
                </div>
                <div className="db-map-legend-item">
                  <div className="db-map-legend-dot" style={{ background: "#6b7280" }} /> Inattivo
                </div>
              </div>
            </div>

            <div style={{ flex: 1, position: "relative" }}>
              {selectedUserId ? (
                <PositionsMap
                  viewerUserId={selectedUserId}
                  mode={mode}
                  interaction="read"
                  visualMode="adminActiveMaps"
                />
              ) : (
                <div style={{
                  position: "absolute", inset: 0,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", background: "#f8fafc",
                  color: "var(--text-muted)", fontSize: "14px", gap: "12px",
                }}>
                  <span style={{ fontSize: "32px", opacity: 0.5 }}>🗺️</span>
                  Seleziona un utente dalla lista per visualizzare la sua mappa
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminMaps;
