import React from "react";

interface UserStatsCardProps {
  applicationsCount: number;
  maxApplications: number;
  userState: "available" | "reserved" | "inactive" | null;
  locationsCount?: number;
  roleName?: string | null;
  departmentName?: string | null;
}

const UserStatsCard: React.FC<UserStatsCardProps> = ({
  applicationsCount,
  maxApplications,
  userState,
  locationsCount,
  roleName,
  departmentName,
}) => {
  const pct =
    maxApplications > 0
      ? Math.round((applicationsCount / maxApplications) * 100)
      : 0;

  const isFull = applicationsCount >= maxApplications;

  return (
    <div className="db-card db-stats-card">
      <div className="db-card-title">Il mio profilo</div>

      <div className="db-stat-item" style={{ marginBottom: "8px" }}>
        <div className="db-stat-label">Posizione</div>
        <div className="db-cell-primary" style={{ marginTop: "4px" }}>
          {roleName
            ? departmentName
              ? `${roleName} — ${departmentName}`
              : roleName
            : "—"}
        </div>
      </div>

      <div className="db-stat-rows">
        {/* Applications count */}
        <div className="db-stat-item">
          <div className="db-stat-label">Candidature</div>
          <div className="db-stat-value-row">
            <span className="db-stat-value">{applicationsCount}/{maxApplications}</span>
          </div>
          <div className="db-progress-bar">
            <div
              className={`db-progress-fill ${isFull ? "full" : ""}`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <div className="db-stat-sub">
            {isFull
              ? "⚠️ Limite raggiunto"
              : `${maxApplications - applicationsCount} slot disponibil${maxApplications - applicationsCount === 1 ? "e" : "i"}`}
          </div>
        </div>

        {/* Availability status */}
        <div className="db-stat-item">
          <div className="db-stat-label">Disponibilità</div>
          <div style={{ marginTop: "4px" }}>
            {userState === null ? (
              <span className="db-status-badge inactive">
                <span className="db-status-dot" />
                Caricamento…
              </span>
            ) : userState === "available" ? (
              <span className="db-status-badge available">
                <span className="db-status-dot" />
                Disponibile
              </span>
            ) : userState === "reserved" ? (
              <span className="db-status-badge inactive">
                <span className="db-status-dot" />
                Prenotato
              </span>
            ) : (
              <span className="db-status-badge inactive">
                <span className="db-status-dot" />
                Non disponibile
              </span>
            )}
          </div>
          <div className="db-stat-sub" style={{ marginTop: "6px" }}>
            {userState === "available"
              ? "Sei visibile per la mobilità"
              : userState === "reserved"
                ? "Prenotazione registrata per la prossima campagna"
                : "Non sei visibile per la mobilità"}
          </div>
        </div>

        {/* Locations visible */}
        {locationsCount !== undefined && (
          <div className="db-stat-item">
            <div className="db-stat-label">Sedi disponibili</div>
            <div className="db-stat-value-row">
              <span className="db-stat-value">{locationsCount}</span>
            </div>
            <div className="db-stat-sub">sedi sulla mappa</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserStatsCard;
