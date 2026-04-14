import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { appApi } from "../lib/appApi";
import TenantContextStrip from "../components/TenantContextStrip";
import "../styles/dashboard.css";

type CompanyRow = {
  id: string;
  name: string;
  slug?: string;
  status?: string;
  created_at?: string;
  perimeters_count?: number;
  super_admins_count?: number;
};

const formatDate = (value?: string) => {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "n/a";
  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
};

const emitTenantStructureChanged = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("tenant-structure-changed"));
  }
};

const OwnerAreaPage: React.FC = () => {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [createdCompanyFlow, setCreatedCompanyFlow] = useState<{ id: string; name: string } | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  const [error, setError] = useState<string | null>(null);

  const sortedCompanies = useMemo(
    () => [...companies].sort((a, b) => a.name.localeCompare(b.name)),
    [companies]
  );

  const loadCompanies = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await appApi.platformGetCompanies();
      setCompanies(rows ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Errore caricamento company");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  const handleCreateProfile = async () => {
    const name = companyName.trim();
    const fn = firstName.trim();
    const ln = lastName.trim();
    const em = email.trim().toLowerCase();

    if (!name || !fn || !ln || !em) {
      setError("Compila tutti i campi per creare il profilo company.");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const created = await appApi.platformCreateCompany({
        name,
        first_super_admin: {
          first_name: fn,
          last_name: ln,
          email: em,
        },
      });

      appApi.setTenantContext({ companyId: created.id, perimeterId: null });
      await loadCompanies();
      emitTenantStructureChanged();
      setCreatedCompanyFlow({ id: created.id, name: created.name ?? name });
      setShowCreatePanel(false);
      setCompanyName("");
      setFirstName("");
      setLastName("");
      setEmail("");
    } catch (e: any) {
      setError(e?.message ?? "Errore creazione company");
    } finally {
      setCreating(false);
    }
  };

  const handleRenameCompany = async (company: CompanyRow) => {
    const nextNameRaw = window.prompt("Nuovo nome company", company.name);
    if (nextNameRaw === null) return;
    const nextName = nextNameRaw.trim();
    if (!nextName || nextName === company.name) return;

    try {
      setError(null);
      await appApi.platformRenameCompany(company.id, { name: nextName });
      await loadCompanies();
      emitTenantStructureChanged();
    } catch (e: any) {
      setError(e?.message ?? "Errore rinomina company");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--surface, #f1f5f9)",
        fontFamily: "var(--font, 'Inter', sans-serif)",
        padding: "24px",
      }}
    >
      <TenantContextStrip sectionLabel="Owner area" />

      <div className="db-card owner-console-header" style={{ marginBottom: "18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "24px", color: "var(--text-primary)" }}>Platform / Companies</h1>
            <p style={{ margin: "6px 0 0", fontSize: "13px", color: "var(--text-secondary)", maxWidth: "700px" }}>
              Console owner per governare onboarding company, contesto multi-tenant e passaggio operativo verso i Super Admin.
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <button
              className="db-btn owner-primary-btn"
              onClick={() => setShowCreatePanel((prev) => !prev)}
              disabled={creating}
            >
              + New Company
            </button>
            <button className="db-btn db-btn-outline" onClick={loadCompanies} disabled={loading || creating}>
              Refresh
            </button>
          </div>
        </div>
      </div>

      {createdCompanyFlow && (
        <div className="db-card owner-flow-card" style={{ marginBottom: "18px" }}>
          <div className="owner-flow-step done">Step 1: Company created ✅</div>
          <div className="owner-flow-step">
            Step 2: Add Super Admin
            <button
              className="db-btn owner-primary-btn"
              onClick={() => navigate(`/companies/${createdCompanyFlow.id}/perimeters`)}
            >
              Open company detail
            </button>
          </div>
        </div>
      )}

      {showCreatePanel && (
        <div className="db-card owner-create-panel" style={{ marginBottom: "18px" }}>
          <h2 style={{ margin: 0, fontSize: "15px", color: "var(--text-primary)" }}>New company profile</h2>
          <p style={{ margin: "6px 0 14px", fontSize: "12px", color: "var(--text-secondary)" }}>
            Crea company e primo Super Admin in un unico flusso guidato.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
            <input
              className="db-filter-select"
              style={{ height: "38px" }}
              placeholder="Company name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={creating}
            />
            <input
              className="db-filter-select"
              style={{ height: "38px" }}
              placeholder="Nome Super Admin"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={creating}
            />
            <input
              className="db-filter-select"
              style={{ height: "38px" }}
              placeholder="Cognome Super Admin"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={creating}
            />
            <input
              className="db-filter-select"
              style={{ height: "38px" }}
              placeholder="Email Super Admin"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={creating}
              type="email"
            />
          </div>

          <div style={{ marginTop: "12px", display: "flex", justifyContent: "flex-end" }}>
            <button className="db-btn owner-primary-btn" onClick={handleCreateProfile} disabled={creating}>
              {creating ? "Creating..." : "Create Company"}
            </button>
          </div>
        </div>
      )}

      <div className="db-card owner-companies-panel">
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ margin: 0, fontSize: "15px", color: "var(--text-primary)", display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
            <span>Companies ({sortedCompanies.length})</span>
            <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500 }}>
              Click on a card to enter company detail
            </span>
          </h2>
        </div>

        <div className="owner-company-grid">
          {sortedCompanies.map((company) => (
            <div
              key={company.id}
              className="owner-company-card"
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/companies/${company.id}/perimeters`)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  navigate(`/companies/${company.id}/perimeters`);
                }
              }}
            >
              <div className="owner-company-card-head">
                <div>
                  <div className="owner-company-name">{company.name}</div>
                  <div className="owner-company-slug">{company.slug ?? "slug n/a"}</div>
                </div>
                <span className="owner-chip">{company.status ?? "active"}</span>
              </div>

              <div className="owner-company-meta">
                <span>Perimeters: {company.perimeters_count ?? 0}</span>
                <span>Super Admins: {company.super_admins_count ?? 0}</span>
                <span>Created: {formatDate(company.created_at)}</span>
              </div>

              <div className="owner-company-actions" onClick={(event) => event.stopPropagation()}>
                <Link
                  to={`/companies/${company.id}/perimeters`}
                  className="db-btn owner-primary-btn"
                  style={{ textDecoration: "none" }}
                >
                  Enter
                </Link>
                <button className="db-btn db-btn-outline" onClick={() => handleRenameCompany(company)}>
                  Edit
                </button>
                <button className="db-btn db-btn-outline" disabled>
                  Delete
                </button>
              </div>
            </div>
          ))}

          {!loading && sortedCompanies.length === 0 && (
            <div className="db-empty-state" style={{ gridColumn: "1 / -1" }}>
              <div className="db-empty-state-title">Nessuna company disponibile</div>
              <div className="db-empty-state-desc">
                Crea una nuova company per attivare il primo flusso operativo owner.
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div style={{ marginTop: "14px", color: "#b91c1c", fontSize: "13px" }}>
          {error}
        </div>
      )}
    </div>
  );
};

export default OwnerAreaPage;
