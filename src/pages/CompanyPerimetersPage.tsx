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

const CompanyPerimetersPage: React.FC = () => {
  const navigate = useNavigate();
  const { companyId } = useParams<{ companyId: string }>();

  const [perimeters, setPerimeters] = useState<PerimeterRow[]>([]);
  const [companyName, setCompanyName] = useState<string>("Company");
  const [newPerimeterName, setNewPerimeterName] = useState("");
  const [meData, setMeData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      <div className="db-card" style={{ padding: "18px 20px", marginBottom: "18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              <Link to="/owner" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>
                Owner
              </Link>
              <span> / {companyName}</span>
            </div>
            <h1 style={{ margin: "6px 0 0", fontSize: "20px", color: "var(--text-primary)" }}>
              Perimeter Management
            </h1>
            <p style={{ margin: "6px 0 0", fontSize: "13px", color: "var(--text-secondary)" }}>
              Livello company: crea aree operative e accedi all'interfaccia JIP per perimeter.
            </p>
          </div>
          <button className="db-btn db-btn-outline" onClick={loadPage} disabled={loading || creating}>
            Aggiorna
          </button>
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
          <button className="db-btn db-btn-outline" onClick={handleCreatePerimeter} disabled={creating}>
            {creating ? "Creazione..." : "Create area"}
          </button>
        </div>
      </div>

      <div className="db-card">
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ margin: 0, fontSize: "15px", color: "var(--text-primary)" }}>
            Perimeter list ({sortedPerimeters.length})
          </h2>
        </div>

        <div className="db-apps-table-wrap">
          <table className="db-apps-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Perimeter</th>
                <th>Status</th>
                <th>Members</th>
                <th>Admins</th>
                <th>Ingresso</th>
              </tr>
            </thead>
            <tbody>
              {sortedPerimeters.map((perimeter) => (
                <tr key={perimeter.id}>
                  <td>
                    <div className="db-cell-primary">{perimeter.name}</div>
                    <div className="db-cell-secondary">{perimeter.slug ?? "-"}</div>
                  </td>
                  <td>{perimeter.status ?? "active"}</td>
                  <td>{perimeter.members_count ?? 0}</td>
                  <td>{perimeter.admins_count ?? 0}</td>
                  <td>
                    <button className="db-btn db-btn-outline" onClick={() => handleEnterPerimeter(perimeter)}>
                      Enter perimeter
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && sortedPerimeters.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ color: "var(--text-secondary)" }}>
                    Nessun perimeter disponibile per questa company.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
