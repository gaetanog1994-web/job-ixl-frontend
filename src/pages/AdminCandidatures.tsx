import { Fragment, useEffect, useMemo, useState } from "react";
import { appApi } from "../lib/appApi";
import type { AdminCandidaturesStats } from "../lib/appApi";
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
  target_org_unit_id: string | null;
  target_org_unit_name: string | null;
  target_responsabili: Array<{ id: string; name: string }>;
  target_hr_managers: Array<{ id: string; name: string }>;
};

const AdminCandidatures = () => {
  const [applications, setApplications] = useState<AdminCandidatureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminCandidaturesStats>({
    campaign_id: null,
    campaign_status: "closed",
    reservations_status: "closed",
    reserved_count: 0,
    active_users_count: 0,
    active_users_pct: 0,
    avg_applications_per_reserved: 0,
  });

  /* ---------- search / filter state ---------- */
  const [search, setSearch] = useState("");
  const [filterCandidateRole, setFilterCandidateRole] = useState("");
  const [filterCandidateLocation, setFilterCandidateLocation] = useState("");
  const [filterOccupantRole, setFilterOccupantRole] = useState("");
  const [sortField, setSortField] = useState<string>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

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
          (a.occupant_location_name ?? "").toLowerCase().includes(q) ||
          (a.target_org_unit_name ?? "").toLowerCase().includes(q) ||
          (a.target_responsabili ?? []).map((item) => item.name).join(", ").toLowerCase().includes(q) ||
          (a.target_hr_managers ?? []).map((item) => item.name).join(", ").toLowerCase().includes(q)
      );
    }
    if (filterCandidateRole)
      rows = rows.filter((a) => a.candidate_role_name === filterCandidateRole);
    if (filterCandidateLocation)
      rows = rows.filter((a) => a.candidate_location_name === filterCandidateLocation);
    if (filterOccupantRole)
      rows = rows.filter((a) => a.occupant_role_name === filterOccupantRole);

    rows.sort((a, b) => {
      let va: string | number, vb: string | number;
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
      setLoading(true);
      setLoadError(null);
      try {
        const [rowsRes, statsRes] = await Promise.allSettled([
          appApi.adminGetCandidatures(),
          appApi.adminGetCandidaturesStats(),
        ]);
        if (cancelled) return;

        setApplications(rowsRes.status === "fulfilled" ? (rowsRes.value ?? []) : []);
        setStats(
          statsRes.status === "fulfilled"
            ? statsRes.value
            : {
              campaign_id: null,
              campaign_status: "closed",
              reservations_status: "closed",
              reserved_count: 0,
              active_users_count: 0,
              active_users_pct: 0,
              avg_applications_per_reserved: 0,
            }
        );
      } catch (e: unknown) {
        console.error("[AdminCandidatures] load error:", e instanceof Error ? e.message : e);
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Errore caricamento candidature");
          setApplications([]);
          setStats({
            campaign_id: null,
            campaign_status: "closed",
            reservations_status: "closed",
            reserved_count: 0,
            active_users_count: 0,
            active_users_pct: 0,
            avg_applications_per_reserved: 0,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
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

  const formatPct = (value: number) => {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded.toFixed(0)}` : `${rounded.toFixed(1)}`;
  };

  const liveStateLabel = stats.campaign_status === "open"
    ? (applications.length > 0 ? "LIVE" : "LIVE SENZA DATI")
    : "VUOTA";
  const liveStateStyles =
    stats.campaign_status === "open"
      ? {
        background: applications.length > 0 ? "#ecfdf5" : "#fff7ed",
        color: applications.length > 0 ? "#166534" : "#9a3412",
        border: applications.length > 0 ? "#86efac" : "#fed7aa",
      }
      : { background: "#f3f4f6", color: "#374151", border: "#d1d5db" };

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
          Lista candidature
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-secondary, #64748b)", marginTop: "4px" }}>
          {applications.length} candidature correnti · {filtered.length} visibili con i filtri correnti
        </p>
        <div
          style={{
            marginTop: "8px",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "11px",
            fontWeight: 700,
            borderRadius: "999px",
            padding: "4px 10px",
            background: liveStateStyles.background,
            color: liveStateStyles.color,
            border: `1px solid ${liveStateStyles.border}`,
          }}
        >
          Stato lista: {liveStateLabel}
        </div>
      </div>

      {loading && (
        <div style={{ marginBottom: "16px", fontSize: "12px", color: "#64748b" }}>
          Caricamento candidature in corso…
        </div>
      )}
      {loadError && (
        <div style={{ marginBottom: "16px", border: "1px solid #fca5a5", background: "#fef2f2", color: "#b91c1c", borderRadius: "10px", padding: "10px 12px", fontSize: "12px" }}>
          {loadError}
        </div>
      )}

      {stats.campaign_status !== "open" && (
        <div
          style={{
            marginBottom: "16px",
            border: "1px solid #d1d5db",
            borderRadius: "10px",
            padding: "10px 12px",
            background: "#f8fafc",
            fontSize: "12px",
            color: "#475569",
          }}
        >
          Campagna non aperta: la lista mostra solo candidature correnti e risulta vuota finché la campagna non è in stato aperto.
        </div>
      )}

      <div
        className="db-card"
        style={{
          marginBottom: "20px",
          padding: "16px 18px",
          display: "grid",
          gap: "12px",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        <div style={{ border: "1px solid var(--border)", borderRadius: "10px", padding: "12px 14px", background: "#fff" }}>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600 }}>Prenotati</div>
          <div style={{ marginTop: "4px", fontSize: "24px", lineHeight: 1.1, fontWeight: 700, color: "var(--text-primary)" }}>
            {stats.reserved_count}
          </div>
        </div>

        <div style={{ border: "1px solid var(--border)", borderRadius: "10px", padding: "12px 14px", background: "#fff" }}>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600 }}>Attività utenti</div>
          <div style={{ marginTop: "4px", fontSize: "24px", lineHeight: 1.1, fontWeight: 700, color: "var(--text-primary)" }}>
            {stats.active_users_count} ({formatPct(stats.active_users_pct)}%)
          </div>
        </div>

        <div style={{ border: "1px solid var(--border)", borderRadius: "10px", padding: "12px 14px", background: "#fff" }}>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600 }}>Media candidature</div>
          <div style={{ marginTop: "4px", fontSize: "24px", lineHeight: 1.1, fontWeight: 700, color: "var(--text-primary)" }}>
            {(Math.round(stats.avg_applications_per_reserved * 10) / 10).toFixed(1)}
          </div>
        </div>
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
                <th colSpan={6} style={{
                  textAlign: "left", padding: "10px 14px 6px",
                  fontSize: "10px", fontWeight: 700,
                  color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.08em",
                  borderBottom: "2px solid #bfdbfe",
                  background: "rgba(37,99,235,0.03)",
                  borderRight: "2px solid var(--border)",
                }}>
                  Posizione target
                </th>
                <th colSpan={3} style={{
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
                <th style={thStyle}>Reparto</th>
                <th style={thStyle}>Sede</th>
                <th style={thStyle} className="db-col-desktop-only">Responsabile</th>
                <th style={{ ...thStyle, borderRight: "2px solid var(--border)" }} className="db-col-desktop-only">HR</th>

                <th style={thStyle} onClick={() => handleSort("created_at")}>
                  Data{sortIcon("created_at")}
                </th>
                <th style={thStyle} onClick={() => handleSort("priority")}>
                  Priorità{sortIcon("priority")}
                </th>
                <th style={thStyle}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={12}>
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
                  <Fragment key={a.id}>
                    <tr
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
                    <td style={tdStyle}>{a.target_org_unit_name ?? "—"}</td>
                    <td style={tdStyle}>{a.occupant_location_name ?? "—"}</td>
                    <td style={tdStyle} className="db-col-desktop-only">
                      {(a.target_responsabili ?? []).length > 0
                        ? (a.target_responsabili ?? []).map((item) => item.name).join(", ")
                        : "—"}
                    </td>
                    <td style={{ ...tdStyle, borderRight: "2px solid var(--border)" }} className="db-col-desktop-only">
                      {(a.target_hr_managers ?? []).length > 0
                        ? (a.target_hr_managers ?? []).map((item) => item.name).join(", ")
                        : "—"}
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
                    <td style={tdStyle}>
                      <button
                        className="db-action-btn db-action-btn-map db-mobile-only-inline"
                        onClick={() => setExpandedRowId((prev) => prev === a.id ? null : a.id)}
                      >
                        Esplora
                      </button>
                    </td>
                    </tr>
                    {expandedRowId === a.id && (
                      <tr className="db-mobile-only-row">
                      <td colSpan={12} style={{ padding: "10px 14px", background: "#f8fafc", borderBottom: "1px solid var(--border)" }}>
                        <div style={{ fontSize: "12px", color: "var(--text-secondary)", display: "grid", gap: "6px" }}>
                          <div><strong>Responsabile:</strong> {(a.target_responsabili ?? []).length > 0 ? (a.target_responsabili ?? []).map((item) => item.name).join(", ") : "—"}</div>
                          <div><strong>HR:</strong> {(a.target_hr_managers ?? []).length > 0 ? (a.target_hr_managers ?? []).map((item) => item.name).join(", ") : "—"}</div>
                        </div>
                      </td>
                    </tr>
                    )}
                  </Fragment>
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
