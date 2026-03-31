import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

interface SidebarProps {
  userData: any | null;
  isAdmin: boolean;
  availabilityStatus: "available" | "inactive" | null;
  onToggleAvailability: () => void;
  onLogout: () => void;
  activePath?: string;
}

const Sidebar: React.FC<SidebarProps> = ({
  userData,
  isAdmin,
  availabilityStatus,
  onToggleAvailability,
  onLogout,
  activePath = "/",
}) => {
  const navigate = useNavigate();
  const [adminOpen, setAdminOpen] = useState(false);

  const initials = userData?.full_name
    ? userData.full_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "U";

  const isActive = (path: string) => activePath === path;

  return (
    <aside className="db-sidebar">
      {/* Logo */}
      <div className="db-sidebar-logo">
        <div className="db-sidebar-logo-mark">
          <div className="db-sidebar-logo-icon">🔗</div>
          <div className="db-sidebar-logo-text">
            <div className="db-sidebar-logo-name">Job IXL</div>
            <div className="db-sidebar-logo-sub">Mobility Platform</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="db-sidebar-nav">
        <div className="db-section-label">Principale</div>

        <button
          className={`db-nav-item ${isActive("/") ? "active" : ""}`}
          onClick={() => navigate("/")}
          id="nav-dashboard"
        >
          <span className="db-nav-icon">🗺️</span>
          <span className="db-nav-label">Dashboard</span>
        </button>

        {isAdmin && (
          <>
            <div className="db-section-label" style={{ marginTop: "12px" }}>
              Amministrazione
            </div>

            <button
              className="db-nav-item"
              onClick={() => setAdminOpen((o) => !o)}
              id="nav-admin-toggle"
            >
              <span className="db-nav-icon">⚙️</span>
              <span className="db-nav-label">Area Admin</span>
              <span className={`db-nav-chevron ${adminOpen ? "open" : ""}`}>▶</span>
            </button>

            <div
              className="db-admin-submenu"
              style={{ maxHeight: adminOpen ? "300px" : "0" }}
            >
              <button
                className="db-admin-sub-item"
                onClick={() => navigate("/admin")}
                id="nav-admin-home"
              >
                Home Admin
              </button>
              <button
                className="db-admin-sub-item"
                onClick={() => navigate("/admin/candidatures")}
                id="nav-admin-candidatures"
              >
                Candidature
              </button>
              <button
                className="db-admin-sub-item"
                onClick={() => navigate("/admin/maps")}
                id="nav-admin-maps"
              >
                Mappe utenti
              </button>
              <button
                className="db-admin-sub-item"
                onClick={() => navigate("/admin/interlocking")}
                id="nav-admin-interlocking"
              >
                Interlocking
              </button>
              <button
                className="db-admin-sub-item"
                onClick={() => navigate("/admin/test-users")}
                id="nav-admin-config"
              >
                Configurazione
              </button>
            </div>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="db-sidebar-footer">
        {/* Availability toggle */}
        <button
          className="db-sidebar-availability"
          onClick={onToggleAvailability}
          id="sidebar-availability-toggle"
          title={
            availabilityStatus === "available"
              ? "Clicca per disattivarti"
              : "Clicca per attivarti"
          }
        >
          <div
            className={`db-avail-dot ${
              availabilityStatus === "available" ? "available" : "inactive"
            }`}
          />
          <span
            className={`db-avail-text ${
              availabilityStatus === "available" ? "available" : ""
            }`}
          >
            {availabilityStatus === "available" ? "Disponibile" : "Non disponibile"}
          </span>
        </button>

        {/* User box */}
        <div className="db-user-box">
          <div className="db-user-avatar">{initials}</div>
          <div className="db-user-info">
            <div className="db-user-name">
              {userData?.full_name ?? "Utente"}
            </div>
            <div className="db-user-role">{userData?.email ?? ""}</div>
          </div>
        </div>

        {/* Logout */}
        <button
          className="db-logout-btn"
          onClick={onLogout}
          id="sidebar-logout-btn"
        >
          <span style={{ fontSize: "14px" }}>↩</span>
          Esci
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
