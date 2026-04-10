import React, { useEffect, useMemo, useState } from "react";
import { solveOptimalChains } from "../lib/optimalChainsSolver";
import type {
    ChainCandidate,
    OptimizationStrategy,
} from "../lib/optimalChainsSolver";
import { appApi } from "../lib/appApi";
import {
    MapContainer,
    TileLayer,
    CircleMarker,
    Popup,
    useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

type UiStrategy = OptimizationStrategy | "NONE";
type RightPanelTab = "PEOPLE" | "CHAINS";

/** Palette colori per le prime 8 catene (border, bg, dot) */
const CHAIN_COLORS = [
    { border: "#16A34A", bg: "#F0FDF4", dot: "#22C55E", marker: "#22C55E" },  // verde
    { border: "#CA8A04", bg: "#FEFCE8", dot: "#EAB308", marker: "#EAB308" },  // giallo
    { border: "#DC2626", bg: "#FEF2F2", dot: "#EF4444", marker: "#EF4444" },  // rosso
    { border: "#7C3AED", bg: "#F5F3FF", dot: "#8B5CF6", marker: "#8B5CF6" },  // viola
    { border: "#0284C7", bg: "#F0F9FF", dot: "#38BDF8", marker: "#38BDF8" },  // azzurro
    { border: "#6B7280", bg: "#F9FAFB", dot: "#9CA3AF", marker: "#9CA3AF" },  // grigio
    { border: "#DB2777", bg: "#FDF2F8", dot: "#EC4899", marker: "#EC4899" },  // fucsia
    { border: "#EA580C", bg: "#FFF7ED", dot: "#F97316", marker: "#F97316" },  // arancione
];

const getChainColor = (index: number) => CHAIN_COLORS[index % CHAIN_COLORS.length];

type AnalyticsMetric =
    | "unique_people"
    | "total_chains"
    | "avg_length"
    | "coverage"
    | "avg_priority";
type ExpandableBoxKey = "controls" | "scenarios" | "insights" | "analytics" | null;

type BuildResult = {
    nodes: number;
    relationships: number;
};

type InterlockingChain = {
    users?: string[];
    peopleNames?: string[];
    length?: number;
    avgPriority?: number | null;
};

type SavedScenario = {
    id: string;
    scenario_code: string;
    generated_at: string;
    strategy: UiStrategy | string;
    max_len: number;
    total_chains: number;
    unique_people: number;
    coverage: number | null;
    avg_length: number | null;
    max_length: number | null;
    avg_priority: number | null;
    build_nodes: number | null;
    build_relationships: number | null;
    chains_json: InterlockingChain[];
    optimal_chains_json?: ChainCandidate[] | null;
};

type AdminUserRow = {
    id: string;
    full_name: string;
    role_id: string | null;
    role_name: string | null;
    location_id: string | null;
    location_name: string | null;
    responsible_name: string | null;
    pbp: string | null;
};

type LocationRow = {
    id: string;
    name: string;
    latitude: number | null;
    longitude: number | null;
};

type RoleRow = {
    id: string;
    name: string;
};

type ScenarioChainView = {
    userIds: string[];
    peopleNames: string[];
    avgPriority: number | null;
    length: number;
};

type ScenarioPersonRow = {
    id: string;
    name: string;
    role: string;
    locationId: string | null;
    locationName: string;
    responsible: string;
    pbp: string;
    latitude: number | null;
    longitude: number | null;
};

type ScenarioLocationMarker = {
    locationId: string;
    locationName: string;
    latitude: number;
    longitude: number;
    peopleCount: number;
    peopleNames: string[];
    isFocused: boolean;
    colorMode: "default-green" | "scenario-red" | "focused-gold";
};

const pageStyle: React.CSSProperties = {
    padding: "26px",
    background:
        "#F9FAFB",
    minHeight: "100%",
    color: "#111827",
    fontFamily:
        'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const panelStyle: React.CSSProperties = {
    background:
        "#FFFFFF",
    border: "1px solid #E5E7EB",
    borderRadius: "24px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    overflow: "hidden",
    position: "relative",
};

const innerPanelPadding: React.CSSProperties = {
    padding: "18px 20px 18px 20px",
};

const sectionTitleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: "15px",
    fontWeight: 600,
    color: "#111827",
};

const sectionSubtitleStyle: React.CSSProperties = {
    marginTop: "4px",
    fontSize: "12px",
    color: "#6B7280",
};

const ghostButtonStyle: React.CSSProperties = {
    border: "1px solid #E5E7EB",
    background: "#FFFFFF",
    color: "#374151",
    borderRadius: "12px",
    padding: "10px 14px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 500,
};



const subtleCardStyle: React.CSSProperties = {
    background: "#F9FAFB",
    border: "1px solid #E5E7EB",
    borderRadius: "18px",
};

function FitBounds({
    markers,
}: {
    markers: Array<{ latitude: number; longitude: number }>;
}) {
    const map = useMap();

    useEffect(() => {
        if (!markers.length) return;

        if (markers.length === 1) {
            map.setView([markers[0].latitude, markers[0].longitude], 7);
            return;
        }

        const bounds = markers.map((m) => [m.latitude, m.longitude]) as [
            number,
            number
        ][];
        map.fitBounds(bounds, { padding: [40, 40] });
    }, [map, markers]);

    return null;
}

