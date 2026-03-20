import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import {
    MapContainer,
    TileLayer,
    Marker,
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
    me: new L.Icon({
        iconUrl: iconBase + "marker-icon-blue.png",
        shadowUrl: iconBase + "marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
    }),
};

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

type MapLocation = {
    location_id: string;
    name: string;
    latitude: number;
    longitude: number;
    roles: LocationRole[];
};

type MeLocation = {
    latitude: number;
    longitude: number;
};

type Props = {
    viewerUserId?: string;
    mode?: "from" | "to";
    interaction?: "read" | "write";
    highlightPositionId?: string;
};

/* ---------- COMPONENT ---------- */

const PositionsMap = ({
    viewerUserId,
    mode = "from",
    interaction = "write",
    highlightPositionId,
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
    };

    /* ---------- HELPERS ---------- */

    const getLocationIcon = (roles: LocationRole[]) => {
        if (myStatus === "inactive") return icons.grey;

        const hasApplied = roles.some((r) => r.applied);
        const hasAvailable = roles.some((r) => !r.applied);

        if (hasApplied && hasAvailable) return icons.yellow;
        if (hasApplied) return icons.red;
        return icons.green;
    };

    const MapHighlighter = () => {
        const map = useMap();

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
        }, [highlightPositionId, locations, map]);

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
                locations.map((loc) => (
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

                        <Marker
                            position={[loc.latitude, loc.longitude]}
                            icon={getLocationIcon(loc.roles)}
                            ref={(ref: L.Marker | null) => {
                                if (ref) locationMarkerRefs.current[loc.location_id] = ref;
                            }}
                            zIndexOffset={
                                highlightPositionId &&
                                    loc.roles.some((r) =>
                                        r.users.some((u) => u.position_id === highlightPositionId)
                                    )
                                    ? 2000
                                    : 0
                            }
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
                    </React.Fragment>
                ))}

            {/* VIEWER */}
            {meLocation && (
                <Marker
                    position={[meLocation.latitude, meLocation.longitude]}
                    icon={icons.me}
                    zIndexOffset={1000}
                >
                    <Popup>
                        <b>📍 Tu sei qui</b>
                    </Popup>
                </Marker>
            )}
        </MapContainer>
    );
};

export default PositionsMap;
