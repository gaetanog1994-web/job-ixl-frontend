import { useEffect, useMemo, useState } from "react";
import AdminLocationsManager from "./AdminLocationsManager";
import AdminRolesManager from "./AdminRolesManager";
import { AppApiError, appApi } from "../lib/appApi";
import OrgUnitTreeSelector, { type OrgNode } from "../components/OrgUnitTreeSelector";
import "../styles/dashboard.css";

type ConfigTab = "users" | "roles" | "departments" | "locations" | "responsabili" | "hr";

type RoleOption = { id: string; name: string };
type LocationOption = { id: string; name: string };
type DepartmentOption = { id: string; name: string; assigned_users_count: number; parent_id?: string | null };
type ManagerRef = { id: string; name: string };

type User = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
  availability_status: string | null;
  user_state?: "inactive" | "reserved" | "available" | null;
  role_id?: string | null;
  role_name?: string | null;
  department_id?: string | null;
  department_name?: string | null;
  location_id?: string | null;
  location_name?: string | null;
  fixed_location?: boolean | null;
  access_role?: "user" | "admin" | "admin_user" | null;
  application_count?: number | null;
  responsabili?: ManagerRef[];
  hr_managers?: ManagerRef[];
};

type ManagerListItem = {
  id: string;
  name: string;
  email: string | null;
  assigned_users_count: number;
};

type AssignedUser = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  role_name?: string | null;
  department_name?: string | null;
  location_name?: string | null;
};

type AddUserForm = {
  firstName: string;
  lastName: string;
  email: string;
  roleId: string;
  departmentId: string;
  locationId: string;
  fixedLocation: boolean;
  accessRole: "user" | "admin" | "admin_user";
};

type EditUserForm = {
  firstName: string;
  lastName: string;
  email: string;
  roleId: string;
  departmentId: string;
  locationId: string;
  fixedLocation: boolean;
  accessRole: "user" | "admin" | "admin_user";
  responsabileIds: string[];
  hrManagerIds: string[];
  responsabiliSearch: string;
  hrSearch: string;
};

type UserPickerFilters = {
  name: string;
  roleId: string;
  departmentId: string;
  locationId: string;
};

type ManagerKind = "responsabili" | "hr";

type ManagerTabProps = {
  kind: ManagerKind;
  users: User[];
  roles: RoleOption[];
  locations: LocationOption[];
  departments: DepartmentOption[];
  items: ManagerListItem[];
  loadItems: () => Promise<void>;
  createItem: (payload: { name: string; email: string | null }) => Promise<void>;
  updateItem: (id: string, payload: { name: string; email: string | null }) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  loadAssignedUsers: (id: string) => Promise<AssignedUser[]>;
  assignUsers: (id: string, userIds: string[]) => Promise<void>;
  removeAssignment: (id: string, userId: string) => Promise<void>;
};

const TAB_ORDER: { id: ConfigTab; label: string; icon: string; description: string }[] = [
  { id: "users", label: "Utenti", icon: "👤", description: "Gestisci anagrafica e posizioni" },
  { id: "roles", label: "Ruoli", icon: "🏷️", description: "Ruoli e compatibilità" },
  { id: "departments", label: "Struttura Org.", icon: "🌳", description: "Unità organizzative" },
  { id: "locations", label: "Sedi", icon: "📍", description: "Sedi geografiche" },
  { id: "responsabili", label: "Responsabili", icon: "👔", description: "Gestione responsabili" },
  { id: "hr", label: "HR", icon: "💼", description: "HR Manager" },
];

const EMPTY_ADD_FORM: AddUserForm = {
  firstName: "",
  lastName: "",
  email: "",
  roleId: "",
  departmentId: "",
  locationId: "",
  fixedLocation: false,
  accessRole: "user",
};

const OVERLAY_STYLE: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const MODAL_STYLE: React.CSSProperties = {
  background: "#fff",
  borderRadius: "14px",
  padding: "24px",
  maxWidth: "980px",
  width: "94%",
  maxHeight: "90vh",
  overflowY: "auto",
  boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
};

const LABEL_STYLE: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--text-secondary)",
  marginBottom: "6px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  height: "36px",
  boxSizing: "border-box",
};

