import React from "react";

interface UserStatsCardProps {
  applicationsCount: number;
  maxApplications: number;
  availabilityStatus: "available" | "inactive" | null;
  locationsCount?: number;
}

const UserStatsCard: React.FC<UserStatsCardProps> = ({
  applicationsCount,
  maxApplications,
  availabilityStatus,
  locationsCount,
}) => {
  const pct =
    maxApplications > 0
      ? Math.round((applicationsCount / maxApplications) * 100)
      : 0;

  const isFull = applicationsCount >= maxApplications;

  return (
    <div className="db-card db-stats-card">
      <div className="db-card-title">Il mio profilo</div>

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
            {availabilityStatus === null ? (
              <span className="db-status-badge inactive">
                <span className="db-status-dot" />
                Caricamento…
              </span>
            ) : availabilityStatus === "available" ? (
              <span className="db-status-badge available">
                <span className="db-status-dot" />
                Disponibile
              </span>
            ) : (
              <span className="db-status-badge inactive">
                <span className="db-status-dot" />
                Non disponibile
              </span>
            )}
          </div>
          <div className="db-stat-sub" style={{ marginTop: "6px" }}>
            {availabilityStatus === "available"
              ? "Sei visibile per la mobilità"
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
