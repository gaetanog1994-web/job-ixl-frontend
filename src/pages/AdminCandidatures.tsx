import { useEffect, useMemo, useState } from "react";
import { appApi } from "../lib/appApi";
import "../styles/dashboard.css";

type AdminCandidatureRow = {
  id: string;
  priority: number | null;
  created_at: string;
  candidate_full_name: string | null;
  candidate_role_name: string | null;
  candidate_location_name: string | null;
  occupant_full_name: string | null;
  occupant_role_name: string | null;
  occupant_location_name: string | null;
};

const AdminCandidatures = () => {
  const [applications, setApplications] = useState<AdminCandidatureRow[]>([]);

  /* ---------- search / filter state ---------- */
  const [search, setSearch] = useState("");
  const [filterCandidateRole, setFilterCandidateRole] = useState("");
  const [filterCandidateLocation, setFilterCandidateLocation] = useState("");
  const [filterOccupantRole, setFilterOccupantRole] = useState("");
  const [sortField, setSortField] = useState<string>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  /* ---------- derived filter options ---------- */
  const candidateRoles = useMemo(
    () => Array.from(new Set(applications.map((a) => a.candidate_role_name).filter(Boolean) as string[])).sort(),
    [applications]
  );
  const candidateLocations = useMemo(
    () => Array.from(new Set(applications.map((a) => a.candidate_location_name).filter(Boolean) as string[])).sort(),
    [applications]
  );
  const occupantRoles = useMemo(
    () => Array.from(new Set(applications.map((a) => a.occupant_role_name).filter(Boolean) as string[])).sort(),
    [applications]
  );

  /* ---------- filtered + sorted rows ---------- */
  const filtered = useMemo(() => {
    let rows = [...applications];

    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (a) =>
          (a.candidate_full_name ?? "").toLowerCase().includes(q) ||
          (a.candidate_role_name ?? "").toLowerCase().includes(q) ||
          (a.candidate_location_name ?? "").toLowerCase().includes(q) ||
          (a.occupant_full_name ?? "").toLowerCase().includes(q) ||
          (a.occupant_role_name ?? "").toLowerCase().includes(q) ||
          (a.occupant_location_name ?? "").toLowerCase().includes(q)
      );
    }
    if (filterCandidateRole)
      rows = rows.filter((a) => a.candidate_role_name === filterCandidateRole);
    if (filterCandidateLocation)
      rows = rows.filter((a) => a.candidate_location_name === filterCandidateLocation);
    if (filterOccupantRole)
      rows = rows.filter((a) => a.occupant_role_name === filterOccupantRole);

    rows.sort((a, b) => {
      let va: any, vb: any;
      if (sortField === "created_at") {
        va = new Date(a.created_at ?? 0).getTime();
        vb = new Date(b.created_at ?? 0).getTime();
      } else if (sortField === "priority") {
        va = a.priority ?? 9999;
        vb = b.priority ?? 9999;
      } else if (sortField === "candidate") {
        va = a.candidate_full_name ?? "";
        vb = b.candidate_full_name ?? "";
      } else {
        va = 0; vb = 0;
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return rows;
  }, [applications, search, filterCandidateRole, filterCandidateLocation, filterOccupantRole, sortField, sortDir]);

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const sortIcon = (field: string) =>
    sortField === field ? (sortDir === "asc" ? " ↑" : " ↓") : " ⇅";

  const resetFilters = () => {
    setSearch("");
    setFilterCandidateRole("");
    setFilterCandidateLocation("");
    setFilterOccupantRole("");
  };

  const hasFilters = search || filterCandidateRole || filterCandidateLocation || filterOccupantRole;

  /* ---------- load data ---------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await appApi.adminGetCandidatures();
        if (!cancelled) setApplications(rows ?? []);
      } catch (e: any) {
        console.error("[AdminCandidatures] load error:", e?.message ?? e);
        if (!cancelled) setApplications([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const formatDate = (iso?: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("it-IT", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  /* ---------- render ---------- */
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
          Tabella Candidature
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-secondary, #64748b)", marginTop: "4px" }}>
          {applications.length} candidature totali · {filtered.length} visibili con i filtri correnti
        </p>
      </div>



      {/* ---- Main table card ---- */}
      <div className="db-card">

        {/* Table header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px 0", gap: "12px", flexWrap: "wrap",
        }}>
          <div>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
              Candidature
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
              {filtered.length} di {applications.length} risultati
            </div>
          </div>
          {hasFilters && (
            <button className="db-btn db-btn-outline" onClick={resetFilters} id="btn-reset-candidatures-filters">
              ↺ Azzera filtri
            </button>
          )}
        </div>

        {/* ---- Filter bar ---- */}
        <div style={{
          display: "flex", gap: "10px", flexWrap: "wrap",
          padding: "14px 16px",
          borderBottom: "1px solid var(--border)",
          alignItems: "center",
        }}>
          {/* Global search */}
          <div style={{
            display: "flex", alignItems: "center", gap: "8px",
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "10px", padding: "0 12px", height: "36px", flex: "1", minWidth: "200px",
          }}>
            <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>🔍</span>
            <input
              id="candidatures-search"
              type="text"
              placeholder="Cerca candidato, ruolo, sede…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                border: "none", background: "transparent", outline: "none",
                fontSize: "13px", fontFamily: "var(--font)", color: "var(--text-primary)", flex: 1,
              }}
            />
            {search && (
              <button onClick={() => setSearch("")} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--text-muted)", fontSize: "13px", padding: 0 }}>✕</button>
            )}
          </div>

          {/* Ruolo candidato */}
          <select
            id="filter-candidate-role"
            className="db-filter-select"
            style={{ minWidth: "150px", height: "36px" }}
            value={filterCandidateRole}
            onChange={(e) => setFilterCandidateRole(e.target.value)}
          >
            <option value="">Ruolo candidato</option>
            {candidateRoles.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>

          {/* Sede candidato */}
          <select
            id="filter-candidate-location"
            className="db-filter-select"
            style={{ minWidth: "150px", height: "36px" }}
            value={filterCandidateLocation}
            onChange={(e) => setFilterCandidateLocation(e.target.value)}
          >
            <option value="">Sede candidato</option>
            {candidateLocations.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>

          {/* Ruolo target */}
          <select
            id="filter-occupant-role"
            className="db-filter-select"
            style={{ minWidth: "150px", height: "36px" }}
            value={filterOccupantRole}
            onChange={(e) => setFilterOccupantRole(e.target.value)}
          >
            <option value="">Ruolo target</option>
            {occupantRoles.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* ---- Table ---- */}
        <div style={{ overflowX: "auto", padding: "0 4px 16px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr>
                {/* Group headers */}
                <th colSpan={3} style={{
                  textAlign: "left", padding: "10px 14px 6px",
                  fontSize: "10px", fontWeight: 700,
                  color: "var(--brand)", textTransform: "uppercase", letterSpacing: "0.08em",
                  borderBottom: "2px solid var(--brand-light)",
                  background: "rgba(232,81,26,0.03)",
                  borderRight: "2px solid var(--border)",
                }}>
                  Candidato
                </th>
                <th colSpan={3} style={{
                  textAlign: "left", padding: "10px 14px 6px",
                  fontSize: "10px", fontWeight: 700,
                  color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.08em",
                  borderBottom: "2px solid #bfdbfe",
                  background: "rgba(37,99,235,0.03)",
                  borderRight: "2px solid var(--border)",
                }}>
                  Posizione target
                </th>
                <th colSpan={2} style={{
                  textAlign: "left", padding: "10px 14px 6px",
                  fontSize: "10px", fontWeight: 700,
                  color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em",
                  borderBottom: "2px solid var(--border)",
                  background: "#fafafa",
                }}>
                  Candidatura
                </th>
              </tr>
              <tr style={{ background: "#fafafa" }}>
                <th style={thStyle} onClick={() => handleSort("candidate")}>
                  Nome{sortIcon("candidate")}
                </th>
                <th style={thStyle}>Ruolo</th>
                <th style={{ ...thStyle, borderRight: "2px solid var(--border)" }}>Sede</th>

                <th style={thStyle}>Occupato da</th>
                <th style={thStyle}>Ruolo</th>
                <th style={{ ...thStyle, borderRight: "2px solid var(--border)" }}>Sede</th>

                <th style={thStyle} onClick={() => handleSort("created_at")}>
                  Data{sortIcon("created_at")}
                </th>
                <th style={thStyle} onClick={() => handleSort("priority")}>
                  Priorità{sortIcon("priority")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="db-empty-state">
                      <div className="db-empty-state-icon">🔍</div>
                      <div className="db-empty-state-title">Nessun risultato</div>
                      <div className="db-empty-state-desc">
                        {applications.length === 0
                          ? "Nessuna candidatura presente."
                          : "Modifica i filtri per vedere più risultati."}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((a, i) => (
                  <tr
                    key={a.id}
                    style={{ background: i % 2 === 0 ? "#fff" : "#fafafa", transition: "background 0.1s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f9ff")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#fafafa")}
                  >
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                        {a.candidate_full_name ?? "—"}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        display: "inline-flex", padding: "3px 8px",
                        borderRadius: "6px", background: "var(--brand-light)",
                        color: "var(--brand)", fontSize: "11px", fontWeight: 600,
                      }}>
                        {a.candidate_role_name ?? "—"}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, borderRight: "2px solid var(--border)" }}>
                      {a.candidate_location_name ?? "—"}
                    </td>

                    <td style={tdStyle}>{a.occupant_full_name ?? "—"}</td>
                    <td style={tdStyle}>
                      <span style={{
                        display: "inline-flex", padding: "3px 8px",
                        borderRadius: "6px", background: "#eff6ff",
                        color: "#2563eb", fontSize: "11px", fontWeight: 600,
                      }}>
                        {a.occupant_role_name ?? "—"}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, borderRight: "2px solid var(--border)" }}>
                      {a.occupant_location_name ?? "—"}
                    </td>

                    <td style={{ ...tdStyle, color: "var(--text-secondary)", fontSize: "12px" }}>
                      {formatDate(a.created_at)}
                    </td>
                    <td style={tdStyle}>
                      {a.priority != null ? (
                        <span style={{
                          display: "inline-flex", width: 26, height: 26,
                          borderRadius: "7px", alignItems: "center", justifyContent: "center",
                          background: "var(--brand-light)", color: "var(--brand)",
                          fontSize: "12px", fontWeight: 700,
                        }}>
                          {a.priority}
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>


    </div>
  );
};

/* ---- shared cell styles ---- */
const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 14px",
  fontSize: "10.5px",
  fontWeight: 700,
  color: "var(--text-secondary)",
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap",
  cursor: "pointer",
  userSelect: "none",
};

const tdStyle: React.CSSProperties = {
  padding: "11px 14px",
  borderBottom: "1px solid var(--border)",
  verticalAlign: "middle",
  whiteSpace: "nowrap",
  color: "var(--text-primary)",
};

export default AdminCandidatures;
