import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import {
    MapContainer,
    TileLayer,
    Marker,
    CircleMarker,
    Popup,
    Circle,
    useMap,
} from "react-leaflet";
import React from "react";
import { appApi } from "../lib/appApi";

/* ---------- ICONE ---------- */

const iconBase =
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/";

const icons = {
    green: new L.Icon({
        iconUrl: iconBase + "marker-icon-green.png",
        shadowUrl: iconBase + "marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
    }),
    red: new L.Icon({
        iconUrl: iconBase + "marker-icon-red.png",
        shadowUrl: iconBase + "marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
    }),
    yellow: new L.Icon({
        iconUrl: iconBase + "marker-icon-yellow.png",
        shadowUrl: iconBase + "marker-shadow.png",
        iconSize: [25, 41],
        iconIconSize: [25, 41],
        iconAnchor: [12, 41],
    } as any),
    grey: new L.Icon({
        iconUrl: iconBase + "marker-icon-grey.png",
        shadowUrl: iconBase + "marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
    }),
};

const meIndicatorIcon = L.divIcon({
    className: "me-location-indicator",
    html: `
        <div style="
            width: 14px;
            height: 14px;
            border-radius: 999px;
            background: #2563EB;
            border: 2px solid #FFFFFF;
            box-shadow: 0 1px 4px rgba(0,0,0,0.25);
            transform: translate(8px, -8px);
        "></div>
    `,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
});

/* ---------- TYPES ---------- */

type LocationUser = {
    id: string; // user_id
    full_name: string;
    position_id: string; // posizione occupata da questo utente
};

type LocationRole = {
    role_id: string;
    role_name: string;
    users: LocationUser[];
    applied: boolean;
    priority?: number;
};

type MeLocation = {
    latitude: number;
    longitude: number;
};

export type MapLocation = {
    location_id: string;
    name: string;
    latitude: number;
    longitude: number;
    roles: LocationRole[];
};

type Props = {
    viewerUserId?: string;
    mode?: "from" | "to";
    interaction?: "read" | "write";
    visualMode?: "default" | "adminActiveMaps";
    suppressAutoFocusOnHighlight?: boolean;
    highlightPositionId?: string;
    /** Fly to this location name and open its popup */
    filterLocationName?: string;
    /** Highlight all markers that have at least one role matching this name */
    filterRoleName?: string;
    /** Called once after each data load with the full location list */
    onLocationsLoaded?: (locations: MapLocation[]) => void;
    /** Called whenever the user successfully applies or withdraws from a role */
    onApplicationUpdate?: () => void;
};

/* ---------- COMPONENT ---------- */

