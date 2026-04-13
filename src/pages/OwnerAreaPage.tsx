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

const OwnerAreaPage: React.FC = () => {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

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
      navigate(`/companies/${created.id}/perimeters`);
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

      <div className="db-card" style={{ padding: "18px 20px", marginBottom: "18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "20px", color: "var(--text-primary)" }}>Owner Area</h1>
            <p style={{ margin: "6px 0 0", fontSize: "13px", color: "var(--text-secondary)" }}>
              Livello piattaforma: gestione companies e bootstrap Super Admin.
            </p>
          </div>
          <button className="db-btn db-btn-outline" onClick={loadCompanies} disabled={loading || creating}>
            Aggiorna
          </button>
        </div>
      </div>

      <div className="db-card" style={{ padding: "18px 20px", marginBottom: "18px" }}>
        <h2 style={{ margin: 0, fontSize: "15px", color: "var(--text-primary)" }}>Create profile</h2>
        <p style={{ margin: "6px 0 14px", fontSize: "12px", color: "var(--text-secondary)" }}>
          Crea company e primo Super Admin in un unico flusso.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
          <input
            className="db-filter-select"
            style={{ height: "36px" }}
            placeholder="Company name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            disabled={creating}
          />
          <input
            className="db-filter-select"
            style={{ height: "36px" }}
            placeholder="Nome Super Admin"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            disabled={creating}
          />
          <input
            className="db-filter-select"
            style={{ height: "36px" }}
            placeholder="Cognome Super Admin"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            disabled={creating}
          />
          <input
            className="db-filter-select"
            style={{ height: "36px" }}
            placeholder="Email Super Admin"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={creating}
            type="email"
          />
        </div>

        <div style={{ marginTop: "12px", display: "flex", justifyContent: "flex-end" }}>
          <button className="db-btn db-btn-outline" onClick={handleCreateProfile} disabled={creating}>
            {creating ? "Creazione..." : "Create profile"}
          </button>
        </div>
      </div>

      <div className="db-card">
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ margin: 0, fontSize: "15px", color: "var(--text-primary)" }}>
            Company list ({sortedCompanies.length})
          </h2>
        </div>

        <div className="db-apps-table-wrap">
          <table className="db-apps-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Company</th>
                <th>Status</th>
                <th>Perimeters</th>
                <th>Super Admin</th>
                <th>Azione</th>
              </tr>
            </thead>
            <tbody>
              {sortedCompanies.map((company) => (
                <tr key={company.id}>
                  <td>
                    <div className="db-cell-primary">{company.name}</div>
                    <div className="db-cell-secondary">{company.slug ?? "-"}</div>
                  </td>
                  <td>{company.status ?? "active"}</td>
                  <td>{company.perimeters_count ?? 0}</td>
                  <td>{company.super_admins_count ?? 0}</td>
                  <td>
                    <Link to={`/companies/${company.id}/perimeters`} className="db-btn db-btn-outline" style={{ textDecoration: "none" }}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
              {!loading && sortedCompanies.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ color: "var(--text-secondary)" }}>
                    Nessuna company disponibile.
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

export default OwnerAreaPage;