const AdminInterlocking = () => {
    const [loadingGraph, setLoadingGraph] = useState(false);
    const [loadingAnalyze, setLoadingAnalyze] = useState(false);
    const [loadingScenarios, setLoadingScenarios] = useState(false);
    const [loadingReferenceData, setLoadingReferenceData] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const [buildResult, setBuildResult] = useState<BuildResult | null>(null);
    const [strategy, setStrategy] = useState<UiStrategy>("NONE");
    const [error, setError] = useState<string | null>(null);
    const [maxLen, setMaxLen] = useState<number>(8);

    const [scenarios, setScenarios] = useState<SavedScenario[]>([]);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedScenarioIds, setSelectedScenarioIds] = useState<string[]>([]);
    const [expandedScenarioIds, setExpandedScenarioIds] = useState<string[]>([]);

    const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
    const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>("PEOPLE");
    const [focusedPersonId, setFocusedPersonId] = useState<string | null>(null);
    const [selectedChainIndex, setSelectedChainIndex] = useState<number | null>(null);
    const [focusedLocationId, setFocusedLocationId] = useState<string | null>(null);
    const [expandedBox, setExpandedBox] = useState<ExpandableBoxKey>(null);
    const [analyticsMetric, setAnalyticsMetric] =
        useState<AnalyticsMetric>("unique_people");
    const [showNewSimPanel, setShowNewSimPanel] = useState(false);

    const [usersDirectory, setUsersDirectory] = useState<AdminUserRow[]>([]);
    const [locationsDirectory, setLocationsDirectory] = useState<LocationRow[]>([]);



    const toggleExpand = (key: ExpandableBoxKey) => {
        setExpandedBox((prev) => (prev === key ? null : key));
    };

    const getBoxShellStyle = (
        key: Exclude<ExpandableBoxKey, null>,
        minHeight?: number
    ): React.CSSProperties => {
        const expanded = expandedBox === key;

        return {
            ...panelStyle,
            minHeight: expanded ? undefined : minHeight,
            position: expanded ? "fixed" : "relative",
            top: expanded ? "64px" : undefined,
            left: expanded ? "24px" : undefined,
            right: expanded ? "24px" : undefined,
            bottom: expanded ? "24px" : undefined,
            zIndex: expanded ? 80 : 1,
            width: expanded ? "calc(100vw - 48px)" : undefined,
            height: expanded ? "calc(100vh - 88px)" : undefined,
            borderRadius: expanded ? "28px" : "24px",
        };
    };

    const getTimestampForFilename = () => {
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
    };

    const getScenarioCode = () => {
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        return `SIM-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    };

    const formatDateTime = (value: string | null | undefined) => {
        if (!value) return "—";
        const dt = new Date(value);
        return dt.toLocaleString("it-IT", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const formatNumber = (value: number | string | null | undefined, digits = 1) => {
        if (value === null || value === undefined || value === "") return "—";
        const num = typeof value === "number" ? value : Number(value);
        if (!Number.isFinite(num)) return "—";
        return num.toFixed(digits);
    };

    const getStrategyLabel = (value: UiStrategy | string) => {
        if (value === "NONE") return "Nessuna";
        if (value === "MAX_IMPACT") return "Massimo impatto";
        if (value === "QUALITY_FIRST") return "Qualità delle scelte";
        return value;
    };

    const getAnalyticsMetricLabel = (value: AnalyticsMetric) => {
        if (value === "unique_people") return "Persone coinvolte";
        if (value === "total_chains") return "Numero catene";
        if (value === "avg_length") return "Lunghezza media";
        if (value === "coverage") return "Coverage";
        if (value === "avg_priority") return "Priorità media";
        return value;
    };

    const getScenarioMetricValue = (
        scenario: SavedScenario,
        metric: AnalyticsMetric
    ): number => {
        if (metric === "unique_people") return scenario.unique_people ?? 0;
        if (metric === "total_chains") return scenario.total_chains ?? 0;
        if (metric === "avg_length") return scenario.avg_length ?? 0;
        if (metric === "coverage") return scenario.coverage ?? 0;
        if (metric === "avg_priority") return scenario.avg_priority ?? 0;
        return 0;
    };

    const escapeCsvValue = (value: string | number | null | undefined) => {
        if (value === null || value === undefined) return "";
        const str = String(value).replace(/"/g, '""');
        return `"${str}"`;
    };

    const downloadCsv = (
        filenameBase: string,
        headers: string[],
        rows: Array<Array<string | number | null | undefined>>
    ) => {
        const csvLines = [
            headers.map(escapeCsvValue).join(";"),
            ...rows.map((row) => row.map(escapeCsvValue).join(";")),
        ];

        const csvContent = "\uFEFF" + csvLines.join("\n");
        const blob = new Blob([csvContent], {
            type: "text/csv;charset=utf-8;",
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${filenameBase}_${getTimestampForFilename()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const buildCandidatesForSolver = (
        sourceChains: InterlockingChain[]
    ): ChainCandidate[] => {
        return sourceChains
            .filter((c) => Array.isArray(c.users) && c.users.length > 1)
            .map((c, index) => ({
                id: `chain_${index + 1}`,
                nodeIds: c.users!,
                avgPriority: c.avgPriority ?? 999,
                length: c.length ?? c.users!.length,
            }));
    };

    const computeStatsFromChains = (
        chains: InterlockingChain[],
        totalNodes?: number | null
    ) => {
        const totalChains = chains.length;
        const uniqueUsers = new Set<string>();
        let totalLength = 0;
        let maxLengthFound = 0;
        let prioritySum = 0;
        let priorityCount = 0;

        for (const chain of chains) {
            const chainUsers = Array.isArray(chain.users) ? chain.users : [];
            const length = chain.length ?? chainUsers.length ?? 0;

            totalLength += length;
            maxLengthFound = Math.max(maxLengthFound, length);

            for (const userId of chainUsers) uniqueUsers.add(userId);

            if (typeof chain.avgPriority === "number") {
                prioritySum += chain.avgPriority;
                priorityCount += 1;
            }
        }

        const uniquePeople = uniqueUsers.size;
        const avgLength = totalChains > 0 ? totalLength / totalChains : 0;
        const avgPriority = priorityCount > 0 ? prioritySum / priorityCount : null;
        const coverage =
            totalNodes && totalNodes > 0 ? (uniquePeople / totalNodes) * 100 : null;

        return {
            totalChains,
            uniquePeople,
            avgLength,
            maxLengthFound,
            avgPriority,
            coverage,
        };
    };

    const loadReferenceData = async () => {
        try {
            setLoadingReferenceData(true);

            const [usersRes, locationsRes, rolesRes] = await Promise.allSettled([
                appApi.adminGetUsers(),
                appApi.adminGetLocations(),
                appApi.adminGetRoles(),
            ]);

            const roles: RoleRow[] =
                rolesRes.status === "fulfilled" && Array.isArray(rolesRes.value)
                    ? rolesRes.value.map((r: any) => ({
                        id: String(r.id),
                        name: String(r.name ?? ""),
                    }))
                    : [];

            const roleNameById = new Map(roles.map((r) => [r.id, r.name]));

            const locations: LocationRow[] =
                locationsRes.status === "fulfilled" && Array.isArray(locationsRes.value)
                    ? locationsRes.value.map((l: any) => ({
                        id: String(l.id),
                        name: String(l.name ?? ""),
                        latitude:
                            l.latitude === null || l.latitude === undefined
                                ? null
                                : Number(l.latitude),
                        longitude:
                            l.longitude === null || l.longitude === undefined
                                ? null
                                : Number(l.longitude),
                    }))
                    : [];

            const locationNameById = new Map(locations.map((l) => [l.id, l.name]));

            const users: AdminUserRow[] =
                usersRes.status === "fulfilled" && Array.isArray(usersRes.value)
                    ? usersRes.value.map((u: any) => {
                        const roleId =
                            u.role_id === null || u.role_id === undefined
                                ? null
                                : String(u.role_id);
                        const locationId =
                            u.location_id === null || u.location_id === undefined
                                ? null
                                : String(u.location_id);

                        return {
                            id: String(u.id),
                            full_name: String(
                                u.full_name ??
                                u.name ??
                                u.display_name ??
                                u.email ??
                                "Utente"
                            ),
                            role_id: roleId,
                            role_name:
                                u.role_name ??
                                (roleId ? roleNameById.get(roleId) ?? null : null),
                            location_id: locationId,
                            location_name:
                                u.location_name ??
                                (locationId ? locationNameById.get(locationId) ?? null : null),
                            responsible_name:
                                u.responsible_name ??
                                u.manager_name ??
                                u.responsabile ??
                                null,
                            pbp: u.pbp ?? null,
                        };
                    })
                    : [];


            setLocationsDirectory(locations);
            setUsersDirectory(users);
        } finally {
            setLoadingReferenceData(false);
        }
    };

    const loadScenarios = async () => {
        try {
            setLoadingScenarios(true);
            setError(null);
            const json = await appApi.adminListInterlockingScenarios();
            const raw = Array.isArray(json?.scenarios) ? json.scenarios : [];

            const normalizedScenarios: SavedScenario[] = raw.map((s: any) => ({
                id: String(s.id),
                scenario_code: String(s.scenario_code ?? ""),
                generated_at: String(s.generated_at ?? ""),
                strategy: String(s.strategy ?? "NONE"),
                max_len: Number(s.max_len ?? 0),
                total_chains: Number(s.total_chains ?? 0),
                unique_people: Number(s.unique_people ?? 0),
                coverage:
                    s.coverage === null || s.coverage === undefined ? null : Number(s.coverage),
                avg_length:
                    s.avg_length === null || s.avg_length === undefined
                        ? null
                        : Number(s.avg_length),
                max_length:
                    s.max_length === null || s.max_length === undefined
                        ? null
                        : Number(s.max_length),
                avg_priority:
                    s.avg_priority === null || s.avg_priority === undefined
                        ? null
                        : Number(s.avg_priority),
                build_nodes:
                    s.build_nodes === null || s.build_nodes === undefined
                        ? null
                        : Number(s.build_nodes),
                build_relationships:
                    s.build_relationships === null || s.build_relationships === undefined
                        ? null
                        : Number(s.build_relationships),
                chains_json: Array.isArray(s.chains_json) ? s.chains_json : [],
                optimal_chains_json: Array.isArray(s.optimal_chains_json)
                    ? s.optimal_chains_json
                    : null,
            }));

            setScenarios(normalizedScenarios);

            setActiveScenarioId((prev) => {
                if (!prev) return prev;
                const stillExists = normalizedScenarios.some((s) => s.id === prev);
                return stillExists ? prev : null;
            });
        } catch (err: any) {
            setError(err?.message ?? String(err));
        } finally {
            setLoadingScenarios(false);
        }
    };

    useEffect(() => {
        loadScenarios();
        loadReferenceData();
    }, []);

    const usersById = useMemo(() => {
        return new Map(usersDirectory.map((u) => [u.id, u]));
    }, [usersDirectory]);

    const locationsById = useMemo(() => {
        return new Map(locationsDirectory.map((l) => [l.id, l]));
    }, [locationsDirectory]);

    const activeScenario = useMemo(() => {
        return scenarios.find((s) => s.id === activeScenarioId) ?? null;
    }, [scenarios, activeScenarioId]);

    const getScenarioViewChains = (scenario: SavedScenario | null): ScenarioChainView[] => {
        if (!scenario) return [];

        if (
            scenario.strategy !== "NONE" &&
            scenario.optimal_chains_json &&
            scenario.optimal_chains_json.length > 0
        ) {
            return scenario.optimal_chains_json.map((c) => ({
                userIds: Array.isArray(c.nodeIds) ? c.nodeIds : [],
                peopleNames: Array.isArray(c.nodeIds)
                    ? c.nodeIds.map((id) => usersById.get(id)?.full_name ?? id)
                    : [],
                avgPriority: c.avgPriority ?? null,
                length: c.length ?? (Array.isArray(c.nodeIds) ? c.nodeIds.length : 0),
            }));
        }

        return scenario.chains_json.map((c) => {
            const userIds = Array.isArray(c.users) ? c.users : [];
            const peopleNames =
                Array.isArray(c.peopleNames) && c.peopleNames.length > 0
                    ? c.peopleNames
                    : userIds.map((id) => usersById.get(id)?.full_name ?? id);

            return {
                userIds,
                peopleNames,
                avgPriority: c.avgPriority ?? null,
                length: c.length ?? userIds.length,
            };
        });
    };


    const activeScenarioPeople = useMemo<ScenarioPersonRow[]>(() => {
        if (!activeScenario) return [];

        const chains = getScenarioViewChains(activeScenario);
        const namesFromChains = new Map<string, string>();

        for (const chain of chains) {
            chain.userIds.forEach((userId, index) => {
                const fallbackName = chain.peopleNames[index];
                if (fallbackName) namesFromChains.set(userId, fallbackName);
            });
        }

        const uniqueUserIds = Array.from(
            new Set(chains.flatMap((chain) => chain.userIds))
        );

        return uniqueUserIds.map((userId) => {
            const user = usersById.get(userId);
            let location = user?.location_id ? locationsById.get(user.location_id) ?? null : null;

            if (!location && user?.location_name) {
                location = locationsDirectory.find(l => l.name?.toLowerCase() === user.location_name?.toLowerCase()) ?? null;
            }

            return {
                id: userId,
                name: user?.full_name ?? namesFromChains.get(userId) ?? userId,
                role: user?.role_name ?? "—",
                locationId: user?.location_id ?? null,
                locationName: user?.location_name ?? location?.name ?? "—",
                responsible: user?.responsible_name ?? "—",
                pbp: user?.pbp ?? "—",
                latitude: location?.latitude ?? null,
                longitude: location?.longitude ?? null,
            };
        });
    }, [activeScenario, usersById, locationsById]);

    /**
     * Set degli userId appartenenti alla catena selezionata.
     * Usato sia per colorare i marker sia per enfatizzare la lista persone.
     */
    const selectedChainUserIds = useMemo<Set<string>>(() => {
        if (selectedChainIndex === null || !activeScenario) return new Set();
        const chains = getScenarioViewChains(activeScenario);
        const chain = chains[selectedChainIndex];
        if (!chain) return new Set();
        return new Set(chain.userIds);
    }, [selectedChainIndex, activeScenario, usersById]);

    const activeScenarioLocationMarkers = useMemo<ScenarioLocationMarker[]>(() => {
        const grouped = new Map<string, ScenarioLocationMarker & { chainIndex?: number }>();

        for (const person of activeScenarioPeople) {
            const locationKey = person.locationId || person.locationName;

            if (
                !locationKey ||
                person.latitude === null ||
                person.longitude === null
            ) {
                continue;
            }

            const isInSelectedChain = selectedChainIndex !== null && selectedChainUserIds.has(person.id);
            const isPersonFocused = focusedPersonId === person.id;

            const existing = grouped.get(locationKey);
            if (existing) {
                existing.peopleCount += 1;
                existing.peopleNames.push(person.name);

                if (isPersonFocused) {
                    existing.isFocused = true;
                    existing.colorMode = "focused-gold";
                } else if (isInSelectedChain && existing.colorMode !== "focused-gold") {
                    // Mantieni il chainIndex del primo membro trovato in questa location
                    existing.colorMode = "scenario-red";
                    (existing as any).__chainHighlight = true;
                } else if (!isInSelectedChain && existing.colorMode !== "focused-gold" && !(existing as any).__chainHighlight) {
                    existing.colorMode = "scenario-red";
                }
            } else {
                const entry: any = {
                    locationId: locationKey,
                    locationName: person.locationName,
                    latitude: person.latitude,
                    longitude: person.longitude,
                    peopleCount: 1,
                    peopleNames: [person.name],
                    isFocused: isPersonFocused,
                    colorMode: isPersonFocused ? "focused-gold" : "scenario-red",
                    __chainHighlight: isInSelectedChain,
                    __inChain: isInSelectedChain,
                };
                grouped.set(locationKey, entry);
            }
        }

        return Array.from(grouped.values());
    }, [activeScenarioPeople, focusedPersonId, selectedChainIndex, selectedChainUserIds]);

    const globalLocationMarkers = useMemo<ScenarioLocationMarker[]>(() => {
        return locationsDirectory
            .filter(
                (l) =>
                    l.latitude !== null &&
                    l.latitude !== undefined &&
                    l.longitude !== null &&
                    l.longitude !== undefined
            )
            .map((l) => ({
                locationId: l.id,
                locationName: l.name,
                latitude: Number(l.latitude),
                longitude: Number(l.longitude),
                peopleCount: 0,
                peopleNames: [],
                isFocused: focusedLocationId === l.id,
                colorMode: focusedLocationId === l.id ? "focused-gold" as const : "default-green" as const,
            }));
    }, [locationsDirectory, focusedLocationId]);

    const displayedMapMarkers = useMemo(() => {
        return activeScenario ? activeScenarioLocationMarkers : globalLocationMarkers;
    }, [activeScenario, activeScenarioLocationMarkers, globalLocationMarkers]);

    const mapCenter = useMemo<[number, number]>(() => {
        if (!displayedMapMarkers.length) return [41.9028, 12.4964];

        const latAvg =
            displayedMapMarkers.reduce((acc, m) => acc + m.latitude, 0) /
            displayedMapMarkers.length;
        const lngAvg =
            displayedMapMarkers.reduce((acc, m) => acc + m.longitude, 0) /
            displayedMapMarkers.length;

        return [latAvg, lngAvg];
    }, [displayedMapMarkers]);

    const allSelected = useMemo(() => {
        return scenarios.length > 0 && selectedScenarioIds.length === scenarios.length;
    }, [scenarios, selectedScenarioIds]);

    const analyticsSeries = useMemo(() => {
        const values = scenarios.map((scenario) => ({
            id: scenario.id,
            label: scenario.scenario_code || "SIM",
            shortLabel: (scenario.scenario_code || "SIM").slice(-6),
            value: getScenarioMetricValue(scenario, analyticsMetric),
            isActive: scenario.id === activeScenarioId,
        }));

        const maxValue =
            values.length > 0 ? Math.max(...values.map((v) => v.value || 0), 1) : 1;

        return values.map((v) => ({
            ...v,
            heightPct: Math.max(8, (v.value / maxValue) * 100),
        }));
    }, [scenarios, analyticsMetric, activeScenarioId]);

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const handleBuildGraph = async () => {
        if (loadingGraph) return;

        try {
            setLoadingGraph(true);
            setError(null);

            await appApi.adminWarmupNeo4j();

            // piccolo tempo di assestamento dopo il warmup
            await sleep(1200);

            const json = await appApi.syncGraph();

            setBuildResult({
                nodes: Number(json?.engine?.nodes ?? 0),
                relationships: Number(json?.engine?.relationships ?? 0),
            });
        } catch (err: any) {
            const message = err?.message ?? String(err);

            if (message.includes("503")) {
                setError(
                    "Il servizio grafo non è ancora pronto. Attendi qualche secondo e riprova."
                );
            } else if (message.includes("429")) {
                setError(
                    "Troppe richieste ravvicinate. Attendi qualche secondo prima di riprovare."
                );
            } else {
                setError(message);
            }
        } finally {
            setLoadingGraph(false);
        }
    };

    const handleAnalyzeScenarios = async () => {
        try {
            setLoadingAnalyze(true);
            setError(null);

            const json = await appApi.adminFindChains({ maxLen });
            const raw = Array.isArray(json?.chains) ? json.chains : [];

            const normalized: InterlockingChain[] = raw.map((c: any) => ({
                users: Array.isArray(c?.users) ? c.users : [],
                peopleNames: Array.isArray(c?.peopleNames) ? c.peopleNames : [],
                length: Number(
                    c?.length ?? (Array.isArray(c?.users) ? c.users.length : 0)
                ),
                avgPriority: c?.avgPriority ?? null,
            }));

            let optimalChains: ChainCandidate[] | null = null;
            let statsSource = normalized;

            if (strategy !== "NONE") {
                const candidates = buildCandidatesForSolver(normalized);
                const { selectedChains } = solveOptimalChains(
                    candidates,
                    strategy as OptimizationStrategy
                );
                optimalChains = selectedChains;

                statsSource = selectedChains.map((c) => ({
                    users: c.nodeIds,
                    peopleNames: c.nodeIds.map((id) => usersById.get(id)?.full_name ?? id),
                    length: c.length,
                    avgPriority: c.avgPriority ?? null,
                }));
            }

            const stats = computeStatsFromChains(
                statsSource,
                buildResult?.nodes ?? null
            );

            const payload = {
                scenario_code: getScenarioCode(),
                generated_at: new Date().toISOString(),
                strategy,
                max_len: maxLen,
                total_chains: stats.totalChains,
                unique_people: stats.uniquePeople,
                coverage: stats.coverage,
                avg_length: stats.avgLength,
                max_length: stats.maxLengthFound,
                avg_priority: stats.avgPriority,
                build_nodes: buildResult?.nodes ?? null,
                build_relationships: buildResult?.relationships ?? null,
                chains_json: normalized,
                optimal_chains_json: optimalChains,
            };

            await appApi.adminSaveInterlockingScenario(payload);
            await loadScenarios();
        } catch (err: any) {
            setError(err?.message ?? String(err));
        } finally {
            setLoadingAnalyze(false);
        }
    };

    const toggleSelectionMode = () => {
        setSelectionMode((prev) => {
            const next = !prev;
            if (!next) setSelectedScenarioIds([]);
            return next;
        });
    };

    const toggleScenarioSelected = (id: string) => {
        setSelectedScenarioIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const handleSelectAll = () => {
        if (allSelected) {
            setSelectedScenarioIds([]);
            return;
        }
        setSelectedScenarioIds(scenarios.map((s) => s.id));
    };

    const handleDeleteSelected = async () => {
        if (selectedScenarioIds.length === 0) return;

        try {
            setDeleting(true);
            setError(null);
            await appApi.adminDeleteInterlockingScenarios({ ids: selectedScenarioIds });
            setSelectedScenarioIds([]);
            await loadScenarios();
            setFocusedPersonId(null);
        } catch (err: any) {
            setError(err?.message ?? String(err));
        } finally {
            setDeleting(false);
        }
    };

    const toggleExpanded = (id: string) => {
        setExpandedScenarioIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const handleScenarioRowClick = (scenarioId: string) => {
        setActiveScenarioId(scenarioId);
        setFocusedPersonId(null);
        setSelectedChainIndex(null);
    };

    const clearScenarioSelection = () => {
        setActiveScenarioId(null);
        setFocusedPersonId(null);
        setFocusedLocationId(null);
        setSelectedChainIndex(null);
    };

    const exportScenarioCsv = (scenario: SavedScenario) => {
        const source =
            scenario.strategy !== "NONE" &&
                scenario.optimal_chains_json &&
                scenario.optimal_chains_json.length > 0
                ? scenario.optimal_chains_json.map((c) => ({
                    peopleNames: c.nodeIds.map((id) => usersById.get(id)?.full_name ?? id),
                    avgPriority: c.avgPriority ?? null,
                    length: c.length ?? c.nodeIds.length,
                }))
                : scenario.chains_json;

        const headers = [
            "ID Catena",
            "Persone coinvolte",
            "Priorità catena",
            "Lunghezza",
            "Scenario",
            "Data e ora",
            "Strategia",
            "MaxLen",
        ];

        const rows = source.map((c: any, i: number) => [
            i + 1,
            Array.isArray(c.peopleNames)
                ? c.peopleNames.join(" -> ")
                : Array.isArray(c.nodeIds)
                    ? c.nodeIds.join(" -> ")
                    : "",
            typeof c.avgPriority === "number" ? c.avgPriority : "",
            c.length ?? "",
            scenario.scenario_code,
            formatDateTime(scenario.generated_at),
            getStrategyLabel(scenario.strategy),
            scenario.max_len,
        ]);

        downloadCsv(`scenario_${scenario.scenario_code}`, headers, rows);
    };

    const renderExpandButton = (key: Exclude<ExpandableBoxKey, null>) => {
        const isExpanded = expandedBox === key;

        return (
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    toggleExpand(key);
                }}
                style={{
                    width: "34px",
                    height: "34px",
                    borderRadius: "12px",
                    background: "#FFFFFF",
                    border: "1px solid #E5E7EB",
                    color: "#111827",
                    cursor: "pointer",
                    fontSize: "15px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: 1,
                }}
                title={isExpanded ? "Comprimi" : "Espandi"}
            >
                {isExpanded ? "⤡" : "⤢"}
            </button>
        );
    };

    return (
        <div style={pageStyle} onClick={clearScenarioSelection}>
            {expandedBox && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(255,255,255,0.7)",
                        backdropFilter: "blur(4px)",
                        zIndex: 70,
                    }}
                />
            )}

            <div style={{ position: "relative", zIndex: 71, display: "grid", gap: "20px" }}>
                {/* ── Page header ── */}
                <div style={{ marginBottom: "2px" }}>
                    <div style={{ fontSize: "31px", fontWeight: 700, letterSpacing: "-0.02em", color: "#111827" }}>
                        Interlocking Analytics
                    </div>
                    <div style={{ ...sectionSubtitleStyle, fontSize: "13px", marginTop: "6px" }}>
                        Dashboard decisionale per scenari, sedi coinvolte e analisi di impatto
                    </div>
                </div>

                {/* ── Row 1: Simulazioni (left 55%) + World Map (right 45%) ── */}
                <div
                    style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "20px", alignItems: "stretch" }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* ══ Simulazioni e scenari ══ */}
                    <div style={getBoxShellStyle("scenarios", 560)}>
                        <div style={innerPanelPadding}>
                            {/* Header */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "14px" }}>
                                <div>
                                    <h4 style={sectionTitleStyle}>Simulazioni e scenari</h4>
                                    <div style={sectionSubtitleStyle}>Click sulla riga per attivare scenario, mappa e analytics</div>
                                </div>
                                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                    <button onClick={toggleSelectionMode} style={ghostButtonStyle}>
                                        {selectionMode ? "Annulla" : "Seleziona"}
                                    </button>
                                    {selectionMode && (
                                        <>
                                            <button onClick={handleSelectAll} style={ghostButtonStyle}>
                                                {allSelected ? "Deseleziona tutto" : "Seleziona tutto"}
                                            </button>
                                            <button onClick={handleDeleteSelected} disabled={selectedScenarioIds.length === 0 || deleting} style={ghostButtonStyle}>
                                                {deleting ? "Eliminazione…" : "Elimina"}
                                            </button>
                                        </>
                                    )}
                                    {renderExpandButton("scenarios")}
                                </div>
                            </div>

                            {/* ── Nuova simulazione panel ── */}
                            <div style={{ marginBottom: "14px" }}>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setShowNewSimPanel((prev) => !prev); }}
                                    style={{
                                        display: "flex", alignItems: "center", gap: "6px",
                                        padding: "9px 16px", borderRadius: "12px",
                                        border: "1px solid #E8511A",
                                        background: showNewSimPanel ? "#FEF2EB" : "#FFFFFF",
                                        color: "#E8511A", fontSize: "13px", fontWeight: 600, cursor: "pointer",
                                    }}
                                >
                                    <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span> Nuova simulazione
                                </button>

                                {showNewSimPanel && (
                                    <div
                                        style={{
                                            marginTop: "10px", padding: "16px",
                                            background: "#F9FAFB", border: "1px solid #E5E7EB",
                                            borderRadius: "16px", display: "grid", gap: "14px",
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {/* Step 1: build */}
                                        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                                            <button
                                                onClick={handleBuildGraph}
                                                disabled={loadingGraph}
                                                style={{
                                                    ...ghostButtonStyle,
                                                    background: buildResult ? "#ECFDF5" : "#FFFFFF",
                                                    border: buildResult ? "1px solid #A7F3D0" : "1px solid #E5E7EB",
                                                    color: buildResult ? "#065F46" : "#374151",
                                                    fontWeight: 600, minWidth: "185px",
                                                }}
                                            >
                                                {loadingGraph ? "Preparazione…" : buildResult ? "✓ Simulazione pronta" : "Prepara simulazione"}
                                            </button>
                                            {buildResult && (
                                                <div style={{ fontSize: "13px", color: "#059669" }}>
                                                    <strong>{buildResult.nodes}</strong> persone · <strong>{buildResult.relationships}</strong> candidature
                                                </div>
                                            )}
                                        </div>

                                        {/* Step 2: strategy + maxLen + analyze (locked until build ready) */}
                                        <div
                                            style={{
                                                display: "grid", gridTemplateColumns: "1fr 1fr auto",
                                                gap: "12px", alignItems: "end",
                                                opacity: buildResult ? 1 : 0.38,
                                                pointerEvents: buildResult ? "auto" : "none",
                                                transition: "opacity 0.3s",
                                            }}
                                        >
                                            <label style={{ display: "grid", gap: "6px", fontSize: "12px", color: "#4B5563" }}>
                                                Strategia
                                                <select value={strategy} onChange={(e) => setStrategy(e.target.value as UiStrategy)}
                                                    style={{ background: "#FFF", color: "#111827", border: "1px solid #E5E7EB", borderRadius: "10px", padding: "9px 12px", outline: "none", fontSize: "13px" }}>
                                                    <option value="NONE">Nessuna</option>
                                                    <option value="MAX_IMPACT">Massimo impatto</option>
                                                    <option value="QUALITY_FIRST">Qualità delle scelte</option>
                                                </select>
                                            </label>
                                            <label style={{ display: "grid", gap: "6px", fontSize: "12px", color: "#4B5563" }}>
                                                MaxLen
                                                <select value={maxLen} onChange={(e) => setMaxLen(Number(e.target.value))}
                                                    style={{ background: "#FFF", color: "#111827", border: "1px solid #E5E7EB", borderRadius: "10px", padding: "9px 12px", outline: "none", fontSize: "13px" }}>
                                                    {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((n) => <option key={n} value={n}>{n}</option>)}
                                                </select>
                                            </label>
                                            <button
                                                onClick={handleAnalyzeScenarios}
                                                disabled={loadingAnalyze || !buildResult}
                                                style={{ ...ghostButtonStyle, background: "#6366F1", color: "#FFFFFF", border: "1px solid #4F46E5", fontWeight: 600, whiteSpace: "nowrap" }}
                                            >
                                                {loadingAnalyze ? "Analisi…" : "Analizza scenari"}
                                            </button>
                                        </div>

                                        {error && (
                                            <div style={{ fontSize: "12px", color: "#B91C1C", padding: "8px 12px", background: "#FEF2F2", borderRadius: "8px", border: "1px solid #FECACA" }}>
                                                {error}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* ── Table header ── */}
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "32px 1fr 1.2fr 0.65fr 0.65fr 0.65fr 0.7fr 0.65fr 0.9fr 0.95fr 56px 32px",
                                    gap: "6px", padding: "9px 10px",
                                    fontSize: "10px", fontWeight: 700, color: "#92400E",
                                    textTransform: "uppercase", letterSpacing: "0.06em",
                                    alignItems: "center", textAlign: "left",
                                    background: "#FEF3C7", borderRadius: "10px", marginBottom: "8px",
                                }}
                            >
                                <div /><div>ID</div><div>Data e ora</div><div>Catene</div>
                                <div>Persone</div><div>Cov.</div><div>L.med</div><div>L.max</div>
                                <div>Priorità</div><div>Strategia</div><div>CSV</div><div />
                            </div>

                            {/* ── Scenario rows ── */}
                            <div style={{ display: "grid", gap: "8px", maxHeight: expandedBox === "scenarios" ? "calc(100vh - 320px)" : "420px", overflowY: "auto", paddingRight: "2px" }}>
                                {loadingScenarios ? (
                                    <div style={{ color: "#9CA3AF", fontSize: "13px" }}>Caricamento scenari...</div>
                                ) : scenarios.length === 0 ? (
                                    <div style={{ color: "#9CA3AF", fontSize: "13px" }}>Nessuno scenario disponibile.</div>
                                ) : (
                                    scenarios.map((scenario) => {
                                        const isExpSc = expandedScenarioIds.includes(scenario.id);
                                        const isSelected = selectedScenarioIds.includes(scenario.id);
                                        const isActive = activeScenarioId === scenario.id;
                                        const visibleChains =
                                            scenario.strategy !== "NONE" && scenario.optimal_chains_json && scenario.optimal_chains_json.length > 0
                                                ? scenario.optimal_chains_json.map((c) => ({ peopleNames: c.nodeIds.map((id) => usersById.get(id)?.full_name ?? id), avgPriority: c.avgPriority ?? null, length: c.length ?? c.nodeIds.length }))
                                                : scenario.chains_json;

                                        return (
                                            <div
                                                key={scenario.id}
                                                onClick={() => handleScenarioRowClick(scenario.id)}
                                                style={{
                                                    border: isActive ? "1px solid #6366F1" : "1px solid #E5E7EB",
                                                    borderRadius: "12px",
                                                    background: isActive ? "#EFF6FF" : isSelected ? "#F3F4F6" : "#FFFFFF",
                                                    cursor: "pointer", overflow: "hidden",
                                                    boxShadow: isActive ? "0 0 0 1px rgba(99,102,241,0.2), 0 4px 6px -1px rgba(0,0,0,0.08)" : "none",
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: "grid",
                                                        gridTemplateColumns: "32px 1fr 1.2fr 0.65fr 0.65fr 0.65fr 0.7fr 0.65fr 0.9fr 0.95fr 56px 32px",
                                                        gap: "6px", alignItems: "center",
                                                        padding: "11px 10px", fontSize: "12px", textAlign: "left",
                                                    }}
                                                >
                                                    <div style={{ display: "flex", justifyContent: "center" }}>
                                                        {selectionMode ? (
                                                            <input type="checkbox" checked={isSelected}
                                                                onClick={(e) => e.stopPropagation()}
                                                                onChange={() => toggleScenarioSelected(scenario.id)} />
                                                        ) : null}
                                                    </div>
                                                    <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{scenario.scenario_code}</div>
                                                    <div style={{ color: "#6B7280", fontSize: "11px" }}>{formatDateTime(scenario.generated_at)}</div>
                                                    <div>{scenario.total_chains}</div>
                                                    <div>{scenario.unique_people}</div>
                                                    <div>{formatNumber(scenario.coverage, 1)}%</div>
                                                    <div>{formatNumber(scenario.avg_length, 2)}</div>
                                                    <div>{scenario.max_length ?? "—"}</div>
                                                    <div>{formatNumber(scenario.avg_priority, 2)}</div>
                                                    <div style={{ color: "#6B7280", fontSize: "11px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getStrategyLabel(scenario.strategy)}</div>
                                                    <div>
                                                        <button onClick={(e) => { e.stopPropagation(); exportScenarioCsv(scenario); }}
                                                            style={{ ...ghostButtonStyle, padding: "5px 8px", fontSize: "11px" }}>CSV</button>
                                                    </div>
                                                    <div>
                                                        <button onClick={(e) => { e.stopPropagation(); toggleExpanded(scenario.id); }}
                                                            title={isExpSc ? "Comprimi" : "Espandi"}
                                                            style={{ ...ghostButtonStyle, padding: "5px 8px", fontSize: "11px" }}>
                                                            {isExpSc ? "↓" : "→"}
                                                        </button>
                                                    </div>
                                                </div>

                                                {isExpSc && (
                                                    <div style={{ borderTop: "1px solid #E5E7EB", background: "#F9FAFB", padding: "10px 12px 14px" }}
                                                        onClick={(e) => e.stopPropagation()}>
                                                        <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 120px 100px", gap: "8px", padding: "0 0 10px 0", fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                                            <div>ID catena</div><div>Persone coinvolte</div><div>Priorità</div><div>Lunghezza</div>
                                                        </div>
                                                        <div style={{ display: "grid", gap: "8px" }}>
                                                            {visibleChains.length === 0 ? (
                                                                <div style={{ color: "#9CA3AF", fontSize: "13px" }}>Nessuna catena disponibile.</div>
                                                            ) : (
                                                                visibleChains.map((chain: any, index: number) => (
                                                                    <div key={index} style={{ display: "grid", gridTemplateColumns: "80px 1fr 120px 100px", gap: "8px", alignItems: "center", padding: "10px 0", borderTop: "1px solid #E5E7EB", fontSize: "13px" }}>
                                                                        <div>{index + 1}</div>
                                                                        <div>{Array.isArray(chain.peopleNames) ? chain.peopleNames.join(" → ") : "—"}</div>
                                                                        <div>{typeof chain.avgPriority === "number" ? chain.avgPriority.toFixed(2) : "—"}</div>
                                                                        <div>{chain.length ?? "—"}</div>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ══ World Map & People ══ */}
                    <div style={{ ...getBoxShellStyle("insights", 560), ...(expandedBox !== "insights" ? { overflow: "hidden" } : {}) }}>
                        <div style={innerPanelPadding}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "14px" }}>
                                <div>
                                    <h4 style={sectionTitleStyle}>World Map & People</h4>
                                    <div style={sectionSubtitleStyle}>
                                        {activeScenario ? `Scenario attivo: ${activeScenario.scenario_code}` : "Vista globale sedi in verde — seleziona uno scenario per dettaglio"}
                                    </div>
                                </div>
                                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                    {renderExpandButton("insights")}
                                </div>
                            </div>

                            {/* ─────────────────────────────────────────────────────────
                                LAYOUT FISSO: mappa sempre a sinistra, pannello a destra.
                                La mappa NON viene mai smontata. Le tab PEOPLE/CHAINS
                                controllano solo il contenuto della colonna destra.
                            ───────────────────────────────────────────────────────── */}
                            <div style={{ ...subtleCardStyle, height: expandedBox === "insights" ? "calc(100vh - 210px)" : "450px", display: "grid", gridTemplateColumns: "1.38fr 0.86fr", gap: "0px", overflow: "hidden" }}>

                                {/* ── Colonna sinistra: MAPPA (sempre visibile) ── */}
                                <div style={{ height: expandedBox === "insights" ? "calc(100vh - 210px)" : "450px", background: "#F3F4F6", overflow: "hidden" }}>
                                    {displayedMapMarkers.length > 0 ? (
                                        <MapContainer center={mapCenter} zoom={6} style={{ width: "100%", height: "100%" }}>
                                            <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                            <FitBounds markers={displayedMapMarkers} />
                                            {displayedMapMarkers.map((marker) => {
                                                const m = marker as any;
                                                const inChain: boolean = !!m.__inChain;
                                                const chainHighlightActive = selectedChainIndex !== null;

                                                let color: string;
                                                let fillColor: string;
                                                let fillOpacity: number;
                                                let weight: number;
                                                let radius: number;

                                                if (marker.colorMode === "focused-gold") {
                                                    color = "#FCD34D"; fillColor = "#F59E0B";
                                                    fillOpacity = 0.92; weight = 4; radius = 16;
                                                } else if (chainHighlightActive && inChain) {
                                                    const cc = getChainColor(selectedChainIndex!);
                                                    color = cc.marker; fillColor = cc.marker;
                                                    fillOpacity = 0.88; weight = 3;
                                                    radius = 12 + Math.min(marker.peopleCount, 5);
                                                } else if (chainHighlightActive && !inChain) {
                                                    color = "#D1D5DB"; fillColor = "#E5E7EB";
                                                    fillOpacity = 0.45; weight = 1; radius = 7;
                                                } else if (marker.colorMode === "scenario-red") {
                                                    color = "#F43F5E"; fillColor = "#F43F5E";
                                                    fillOpacity = 0.82; weight = 2;
                                                    radius = 10 + Math.min(marker.peopleCount, 6);
                                                } else {
                                                    color = "#34D399"; fillColor = "#10B981";
                                                    fillOpacity = 0.75; weight = 2; radius = 8;
                                                }

                                                return (
                                                    <CircleMarker key={marker.locationId} center={[marker.latitude, marker.longitude]} radius={radius}
                                                        pathOptions={{ color, fillColor, fillOpacity, weight }}>
                                                        <Popup>
                                                            <div>
                                                                <strong>{marker.locationName}</strong>
                                                                {activeScenario ? (
                                                                    <><div>Persone coinvolte: {marker.peopleCount}</div><div style={{ marginTop: "6px", fontSize: "12px" }}>{marker.peopleNames.join(", ")}</div></>
                                                                ) : (
                                                                    <div style={{ marginTop: "6px", fontSize: "12px" }}>Sede disponibile nel perimetro aziendale</div>
                                                                )}
                                                            </div>
                                                        </Popup>
                                                    </CircleMarker>
                                                );
                                            })}
                                        </MapContainer>
                                    ) : (
                                        <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", padding: "20px", textAlign: "center" }}>
                                            Nessuna sede geolocalizzata disponibile.
                                        </div>
                                    )}
                                </div>

                                {/* ── Colonna destra: tab PEOPLE / CHAINS ── */}
                                <div style={{ borderLeft: "1px solid #E5E7EB", background: "#FFFFFF", height: expandedBox === "insights" ? "calc(100vh - 210px)" : "450px", display: "grid", gridTemplateRows: "auto 1fr", overflow: "hidden" }}>

                                    {/* Tab bar interna */}
                                    <div style={{ display: "flex", gap: "4px", padding: "10px 12px 0px", borderBottom: "1px solid #E5E7EB", flexShrink: 0 }}>
                                        <button
                                            onClick={() => setRightPanelTab("PEOPLE")}
                                            style={{
                                                padding: "7px 12px", borderRadius: "10px 10px 0 0",
                                                fontSize: "12px", fontWeight: 600, cursor: "pointer",
                                                border: "1px solid transparent",
                                                borderBottom: rightPanelTab === "PEOPLE" ? "2px solid #6366F1" : "1px solid transparent",
                                                background: "transparent",
                                                color: rightPanelTab === "PEOPLE" ? "#6366F1" : "#6B7280",
                                                transition: "color 0.15s",
                                            }}
                                        >
                                            Persone coinvolte
                                        </button>
                                        <button
                                            onClick={() => setRightPanelTab("CHAINS")}
                                            style={{
                                                padding: "7px 12px", borderRadius: "10px 10px 0 0",
                                                fontSize: "12px", fontWeight: 600, cursor: "pointer",
                                                border: "1px solid transparent",
                                                borderBottom: rightPanelTab === "CHAINS" ? "2px solid #6366F1" : "1px solid transparent",
                                                background: "transparent",
                                                color: rightPanelTab === "CHAINS" ? "#6366F1" : "#6B7280",
                                                transition: "color 0.15s",
                                            }}
                                        >
                                            Catene trovate{activeScenario ? ` (${getScenarioViewChains(activeScenario).length})` : ""}
                                            {selectedChainIndex !== null && (
                                                <span style={{ marginLeft: 5, display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: getChainColor(selectedChainIndex).dot, verticalAlign: "middle" }} />
                                            )}
                                        </button>
                                    </div>

                                    {/* Contenuto tab (scorre, mappa resta ferma) */}
                                    <div style={{ overflowY: "auto", height: "100%" }}>

                                        {rightPanelTab === "PEOPLE" ? (
                                            /* ── PEOPLE: lista card persone ── */
                                            <div style={{ padding: "10px 12px", display: "grid", gap: "8px", alignContent: "start" }}>
                                                <div style={sectionSubtitleStyle}>
                                                    {activeScenario ? "Click su una persona per enfatizzare la sede" : "Seleziona uno scenario per vedere le persone"}
                                                    {selectedChainIndex !== null && (
                                                        <span style={{ marginLeft: 6, color: getChainColor(selectedChainIndex).border, fontWeight: 600 }}>
                                                            · filtro catena #{selectedChainIndex + 1} attivo
                                                        </span>
                                                    )}
                                                </div>
                                                {activeScenario ? (
                                                    activeScenarioPeople.length > 0 ? (
                                                        activeScenarioPeople.map((person) => {
                                                            const isFocused = focusedPersonId === person.id;
                                                            const isInChain = selectedChainIndex !== null && selectedChainUserIds.has(person.id);
                                                            const chainActive = selectedChainIndex !== null;
                                                            const cc = selectedChainIndex !== null ? getChainColor(selectedChainIndex) : null;
                                                            return (
                                                                <button key={person.id}
                                                                    onClick={() => setFocusedPersonId((prev) => prev === person.id ? null : person.id)}
                                                                    style={{
                                                                        textAlign: "left", padding: "10px 12px", borderRadius: "12px",
                                                                        border: isFocused ? "1px solid #FCD34D" : isInChain && cc ? `1px solid ${cc.border}` : "1px solid #E5E7EB",
                                                                        background: isFocused ? "#FEF3C7" : isInChain && cc ? cc.bg : "#FFFFFF",
                                                                        color: "#111827", cursor: "pointer", width: "100%",
                                                                        opacity: chainActive && !isInChain && !isFocused ? 0.45 : 1,
                                                                        transition: "opacity 0.2s, border 0.2s, background 0.2s",
                                                                    }}>
                                                                    <div style={{ fontWeight: 600, fontSize: "13px", lineHeight: 1.2 }}>{person.name}</div>
                                                                    <div style={{ marginTop: "4px", fontSize: "11px", color: "#6B7280" }}>{person.role !== "—" ? person.role : "Ruolo non disponibile"}</div>
                                                                    <div style={{ marginTop: "2px", fontSize: "11px", color: "#9CA3AF" }}>{person.locationName}</div>
                                                                </button>
                                                            );
                                                        })
                                                    ) : (
                                                        <div style={{ color: "#9CA3AF", fontSize: "13px" }}>Nessuna persona disponibile.</div>
                                                    )
                                                ) : globalLocationMarkers.length > 0 ? (
                                                    globalLocationMarkers.map((loc) => {
                                                        const isLocFocused = focusedLocationId === loc.locationId;
                                                        return (
                                                            <button key={loc.locationId}
                                                                onClick={() => setFocusedLocationId((prev) => prev === loc.locationId ? null : loc.locationId)}
                                                                style={{ textAlign: "left", padding: "10px 12px", borderRadius: "12px", border: isLocFocused ? "1px solid #FCD34D" : "1px solid #E5E7EB", background: isLocFocused ? "#FEF3C7" : "#FFFFFF", color: "#111827", fontSize: "13px", cursor: "pointer", width: "100%" }}>
                                                                {loc.locationName}
                                                            </button>
                                                        );
                                                    })
                                                ) : (
                                                    <div style={{ color: "#9CA3AF", fontSize: "13px" }}>Nessuna sede disponibile.</div>
                                                )}
                                                {!activeScenario && focusedLocationId && (
                                                    <button onClick={() => setFocusedLocationId(null)}
                                                        style={{ fontSize: "11px", color: "#6B7280", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}>
                                                        Deseleziona sede
                                                    </button>
                                                )}
                                            </div>

                                        ) : (
                                            /* ── CHAINS: lista catene ── */
                                            <div style={{ padding: "10px 12px", display: "grid", gap: "8px", alignContent: "start" }}>
                                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                                    <div style={sectionSubtitleStyle}>
                                                        {activeScenario
                                                            ? `${getScenarioViewChains(activeScenario).length} catene — click per evidenziare sulla mappa`
                                                            : "Seleziona uno scenario per vedere le catene"}
                                                    </div>
                                                    {selectedChainIndex !== null && (
                                                        <button
                                                            onClick={() => setSelectedChainIndex(null)}
                                                            style={{ fontSize: "11px", color: "#6B7280", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0, flexShrink: 0 }}
                                                        >
                                                            ✕ reset
                                                        </button>
                                                    )}
                                                </div>

                                                {!activeScenario ? (
                                                    <div style={{ color: "#9CA3AF", fontSize: "13px", paddingTop: "8px" }}>Seleziona uno scenario per vedere le catene.</div>
                                                ) : getScenarioViewChains(activeScenario).length === 0 ? (
                                                    <div style={{ color: "#9CA3AF", fontSize: "13px", paddingTop: "8px" }}>Nessuna catena disponibile.</div>
                                                ) : (
                                                    getScenarioViewChains(activeScenario).map((chain, idx) => {
                                                        const cc = getChainColor(idx);
                                                        const isSelected = selectedChainIndex === idx;
                                                        return (
                                                            <button
                                                                key={idx}
                                                                onClick={() => setSelectedChainIndex((prev) => prev === idx ? null : idx)}
                                                                style={{
                                                                    textAlign: "left",
                                                                    padding: "10px 12px 10px 15px",
                                                                    borderRadius: "12px",
                                                                    border: isSelected ? `2px solid ${cc.border}` : `1px solid ${cc.border}40`,
                                                                    background: isSelected ? cc.bg : "#FFFFFF",
                                                                    cursor: "pointer",
                                                                    display: "grid",
                                                                    gridTemplateColumns: "12px 1fr",
                                                                    gap: "10px",
                                                                    alignItems: "start",
                                                                    boxShadow: isSelected ? `0 0 0 2px ${cc.border}30` : "none",
                                                                    transition: "all 0.15s",
                                                                    width: "100%",
                                                                }}
                                                            >
                                                                <div style={{
                                                                    width: 12, height: 12, borderRadius: "50%",
                                                                    background: cc.dot, marginTop: 3, flexShrink: 0,
                                                                    boxShadow: isSelected ? `0 0 0 3px ${cc.dot}40` : "none",
                                                                }} />
                                                                <div>
                                                                    <div style={{ fontSize: "12px", fontWeight: 600, color: "#111827", lineHeight: 1.4 }}>
                                                                        {chain.peopleNames.slice(0, 5).join(" → ")}
                                                                        {chain.peopleNames.length > 5 && ` → +${chain.peopleNames.length - 5}`}
                                                                    </div>
                                                                    <div style={{ marginTop: "5px", display: "flex", gap: "10px", fontSize: "11px", color: "#6B7280" }}>
                                                                        <span>#{idx + 1}</span>
                                                                        <span>Lung. {chain.length}</span>
                                                                        {chain.avgPriority != null && (
                                                                            <span>Priorità {chain.avgPriority.toFixed(1)}</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </button>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginTop: "10px", display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "12px", color: "#9CA3AF" }}>
                                <div>Scenario attivo: {activeScenario?.scenario_code ?? "—"}</div>
                                <div>Persone coinvolte: {activeScenario ? activeScenarioPeople.length : "—"}</div>
                                <div>Sedi evidenziate: {displayedMapMarkers.length}</div>
                                <div>Reference data: {loadingReferenceData ? "caricamento..." : "ok"}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Row 2: Analytics — full width ── */}
                <div style={getBoxShellStyle("analytics", 280)} onClick={(e) => e.stopPropagation()}>
                    <div style={innerPanelPadding}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "16px" }}>
                            <div>
                                <h4 style={sectionTitleStyle}>Analytics</h4>
                                <div style={sectionSubtitleStyle}>Andamento scenari in base alla metrica selezionata</div>
                            </div>
                            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#6B7280" }}>
                                    Scegli analisi:
                                    <select value={analyticsMetric} onChange={(e) => setAnalyticsMetric(e.target.value as AnalyticsMetric)}
                                        style={{ background: "#FFFFFF", color: "#111827", border: "1px solid #E5E7EB", borderRadius: "12px", padding: "10px 12px", outline: "none" }}>
                                        <option value="avg_length">Lung media</option>
                                        <option value="unique_people">Persone coinvolte</option>
                                        <option value="total_chains">Num catene</option>
                                        <option value="coverage">Coverage</option>
                                        <option value="avg_priority">Priorità media</option>
                                    </select>
                                </label>
                                {renderExpandButton("analytics")}
                            </div>
                        </div>

                        <div style={{ ...subtleCardStyle, padding: "16px 18px 12px 18px", minHeight: expandedBox === "analytics" ? "calc(100vh - 160px)" : "200px", display: "grid", gridTemplateRows: "auto 1fr auto", gap: "12px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontSize: "13px", color: "#6B7280" }}>Metrica attiva</div>
                                    <div style={{ marginTop: "4px", fontSize: "22px", fontWeight: 700, color: "#111827" }}>{getAnalyticsMetricLabel(analyticsMetric)}</div>
                                </div>
                                <div style={{ fontSize: "12px", color: "#6B7280" }}>{analyticsSeries.length} scenari</div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(analyticsSeries.length, 1)}, minmax(28px, 1fr))`, gap: "14px", alignItems: "end", minHeight: expandedBox === "analytics" ? "380px" : "120px", paddingTop: "16px", borderTop: "1px solid #E5E7EB" }}>
                                {analyticsSeries.length > 0 ? (
                                    analyticsSeries.map((item) => (
                                        <div key={item.id} style={{ display: "grid", gap: "10px", alignItems: "end", cursor: "pointer" }}
                                            onClick={(e) => { e.stopPropagation(); setActiveScenarioId((prev) => prev === item.id ? null : item.id); setFocusedPersonId(null); }}
                                            title={`${item.label} • ${formatNumber(item.value, analyticsMetric === "avg_length" || analyticsMetric === "avg_priority" || analyticsMetric === "coverage" ? 2 : 0)}`}>
                                            <div style={{ height: expandedBox === "analytics" ? "300px" : "100px", display: "flex", alignItems: "end", justifyContent: "center" }}>
                                                <div style={{ width: "100%", maxWidth: "34px", height: `${item.heightPct}%`, minHeight: "16px", borderRadius: "14px 14px 8px 8px", background: item.isActive ? "#E8511A" : "#F5C4B0", boxShadow: item.isActive ? "0 4px 6px -1px rgba(232,81,26,0.4)" : "none" }} />
                                            </div>
                                            <div style={{ textAlign: "center", fontSize: "11px", color: item.isActive ? "#111827" : "#6B7280" }}>{item.shortLabel}</div>
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ color: "#9CA3AF", fontSize: "13px" }}>Nessuno scenario disponibile.</div>
                                )}
                            </div>

                            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", fontSize: "12px", color: "#6B7280", borderTop: "1px solid #E5E7EB", paddingTop: "10px" }}>
                                <div>Scenario attivo: {activeScenario?.scenario_code ?? "—"}</div>
                                <div>Valore attivo: {activeScenario ? formatNumber(getScenarioMetricValue(activeScenario, analyticsMetric), analyticsMetric === "avg_length" || analyticsMetric === "avg_priority" || analyticsMetric === "coverage" ? 2 : 0) : "—"}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminInterlocking;