function normalizeText(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function normalizeEmail(value: string | null | undefined): string {
  return normalizeText(value).toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function accessRoleLabel(role: string | null | undefined) {
  if (role === "admin") return "Admin";
  if (role === "admin_user") return "Admin + User";
  return "User";
}

function stateLabel(user: User) {
  const state = user.user_state ?? "inactive";
  if (state === "available") return "Disponibile";
  if (state === "reserved") return "Prenotato";
  return "Inattivo";
}

function buildEditForm(user: User): EditUserForm {
  return {
    firstName: normalizeText(user.first_name),
    lastName: normalizeText(user.last_name),
    email: normalizeText(user.email),
    roleId: user.role_id ?? "",
    departmentId: user.department_id ?? "",
    locationId: user.location_id ?? "",
    fixedLocation: Boolean(user.fixed_location),
    accessRole: user.access_role ?? "user",
    responsabileIds: (user.responsabili ?? []).map((item) => item.id),
    hrManagerIds: (user.hr_managers ?? []).map((item) => item.id),
    responsabiliSearch: "",
    hrSearch: "",
  };
}

const SectionCard = ({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) => (
  <div className="db-card" style={{ marginTop: "16px" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
      <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>{title}</h2>
      {actions ? <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>{actions}</div> : null}
    </div>
    <div style={{ padding: "16px 20px" }}>{children}</div>
  </div>
);

const ManagerTab = ({
  kind,
  users,
  roles,
  locations,
  departments,
  items,
  loadItems,
  createItem,
  updateItem,
  deleteItem,
  loadAssignedUsers,
  assignUsers,
  removeAssignment,
}: ManagerTabProps) => {
  const entityLabel = kind === "responsabili" ? "Responsabile" : "HR";
  const createButtonLabel = kind === "responsabili" ? "+ Nuovo Responsabile" : "+ Nuovo HR";

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSaving, setCreateSaving] = useState(false);

  const [selectedManager, setSelectedManager] = useState<ManagerListItem | null>(null);
  const [detailName, setDetailName] = useState("");
  const [detailEmail, setDetailEmail] = useState("");
  const [detailSaving, setDetailSaving] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [assignedUsers, setAssignedUsers] = useState<AssignedUser[]>([]);
  const [loadingAssignedUsers, setLoadingAssignedUsers] = useState(false);

  const [showPicker, setShowPicker] = useState(false);
  const [pickerFilters, setPickerFilters] = useState<UserPickerFilters>({ name: "", roleId: "", departmentId: "", locationId: "" });
  const [pickerSelection, setPickerSelection] = useState<Set<string>>(new Set());
  const [pickerSaving, setPickerSaving] = useState(false);

  const assignedUserIds = useMemo(() => new Set(assignedUsers.map((user) => user.id)), [assignedUsers]);

  const filteredPickerUsers = useMemo(() => {
    const filterName = pickerFilters.name.trim().toLowerCase();
    return users.filter((user) => {
      const fullName = `${normalizeText(user.first_name)} ${normalizeText(user.last_name)}`.trim().toLowerCase();
      const byName = !filterName || fullName.includes(filterName) || normalizeText(user.email).toLowerCase().includes(filterName);
      const byRole = !pickerFilters.roleId || (user.role_id ?? "") === pickerFilters.roleId;
      const byDepartment = !pickerFilters.departmentId || (user.department_id ?? "") === pickerFilters.departmentId;
      const byLocation = !pickerFilters.locationId || (user.location_id ?? "") === pickerFilters.locationId;
      return byName && byRole && byDepartment && byLocation;
    });
  }, [users, pickerFilters]);

  const selectableFilteredUserIds = useMemo(
    () => filteredPickerUsers.map((user) => user.id).filter((id) => !assignedUserIds.has(id)),
    [filteredPickerUsers, assignedUserIds]
  );

  const openCreateModal = () => {
    setShowCreateModal(true);
    setCreateName("");
    setCreateEmail("");
    setCreateError(null);
  };

  const closeCreateModal = () => {
    if (createSaving) return;
    setShowCreateModal(false);
    setCreateError(null);
  };

  const handleCreate = async () => {
    const name = createName.trim();
    const email = normalizeEmail(createEmail) || null;
    if (!name) {
      setCreateError("Il nome è obbligatorio.");
      return;
    }
    if (email && !isValidEmail(email)) {
      setCreateError("Formato email non valido.");
      return;
    }
    setCreateSaving(true);
    setCreateError(null);
    try {
      await createItem({ name, email });
      await loadItems();
      closeCreateModal();
    } catch (error: unknown) {
      setCreateError(error instanceof Error ? error.message : "Errore durante la creazione.");
    } finally {
      setCreateSaving(false);
    }
  };

  const openDetailModal = async (manager: ManagerListItem) => {
    setSelectedManager(manager);
    setDetailName(manager.name);
    setDetailEmail(manager.email ?? "");
    setDetailError(null);
    setLoadingAssignedUsers(true);
    try {
      const usersList = await loadAssignedUsers(manager.id);
      setAssignedUsers(usersList);
    } catch (error: unknown) {
      setAssignedUsers([]);
      setDetailError(error instanceof Error ? error.message : "Errore caricamento utenti associati.");
    } finally {
      setLoadingAssignedUsers(false);
    }
  };

  const closeDetailModal = () => {
    if (detailSaving) return;
    setSelectedManager(null);
    setDetailError(null);
    setAssignedUsers([]);
    setShowPicker(false);
    setPickerSelection(new Set());
  };

  const handleUpdateDetail = async () => {
    if (!selectedManager) return;
    const name = detailName.trim();
    const email = normalizeEmail(detailEmail) || null;
    if (!name) {
      setDetailError("Il nome è obbligatorio.");
      return;
    }
    if (email && !isValidEmail(email)) {
      setDetailError("Formato email non valido.");
      return;
    }

    setDetailSaving(true);
    setDetailError(null);
    try {
      await updateItem(selectedManager.id, { name, email });
      await loadItems();
      setSelectedManager((current) => (current ? { ...current, name, email } : current));
    } catch (error: unknown) {
      setDetailError(error instanceof Error ? error.message : "Errore durante il salvataggio.");
    } finally {
      setDetailSaving(false);
    }
  };

  const handleDeleteManager = async (manager: ManagerListItem) => {
    if (!window.confirm(`Confermi eliminazione di ${manager.name}?`)) return;
    try {
      await deleteItem(manager.id);
      await loadItems();
      if (selectedManager?.id === manager.id) {
        closeDetailModal();
      }
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : "Errore durante eliminazione.");
    }
  };

  const handleRemoveAssignedUser = async (userId: string) => {
    if (!selectedManager) return;
    try {
      await removeAssignment(selectedManager.id, userId);
      const usersList = await loadAssignedUsers(selectedManager.id);
      setAssignedUsers(usersList);
      await loadItems();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : "Errore durante la rimozione dell'associazione.");
    }
  };

  const openPicker = () => {
    setPickerFilters({ name: "", roleId: "", departmentId: "", locationId: "" });
    setPickerSelection(new Set());
    setShowPicker(true);
  };

  const closePicker = () => {
    if (pickerSaving) return;
    setShowPicker(false);
    setPickerSelection(new Set());
  };

  const togglePickerUser = (userId: string) => {
    if (assignedUserIds.has(userId)) return;
    setPickerSelection((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleSelectAllPicker = () => {
    setPickerSelection((prev) => {
      const allSelected = selectableFilteredUserIds.length > 0 && selectableFilteredUserIds.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        selectableFilteredUserIds.forEach((id) => next.delete(id));
        return next;
      }
      const next = new Set(prev);
      selectableFilteredUserIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleConfirmPicker = async () => {
    if (!selectedManager) return;
    const toAssign = [...pickerSelection];
    if (toAssign.length === 0) {
      closePicker();
      return;
    }
    setPickerSaving(true);
    try {
      await assignUsers(selectedManager.id, toAssign);
      const usersList = await loadAssignedUsers(selectedManager.id);
      setAssignedUsers(usersList);
      await loadItems();
      closePicker();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : "Errore durante l'associazione utenti.");
    } finally {
      setPickerSaving(false);
    }
  };

  return (
    <>
      <SectionCard
        title={`${entityLabel} (${items.length})`}
        actions={
          <button className="db-btn" style={{ background: "var(--brand)", color: "white", border: "none" }} onClick={openCreateModal}>
            {createButtonLabel}
          </button>
        }
      >
        <div style={{ overflowX: "auto" }}>
          <table className="db-apps-table" style={{ width: "100%", whiteSpace: "nowrap" }}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>N. Utenti associati</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.email || "—"}</td>
                  <td>{item.assigned_users_count}</td>
                  <td>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button className="db-action-btn" onClick={() => openDetailModal(item)}>Esplora</button>
                      <button className="db-action-btn db-action-btn-delete" onClick={() => handleDeleteManager(item)}>Elimina</button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", color: "var(--text-secondary)", padding: "16px" }}>
                    Nessun {entityLabel.toLowerCase()} configurato.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {showCreateModal && (
        <div style={OVERLAY_STYLE} onClick={closeCreateModal} role="dialog" aria-modal="true">
          <div style={{ ...MODAL_STYLE, maxWidth: "520px" }} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0 }}>{createButtonLabel.replace("+ ", "")}</h3>
              <button onClick={closeCreateModal} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer" }}>×</button>
            </div>
            <div style={{ display: "grid", gap: "12px" }}>
              <div>
                <label style={LABEL_STYLE}>Nome *</label>
                <input className="db-filter-select" style={INPUT_STYLE} value={createName} onChange={(event) => setCreateName(event.target.value)} disabled={createSaving} />
              </div>
              <div>
                <label style={LABEL_STYLE}>Email</label>
                <input className="db-filter-select" style={INPUT_STYLE} value={createEmail} onChange={(event) => setCreateEmail(event.target.value)} disabled={createSaving} />
              </div>
            </div>
            {createError && (
              <div style={{ marginTop: "12px", padding: "10px", border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", borderRadius: "8px" }}>
                {createError}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
              <button className="db-btn db-btn-outline" onClick={closeCreateModal} disabled={createSaving}>Annulla</button>
              <button className="db-btn" style={{ background: "var(--brand)", color: "white", border: "none" }} onClick={handleCreate} disabled={createSaving}>
                {createSaving ? "Salvataggio..." : "Salva"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedManager && (
        <div style={OVERLAY_STYLE} onClick={closeDetailModal} role="dialog" aria-modal="true">
          <div style={{ ...MODAL_STYLE, maxWidth: "940px" }} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0 }}>{entityLabel}: {selectedManager.name}</h3>
              <button onClick={closeDetailModal} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer" }}>×</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginBottom: "12px" }}>
              <div>
                <label style={LABEL_STYLE}>Nome *</label>
                <input className="db-filter-select" style={INPUT_STYLE} value={detailName} onChange={(event) => setDetailName(event.target.value)} disabled={detailSaving} />
              </div>
              <div>
                <label style={LABEL_STYLE}>Email</label>
                <input className="db-filter-select" style={INPUT_STYLE} value={detailEmail} onChange={(event) => setDetailEmail(event.target.value)} disabled={detailSaving} />
              </div>
            </div>

            {detailError && (
              <div style={{ marginBottom: "12px", padding: "10px", border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", borderRadius: "8px" }}>
                {detailError}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <h4 style={{ margin: 0 }}>Utenti associati ({assignedUsers.length})</h4>
              <div style={{ display: "flex", gap: "8px" }}>
                <button className="db-btn db-btn-outline" onClick={handleUpdateDetail} disabled={detailSaving}>
                  {detailSaving ? "Salvataggio..." : "Salva"}
                </button>
                <button className="db-btn" style={{ background: "var(--brand)", color: "white", border: "none" }} onClick={openPicker}>
                  Associa utenti
                </button>
              </div>
            </div>

            <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "8px" }}>
              <table className="db-apps-table" style={{ width: "100%", whiteSpace: "nowrap" }}>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Cognome</th>
                    <th>Ruolo</th>
                    <th>Reparto</th>
                    <th>Sede</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingAssignedUsers && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", color: "var(--text-secondary)", padding: "12px" }}>Caricamento...</td>
                    </tr>
                  )}
                  {!loadingAssignedUsers && assignedUsers.map((user) => (
                    <tr key={user.id}>
                      <td>{user.first_name ?? "—"}</td>
                      <td>{user.last_name ?? "—"}</td>
                      <td>{user.role_name ?? "—"}</td>
                      <td>{user.department_name ?? "—"}</td>
                      <td>{user.location_name ?? "—"}</td>
                      <td>
                        <button className="db-action-btn db-action-btn-delete" onClick={() => handleRemoveAssignedUser(user.id)}>Rimuovi</button>
                      </td>
                    </tr>
                  ))}
                  {!loadingAssignedUsers && assignedUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", color: "var(--text-secondary)", padding: "12px" }}>
                        Nessun utente associato.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: "16px", display: "flex", justifyContent: "space-between", gap: "8px" }}>
              <button className="db-btn db-btn-danger" onClick={() => handleDeleteManager(selectedManager)} disabled={detailSaving}>
                Elimina {entityLabel.toLowerCase()}
              </button>
              <button className="db-btn db-btn-outline" onClick={closeDetailModal} disabled={detailSaving}>Chiudi</button>
            </div>

            {showPicker && (
              <div style={OVERLAY_STYLE} onClick={closePicker} role="dialog" aria-modal="true">
                <div style={{ ...MODAL_STYLE, maxWidth: "1080px" }} onClick={(event) => event.stopPropagation()}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <h3 style={{ margin: 0 }}>Associa utenti</h3>
                    <button onClick={closePicker} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer" }}>×</button>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "8px", marginBottom: "10px" }}>
                    <input
                      className="db-filter-select"
                      style={INPUT_STYLE}
                      placeholder="Nome o email"
                      value={pickerFilters.name}
                      onChange={(event) => setPickerFilters((prev) => ({ ...prev, name: event.target.value }))}
                    />
                    <select className="db-filter-select" style={INPUT_STYLE} value={pickerFilters.roleId} onChange={(event) => setPickerFilters((prev) => ({ ...prev, roleId: event.target.value }))}>
                      <option value="">Tutti i ruoli</option>
                      {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                    </select>
                    <select className="db-filter-select" style={INPUT_STYLE} value={pickerFilters.departmentId} onChange={(event) => setPickerFilters((prev) => ({ ...prev, departmentId: event.target.value }))}>
                      <option value="">Tutti i reparti</option>
                      {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                    </select>
                    <select className="db-filter-select" style={INPUT_STYLE} value={pickerFilters.locationId} onChange={(event) => setPickerFilters((prev) => ({ ...prev, locationId: event.target.value }))}>
                      <option value="">Tutte le sedi</option>
                      {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                    </select>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={selectableFilteredUserIds.length > 0 && selectableFilteredUserIds.every((id) => pickerSelection.has(id))}
                        onChange={toggleSelectAllPicker}
                      />
                      Seleziona tutti
                    </label>
                    <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                      Già associati: {assignedUserIds.size}
                    </span>
                  </div>

                  <div style={{ maxHeight: "360px", overflowY: "auto", border: "1px solid var(--border)", borderRadius: "8px" }}>
                    <table className="db-apps-table" style={{ width: "100%", whiteSpace: "nowrap" }}>
                      <thead>
                        <tr>
                          <th style={{ width: "52px" }}>✓</th>
                          <th>Nome</th>
                          <th>Cognome</th>
                          <th>Ruolo</th>
                          <th>Reparto</th>
                          <th>Sede</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPickerUsers.map((user) => {
                          const alreadyAssigned = assignedUserIds.has(user.id);
                          return (
                            <tr key={user.id} style={alreadyAssigned ? { background: "#f8fafc" } : undefined}>
                              <td style={{ textAlign: "center" }}>
                                <input
                                  type="checkbox"
                                  checked={alreadyAssigned || pickerSelection.has(user.id)}
                                  disabled={alreadyAssigned}
                                  onChange={() => togglePickerUser(user.id)}
                                />
                              </td>
                              <td>{user.first_name ?? "—"}</td>
                              <td>{user.last_name ?? "—"}</td>
                              <td>{user.role_name ?? "—"}</td>
                              <td>{user.department_name ?? "—"}</td>
                              <td>{user.location_name ?? "—"}</td>
                            </tr>
                          );
                        })}
                        {filteredPickerUsers.length === 0 && (
                          <tr>
                            <td colSpan={6} style={{ textAlign: "center", color: "var(--text-secondary)", padding: "12px" }}>
                              Nessun utente trovato con i filtri correnti.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}>
                    <button className="db-btn db-btn-outline" onClick={closePicker} disabled={pickerSaving}>Annulla</button>
                    <button
                      className="db-btn"
                      style={{ background: "var(--brand)", color: "white", border: "none" }}
                      onClick={handleConfirmPicker}
                      disabled={pickerSaving}
                    >
                      {pickerSaving ? "Salvataggio..." : "Conferma"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

const AdminTestUsers = () => {
  const initialTab = (() => {
    if (typeof window === "undefined") return "users" as ConfigTab;
    const section = new URLSearchParams(window.location.search).get("section");
    const normalized = section === "users" || section === "roles" || section === "locations" || section === "departments" || section === "responsabili" || section === "hr"
      ? section
      : "users";
    return normalized;
  })();

  const [activeTab, setActiveTab] = useState<ConfigTab>(initialTab);

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [responsabili, setResponsabili] = useState<ManagerListItem[]>([]);
  const [hrManagers, setHrManagers] = useState<ManagerListItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);

  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [addUserForm, setAddUserForm] = useState<AddUserForm>(EMPTY_ADD_FORM);
  const [addUserError, setAddUserError] = useState<string | null>(null);
  const [addUserSaving, setAddUserSaving] = useState(false);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editUserForm, setEditUserForm] = useState<EditUserForm | null>(null);
  const [editUserSaving, setEditUserSaving] = useState(false);
  const [editUserError, setEditUserError] = useState<string | null>(null);

  const [filterName, setFilterName] = useState("");
  const [filterSurname, setFilterSurname] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterLocation, setFilterLocation] = useState("");

  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [departmentSaving, setDepartmentSaving] = useState(false);
  const [departmentError, setDepartmentError] = useState<string | null>(null);
  const [editingDepartmentId, setEditingDepartmentId] = useState<string | null>(null);
  const [editingDepartmentName, setEditingDepartmentName] = useState("");

  const loadUsers = async () => {
    const data = await appApi.adminGetUsers();
    setUsers(data as User[]);
  };

  const loadRoles = async () => {
    const data = await appApi.adminGetRoles();
    setRoles(data as RoleOption[]);
  };

  const loadLocations = async () => {
    const data = await appApi.adminGetLocations();
    setLocations(data as LocationOption[]);
  };

  const loadDepartments = async () => {
    const data = await appApi.adminGetDepartments();
    setDepartments(data as DepartmentOption[]);
  };

  const loadResponsabili = async () => {
    const data = await appApi.adminGetResponsabili();
    setResponsabili(data as ManagerListItem[]);
  };

  const loadHrManagers = async () => {
    const data = await appApi.adminGetHrManagers();
    setHrManagers(data as ManagerListItem[]);
  };

  const loadAll = async () => {
    setLoading(true);
    setTopError(null);
    try {
      await Promise.all([
        loadUsers(),
        loadRoles(),
        loadLocations(),
        loadDepartments(),
        loadResponsabili(),
        loadHrManagers(),
      ]);
    } catch (error: unknown) {
      setTopError(error instanceof Error ? error.message : "Errore durante il caricamento dati.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const usersFiltered = useMemo(() => {
    return users.filter((user) => {
      const userName = normalizeText(user.first_name).toLowerCase();
      const userSurname = normalizeText(user.last_name).toLowerCase();
      const userState = String(user.user_state ?? user.availability_status ?? "").toLowerCase();

      const byName = !filterName.trim() || userName.includes(filterName.trim().toLowerCase());
      const bySurname = !filterSurname.trim() || userSurname.includes(filterSurname.trim().toLowerCase());
      const byState = !filterStatus || userState === filterStatus.toLowerCase();
      const byRole = !filterRole || (user.role_id ?? "") === filterRole;
      const byDepartment = !filterDepartment || (user.department_id ?? "") === filterDepartment;
      const byLocation = !filterLocation || (user.location_id ?? "") === filterLocation;
      return byName && bySurname && byState && byRole && byDepartment && byLocation;
    });
  }, [users, filterName, filterSurname, filterStatus, filterRole, filterDepartment, filterLocation]);

  const openAddUserModal = () => {
    setAddUserForm(EMPTY_ADD_FORM);
    setAddUserError(null);
    setShowAddUserModal(true);
  };

  const closeAddUserModal = () => {
    if (addUserSaving) return;
    setShowAddUserModal(false);
    setAddUserError(null);
  };

  const handleAddUser = async () => {
    const firstName = addUserForm.firstName.trim();
    const lastName = addUserForm.lastName.trim();
    const email = normalizeEmail(addUserForm.email);
    if (!firstName || !lastName || !email) {
      setAddUserError("Nome, Cognome ed Email sono obbligatori.");
      return;
    }
    if (!isValidEmail(email)) {
      setAddUserError("Formato email non valido.");
      return;
    }

    setAddUserSaving(true);
    setAddUserError(null);
    try {
      const result = await appApi.adminInviteUser({
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`,
        email,
        location_id: addUserForm.locationId || null,
        access_role: addUserForm.accessRole,
      });
      const userId = (result as { user?: { id?: string } })?.user?.id;
      if (userId) {
        await Promise.all([
          appApi.adminPatchUser(userId, {
            first_name: firstName,
            last_name: lastName,
            email,
            role_id: addUserForm.roleId || null,
            department_id: addUserForm.departmentId || null,
            location_id: addUserForm.locationId || null,
            fixed_location: addUserForm.fixedLocation,
          }),
          appApi.adminPatchUserAccessRole(userId, addUserForm.accessRole),
        ]);
      }
      closeAddUserModal();
      await Promise.all([loadUsers(), loadDepartments()]);
    } catch (error: unknown) {
      setAddUserError(error instanceof Error ? error.message : "Errore durante la creazione utente.");
    } finally {
      setAddUserSaving(false);
    }
  };

  const openUserEditor = (user: User) => {
    setSelectedUser(user);
    setEditUserForm(buildEditForm(user));
    setEditUserError(null);
  };

  const closeUserEditor = () => {
    if (editUserSaving) return;
    setSelectedUser(null);
    setEditUserForm(null);
    setEditUserError(null);
  };

  const toggleManagerSelection = (field: "responsabileIds" | "hrManagerIds", managerId: string) => {
    setEditUserForm((prev) => {
      if (!prev) return prev;
      const next = new Set(prev[field]);
      if (next.has(managerId)) next.delete(managerId);
      else next.add(managerId);
      return { ...prev, [field]: [...next] };
    });
  };

  const syncManagerAssignments = async (
    kind: ManagerKind,
    currentIds: string[],
    selectedIds: string[],
    userId: string
  ) => {
    const current = new Set(currentIds);
    const selected = new Set(selectedIds);
    const toAdd = [...selected].filter((id) => !current.has(id));
    const toRemove = [...current].filter((id) => !selected.has(id));

    if (kind === "responsabili") {
      await Promise.all([
        ...toAdd.map((managerId) => appApi.adminAssignResponsabileUsers(managerId, [userId])),
        ...toRemove.map((managerId) => appApi.adminRemoveResponsabileUser(managerId, userId)),
      ]);
      return;
    }

    await Promise.all([
      ...toAdd.map((managerId) => appApi.adminAssignHrManagerUsers(managerId, [userId])),
      ...toRemove.map((managerId) => appApi.adminRemoveHrManagerUser(managerId, userId)),
    ]);
  };

  const handleSaveUser = async () => {
    if (!selectedUser || !editUserForm) return;

    const firstName = normalizeText(editUserForm.firstName);
    const lastName = normalizeText(editUserForm.lastName);
    const email = normalizeEmail(editUserForm.email);

    if (!firstName || !lastName || !email) {
      setEditUserError("Nome, Cognome ed Email sono obbligatori.");
      return;
    }
    if (!isValidEmail(email)) {
      setEditUserError("Formato email non valido.");
      return;
    }

    setEditUserSaving(true);
    setEditUserError(null);
    try {
      const patchUserPromise = appApi.adminPatchUser(selectedUser.id, {
        first_name: firstName,
        last_name: lastName,
        email,
        role_id: editUserForm.roleId || null,
        department_id: editUserForm.departmentId || null,
        location_id: editUserForm.locationId || null,
        fixed_location: editUserForm.fixedLocation,
      });

      const patchAccessRolePromise = selectedUser.access_role !== editUserForm.accessRole
        ? appApi.adminPatchUserAccessRole(selectedUser.id, editUserForm.accessRole)
        : Promise.resolve(null);

      const syncResponsabiliPromise = syncManagerAssignments(
        "responsabili",
        (selectedUser.responsabili ?? []).map((item) => item.id),
        editUserForm.responsabileIds,
        selectedUser.id
      );

      const syncHrPromise = syncManagerAssignments(
        "hr",
        (selectedUser.hr_managers ?? []).map((item) => item.id),
        editUserForm.hrManagerIds,
        selectedUser.id
      );

      await Promise.all([
        patchUserPromise,
        patchAccessRolePromise,
        syncResponsabiliPromise,
        syncHrPromise,
      ]);

      closeUserEditor();
      await Promise.all([loadUsers(), loadDepartments(), loadResponsabili(), loadHrManagers()]);
    } catch (error: unknown) {
      setEditUserError(error instanceof Error ? error.message : "Errore durante il salvataggio utente.");
    } finally {
      setEditUserSaving(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("Eliminare definitivamente questo utente?")) return;
    try {
      await appApi.adminDeleteUser(userId);
      await Promise.all([loadUsers(), loadDepartments()]);
      if (selectedUser?.id === userId) {
        closeUserEditor();
      }
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : "Errore durante eliminazione utente.");
    }
  };

  const handleCreateDepartment = async () => {
    const name = newDepartmentName.trim();
    if (!name) {
      setDepartmentError("Il nome del reparto è obbligatorio.");
      return;
    }

    setDepartmentSaving(true);
    setDepartmentError(null);
    try {
      await appApi.adminCreateDepartment({ name });
      setNewDepartmentName("");
      await Promise.all([loadDepartments(), loadUsers()]);
    } catch (error: unknown) {
      setDepartmentError(error instanceof Error ? error.message : "Errore durante creazione reparto.");
    } finally {
      setDepartmentSaving(false);
    }
  };

  const startRenameDepartment = (department: DepartmentOption) => {
    setEditingDepartmentId(department.id);
    setEditingDepartmentName(department.name);
  };

  const cancelRenameDepartment = () => {
    setEditingDepartmentId(null);
    setEditingDepartmentName("");
  };

  const handleRenameDepartment = async (departmentId: string) => {
    const name = editingDepartmentName.trim();
    if (!name) {
      alert("Il nome del reparto è obbligatorio.");
      return;
    }
    try {
      await appApi.adminRenameDepartment(departmentId, { name });
      cancelRenameDepartment();
      await Promise.all([loadDepartments(), loadUsers()]);
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : "Errore durante rinomina reparto.");
    }
  };

  const handleDeleteDepartment = async (department: DepartmentOption) => {
    if (!window.confirm(`Eliminare il reparto ${department.name}?`)) return;
    try {
      await appApi.adminDeleteDepartment(department.id);
      await Promise.all([loadDepartments(), loadUsers()]);
    } catch (error: unknown) {
      if (error instanceof AppApiError && error.code === "DEPARTMENT_HAS_USERS") {
        alert("Impossibile eliminare: ci sono utenti assegnati a questo reparto.");
        return;
      }
      alert(error instanceof Error ? error.message : "Errore durante eliminazione reparto.");
    }
  };

  const switchTab = (nextTab: ConfigTab) => {
    setActiveTab(nextTab);
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", `/admin/configurazione?section=${nextTab}`);
    }
  };

  const filteredResponsabiliOptions = useMemo(() => {
    const search = editUserForm?.responsabiliSearch?.trim().toLowerCase() ?? "";
    if (!search) return responsabili;
    return responsabili.filter((item) => item.name.toLowerCase().includes(search) || normalizeText(item.email).toLowerCase().includes(search));
  }, [editUserForm?.responsabiliSearch, responsabili]);

  const filteredHrOptions = useMemo(() => {
    const search = editUserForm?.hrSearch?.trim().toLowerCase() ?? "";
    if (!search) return hrManagers;
    return hrManagers.filter((item) => item.name.toLowerCase().includes(search) || normalizeText(item.email).toLowerCase().includes(search));
  }, [editUserForm?.hrSearch, hrManagers]);

  const activeTabMeta = TAB_ORDER.find((t) => t.id === activeTab)!;

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface, #f1f5f9)", fontFamily: "var(--font, 'Inter', sans-serif)", paddingTop: "56px" }}>

      {/* Page header */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--border)", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Admin</span>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>›</span>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--brand)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Configurazione</span>
          </div>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>{activeTabMeta.icon}</span>
            {activeTabMeta.label}
            <span style={{ fontSize: "13px", fontWeight: 400, color: "var(--text-secondary)" }}>{activeTabMeta.description}</span>
          </h1>
        </div>
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-secondary)", fontSize: "13px" }}>
            <div className="db-spinner" />
            Caricamento...
          </div>
        )}
      </div>

      {/* Tab navigation */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--border)", padding: "0 24px", display: "flex", gap: "0", overflowX: "auto" }}>
        {TAB_ORDER.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "12px 16px",
                border: "none",
                borderBottom: isActive ? "2px solid var(--brand)" : "2px solid transparent",
                background: "transparent",
                color: isActive ? "var(--brand)" : "var(--text-secondary)",
                fontWeight: isActive ? 700 : 500,
                fontSize: "13px",
                fontFamily: "var(--font)",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "color 0.15s, border-color 0.15s",
                marginBottom: "-1px",
              }}
              onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)"; }}
              onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)"; }}
            >
              <span style={{ fontSize: "14px" }}>{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Page content */}
      <div style={{ padding: "20px 24px" }}>
        {topError && (
          <div style={{ marginBottom: "14px", padding: "12px 16px", border: "1px solid #fecaca", background: "#fef2f2", borderRadius: "10px", color: "#b91c1c", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "16px" }}>⚠️</span>
            {topError}
          </div>
        )}

      {activeTab === "users" && (
        <>
          <SectionCard
            title={`Lista Utenti (${usersFiltered.length})`}
            actions={
              <button className="db-btn" style={{ background: "var(--brand)", color: "white", border: "none" }} onClick={openAddUserModal}>
                + Aggiungi Utente
              </button>
            }
          >
            <div style={{ overflowX: "auto" }}>
              <table className="db-apps-table" style={{ width: "100%", whiteSpace: "nowrap" }}>
                <thead>
                  <tr>
                    <th>
                      <input className="db-filter-select" style={{ height: "30px", fontSize: "12px", minWidth: "120px" }} placeholder="Filtro cognome" value={filterSurname} onChange={(event) => setFilterSurname(event.target.value)} />
                    </th>
                    <th>
                      <input className="db-filter-select" style={{ height: "30px", fontSize: "12px", minWidth: "120px" }} placeholder="Filtro nome" value={filterName} onChange={(event) => setFilterName(event.target.value)} />
                    </th>
                    <th />
                    <th>
                      <select className="db-filter-select" style={{ height: "30px", fontSize: "12px", minWidth: "120px" }} value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}>
                        <option value="">Tutti</option>
                        <option value="available">Disponibile</option>
                        <option value="reserved">Prenotato</option>
                        <option value="inactive">Inattivo</option>
                      </select>
                    </th>
                    <th>
                      <select className="db-filter-select" style={{ height: "30px", fontSize: "12px", minWidth: "140px" }} value={filterRole} onChange={(event) => setFilterRole(event.target.value)}>
                        <option value="">Tutti i ruoli</option>
                        {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                      </select>
                    </th>
                    <th>
                      <select className="db-filter-select" style={{ height: "30px", fontSize: "12px", minWidth: "140px" }} value={filterDepartment} onChange={(event) => setFilterDepartment(event.target.value)}>
                        <option value="">Tutti i reparti</option>
                        {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                      </select>
                    </th>
                    <th>
                      <select className="db-filter-select" style={{ height: "30px", fontSize: "12px", minWidth: "140px" }} value={filterLocation} onChange={(event) => setFilterLocation(event.target.value)}>
                        <option value="">Tutte le sedi</option>
                        {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                      </select>
                    </th>
                    <th />
                    <th />
                  </tr>
                  <tr>
                    <th>Cognome</th>
                    <th>Nome</th>
                    <th>Email</th>
                    <th>Stato</th>
                    <th>Ruolo</th>
                    <th>Reparto</th>
                    <th>Sede</th>
                    <th>Ruolo accesso</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {usersFiltered.map((user) => (
                    <tr key={user.id}>
                      <td>{user.last_name ?? "—"}</td>
                      <td>{user.first_name ?? "—"}</td>
                      <td>{user.email ?? "—"}</td>
                      <td>{stateLabel(user)}</td>
                      <td>{user.role_name ?? "—"}</td>
                      <td>{user.department_name ?? "—"}</td>
                      <td>{user.location_name ?? "—"}</td>
                      <td>{accessRoleLabel(user.access_role)}</td>
                      <td>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button className="db-action-btn" onClick={() => openUserEditor(user)}>Esplora</button>
                          <button className="db-action-btn db-action-btn-delete" onClick={() => handleDeleteUser(user.id)}>Elimina</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {usersFiltered.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: "center", color: "var(--text-secondary)", padding: "16px" }}>Nessun utente trovato.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      )}

      {activeTab === "roles" && <AdminRolesManager />}

      {activeTab === "departments" && (
        <SectionCard
          title={`Reparti (${departments.length})`}
          actions={
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                className="db-filter-select"
                style={{ ...INPUT_STYLE, width: "260px" }}
                placeholder="Nome reparto"
                value={newDepartmentName}
                onChange={(event) => setNewDepartmentName(event.target.value)}
              />
              <button className="db-btn" style={{ background: "var(--brand)", color: "white", border: "none" }} onClick={handleCreateDepartment} disabled={departmentSaving}>
                + Nuovo Reparto
              </button>
            </div>
          }
        >
          {departmentError && (
            <div style={{ marginBottom: "12px", padding: "10px", border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", borderRadius: "8px" }}>
              {departmentError}
            </div>
          )}

          <div style={{ overflowX: "auto" }}>
            <table className="db-apps-table" style={{ width: "100%", whiteSpace: "nowrap" }}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>N. Utenti assegnati</th>
                  <th>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((department) => (
                  <tr key={department.id}>
                    <td>
                      {editingDepartmentId === department.id ? (
                        <input
                          className="db-filter-select"
                          style={{ ...INPUT_STYLE, width: "260px" }}
                          value={editingDepartmentName}
                          onChange={(event) => setEditingDepartmentName(event.target.value)}
                        />
                      ) : (
                        department.name
                      )}
                    </td>
                    <td>{department.assigned_users_count}</td>
                    <td>
                      {editingDepartmentId === department.id ? (
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button className="db-action-btn" onClick={() => handleRenameDepartment(department.id)}>Salva</button>
                          <button className="db-action-btn" onClick={cancelRenameDepartment}>Annulla</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button className="db-action-btn" onClick={() => startRenameDepartment(department)}>Modifica</button>
                          <button
                            className="db-action-btn db-action-btn-delete"
                            onClick={() => handleDeleteDepartment(department)}
                            disabled={department.assigned_users_count > 0}
                            title={department.assigned_users_count > 0 ? "Impossibile eliminare: ci sono utenti assegnati a questo reparto." : undefined}
                            style={department.assigned_users_count > 0 ? { opacity: 0.55, cursor: "not-allowed" } : undefined}
                          >
                            Elimina
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {departments.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ textAlign: "center", color: "var(--text-secondary)", padding: "16px" }}>
                      Nessun reparto configurato. Aggiungine uno per poterlo assegnare agli utenti.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {activeTab === "locations" && <AdminLocationsManager />}

      {activeTab === "responsabili" && (
        <ManagerTab
          kind="responsabili"
          users={users}
          roles={roles}
          locations={locations}
          departments={departments}
          items={responsabili}
          loadItems={loadResponsabili}
          createItem={async (payload) => { await appApi.adminCreateResponsabile(payload); }}
          updateItem={async (id, payload) => { await appApi.adminPatchResponsabile(id, payload); }}
          deleteItem={async (id) => { await appApi.adminDeleteResponsabile(id); }}
          loadAssignedUsers={async (id) => {
            const data = await appApi.adminGetResponsabileUsers(id);
            return data as AssignedUser[];
          }}
          assignUsers={async (id, userIds) => { await appApi.adminAssignResponsabileUsers(id, userIds); }}
          removeAssignment={async (id, userId) => { await appApi.adminRemoveResponsabileUser(id, userId); }}
        />
      )}

      {activeTab === "hr" && (
        <ManagerTab
          kind="hr"
          users={users}
          roles={roles}
          locations={locations}
          departments={departments}
          items={hrManagers}
          loadItems={loadHrManagers}
          createItem={async (payload) => { await appApi.adminCreateHrManager(payload); }}
          updateItem={async (id, payload) => { await appApi.adminPatchHrManager(id, payload); }}
          deleteItem={async (id) => { await appApi.adminDeleteHrManager(id); }}
          loadAssignedUsers={async (id) => {
            const data = await appApi.adminGetHrManagerUsers(id);
            return data as AssignedUser[];
          }}
          assignUsers={async (id, userIds) => { await appApi.adminAssignHrManagerUsers(id, userIds); }}
          removeAssignment={async (id, userId) => { await appApi.adminRemoveHrManagerUser(id, userId); }}
        />
      )}

      {showAddUserModal && (() => {
        const addOrgNodes: OrgNode[] = departments.map((d) => ({ id: d.id, name: d.name, parent_id: d.parent_id ?? null }));
        const addSelectedRole = roles.find((r) => r.id === addUserForm.roleId);
        const addSelectedDept = departments.find((d) => d.id === addUserForm.departmentId);
        return (
        <div style={OVERLAY_STYLE} onClick={closeAddUserModal} role="dialog" aria-modal="true">
          <div style={{ ...MODAL_STYLE, maxWidth: "680px" }} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", paddingBottom: "14px", borderBottom: "1px solid var(--border)" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>Aggiungi Utente</h3>
                <p style={{ margin: "3px 0 0", fontSize: "12px", color: "var(--text-secondary)" }}>Invito via email + assegnazione posizione organizzativa</p>
              </div>
              <button onClick={closeAddUserModal} style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", color: "var(--text-muted)" }}>×</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              {/* Left: anagrafica + accesso */}
              <div style={{ display: "grid", gap: "12px", alignContent: "start" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Anagrafica</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <div>
                    <label style={LABEL_STYLE}>Nome *</label>
                    <input className="db-filter-select" style={INPUT_STYLE} value={addUserForm.firstName} onChange={(event) => setAddUserForm((prev) => ({ ...prev, firstName: event.target.value }))} />
                  </div>
                  <div>
                    <label style={LABEL_STYLE}>Cognome *</label>
                    <input className="db-filter-select" style={INPUT_STYLE} value={addUserForm.lastName} onChange={(event) => setAddUserForm((prev) => ({ ...prev, lastName: event.target.value }))} />
                  </div>
                </div>
                <div>
                  <label style={LABEL_STYLE}>Email *</label>
                  <input className="db-filter-select" style={INPUT_STYLE} type="email" value={addUserForm.email} onChange={(event) => setAddUserForm((prev) => ({ ...prev, email: event.target.value }))} />
                </div>
                <div>
                  <label style={LABEL_STYLE}>Sede</label>
                  <select className="db-filter-select" style={INPUT_STYLE} value={addUserForm.locationId} onChange={(event) => setAddUserForm((prev) => ({ ...prev, locationId: event.target.value }))}>
                    <option value="">— Nessuna —</option>
                    {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                  </select>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input type="checkbox" checked={addUserForm.fixedLocation} onChange={(event) => setAddUserForm((prev) => ({ ...prev, fixedLocation: event.target.checked }))} />
                  <span style={{ fontSize: "13px", color: "var(--text-primary)" }}>Sede vincolante</span>
                </label>
                <div>
                  <label style={LABEL_STYLE}>Ruolo accesso</label>
                  <select className="db-filter-select" style={INPUT_STYLE} value={addUserForm.accessRole} onChange={(event) => setAddUserForm((prev) => ({ ...prev, accessRole: event.target.value as AddUserForm["accessRole"] }))}>
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                    <option value="admin_user">Admin + User</option>
                  </select>
                </div>
              </div>

              {/* Right: posizione organizzativa */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Posizione organizzativa</div>
                <div>
                  <label style={LABEL_STYLE}>Ruolo</label>
                  <select className="db-filter-select" style={INPUT_STYLE} value={addUserForm.roleId} onChange={(event) => setAddUserForm((prev) => ({ ...prev, roleId: event.target.value }))}>
                    <option value="">— Nessuno —</option>
                    {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={LABEL_STYLE}>Unità organizzativa (Reparto)</label>
                  <OrgUnitTreeSelector
                    nodes={addOrgNodes}
                    value={addUserForm.departmentId || null}
                    onChange={(id) => setAddUserForm((prev) => ({ ...prev, departmentId: id ?? "" }))}
                    placeholder="Seleziona reparto / unità org."
                    disabled={addUserSaving}
                  />
                </div>

                {/* Summary */}
                <div style={{ marginTop: "auto", padding: "12px", borderRadius: "10px", border: `1px solid ${addSelectedRole && addSelectedDept ? "rgba(232,81,26,0.25)" : "var(--border)"}`, background: addSelectedRole && addSelectedDept ? "rgba(232,81,26,0.04)" : "#f8fafc" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: addSelectedRole && addSelectedDept ? "var(--brand)" : "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>
                    {addSelectedRole && addSelectedDept ? "✓ Posizione assegnata" : "Riepilogo posizione"}
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--text-primary)", display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div><span style={{ color: "var(--text-muted)", fontSize: "11px" }}>Ruolo:</span> <strong>{addSelectedRole?.name ?? "—"}</strong></div>
                    <div><span style={{ color: "var(--text-muted)", fontSize: "11px" }}>Unità:</span> <strong>{addSelectedDept?.name ?? "—"}</strong></div>
                  </div>
                </div>
              </div>
            </div>

            {addUserError && (
              <div style={{ marginTop: "16px", padding: "12px 16px", border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", borderRadius: "10px", fontSize: "13px", display: "flex", gap: "8px", alignItems: "center" }}>
                <span>⚠️</span>{addUserError}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px", paddingTop: "14px", borderTop: "1px solid var(--border)" }}>
              <button className="db-btn db-btn-outline" onClick={closeAddUserModal} disabled={addUserSaving}>Annulla</button>
              <button className="db-btn" style={{ background: "var(--brand)", color: "white", border: "none" }} onClick={handleAddUser} disabled={addUserSaving}>
                {addUserSaving ? "Salvataggio..." : "Invita & Salva"}
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {selectedUser && editUserForm && (() => {
        const orgNodes: OrgNode[] = departments.map((d) => ({ id: d.id, name: d.name, parent_id: d.parent_id ?? null }));
        const selectedRole = roles.find((r) => r.id === editUserForm.roleId);
        const selectedDept = departments.find((d) => d.id === editUserForm.departmentId);
        const selectedLoc = locations.find((l) => l.id === editUserForm.locationId);
        const positionComplete = !!selectedRole && !!selectedDept;
        const userInitials = `${(editUserForm.firstName || "?")[0]}${(editUserForm.lastName || "?")[0]}`.toUpperCase();

        return (
        <div style={OVERLAY_STYLE} onClick={closeUserEditor} role="dialog" aria-modal="true">
          <div style={{ ...MODAL_STYLE, maxWidth: "1100px" }} onClick={(event) => event.stopPropagation()}>

            {/* Modal header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", paddingBottom: "16px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: 700, color: "white", flexShrink: 0, boxShadow: "0 2px 8px rgba(232,81,26,0.3)" }}>
                  {userInitials}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
                    {editUserForm.firstName} {editUserForm.lastName}
                  </h3>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "3px" }}>
                    <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{selectedUser.email}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 600, background: selectedUser.user_state === "available" ? "#f0fdf4" : selectedUser.user_state === "reserved" ? "#fff7ed" : "#f8fafc", color: selectedUser.user_state === "available" ? "#16a34a" : selectedUser.user_state === "reserved" ? "#ea580c" : "#64748b", border: `1px solid ${selectedUser.user_state === "available" ? "#bbf7d0" : selectedUser.user_state === "reserved" ? "#fed7aa" : "#e2e8f0"}` }}>
                      {stateLabel(selectedUser)}
                    </span>
                    {(selectedUser.application_count ?? 0) > 0 && (
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{selectedUser.application_count} candidature</span>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={closeUserEditor} style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", color: "var(--text-muted)", lineHeight: 1, padding: "4px" }}>×</button>
            </div>

            {/* Two-column layout */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>

              {/* LEFT — Anagrafica + Accesso */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

                {/* Anagrafica section */}
                <div style={{ background: "#f8fafc", borderRadius: "12px", padding: "16px", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "12px" }}>Anagrafica</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={LABEL_STYLE}>Nome *</label>
                      <input className="db-filter-select" style={INPUT_STYLE} value={editUserForm.firstName} onChange={(event) => setEditUserForm((prev) => (prev ? { ...prev, firstName: event.target.value } : prev))} disabled={editUserSaving} />
                    </div>
                    <div>
                      <label style={LABEL_STYLE}>Cognome *</label>
                      <input className="db-filter-select" style={INPUT_STYLE} value={editUserForm.lastName} onChange={(event) => setEditUserForm((prev) => (prev ? { ...prev, lastName: event.target.value } : prev))} disabled={editUserSaving} />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={LABEL_STYLE}>Email *</label>
                      <input className="db-filter-select" style={INPUT_STYLE} value={editUserForm.email} onChange={(event) => setEditUserForm((prev) => (prev ? { ...prev, email: event.target.value } : prev))} disabled={editUserSaving} />
                    </div>
                  </div>
                </div>

                {/* Accesso section */}
                <div style={{ background: "#f8fafc", borderRadius: "12px", padding: "16px", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "12px" }}>Accesso piattaforma</div>
                  <div>
                    <label style={LABEL_STYLE}>Ruolo accesso</label>
                    <select className="db-filter-select" style={INPUT_STYLE} value={editUserForm.accessRole} onChange={(event) => setEditUserForm((prev) => (prev ? { ...prev, accessRole: event.target.value as EditUserForm["accessRole"] } : prev))} disabled={editUserSaving}>
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                      <option value="admin_user">Admin + User</option>
                    </select>
                  </div>
                </div>

                {/* People section */}
                <div style={{ background: "#f8fafc", borderRadius: "12px", padding: "16px", border: "1px solid var(--border)", flex: 1 }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "12px" }}>Responsabili & HR</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={LABEL_STYLE}>Responsabile</label>
                      <input
                        className="db-filter-select"
                        style={{ ...INPUT_STYLE, marginBottom: "6px" }}
                        placeholder="Cerca..."
                        value={editUserForm.responsabiliSearch}
                        onChange={(event) => setEditUserForm((prev) => (prev ? { ...prev, responsabiliSearch: event.target.value } : prev))}
                        disabled={editUserSaving}
                      />
                      <div style={{ maxHeight: "140px", overflowY: "auto", border: "1px solid var(--border)", borderRadius: "8px", background: "#fff" }}>
                        {filteredResponsabiliOptions.map((item) => (
                          <label key={item.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 10px", borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}>
                            <input type="checkbox" checked={editUserForm.responsabileIds.includes(item.id)} onChange={() => toggleManagerSelection("responsabileIds", item.id)} disabled={editUserSaving} />
                            <span style={{ fontSize: "12px", color: "var(--text-primary)" }}>{item.name}</span>
                          </label>
                        ))}
                        {filteredResponsabiliOptions.length === 0 && (
                          <div style={{ padding: "10px", color: "var(--text-muted)", fontSize: "12px", textAlign: "center" }}>Nessun risultato.</div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label style={LABEL_STYLE}>HR</label>
                      <input
                        className="db-filter-select"
                        style={{ ...INPUT_STYLE, marginBottom: "6px" }}
                        placeholder="Cerca..."
                        value={editUserForm.hrSearch}
                        onChange={(event) => setEditUserForm((prev) => (prev ? { ...prev, hrSearch: event.target.value } : prev))}
                        disabled={editUserSaving}
                      />
                      <div style={{ maxHeight: "140px", overflowY: "auto", border: "1px solid var(--border)", borderRadius: "8px", background: "#fff" }}>
                        {filteredHrOptions.map((item) => (
                          <label key={item.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 10px", borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}>
                            <input type="checkbox" checked={editUserForm.hrManagerIds.includes(item.id)} onChange={() => toggleManagerSelection("hrManagerIds", item.id)} disabled={editUserSaving} />
                            <span style={{ fontSize: "12px", color: "var(--text-primary)" }}>{item.name}</span>
                          </label>
                        ))}
                        {filteredHrOptions.length === 0 && (
                          <div style={{ padding: "10px", color: "var(--text-muted)", fontSize: "12px", textAlign: "center" }}>Nessun risultato.</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT — Posizione organizzativa */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

                <div style={{ background: "#f8fafc", borderRadius: "12px", padding: "16px", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "12px" }}>Posizione organizzativa</div>

                  {/* Role dropdown */}
                  <div style={{ marginBottom: "14px" }}>
                    <label style={LABEL_STYLE}>Ruolo *</label>
                    <select className="db-filter-select" style={INPUT_STYLE} value={editUserForm.roleId} onChange={(event) => setEditUserForm((prev) => (prev ? { ...prev, roleId: event.target.value } : prev))} disabled={editUserSaving}>
                      <option value="">— Seleziona ruolo —</option>
                      {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                    </select>
                  </div>

                  {/* Org unit tree */}
                  <div style={{ marginBottom: "14px" }}>
                    <label style={LABEL_STYLE}>Unità organizzativa (Reparto)</label>
                    <OrgUnitTreeSelector
                      nodes={orgNodes}
                      value={editUserForm.departmentId || null}
                      onChange={(id) => setEditUserForm((prev) => (prev ? { ...prev, departmentId: id ?? "" } : prev))}
                      placeholder="Seleziona reparto / unità organizzativa"
                      disabled={editUserSaving}
                    />
                  </div>

                  {/* Location */}
                  <div style={{ marginBottom: "10px" }}>
                    <label style={LABEL_STYLE}>Sede</label>
                    <select className="db-filter-select" style={INPUT_STYLE} value={editUserForm.locationId} onChange={(event) => setEditUserForm((prev) => (prev ? { ...prev, locationId: event.target.value } : prev))} disabled={editUserSaving}>
                      <option value="">— Nessuna —</option>
                      {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                    </select>
                  </div>

                  {/* Fixed location */}
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--border)", background: "#fff" }}>
                    <input type="checkbox" checked={editUserForm.fixedLocation} onChange={(event) => setEditUserForm((prev) => (prev ? { ...prev, fixedLocation: event.target.checked } : prev))} disabled={editUserSaving} />
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>Sede vincolante</div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>L'utente non può cambiare sede</div>
                    </div>
                  </label>
                </div>

                {/* Position Summary card */}
                <div style={{
                  borderRadius: "12px",
                  padding: "16px",
                  border: `1px solid ${positionComplete ? "rgba(232,81,26,0.25)" : "var(--border)"}`,
                  background: positionComplete ? "rgba(232,81,26,0.04)" : "#f8fafc",
                  transition: "border-color 0.2s, background 0.2s",
                }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: positionComplete ? "var(--brand)" : "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>{positionComplete ? "✓" : "○"}</span>
                    Riepilogo posizione
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                      <span style={{ fontSize: "16px", flexShrink: 0, marginTop: "1px" }}>🏷️</span>
                      <div>
                        <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>Ruolo</div>
                        <div style={{ fontSize: "14px", fontWeight: 700, color: selectedRole ? "var(--text-primary)" : "var(--text-muted)" }}>
                          {selectedRole?.name ?? "Non assegnato"}
                        </div>
                      </div>
                    </div>

                    <div style={{ height: "1px", background: "var(--border)" }} />

                    <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                      <span style={{ fontSize: "16px", flexShrink: 0, marginTop: "1px" }}>🌳</span>
                      <div>
                        <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>Unità organizzativa</div>
                        <div style={{ fontSize: "14px", fontWeight: 700, color: selectedDept ? "var(--text-primary)" : "var(--text-muted)" }}>
                          {selectedDept?.name ?? "Non assegnata"}
                        </div>
                      </div>
                    </div>

                    {selectedLoc && (
                      <>
                        <div style={{ height: "1px", background: "var(--border)" }} />
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                          <span style={{ fontSize: "16px", flexShrink: 0, marginTop: "1px" }}>📍</span>
                          <div>
                            <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>Sede</div>
                            <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>{selectedLoc.name}</div>
                          </div>
                        </div>
                      </>
                    )}

                    {positionComplete && (
                      <div style={{ marginTop: "4px", padding: "8px 12px", borderRadius: "8px", background: "rgba(232,81,26,0.08)", border: "1px solid rgba(232,81,26,0.18)", fontSize: "12px", color: "var(--brand)", fontWeight: 600 }}>
                        {selectedRole?.name} · {selectedDept?.name}{selectedLoc ? ` · ${selectedLoc.name}` : ""}
                      </div>
                    )}

                    {!positionComplete && (
                      <div style={{ padding: "8px 12px", borderRadius: "8px", background: "#f1f5f9", fontSize: "12px", color: "var(--text-muted)" }}>
                        Seleziona ruolo e unità organizzativa per completare la posizione.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {editUserError && (
              <div style={{ marginTop: "16px", padding: "12px 16px", border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", borderRadius: "10px", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>⚠️</span> {editUserError}
              </div>
            )}

            <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", gap: "8px" }}>
              <button className="db-btn db-btn-danger" onClick={() => handleDeleteUser(selectedUser.id)} disabled={editUserSaving}>Elimina utente</button>
              <div style={{ display: "flex", gap: "8px" }}>
                <button className="db-btn db-btn-outline" onClick={closeUserEditor} disabled={editUserSaving}>Annulla</button>
                <button className="db-btn" style={{ background: "var(--brand)", color: "white", border: "none" }} onClick={handleSaveUser} disabled={editUserSaving}>
                  {editUserSaving ? "Salvataggio..." : "Salva modifiche"}
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}
      </div>{/* end page content */}
    </div>
  );
};

export default AdminTestUsers;
