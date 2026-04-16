import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { appApi } from "../lib/appApi";
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

type PerimeterAdminRow = {
  id: string;
  full_name?: string;
  email?: string;
  access_role?: string;
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

const emitTenantStructureChanged = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("tenant-structure-changed"));
  }
};

const CompanyPerimetersPage: React.FC = () => {
  const { companyId } = useParams<{ companyId: string }>();

  const [perimeters, setPerimeters] = useState<PerimeterRow[]>([]);
  const [companyName, setCompanyName] = useState<string>("Company");
  const [companyDetails, setCompanyDetails] = useState<CompanyDetailsRow | null>(null);
  const [newPerimeterName, setNewPerimeterName] = useState("");
  const [meData, setMeData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [superAdminHint, setSuperAdminHint] = useState<string | null>(null);
  const [superAdmins, setSuperAdmins] = useState<SuperAdminRow[]>([]);
  const [superAdminFirstName, setSuperAdminFirstName] = useState("");
  const [superAdminLastName, setSuperAdminLastName] = useState("");
  const [superAdminEmail, setSuperAdminEmail] = useState("");
  const [savingSuperAdmin, setSavingSuperAdmin] = useState(false);
  const [selectedPerimeterForAdmins, setSelectedPerimeterForAdmins] = useState<PerimeterRow | null>(null);
  const [perimeterAdmins, setPerimeterAdmins] = useState<PerimeterAdminRow[]>([]);
  const [loadingPerimeterAdmins, setLoadingPerimeterAdmins] = useState(false);
  const [savingPerimeterAdmin, setSavingPerimeterAdmin] = useState(false);
  const [adminFirstName, setAdminFirstName] = useState("");
  const [adminLastName, setAdminLastName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");

  const sortedPerimeters = useMemo(
    () => [...perimeters].sort((a, b) => a.name.localeCompare(b.name)),
    [perimeters]
  );

  const loadPage = async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [perimetersRows, companiesRows] = await Promise.all([
        appApi.platformGetPerimeters(companyId),
        appApi.platformGetCompanies(),
      ]);
      const me = await appApi.getMe();
      setPerimeters(perimetersRows ?? []);
      setMeData(me ?? null);
      const currentCompany = (companiesRows ?? []).find(
        (row: Record<string, unknown>) => row.id === companyId || row.company_id === companyId
      ) as CompanyDetailsRow | undefined;
      setCompanyDetails(currentCompany ?? null);
      setCompanyName((currentCompany?.name ?? currentCompany?.company_name ?? "Company") as string);
      if (me?.isOwner === true) {
        const superAdminRows = await appApi.platformGetCompanySuperAdmins(companyId);
        setSuperAdmins(superAdminRows ?? []);
      } else {
        setSuperAdmins([]);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Errore caricamento perimeters");
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadPage(); }, [companyId]);

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
      emitTenantStructureChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message :"Errore creazione perimeter");
    } finally {
      setCreating(false);
    }
  };

  const superAdminsCount = meData?.isOwner
    ? superAdmins.length
    : (companyDetails?.super_admins_count ?? 0);

  const handleAddSuperAdmin = async () => {
    if (!companyId) return;
    const first_name = superAdminFirstName.trim();
    const last_name = superAdminLastName.trim();
    const email = superAdminEmail.trim().toLowerCase();
    if (!first_name || !last_name || !email) {
      setError("Compila nome, cognome ed email del Super Admin.");
      return;
    }

    try {
      setSavingSuperAdmin(true);
      setError(null);
      await appApi.platformAddCompanySuperAdmin(companyId, { first_name, last_name, email });
      setSuperAdminFirstName("");
      setSuperAdminLastName("");
      setSuperAdminEmail("");
      const rows = await appApi.platformGetCompanySuperAdmins(companyId);
      setSuperAdmins(rows ?? []);
      emitTenantStructureChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message :"Errore aggiunta Super Admin");
    } finally {
      setSavingSuperAdmin(false);
    }
  };

  const handleRemoveSuperAdmin = async (userId: string) => {
    if (!companyId) return;
    try {
      setSavingSuperAdmin(true);
      setError(null);
      await appApi.platformRemoveCompanySuperAdmin(companyId, userId);
      const rows = await appApi.platformGetCompanySuperAdmins(companyId);
      setSuperAdmins(rows ?? []);
      emitTenantStructureChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message :"Errore rimozione Super Admin");
    } finally {
      setSavingSuperAdmin(false);
    }
  };

  const handleRenamePerimeter = async (perimeter: PerimeterRow) => {
    if (!companyId) return;
    const nextNameRaw = window.prompt("Nuovo nome perimeter", perimeter.name);
    if (nextNameRaw === null) return;
    const nextName = nextNameRaw.trim();
    if (!nextName || nextName === perimeter.name) return;

    try {
      setError(null);
      await appApi.platformRenamePerimeter(companyId, perimeter.id, { name: nextName });
      await loadPage();
      emitTenantStructureChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message :"Errore rinomina perimeter");
    }
  };

  const openPerimeterAdmins = async (perimeter: PerimeterRow) => {
    if (!companyId) return;
    setSelectedPerimeterForAdmins(perimeter);
    setLoadingPerimeterAdmins(true);
    setError(null);
    try {
      const rows = await appApi.platformGetPerimeterAdmins(companyId, perimeter.id);
      setPerimeterAdmins(rows ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message :"Errore caricamento admin perimeter");
      setPerimeterAdmins([]);
    } finally {
      setLoadingPerimeterAdmins(false);
    }
  };

  const handleAddPerimeterAdmin = async () => {
    if (!companyId || !selectedPerimeterForAdmins) return;
    const first_name = adminFirstName.trim();
    const last_name = adminLastName.trim();
    const email = adminEmail.trim().toLowerCase();
    if (!first_name || !last_name || !email) {
      setError("Compila nome, cognome ed email dell'Admin.");
      return;
    }

    try {
      setSavingPerimeterAdmin(true);
      setError(null);
      await appApi.platformAddPerimeterAdmin(companyId, selectedPerimeterForAdmins.id, { first_name, last_name, email });
      const rows = await appApi.platformGetPerimeterAdmins(companyId, selectedPerimeterForAdmins.id);
      setPerimeterAdmins(rows ?? []);
      setAdminFirstName("");
      setAdminLastName("");
      setAdminEmail("");
      await loadPage();
      emitTenantStructureChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message :"Errore aggiunta Admin");
    } finally {
      setSavingPerimeterAdmin(false);
    }
  };

  const handleRemovePerimeterAdmin = async (userId: string) => {
    if (!companyId || !selectedPerimeterForAdmins) return;
    try {
      setSavingPerimeterAdmin(true);
      setError(null);
      await appApi.platformRemovePerimeterAdmin(companyId, selectedPerimeterForAdmins.id, userId);
      const rows = await appApi.platformGetPerimeterAdmins(companyId, selectedPerimeterForAdmins.id);
      setPerimeterAdmins(rows ?? []);
      await loadPage();
      emitTenantStructureChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message :"Errore rimozione Admin");
    } finally {
      setSavingPerimeterAdmin(false);
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
            {meData?.isOwner === true && (
              <button
                className="db-btn owner-primary-btn"
                onClick={() => {
                  setSuperAdminHint("Compila i campi Super Admin nella sezione dedicata qui sotto.");
                }}
              >
                + New Super Admin
              </button>
            )}
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

      {meData?.isOwner === true && (
        <div className="db-card owner-super-admin-panel" style={{ marginBottom: "18px" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ margin: 0, fontSize: "15px", color: "var(--text-primary)" }}>Super Admins</h2>
            <p style={{ margin: "6px 0 0", fontSize: "12px", color: "var(--text-secondary)" }}>
              L'owner configura e visualizza i Super Admin per questa company.
            </p>
          </div>

          {superAdminHint && (
            <div className="owner-inline-note" style={{ margin: "12px 20px 0" }}>
              {superAdminHint}
            </div>
          )}

          <div style={{ padding: "12px 16px 0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
            <input
              className="db-filter-select"
              style={{ height: "36px" }}
              placeholder="Nome"
              value={superAdminFirstName}
              onChange={(e) => setSuperAdminFirstName(e.target.value)}
              disabled={savingSuperAdmin}
            />
            <input
              className="db-filter-select"
              style={{ height: "36px" }}
              placeholder="Cognome"
              value={superAdminLastName}
              onChange={(e) => setSuperAdminLastName(e.target.value)}
              disabled={savingSuperAdmin}
            />
            <input
              className="db-filter-select"
              style={{ height: "36px" }}
              placeholder="Email"
              value={superAdminEmail}
              onChange={(e) => setSuperAdminEmail(e.target.value)}
              disabled={savingSuperAdmin}
              type="email"
            />
          </div>
          <div style={{ padding: "10px 16px 0" }}>
            <button className="db-btn owner-primary-btn" onClick={handleAddSuperAdmin} disabled={savingSuperAdmin}>
              + Add Super Admin
            </button>
          </div>

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
                      <button className="db-btn db-btn-outline" onClick={() => handleRemoveSuperAdmin(superAdmin.id)} disabled={savingSuperAdmin}>
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
              </div>
            )}
          </div>
        </div>
      )}

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
                <span className="owner-chip" style={{ alignSelf: "center" }}>
                  Seleziona il perimetro dalla top bar per entrare
                </span>
                <button className="db-btn db-btn-outline" onClick={() => handleRenamePerimeter(perimeter)}>
                  Rename
                </button>
                {(meData?.isSuperAdmin === true || meData?.isOwner === true) && (
                  <button className="db-btn db-btn-outline" onClick={() => openPerimeterAdmins(perimeter)}>
                    Manage Admins
                  </button>
                )}
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

      {(meData?.isSuperAdmin === true || meData?.isOwner === true) && selectedPerimeterForAdmins && (
        <div className="db-card owner-super-admin-panel" style={{ marginTop: "18px" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ margin: 0, fontSize: "15px", color: "var(--text-primary)" }}>
              Admins — {selectedPerimeterForAdmins.name}
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: "12px", color: "var(--text-secondary)" }}>
              Il Super Admin configura gli Admin del perimeter selezionato.
            </p>
          </div>

          <div style={{ padding: "12px 16px 0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
            <input
              className="db-filter-select"
              style={{ height: "36px" }}
              placeholder="Nome Admin"
              value={adminFirstName}
              onChange={(e) => setAdminFirstName(e.target.value)}
              disabled={savingPerimeterAdmin}
            />
            <input
              className="db-filter-select"
              style={{ height: "36px" }}
              placeholder="Cognome Admin"
              value={adminLastName}
              onChange={(e) => setAdminLastName(e.target.value)}
              disabled={savingPerimeterAdmin}
            />
            <input
              className="db-filter-select"
              style={{ height: "36px" }}
              placeholder="Email Admin"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              disabled={savingPerimeterAdmin}
              type="email"
            />
          </div>
          <div style={{ padding: "10px 16px 0", display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button className="db-btn owner-primary-btn" onClick={handleAddPerimeterAdmin} disabled={savingPerimeterAdmin}>
              + Add Admin
            </button>
            <button className="db-btn db-btn-outline" onClick={() => setSelectedPerimeterForAdmins(null)}>
              Close
            </button>
          </div>

          <div className="owner-super-admin-list">
            {loadingPerimeterAdmins ? (
              <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Caricamento admins…</div>
            ) : perimeterAdmins.length > 0 ? (
              perimeterAdmins.map((admin) => (
                <div key={admin.id} className="owner-super-admin-card">
                  <div className="owner-super-admin-main">
                    <div className="owner-super-admin-name">{admin.full_name ?? "Admin"}</div>
                    <div className="owner-super-admin-email">{admin.email ?? "email non disponibile"}</div>
                  </div>
                  <div className="owner-super-admin-side">
                    <span className="owner-chip">{admin.access_role ?? "admin_user"}</span>
                    <button
                      className="db-btn db-btn-outline"
                      onClick={() => handleRemovePerimeterAdmin(admin.id)}
                      disabled={savingPerimeterAdmin}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="db-empty-state">
                <div className="db-empty-state-title">Nessun Admin su questo perimeter</div>
                <div className="db-empty-state-desc">
                  Aggiungi il primo Admin per abilitare la gestione operativa locale.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div style={{ marginTop: "14px", color: "#b91c1c", fontSize: "13px" }}>
          {error}
        </div>
      )}
    </div>
  );
};

export default CompanyPerimetersPage;
