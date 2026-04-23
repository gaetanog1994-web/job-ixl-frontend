import React from "react";
import type { MapLocation } from "../PositionsMap";
import type { DepartmentOption } from "../../lib/appApi";

export interface MapFilters {
  locationName: string; // sede → fly to + open popup
  roleName: string;     // ruolo → highlight matching markers
  departmentId: string; // reparto → highlight matching markers
  onlyNonFixed?: boolean; // hide/dim fixed-location roles
}

interface FiltersCardProps {
  filters: MapFilters;
  onFiltersChange: (f: MapFilters) => void;
  mapLocations: MapLocation[];
  departments: DepartmentOption[];
}

const FiltersCard: React.FC<FiltersCardProps> = ({
  filters,
  onFiltersChange,
  mapLocations,
  departments,
}) => {
  // Unique location names from map data
  const locationNames = Array.from(
    new Set(mapLocations.map((l) => l.name).filter(Boolean))
  ).sort();

  // Unique role names from all location roles
  const roleNames = Array.from(
    new Set(
      mapLocations.flatMap((l) => l.roles.map((r) => r.role_name)).filter(Boolean)
    )
  ).sort();

  const hasActiveFilters = filters.locationName !== "" || filters.roleName !== "" || filters.departmentId !== "" || !!filters.onlyNonFixed;

  const reset = () => onFiltersChange({ locationName: "", roleName: "", departmentId: "", onlyNonFixed: false });

  return (
    <div className="db-card db-filters-card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="db-card-title">Filtri Mappa</span>
        {hasActiveFilters && (
          <span
            style={{
              fontSize: "10px",
              fontWeight: 700,
              color: "var(--brand)",
              background: "var(--brand-light)",
              padding: "2px 7px",
              borderRadius: "10px",
            }}
          >
            ATTIVI
          </span>
        )}
      </div>

      {/* Sede filter → fly to + popup */}
      <div className="db-filter-group">
        <label className="db-filter-label" htmlFor="filter-location">
          📍 Cerca sede
        </label>
        <select
          id="filter-location"
          className="db-filter-select"
          value={filters.locationName}
          onChange={(e) =>
            onFiltersChange({ ...filters, locationName: e.target.value })
          }
        >
          <option value="">Tutte le sedi</option>
          {locationNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        {filters.locationName && (
          <div
            style={{
              fontSize: "11px",
              color: "var(--available-color)",
              marginTop: "4px",
              fontWeight: 500,
            }}
          >
            ✓ La mappa zoomerà su "{filters.locationName}"
          </div>
        )}
      </div>

      {/* Ruolo filter → highlight markers */}
      <div className="db-filter-group">
        <label className="db-filter-label" htmlFor="filter-role">
          🎯 Filtra per ruolo
        </label>
        <select
          id="filter-role"
          className="db-filter-select"
          value={filters.roleName}
          onChange={(e) =>
            onFiltersChange({ ...filters, roleName: e.target.value })
          }
        >
          <option value="">Tutti i ruoli</option>
          {roleNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        {filters.roleName && (
          <div
            style={{
              fontSize: "11px",
              color: "#2563eb",
              marginTop: "4px",
              fontWeight: 500,
            }}
          >
            ✓ Sedi con "{filters.roleName}" evidenziate
          </div>
        )}
      </div>

      {/* Department filter → highlight markers */}
      <div className="db-filter-group">
        <label className="db-filter-label" htmlFor="filter-department">
          🧩 Filtra per reparto
        </label>
        <select
          id="filter-department"
          className="db-filter-select"
          value={filters.departmentId}
          onChange={(e) =>
            onFiltersChange({ ...filters, departmentId: e.target.value })
          }
        >
          <option value="">Tutti i reparti</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
        {filters.departmentId && (
          <div
            style={{
              fontSize: "11px",
              color: "#2563eb",
              marginTop: "4px",
              fontWeight: 500,
            }}
          >
            ✓ Sedi con reparto selezionato evidenziate
          </div>
        )}
      </div>

      {/* onlyNonFixed filter */}
      <div className="db-filter-group">
        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px" }}>
          <input
            type="checkbox"
            checked={filters.onlyNonFixed ?? false}
            onChange={(e) => onFiltersChange({ ...filters, onlyNonFixed: e.target.checked })}
            style={{ width: 15, height: 15, cursor: "pointer" }}
          />
          <span>Solo posizioni non vincolanti</span>
        </label>
      </div>

      {/* Reset */}
      {hasActiveFilters && (
        <button className="db-filter-reset" onClick={reset} id="filter-reset-btn">
          ↺ Azzera filtri mappa
        </button>
      )}

      {mapLocations.length === 0 && (
        <div
          style={{
            marginTop: "14px",
            fontSize: "12px",
            color: "var(--text-muted)",
            textAlign: "center",
            padding: "8px",
          }}
        >
          In attesa dei dati mappa…
        </div>
      )}
    </div>
  );
};

export default FiltersCard;
