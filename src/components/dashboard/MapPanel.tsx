import React from "react";
import PositionsMap from "../PositionsMap";
import type { MapLocation } from "../PositionsMap";
import type { MapFilters } from "./FiltersCard";

interface MapPanelProps {
  highlightPositionId?: string;
  filters: MapFilters;
  onLocationsLoaded: (locations: MapLocation[]) => void;
  onApplicationUpdate?: () => void;
  onCampaignStatusLoaded?: (status: "open" | "closed") => void;
  isAdmin?: boolean;
}

const MapPanel: React.FC<MapPanelProps> = ({
  highlightPositionId,
  filters,
  onLocationsLoaded,
  onApplicationUpdate,
  onCampaignStatusLoaded,
  isAdmin,
}) => {
  return (
    <div className="db-card db-map-panel">
      {/* Card header */}
      <div className="db-card-header">
        <div>
          <div className="db-card-title">Mappa delle posizioni</div>
        </div>
        <div className="db-map-legend">
          <div className="db-map-legend-item">
            <div className="db-map-legend-dot" style={{ background: "#22c55e" }} />
            Disponibile
          </div>
          <div className="db-map-legend-item">
            <div className="db-map-legend-dot" style={{ background: "#ef4444" }} />
            Candidato
          </div>
          <div className="db-map-legend-item">
            <div className="db-map-legend-dot" style={{ background: "#eab308" }} />
            Parziale
          </div>
          <div className="db-map-legend-item">
            <div className="db-map-legend-dot" style={{ background: "#6b7280" }} />
            Inattivo
          </div>
        </div>
      </div>

      {/* Map container */}
      <div className="db-map-container">
        <div className="db-map-inner">
          <PositionsMap
            interaction="write"
            highlightPositionId={highlightPositionId}
            filterLocationName={filters.locationName || undefined}
            filterRoleName={filters.roleName || undefined}
            filterOnlyNonFixed={filters.onlyNonFixed ?? false}
            onLocationsLoaded={onLocationsLoaded}
            onApplicationUpdate={onApplicationUpdate}
            onCampaignStatusLoaded={onCampaignStatusLoaded}
            isAdmin={isAdmin}
          />
        </div>
      </div>
    </div>
  );
};

export default MapPanel;
