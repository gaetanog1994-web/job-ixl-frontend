import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { appApi } from "../lib/appApi";
import TenantContextStrip from "../components/TenantContextStrip";
import "../styles/dashboard.css";

type PerimeterRow = {
  id: string;
  company_id: string;
  name: string;
  slug?: string;
  status?: string;
  members_count?: number;
  admins_count?: number;
};

type SuperAdminRow = {
  id: string;
  full_name?: string;
  email?: string;
  role?: string;
};

type CompanyDetailsRow = {
  id?: string;
  company_id?: string;
  name?: string;
  company_name?: string;
  slug?: string;
  status?: string;
  perimeters_count?: number;
  super_admins_count?: number;
  super_admins?: SuperAdminRow[];
};

const CompanyPerimetersPage: React.FC = () => {
  const navigate = useNavigate();
  const { companyId } = useParams<{ companyId: string }>();

  const [perimeters, setPerimeters] = useState<PerimeterRow[]>([]);
  const [companyName, setCompanyName] = useState<string>("Company");
  const [companyDetails, setCompanyDetails] = useState<CompanyDetailsRow | null>(null);
  const [newPerimeterName, setNewPerimeterName] = useState("");
  const [meData, setMeData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [superAdminHint, setSuperAdminHint] = useState<string | null>(null);

  const sortedPerimeters = useMemo(
    () => [...perimeters].sort((a, b) => a.name.localeCompare(b.name)),
    [perimeters]
  );

  const loadPage = async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      appApi.setTenantContext({ companyId, perimeterId: null });
      const [perimetersRows, companiesRows] = await Promise.all([
        appApi.platformGetPerimeters(companyId),
        appApi.platformGetCompanies(),
      ]);
      const me = await appApi.getMe();
      setPerimeters(perimetersRows ?? []);
      setMeData(me ?? null);
      const currentCompany = (companiesRows ?? []).find(
        (row: any) => row.id === companyId || row.company_id === companyId
      );
      setCompanyDetails(currentCompany ?? null);
      setCompanyName(currentCompany?.name ?? currentCompany?.company_name ?? "Company");
    } catch (e: any) {
      setError(e?.message ?? "Errore caricamento perimeters");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPage();
  }, [companyId]);

  const handleCreatePerimeter = async () => {
    if (!companyId) return;
    const name = newPerimeterName.trim();
    if (!name) {
      setError("Inserisci il nome del perimeter.");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      await appApi.platformCreatePerimeter(companyId, { name });
      setNewPerimeterName("");
      await loadPage();
    } catch (e: any) {
      setError(e?.message ?? "Errore creazione perimeter");
    } finally {
      setCreating(false);
    }
  };

  const handleEnterPerimeter = (perimeter: PerimeterRow) => {
    appApi.setTenantContext({ companyId: perimeter.company_id, perimeterId: perimeter.id });
    navigate(meData?.isSuperAdmin ? "/admin/interlocking" : "/dashboard");
  };

  const superAdmins = Array.isArray(companyDetails?.super_admins) ? companyDetails?.super_admins ?? [] : [];
  const superAdminsCount = companyDetails?.super_admins_count ?? superAdmins.length ?? 0;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--surface, #f1f5f9)",
        fontFamily: "var(--font, 'Inter', sans-serif)",
        padding: "24px",
      }}
    >
      <TenantContextStrip sectionLabel="Company / Perimeters" />

      <div className="db-card owner-company-detail-header" style={{ marginBottom: "18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", marginBottom: "8px" }}>
              <Link to="/owner" className="owner-back-link">
                ← Back to Companies
              </Link>
              <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                Platform &gt; Companies &gt; {companyName}
              </span>
            </div>
            <h1 style={{ margin: "6px 0 0", fontSize: "28px", color: "var(--text-primary)" }}>
              {companyName}
            </h1>
            <p style={{ margin: "6px 0 0", fontSize: "13px", color: "var(--text-secondary)" }}>
              Company detail: governa super admin e perimeters mantenendo il contesto tenant coerente.
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              className="db-btn owner-primary-btn"
              onClick={() => {
                setSuperAdminHint("Usa il flusso Owner per associare un nuovo Super Admin alla company.");
              }}
            >
              + New Super Admin
            </button>
            <button className="db-btn db-btn-outline" onClick={loadPage} disabled={loading || creating}>
              Refresh
            </button>
          </div>
        </div>

        <div className="owner-company-detail-metrics">
          <span className="owner-chip">Perimeters: {companyDetails?.perimeters_count ?? sortedPerimeters.length}</span>
          <span className="owner-chip">Super Admins: {superAdminsCount}</span>
          <span className="owner-chip">Status: {companyDetails?.status ?? "active"}</span>
        </div>
      </div>

      <div className="db-card owner-super-admin-panel" style={{ marginBottom: "18px" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ margin: 0, fontSize: "15px", color: "var(--text-primary)" }}>Super Admins</h2>
          <p style={{ margin: "6px 0 0", fontSize: "12px", color: "var(--text-secondary)" }}>
            Gestione accessi company-level.
          </p>
        </div>

        {superAdminHint && (
          <div className="owner-inline-note" style={{ margin: "12px 20px 0" }}>
            {superAdminHint}
          </div>
        )}

        <div className="owner-super-admin-list">
          {superAdmins.length > 0 ? (
            superAdmins.map((superAdmin) => (
              <div key={superAdmin.id} className="owner-super-admin-card">
                <div className="owner-super-admin-main">
                  <div className="owner-super-admin-name">{superAdmin.full_name ?? "Super Admin"}</div>
                  <div className="owner-super-admin-email">{superAdmin.email ?? "email non disponibile"}</div>
                </div>
                <div className="owner-super-admin-side">
                  <span className="owner-chip">{superAdmin.role ?? "super_admin"}</span>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button className="db-btn db-btn-outline" disabled>
                      Edit
                    </button>
                    <button className="db-btn db-btn-outline" disabled>
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="db-empty-state">
              <div className="db-empty-state-title">Nessun Super Admin assegnato</div>
              <div className="db-empty-state-desc">
                Definisci almeno un Super Admin per completare il setup company-level.
              </div>
              <button
                className="db-btn owner-primary-btn"
                onClick={() => setSuperAdminHint("Apri il flusso Owner e aggiungi il prossimo Super Admin per questa company.")}
                style={{ marginTop: "12px" }}
              >
                Add first Super Admin
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="db-card" style={{ padding: "18px 20px", marginBottom: "18px" }}>
        <h2 style={{ margin: 0, fontSize: "15px", color: "var(--text-primary)" }}>Create perimeter / area</h2>
        <p style={{ margin: "6px 0 14px", fontSize: "12px", color: "var(--text-secondary)" }}>
          Esempi: Italy, Spain, Colombia, Enterprise, Service, Grids.
        </p>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <input
            className="db-filter-select"
            style={{ minWidth: "220px", maxWidth: "380px", height: "36px" }}
            value={newPerimeterName}
            onChange={(e) => setNewPerimeterName(e.target.value)}
            placeholder="Perimeter name"
            disabled={creating}
          />
          <button className="db-btn owner-primary-btn" onClick={handleCreatePerimeter} disabled={creating}>
            {creating ? "Creating..." : "Create area"}
          </button>
        </div>
      </div>

      <div className="db-card">
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ margin: 0, fontSize: "15px", color: "var(--text-primary)" }}>
            Perimeter list ({sortedPerimeters.length})
          </h2>
        </div>

        <div className="owner-company-grid" style={{ padding: "16px" }}>
          {sortedPerimeters.map((perimeter) => (
            <div key={perimeter.id} className="owner-company-card">
              <div className="owner-company-card-head">
                <div>
                  <div className="owner-company-name">{perimeter.name}</div>
                  <div className="owner-company-slug">{perimeter.slug ?? "slug n/a"}</div>
                </div>
                <span className="owner-chip">{perimeter.status ?? "active"}</span>
              </div>
              <div className="owner-company-meta">
                <span>Members: {perimeter.members_count ?? 0}</span>
                <span>Admins: {perimeter.admins_count ?? 0}</span>
              </div>
              <div className="owner-company-actions">
                <button className="db-btn owner-primary-btn" onClick={() => handleEnterPerimeter(perimeter)}>
                  Enter
                </button>
              </div>
            </div>
          ))}
          {!loading && sortedPerimeters.length === 0 && (
            <div className="db-empty-state" style={{ gridColumn: "1 / -1" }}>
              <div className="db-empty-state-title">Nessun perimeter disponibile</div>
              <div className="db-empty-state-desc">
                Crea il primo perimeter per abilitare il lavoro operativo.
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

export default CompanyPerimetersPage;