const PositionsMap = ({
    viewerUserId,
    mode = "from",
    interaction = "write",
    visualMode = "default",
    suppressAutoFocusOnHighlight = false,
    highlightPositionId,
    filterLocationName,
    filterRoleName,
    onLocationsLoaded,
    onApplicationUpdate,
}: Props) => {
    useEffect(() => {
        console.log("[DEBUG] highlightPositionId =", highlightPositionId);
    }, [highlightPositionId]);

    const [locations, setLocations] = useState<MapLocation[]>([]);
    const [myUserId, setMyUserId] = useState<string | null>(null);
    const [myStatus, setMyStatus] = useState<"available" | "inactive" | null>(null);
    const [meLocation, setMeLocation] = useState<MeLocation | null>(null);

    const [maxApplications, setMaxApplications] = useState<number | null>(null);
    const [usedPriorities, setUsedPriorities] = useState<number[]>([]);
    const [selectedPriorities, setSelectedPriorities] = useState<Record<string, number>>(
        {}
    );

    const locationMarkerRefs = useRef<Record<string, any>>({});
    const [highlightLocationId, setHighlightLocationId] = useState<string | null>(null);
    const consumedHighlightRef = useRef<string | null>(null);
    const autoMoveRef = useRef(false);

    const ALL_PRIORITIES = maxApplications
        ? Array.from({ length: maxApplications }, (_, i) => i + 1)
        : [];

    const availablePriorities = ALL_PRIORITIES.filter((p) => !usedPriorities.includes(p));

    // Mantieni consistenza: se cambia maxApplications o usedPriorities, pulisci scelte non più valide
    useEffect(() => {
        setSelectedPriorities((prev) => {
            const next: Record<string, number> = {};
            for (const [roleId, prio] of Object.entries(prev)) {
                if (availablePriorities.includes(prio)) next[roleId] = prio;
            }
            return next;
        });
    }, [availablePriorities.join(",")]);

    /* ---------- BOOT ---------- */

    const bootSeq = useRef(0);

    const boot = async () => {
        const seq = ++bootSeq.current;

        try {
            const payload = await appApi.getPositionsMapPayload({ viewerUserId, mode });
            if (seq !== bootSeq.current) return;

            setMyUserId(payload.viewerUserId);
            setMyStatus(payload.myStatus);
            setMeLocation(payload.meLocation);
            setMaxApplications(payload.maxApplications);
            setUsedPriorities(payload.usedPriorities);
            setLocations(payload.locations);
            onLocationsLoaded?.(payload.locations ?? []);
        } catch (e: any) {
            if (seq !== bootSeq.current) return;
            console.error("[PositionsMap] boot() via backend failed:", e?.message ?? e);
            setLocations([]);
            setMeLocation(null);
        }
    };

    useEffect(() => {
        boot();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewerUserId, mode, interaction]);

    useEffect(() => {
        const t = setInterval(() => {
            boot();
        }, 10_000); // 10s (puoi mettere 5s se vuoi più reattività)

        return () => clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewerUserId, mode, interaction]);

    /* ---------- APPLY / WITHDRAW (WRITE MODE ONLY) ---------- */

    const handleApplyToRole = async (role: LocationRole) => {
        if (!myUserId || myStatus !== "available") return;

        const priority = selectedPriorities[role.role_id];
        if (priority == null) return;

        try {
            await appApi.applyToPositionsBulk({
                userId: myUserId,
                positionIds: role.users.map((u) => u.position_id),
                priority,
            });
        } catch (e: any) {
            console.error("Apply role error:", e?.message ?? e);
            return;
        }

        setSelectedPriorities((prev) => {
            const copy = { ...prev };
            delete copy[role.role_id];
            return copy;
        });

        boot();
        onApplicationUpdate?.();
    };

    const handleWithdrawFromRole = async (role: LocationRole) => {
        if (!myUserId) return;

        const positionIds = role.users.map((u) => u.position_id);

        try {
            await appApi.withdrawFromPositionsBulk({
                userId: myUserId,
                positionIds,
            });
        } catch (e: any) {
            console.error("Withdraw role error:", e?.message ?? e);
            return;
        }

        boot();
        onApplicationUpdate?.();
    };

    /* ---------- HELPERS ---------- */

    const getLocationMarkerState = (roles: LocationRole[]) => {
        if (myStatus === "inactive") return "inactive" as const;

        const hasApplied = roles.some((r) => r.applied);
        const hasAvailable = roles.some((r) => !r.applied);

        if (hasApplied && hasAvailable) return "partial" as const; // giallo
        if (hasApplied) return "candidate" as const; // rosso
        return "available" as const; // verde
    };

    const getLocationIcon = (state: "available" | "candidate" | "partial" | "inactive") => {
        if (state === "inactive") return icons.grey;
        if (state === "partial") return icons.yellow;
        if (state === "candidate") return icons.red;
        return icons.green;
    };

    const getMarkerBaseZIndex = (state: "available" | "candidate" | "partial" | "inactive") => {
        if (state === "candidate") return 1400; // rosso sempre sopra al verde
        if (state === "partial") return 1300; // giallo sempre sopra al verde
        if (state === "inactive") return 700;
        return 200; // verde in background
    };

    const getAdminCircleStyle = (
        state: "available" | "candidate" | "partial" | "inactive",
        opacity: number,
        isHighlightTarget: boolean
    ) => {
        if (state === "candidate") {
            return {
                color: "#DC2626",
                fillColor: "#EF4444",
                fillOpacity: Math.min(0.95, 0.82 * opacity),
                weight: isHighlightTarget ? 4 : 3,
                radius: isHighlightTarget ? 14 : 12,
            };
        }
        if (state === "partial") {
            return {
                color: "#CA8A04",
                fillColor: "#EAB308",
                fillOpacity: Math.min(0.95, 0.8 * opacity),
                weight: isHighlightTarget ? 4 : 3,
                radius: isHighlightTarget ? 14 : 12,
            };
        }
        if (state === "inactive") {
            return {
                color: "#9CA3AF",
                fillColor: "#D1D5DB",
                fillOpacity: Math.min(0.7, 0.5 * opacity),
                weight: 2,
                radius: isHighlightTarget ? 11 : 10,
            };
        }
        return {
            color: "#A7F3D0",
            fillColor: "#D1FAE5",
            fillOpacity: Math.min(0.7, 0.52 * opacity),
            weight: 1.8,
            radius: isHighlightTarget ? 11 : 9,
        };
    };

    const MapHighlighter = () => {
        const map = useMap();

        // ---- highlight by position ID (from AccountPage link) ----
        useEffect(() => {
            if (!highlightPositionId) {
                setHighlightLocationId(null);
                consumedHighlightRef.current = null;
                return;
            }

            if (consumedHighlightRef.current === highlightPositionId) return;
            if (!locations || locations.length === 0) return;

            const targetLoc = locations.find((loc) =>
                loc.roles.some((r) =>
                    r.users.some((u) => u.position_id === highlightPositionId)
                )
            );

            if (!targetLoc) return;

            consumedHighlightRef.current = highlightPositionId;

            setHighlightLocationId(targetLoc.location_id);

            if (suppressAutoFocusOnHighlight) return;

            autoMoveRef.current = true;

            map.flyTo([targetLoc.latitude, targetLoc.longitude], 11, {
                animate: true,
                duration: 0.8,
            });

            map.once("moveend", () => {
                autoMoveRef.current = false;
            });

            const marker = locationMarkerRefs.current[targetLoc.location_id];
            if (marker && typeof marker.openPopup === "function") {
                setTimeout(() => marker.openPopup(), 150);
            }
        }, [highlightPositionId, locations, map, suppressAutoFocusOnHighlight]);

        // ---- filter by location name: fly + open popup ----
        useEffect(() => {
            if (!filterLocationName || !locations || locations.length === 0) return;

            const targetLoc = locations.find(
                (loc) => loc.name.toLowerCase() === filterLocationName.toLowerCase()
            );
            if (!targetLoc) return;

            setHighlightLocationId(targetLoc.location_id);
            autoMoveRef.current = true;

            map.flyTo([targetLoc.latitude, targetLoc.longitude], 12, {
                animate: true,
                duration: 1.0,
            });

            map.once("moveend", () => {
                autoMoveRef.current = false;
                const marker = locationMarkerRefs.current[targetLoc.location_id];
                if (marker && typeof marker.openPopup === "function") {
                    marker.openPopup();
                }
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [filterLocationName, map]);

        return null;
    };

    const MapInteractionReset = () => {
        const map = useMap();

        useEffect(() => {
            const container = map.getContainer();

            const handler = () => {
                if (autoMoveRef.current) return;
                setHighlightLocationId(null);
            };

            container.addEventListener("wheel", handler, { passive: true });
            container.addEventListener("mousedown", handler);
            container.addEventListener("touchstart", handler, { passive: true });

            return () => {
                container.removeEventListener("wheel", handler);
                container.removeEventListener("mousedown", handler);
                container.removeEventListener("touchstart", handler);
            };
        }, [map]);

        return null;
    };

    /* ---------- RENDER ---------- */

    return (
        <MapContainer center={[41.5, 12.5]} zoom={6} style={{ height: "100%", width: "100%" }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

            <MapHighlighter />
            <MapInteractionReset />

            {/* SEDI */}
            {myStatus !== null &&
                [...locations]
                    .sort((a, b) => {
                        const statePriority = (state: "available" | "candidate" | "partial" | "inactive") => {
                            if (state === "available") return 1;
                            if (state === "inactive") return 2;
                            if (state === "partial") return 3;
                            return 4;
                        };
                        const stateA = getLocationMarkerState(a.roles);
                        const stateB = getLocationMarkerState(b.roles);
                        const highlightA =
                            !!highlightPositionId &&
                            a.roles.some((r) => r.users.some((u) => u.position_id === highlightPositionId))
                                ? 10
                                : 0;
                        const highlightB =
                            !!highlightPositionId &&
                            b.roles.some((r) => r.users.some((u) => u.position_id === highlightPositionId))
                                ? 10
                                : 0;
                        return statePriority(stateA) + highlightA - (statePriority(stateB) + highlightB);
                    })
                    .map((loc) => {
                    const markerState = getLocationMarkerState(loc.roles);
                    // When a role filter is active, dim locations that don't match
                    const roleMatchesFilter =
                        !filterRoleName ||
                        loc.roles.some(
                            (r) => r.role_name.toLowerCase() === filterRoleName.toLowerCase()
                        );
                    const locationOpacity = filterRoleName && !roleMatchesFilter ? 0.25 : 1;
                    const baseOpacity =
                        visualMode === "adminActiveMaps" && markerState === "available"
                            ? 0.5
                            : 1;
                    const markerOpacity = locationOpacity * baseOpacity;
                    const isHighlightTarget =
                        !!highlightPositionId &&
                        loc.roles.some((r) =>
                            r.users.some((u) => u.position_id === highlightPositionId)
                        );
                    const zIndexOffset = (() => {
                        const base = getMarkerBaseZIndex(markerState);
                        if (filterRoleName && roleMatchesFilter) return base + 2000;
                        if (isHighlightTarget) return base + 2000;
                        return base;
                    })();
                    const adminCircleStyle = getAdminCircleStyle(
                        markerState,
                        markerOpacity,
                        isHighlightTarget
                    );
                    const useAdminCircleMarker =
                        visualMode === "adminActiveMaps" && interaction === "read";
                    const popupPeople = loc.roles.flatMap((role) =>
                        role.users.map((user) => ({
                            key: `${role.role_id}-${user.position_id}`,
                            fullName: user.full_name ?? "—",
                            roleName: role.role_name ?? "—",
                            locationName: loc.name ?? "—",
                        }))
                    );

                    return (
                    <React.Fragment key={`${loc.location_id}-${myStatus}`}>
                        {highlightLocationId === loc.location_id && (
                            <Circle
                                center={[loc.latitude, loc.longitude]}
                                radius={1800}
                                pathOptions={{
                                    color: "#4da3ff",
                                    fillColor: "#4da3ff",
                                    fillOpacity: 0.35,
                                    weight: 3,
                                }}
                            />
                        )}

                        {useAdminCircleMarker ? (
                            <CircleMarker
                                center={[loc.latitude, loc.longitude]}
                                radius={adminCircleStyle.radius}
                                pathOptions={{
                                    color: adminCircleStyle.color,
                                    fillColor: adminCircleStyle.fillColor,
                                    fillOpacity: adminCircleStyle.fillOpacity,
                                    weight: adminCircleStyle.weight,
                                }}
                                ref={(ref) => {
                                    if (ref) locationMarkerRefs.current[loc.location_id] = ref;
                                }}
                            >
                                <Popup>
                                    <div style={{ minWidth: "230px" }}>
                                        <div style={{ fontWeight: 700, fontSize: "14px", color: "#111827" }}>
                                            📍 {loc.name}
                                        </div>
                                        <div style={{ marginTop: "8px", display: "grid", gap: "8px" }}>
                                            {popupPeople.map((person) => (
                                                <div key={person.key} style={{ border: "1px solid #E5E7EB", borderRadius: "10px", padding: "8px 9px", background: "#FFFFFF" }}>
                                                    <div style={{ fontWeight: 600, color: "#111827", fontSize: "13px" }}>
                                                        {person.fullName}
                                                    </div>
                                                    <div style={{ fontSize: "12px", color: "#4B5563", marginTop: "2px" }}>
                                                        {person.roleName}
                                                    </div>
                                                    <div style={{ fontSize: "12px", color: "#6B7280", marginTop: "1px" }}>
                                                        {person.locationName}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </Popup>
                            </CircleMarker>
                        ) : (
                            <Marker
                                position={[loc.latitude, loc.longitude]}
                                icon={getLocationIcon(markerState)}
                                ref={(ref: L.Marker | null) => {
                                    if (ref) locationMarkerRefs.current[loc.location_id] = ref;
                                }}
                                opacity={markerOpacity}
                                zIndexOffset={zIndexOffset}
                            >
                                <Popup>
                                    <b>
                                        📍 {loc.name} ({loc.roles.length})
                                    </b>

                                    <ul style={{ marginTop: "8px", paddingLeft: "16px" }}>
                                        {loc.roles.map((r) => {
                                            const disabled = interaction !== "write" || myStatus !== "available";

                                            return (
                                                <li key={r.role_id} style={{ marginBottom: "6px" }}>
                                                    <div
                                                        style={{
                                                            display: "flex",
                                                            justifyContent: "space-between",
                                                            alignItems: "center",
                                                            gap: "12px",
                                                            opacity: disabled ? 0.7 : 1,
                                                        }}
                                                    >
                                                        <span style={{ fontWeight: 500 }}>
                                                            {r.role_name} ({r.users.length})
                                                            {r.applied ? " 🔴" : " 🟢"}
                                                        </span>

                                                        {interaction === "write" && myStatus === "available" && !r.applied && (
                                                            <>
                                                                <select
                                                                    value={selectedPriorities[r.role_id] ?? ""}
                                                                    onChange={(e) =>
                                                                        setSelectedPriorities((prev) => ({
                                                                            ...prev,
                                                                            [r.role_id]: Number(e.target.value),
                                                                        }))
                                                                    }
                                                                >
                                                                    <option value="" disabled>
                                                                        Priorità
                                                                    </option>

                                                                    {availablePriorities.map((p) => (
                                                                        <option key={p} value={p}>
                                                                            {p}
                                                                        </option>
                                                                    ))}
                                                                </select>

                                                                <button
                                                                    onClick={() => handleApplyToRole(r)}
                                                                    disabled={selectedPriorities[r.role_id] == null}
                                                                >
                                                                    Candidati
                                                                </button>
                                                            </>
                                                        )}

                                                        {interaction === "write" && r.applied && (
                                                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                                <span style={{ fontSize: "0.9em", opacity: 0.85 }}>
                                                                    Priorità: <b>{r.priority ?? "—"}</b>
                                                                </span>

                                                                <button onClick={() => handleWithdrawFromRole(r)}>Annulla</button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </Popup>
                            </Marker>
                        )}
                    </React.Fragment>
                    );
                })}

            {/* VIEWER: indicatore secondario non interattivo per evitare conflitti click con la sede */}
            {meLocation && (
                <>
                    <Circle
                        center={[meLocation.latitude, meLocation.longitude]}
                        radius={420}
                        pathOptions={{
                            color: "#2563EB",
                            fillColor: "#3B82F6",
                            fillOpacity: 0.12,
                            opacity: 0.9,
                            weight: 2,
                        }}
                        interactive={false}
                    />
                    <Marker
                        position={[meLocation.latitude, meLocation.longitude]}
                        icon={meIndicatorIcon}
                        interactive={false}
                        zIndexOffset={3000}
                    />
                </>
            )}
        </MapContainer>
    );
};

export default PositionsMap;
