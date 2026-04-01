import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../lib/AuthContext";
import { useNavigate } from "react-router-dom";

import { DndContext, closestCenter } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { appApi } from "../lib/appApi";

// 2️⃣ COMPONENTE DI SUPPORTO
const SortableRow: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <tr ref={setNodeRef} style={style}>
            <td
                {...attributes}
                {...listeners}
                style={{
                    cursor: "grab",
                    width: 30,
                    textAlign: "center",
                    userSelect: "none",
                }}
            >
                ☰
            </td>
            {children}
        </tr>
    );
};

type AggregatedRow = {
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

const AccountPage: React.FC = () => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();

    const [userData, setUserData] = useState<any>(null);
    const [myApplications, setMyApplications] = useState<any[]>([]);
    const [maxApplications, setMaxApplications] = useState<number>(10); // fallback safe

    const aggregatedApplications: AggregatedRow[] = useMemo(() => {
        const map = new Map<string, AggregatedRow>();

        for (const app of myApplications) {
            const position = Array.isArray(app.positions) ? app.positions[0] : app.positions;
            const occupant = position?.users;

            // backend route che ti ho proposto ritorna locations come oggetto {name}, non array.
            // ma teniamo compatibilità col vecchio shape.
            const locObj = Array.isArray(occupant?.locations) ? occupant.locations?.[0] : occupant?.locations;

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

        return Array.from(map.values()).sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
    }, [myApplications]);

    // LOAD (FE→BE)
    useEffect(() => {
        if (!user) {
            setUserData(null);
            setMyApplications([]);
            return;
        }

        let cancelled = false;

        const load = async () => {
            try {
                const me = await appApi.getMyUser();
                if (cancelled) return;
                setUserData(me);

                try {
                    const cfg = await appApi.getConfig();
                    if (!cancelled && cfg?.maxApplications != null) {
                        setMaxApplications(cfg.maxApplications);
                    }
                } catch {
                    // ignore
                }

                const apps = await appApi.getMyApplications();
                if (cancelled) return;
                setMyApplications(apps ?? []);
            } catch (e: any) {
                console.error("[AccountPage] load error:", e?.message ?? e);
                if (cancelled) return;
                setUserData(null);
                setMyApplications([]);
            }
        };

        load();

        return () => {
            cancelled = true;
        };
    }, [user]);

    /* ===== PRIORITY ===== */

    const usedPriorities = aggregatedApplications.map((a) => a.priority);

    const getAvailablePriorities = (current?: number) => {
        const all = Array.from({ length: maxApplications }, (_, i) => i + 1);
        return all.filter((p) => p === current || !usedPriorities.includes(p));
    };

    const updatePriority = async (groupKey: string, newPriority: number) => {
        const group = aggregatedApplications.find((g) => g.key === groupKey);
        if (!group || !user) return;

        try {
            await appApi.reorderUserApplications({
                userId: user.id,
                updates: [{ app_ids: group.appIds, priority: newPriority }],
            });

            setMyApplications((prev) =>
                prev.map((a) => (group.appIds.includes(a.id) ? { ...a, priority: newPriority } : a))
            );
        } catch (e: any) {
            console.error("[AccountPage] updatePriority via backend error:", e?.message ?? e);
        }
    };

    /* ===== DELETE APPLICATION ===== */

    const deleteApplication = async (groupKey: string) => {
        const group = aggregatedApplications.find((g) => g.key === groupKey);
        if (!group || !user) return;

        const confirm = window.confirm("Sei sicuro di voler eliminare questa candidatura?");
        if (!confirm) return;

        try {
            await appApi.withdrawFromPositionsBulk({
                userId: user.id,
                positionIds: group.positionIds,
            });
            setMyApplications((prev) => prev.filter((a) => !group.appIds.includes(a.id)));
        } catch (e: any) {
            console.error("[AccountPage] withdrawFromPositionsBulk error:", e?.message ?? e);
        }
    };

    /* ===== AVAILABILITY ===== */

    const toggleAvailability = async () => {
        if (!userData) return;

        if (userData.availability_status === "available") {
            try {
                await appApi.deactivateMe();
                setUserData({ ...userData, availability_status: "inactive" });
                setMyApplications([]);
            } catch (e: any) {
                console.error("[AccountPage] deactivateMe error:", e?.message ?? e);
            }
            return;
        }

        try {
            await appApi.activateMe();
            setUserData({ ...userData, availability_status: "available" });
        } catch (e: any) {
            console.error("[AccountPage] activateMe error:", e?.message ?? e);
        }
    };

    /* ===== NAVIGATION TO DASHBOARD ===== */

    const goToDashboardPosition = (positionId?: string) => {
        if (!positionId) return;

        navigate({
            pathname: "/",
            search: `?highlightPositionId=${encodeURIComponent(positionId)}`,
        });
    };

    const formatDateTime = (iso?: string) => {
        if (!iso) return "—";
        const d = new Date(iso);
        return d.toLocaleDateString("it-IT") + " " + d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    };

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

        // optimistic FE
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

        setMyApplications(updatedApps);

        const payload: { app_ids: string[]; priority: number }[] = reordered.map((group) => {
            const prio = groupPriority.get(group.key);
            if (prio == null) throw new Error(`Priorità mancante per groupKey=${group.key}`);
            return { app_ids: group.appIds, priority: prio };
        });

        try {
            await appApi.reorderUserApplications({
                userId: userData.id,
                updates: payload,
            });
        } catch (e: any) {
            console.error("[AccountPage] reorderUserApplications error:", e?.message ?? e);
        }
    };

    /* ===== RENDER ===== */

    if (loading) return <p style={{ padding: "20px" }}>Caricamento...</p>;
    if (!userData) return <p style={{ padding: "20px" }}>Utente non trovato</p>;

    return (
        <div style={{ padding: "20px", paddingTop: "90px" }}>
            <h2>Area Utente</h2>

            <p>
                <b>Nome:</b> {userData.full_name ?? "—"}
            </p>
            <p>
                <b>Email:</b> {userData.email ?? "—"}
            </p>
            <p>
                <b>Disponibilità:</b> {userData.availability_status === "available" ? "Attivo" : "Inattivo"}
            </p>

            <button onClick={toggleAvailability}>
                {userData.availability_status === "available" ? "Renditi inattivo" : "Renditi attivo"}
            </button>

            <hr />

            <h3>Le mie candidature</h3>

            {myApplications.length === 0 ? (
                <p>Nessuna candidatura</p>
            ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr>
                            <th></th>
                            <th></th>
                            <th>#</th>
                            <th align="left">Da</th>
                            <th align="left">Ruolo</th>
                            <th align="left">Sede</th>
                            <th align="left">Vincolante</th>
                            <th align="left">Priorità</th>
                            <th align="left">Data candidatura</th>
                            <th align="left">Azioni</th>
                        </tr>
                    </thead>

                    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={aggregatedApplications.map((a) => a.key)} strategy={verticalListSortingStrategy}>
                            <tbody>
                                {aggregatedApplications.map((row, index) => (
                                    <SortableRow key={row.key} id={row.key}>
                                        <td>
                                            <button
                                                type="button"
                                                title="Vai alla posizione in dashboard"
                                                onClick={() => goToDashboardPosition(row.representativePositionId)}
                                                style={{
                                                    background: "transparent",
                                                    border: "none",
                                                    cursor: "pointer",
                                                    fontSize: "16px",
                                                }}
                                            >
                                                🌍
                                            </button>
                                        </td>

                                        <td>{index + 1}</td>
                                        <td>{userData.full_name}</td>
                                        <td>{row.roleName}</td>
                                        <td>{row.locationName}</td>
                                        <td>{row.fixedLocation ? "SÌ" : "NO"}</td>

                                        <td>
                                            <select value={row.priority} onChange={(e) => updatePriority(row.key, Number(e.target.value))}>
                                                {getAvailablePriorities(row.priority).map((p) => (
                                                    <option key={p} value={p}>
                                                        {p}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>

                                        <td>{formatDateTime(row.createdAt)}</td>

                                        <td>
                                            <button onClick={() => deleteApplication(row.key)} style={{ color: "red" }}>
                                                Elimina
                                            </button>
                                        </td>
                                    </SortableRow>
                                ))}
                            </tbody>
                        </SortableContext>
                    </DndContext>
                </table>
            )}
        </div>
    );
};

export default AccountPage;
