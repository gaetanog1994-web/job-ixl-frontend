import React, { useMemo, useState } from "react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { appApi } from "../../lib/appApi";

/* ---------- types ---------- */

export type AggregatedRow = {
  key: string;
  roleName: string;
  locationName: string;
  fixedLocation: boolean;
  priority: number;
  createdAt: string;
  representativePositionId: string;
  appIds: string[];
  positionIds: string[];
};

/* ---------- SortableRow ---------- */

const SortableRow: React.FC<{ id: string; children: React.ReactNode }> = ({
  id,
  children,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <tr ref={setNodeRef} style={style}>
      <td style={{ width: 36 }}>
        <div className="db-drag-handle" {...attributes} {...listeners}>
          ⠿
        </div>
      </td>
      {children}
    </tr>
  );
};

/* ---------- helpers ---------- */

const formatDate = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("it-IT") +
    " " +
    d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
  );
};

/* ---------- props ---------- */

interface MyApplicationsPanelProps {
  userData: any | null;
  myApplications: any[];
  maxApplications: number;
  onApplicationsChange: (apps: any[]) => void;
  onHighlightPosition: (positionId: string) => void;
}

/* ---------- component ---------- */

const MyApplicationsPanel: React.FC<MyApplicationsPanelProps> = ({
  userData,
  myApplications,
  maxApplications,
  onApplicationsChange,
  onHighlightPosition,
}) => {
  const [search, setSearch] = useState("");

  /* ----- aggregation (same logic as AccountPage) ----- */
  const aggregatedApplications: AggregatedRow[] = useMemo(() => {
    const map = new Map<string, AggregatedRow>();

    for (const app of myApplications) {
      const position = Array.isArray(app.positions)
        ? app.positions[0]
        : app.positions;
      const occupant = position?.users;
      const locObj = Array.isArray(occupant?.locations)
        ? occupant.locations?.[0]
        : occupant?.locations;

      const roleName = occupant?.roles?.name ?? "—";
      const locationName = locObj?.name ?? "—";
      const key = `${locationName}__${roleName}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          roleName,
          locationName,
          fixedLocation: !!occupant?.fixed_location,
          priority: app.priority,
          createdAt: app.created_at,
          representativePositionId: app.position_id,
          appIds: [app.id],
          positionIds: [app.position_id],
        });
      } else {
        const row = map.get(key)!;
        row.appIds.push(app.id);
        row.positionIds.push(app.position_id);
        row.fixedLocation = row.fixedLocation || !!occupant?.fixed_location;
        if (new Date(app.created_at) < new Date(row.createdAt)) {
          row.createdAt = app.created_at;
          row.representativePositionId = app.position_id;
        }
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => (a.priority ?? 999) - (b.priority ?? 999)
    );
  }, [myApplications]);

  /* ----- internal search filter ----- */
  const filteredRows = useMemo(() => {
    if (!search.trim()) return aggregatedApplications;
    const q = search.toLowerCase();
    return aggregatedApplications.filter(
      (r) =>
        r.roleName.toLowerCase().includes(q) ||
        r.locationName.toLowerCase().includes(q)
    );
  }, [aggregatedApplications, search]);

  /* ----- priority helpers ----- */
  const usedPriorities = aggregatedApplications.map((a) => a.priority);

  const getAvailablePriorities = (current?: number) => {
    const all = Array.from({ length: maxApplications }, (_, i) => i + 1);
    return all.filter((p) => p === current || !usedPriorities.includes(p));
  };

  /* ----- update priority ----- */
  const updatePriority = async (groupKey: string, newPriority: number) => {
    const group = aggregatedApplications.find((g) => g.key === groupKey);
    if (!group || !userData) return;
    try {
      await appApi.reorderUserApplications({
        userId: userData.id,
        updates: [{ app_ids: group.appIds, priority: newPriority }],
      });
      onApplicationsChange(
        myApplications.map((a) =>
          group.appIds.includes(a.id) ? { ...a, priority: newPriority } : a
        )
      );
    } catch (e: any) {
      console.error("[MyApplicationsPanel] updatePriority error:", e?.message ?? e);
    }
  };

  /* ----- delete ----- */
  const deleteApplication = async (groupKey: string) => {
    const group = aggregatedApplications.find((g) => g.key === groupKey);
    if (!group || !userData) return;
    const confirm = window.confirm("Sei sicuro di voler eliminare questa candidatura?");
    if (!confirm) return;
    try {
      await appApi.withdrawFromPositionsBulk({
        userId: userData.id,
        positionIds: group.positionIds,
      });
      onApplicationsChange(myApplications.filter((a) => !group.appIds.includes(a.id)));
    } catch (e: any) {
      console.error("[MyApplicationsPanel] withdrawFromPositionsBulk error:", e?.message ?? e);
    }
  };

  /* ----- drag & drop ----- */
  const handleDragEnd = async (event: DragEndEvent) => {
    if (!userData) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = aggregatedApplications.findIndex((a) => a.key === active.id);
    const newIndex = aggregatedApplications.findIndex((a) => a.key === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...aggregatedApplications];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    const groupPriority = new Map<string, number>();
    reordered.forEach((g, idx) => groupPriority.set(g.key, idx + 1));

    const updatedApps = myApplications.map((app) => {
      const position = Array.isArray(app.positions) ? app.positions[0] : app.positions;
      const occupant = position?.users;
      const locObj = Array.isArray(occupant?.locations) ? occupant.locations?.[0] : occupant?.locations;
      const roleName = occupant?.roles?.name ?? "—";
      const locationName = locObj?.name ?? "—";
      const key = `${locationName}__${roleName}`;
      const newP = groupPriority.get(key);
      return newP != null ? { ...app, priority: newP } : app;
    });
    onApplicationsChange(updatedApps);

    const payload = reordered.map((group) => ({
      app_ids: group.appIds,
      priority: groupPriority.get(group.key)!,
    }));

    try {
      await appApi.reorderUserApplications({ userId: userData.id, updates: payload });
    } catch (e: any) {
      console.error("[MyApplicationsPanel] reorderUserApplications error:", e?.message ?? e);
    }
  };

  /* ----- render ----- */
  return (
    <div className="db-card db-apps-panel db-fade-in">
      {/* Header */}
      <div className="db-apps-header">
        <div className="db-apps-title-group">
          <div className="db-apps-title">Le mie candidature</div>
          <div className="db-apps-subtitle">
            {aggregatedApplications.length > 0
              ? `${aggregatedApplications.length} candidatur${aggregatedApplications.length === 1 ? "a" : "e"} attiv${aggregatedApplications.length === 1 ? "a" : "e"}`
              : "Nessuna candidatura attiva"}
          </div>
        </div>

        {/* Internal search bar */}
        {aggregatedApplications.length > 0 && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "10px",
            padding: "0 12px",
            height: "34px",
            minWidth: "220px",
          }}>
            <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>🔍</span>
            <input
              id="apps-panel-search"
              type="text"
              placeholder="Cerca ruolo o sede…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                border: "none",
                background: "transparent",
                outline: "none",
                fontSize: "13px",
                fontFamily: "var(--font)",
                color: "var(--text-primary)",
                flex: 1,
              }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  fontSize: "13px",
                  padding: 0,
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            )}
          </div>
        )}

        {aggregatedApplications.length > 0 && (
          <span style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic", flexShrink: 0 }}>
            Trascina per riordinare
          </span>
        )}
      </div>

      {/* Table */}
      {aggregatedApplications.length === 0 ? (
        <div className="db-empty-state">
          <div className="db-empty-state-icon">📋</div>
          <div className="db-empty-state-title">Nessuna candidatura attiva</div>
          <div className="db-empty-state-desc">
            Esplora la mappa, clicca su una sede e candidati alle posizioni disponibili.
          </div>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="db-empty-state">
          <div className="db-empty-state-icon">🔍</div>
          <div className="db-empty-state-title">Nessun risultato</div>
          <div className="db-empty-state-desc">
            Nessuna candidatura corrisponde a "{search}".
          </div>
        </div>
      ) : (
        <div className="db-apps-table-wrap">
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={aggregatedApplications.map((a) => a.key)}
              strategy={verticalListSortingStrategy}
            >
              <table className="db-apps-table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }} />
                    <th style={{ width: 50 }}>#</th>
                    <th>Ruolo</th>
                    <th>Sede</th>
                    <th>Vincolante</th>
                    <th>Priorità</th>
                    <th>Data</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, index) => (
                    <SortableRow key={row.key} id={row.key}>
                      <td>
                        <div className="db-priority-badge">{index + 1}</div>
                      </td>
                      <td>
                        <div className="db-cell-primary">{row.roleName}</div>
                      </td>
                      <td>
                        <div className="db-cell-primary">{row.locationName}</div>
                      </td>
                      <td>
                        <span className={`db-fixed-badge ${row.fixedLocation ? "yes" : "no"}`}>
                          {row.fixedLocation ? "Vincolante" : "Flex"}
                        </span>
                      </td>
                      <td>
                        <select
                          className="db-priority-select"
                          value={row.priority}
                          onChange={(e) => updatePriority(row.key, Number(e.target.value))}
                          id={`priority-select-${row.key}`}
                        >
                          {getAvailablePriorities(row.priority).map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <span style={{ color: "var(--text-secondary)", fontSize: "12px" }}>
                          {formatDate(row.createdAt)}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "4px" }}>
                          <button
                            className="db-action-btn db-action-btn-map"
                            title="Mostra sulla mappa"
                            onClick={() => onHighlightPosition(row.representativePositionId)}
                            id={`btn-map-${row.key}`}
                          >
                            🗺
                          </button>
                          <button
                            className="db-action-btn db-action-btn-delete"
                            title="Elimina candidatura"
                            onClick={() => deleteApplication(row.key)}
                            id={`btn-delete-${row.key}`}
                          >
                            Elimina
                          </button>
                        </div>
                      </td>
                    </SortableRow>
                  ))}
                </tbody>
              </table>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
};

export default MyApplicationsPanel;
