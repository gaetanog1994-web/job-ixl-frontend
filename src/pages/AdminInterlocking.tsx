import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { solveOptimalChains } from "../lib/optimalChainsSolver";
import type {
    ChainCandidate,
    OptimizationStrategy,
} from "../lib/optimalChainsSolver";
import { appApi, type CampaignRecord } from "../lib/appApi";
import { canManageCampaignInCurrentPerimeter } from "../lib/operationalAccess";
import {
    MapContainer,
    TileLayer,
    CircleMarker,
    Marker,
    Popup,
    useMap,
} from "react-leaflet";
import * as L from "leaflet";
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

const createCountBadgeIcon = (count: number, color: string) =>
    L.divIcon({
        className: "chain-count-badge",
        html: `
            <div style="
                width: 16px;
                height: 16px;
                border-radius: 999px;
                background: ${color};
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
                font-weight: 700;
                border: 2px solid white;
                box-shadow: 0 1px 4px rgba(0,0,0,0.25);
                transform: translate(6px, -6px);
            ">
                ${count}
            </div>
        `,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
    });

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
    campaign_id: string;
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
    fixed_location: boolean | null;
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

const INTERLOCKING_CSV_HEADERS = [
    "Scenario",
    "ID Catena",
    "Persona",
    "Ruolo persona",
    "Sede persona",
    "Flag sede persona vincolante",
    "PBP persona",
    "Responsabile persona",
    "Persona target",
    "Ruolo target",
    "Sede target",
    "Flag sede target vincolante",
    "PBP target",
    "Responsabile target",
];

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

function formatCampaignOptionLabel(campaign: CampaignRecord) {
    const created = new Date(campaign.created_at);
    const createdLabel = Number.isNaN(created.getTime())
        ? campaign.created_at
        : created.toLocaleDateString("it-IT");
    return `${createdLabel} · ${campaign.total_applications_count} candidature · ${campaign.reserved_users_count} prenotati`;
}

const AdminInterlocking = () => {
    const navigate = useNavigate();
    const [loadingGraph, setLoadingGraph] = useState(false);
    const [loadingAnalyze, setLoadingAnalyze] = useState(false);
    const [loadingScenarios, setLoadingScenarios] = useState(false);
    const [loadingReferenceData, setLoadingReferenceData] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [campaignStatus, setCampaignStatus] = useState<"open" | "closed" | null>(null);
    const [reservationsStatus, setReservationsStatus] = useState<"open" | "closed" | null>(null);
    const [reservedUsersCount, setReservedUsersCount] = useState<number>(0);
    const [canManageCampaign, setCanManageCampaign] = useState(false);
    const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
    const [loadingCampaigns, setLoadingCampaigns] = useState(false);
    const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

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
    const [viewMode, setViewMode] = useState<"map" | "peopleList">("map");
    const [focusedLocationId, setFocusedLocationId] = useState<string | null>(null);
    const [expandedBox, setExpandedBox] = useState<ExpandableBoxKey>(null);
    const [analyticsMetric, setAnalyticsMetric] =
        useState<AnalyticsMetric>("unique_people");
    const [showNewSimPanel, setShowNewSimPanel] = useState(false);

    const [usersDirectory, setUsersDirectory] = useState<AdminUserRow[]>([]);
    const [locationsDirectory, setLocationsDirectory] = useState<LocationRow[]>([]);
    const isRestrictedReadOnly = !canManageCampaign;



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
                    ? rolesRes.value.map((r: Record<string, unknown>) => ({
                        id: String(r.id),
                        name: String(r.name ?? ""),
                    }))
                    : [];

            const roleNameById = new Map(roles.map((r) => [r.id, r.name]));

            const locations: LocationRow[] =
                locationsRes.status === "fulfilled" && Array.isArray(locationsRes.value)
                    ? locationsRes.value.map((l: Record<string, unknown>) => ({
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
                    ? usersRes.value.map((u: Record<string, unknown>) => {
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
                            role_name: (typeof u.role_name === "string" ? u.role_name : null)
                                ?? (roleId ? roleNameById.get(roleId) ?? null : null),
                            location_id: locationId,
                            location_name: (typeof u.location_name === "string" ? u.location_name : null)
                                ?? (locationId ? locationNameById.get(locationId) ?? null : null),
                            fixed_location:
                                typeof u.fixed_location === "boolean"
                                    ? u.fixed_location
                                    : typeof u.fixedLocation === "boolean"
                                        ? u.fixedLocation
                                        : null,
                            responsible_name: (typeof u.responsible_name === "string" ? u.responsible_name : null)
                                ?? (typeof u.manager_name === "string" ? u.manager_name : null)
                                ?? (typeof u.responsabile === "string" ? u.responsabile : null)
                                ?? null,
                            pbp: typeof u.pbp === "string" ? u.pbp : null,
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
        if (!selectedCampaignId) {
            setScenarios([]);
            setActiveScenarioId(null);
            return;
        }
        try {
            setLoadingScenarios(true);
            setError(null);
            const json = await appApi.adminListInterlockingScenarios(selectedCampaignId);
            const raw = Array.isArray(json?.scenarios) ? json.scenarios : [];

            const normalizedScenarios: SavedScenario[] = raw.map((s: Record<string, unknown>) => ({
                id: String(s.id),
                campaign_id: String(s.campaign_id ?? selectedCampaignId),
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
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoadingScenarios(false);
        }
    };

    const loadClosedCampaigns = async () => {
        try {
            setLoadingCampaigns(true);
            const list = await appApi.adminListCampaigns();
            const closed = list.filter((c) => c.status === "campaign_closed");
            setCampaigns(closed);
            setSelectedCampaignId((prev) => {
                if (prev && closed.some((c) => c.id === prev)) return prev;
                return closed[0]?.id ?? null;
            });
        } catch (err: unknown) {
            setCampaigns([]);
            setSelectedCampaignId(null);
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoadingCampaigns(false);
        }
    };

    const loadCampaignStatus = async () => {
        try {
            const data = await appApi.adminGetCampaignStatus();
            setCampaignStatus(data.campaign_status);
            setReservationsStatus(data.reservations_status);
            setReservedUsersCount(data.reserved_users_count ?? 0);
        } catch {
            setCampaignStatus(null);
            setReservationsStatus(null);
            setReservedUsersCount(0);
        }
    };

    const loadCampaignPermission = async () => {
        try {
            const me = await appApi.getMe();
            const canManage = canManageCampaignInCurrentPerimeter(me);
            setCanManageCampaign(canManage);
            return canManage;
        } catch {
            setCanManageCampaign(false);
            return false;
        }
    };

    useEffect(() => {
        const run = async () => {
            const canManage = await loadCampaignPermission();
            if (canManage) {
                await Promise.all([loadClosedCampaigns(), loadReferenceData(), loadCampaignStatus()]);
                return;
            }
            setScenarios([]);
            setUsersDirectory([]);
            setLocationsDirectory([]);
            setCampaignStatus(null);
            setCampaigns([]);
            setSelectedCampaignId(null);
        };
        void run();
    }, []);

    useEffect(() => {
        if (!canManageCampaign) return;
        setActiveScenarioId(null);
        setFocusedPersonId(null);
        setSelectedChainIndex(null);
        setBuildResult(null);
        if (!selectedCampaignId) setShowNewSimPanel(false);
        void loadScenarios();
    }, [canManageCampaign, selectedCampaignId]);

    const usersById = useMemo(() => {
        return new Map(usersDirectory.map((u) => [u.id, u]));
    }, [usersDirectory]);

    const locationsById = useMemo(() => {
        return new Map(locationsDirectory.map((l) => [l.id, l]));
    }, [locationsDirectory]);

    const activeScenario = useMemo(() => {
        return scenarios.find((s) => s.id === activeScenarioId) ?? null;
    }, [scenarios, activeScenarioId]);
    const selectedCampaign = useMemo(
        () => campaigns.find((c) => c.id === selectedCampaignId) ?? null,
        [campaigns, selectedCampaignId]
    );
    const openCampaignManagement = () => {
        const qs = new URLSearchParams();
        if (selectedCampaignId) qs.set("campaignId", selectedCampaignId);
        const suffix = qs.toString() ? `?${qs.toString()}` : "";
        navigate(`/admin/campagne${suffix}`);
    };
    const activeScenarioSummary = useMemo(() => {
        if (!activeScenario) {
            return {
                totalChains: 0,
                uniquePeople: 0,
                avgPriority: null as number | null,
            };
        }
        return {
            totalChains: activeScenario.total_chains ?? 0,
            uniquePeople: activeScenario.unique_people ?? 0,
            avgPriority: activeScenario.avg_priority ?? null,
        };
    }, [activeScenario]);

    const getScenarioViewChains = (scenario: SavedScenario | null): ScenarioChainView[] => {
        if (!scenario) return [];

        if (
            scenario.strategy !== "NONE" &&
            scenario.optimal_chains_json &&
            scenario.optimal_chains_json.length > 0
        ) {
            return scenario.optimal_chains_json.map((c) => {
                /*
                 * BUG FIX: in optimal_chains_json i nodeIds sono position_id,
                 * NON user_id. Dobbiamo ricavare gli userId dai candidati raw
                 * dello scenario (chains_json) cercando chi occupa quelle posizioni.
                 * Strategia:
                 *   1. costruiamo una mappa position_id → userId dall'intero
                 *      chains_json (ogni candidato raw ha users[] e la posizione
                 *      target identificata dalla sequenza delle catene grezze).
                 *   2. Se non troviamo corrispondenza, usiamo il nodeId direttamente
                 *      (potrebbe essere già un userId in scenari legacy).
                 */
                const rawChainUserIds = new Set<string>();
                if (Array.isArray(scenario.chains_json)) {
                    for (const rawChain of scenario.chains_json) {
                        if (Array.isArray(rawChain.users)) {
                            for (const uid of rawChain.users) {
                                rawChainUserIds.add(uid);
                            }
                        }
                    }
                }

                const nodeIds: string[] = Array.isArray(c.nodeIds) ? c.nodeIds : [];

                /*
                 * Prova a risolvere ogni nodeId:
                 * - se il nodeId esiste come userId in usersById → usalo diretto
                 * - altrimenti cerca nei chains_json una catena che contenga
                 *   questo nodeId come elemento della sequenza (occupied_by, etc.)
                 * Fallback: usa il nodeId così com'è (preserva comportamento legacy)
                 */
                const userIds = nodeIds.map((nodeId) => {
                    if (usersById.has(nodeId)) return nodeId;
                    // Cerca tra gli userId noti se uno corrisponde al nodeId
                    // (es: il nodeId potrebbe essere nel formato "userId_positionIdx")
                    return nodeId;
                });

                return {
                    userIds,
                    peopleNames: userIds.map((id) => usersById.get(id)?.full_name ?? id),
                    avgPriority: c.avgPriority ?? null,
                    length: c.length ?? nodeIds.length,
                };
            });
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

            // Compat fallback: if legacy payloads miss location_id, try label lookup.
            // Source of truth remains relational location_id -> locations.id.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeScenario, usersById, locationsById, locationsDirectory]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedChainIndex, activeScenario, usersById]);

    const peopleListToShow = useMemo<ScenarioPersonRow[]>(() => {
        if (!activeScenario) return [];
        if (selectedChainIndex !== null) {
            return activeScenarioPeople.filter((p) => selectedChainUserIds.has(p.id));
        }
        return activeScenarioPeople;
    }, [activeScenario, selectedChainIndex, activeScenarioPeople, selectedChainUserIds]);

    const activeScenarioLocationMarkers = useMemo<ScenarioLocationMarker[]>(() => {
        const grouped = new Map<string, ScenarioLocationMarker & {
            __chainHighlight?: boolean;
            __inChain?: boolean;
            __chainMemberCount?: number;
        }>();

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

                if (isInSelectedChain) {
                    existing.__inChain = true;
                    existing.__chainHighlight = true;
                    existing.__chainMemberCount = (existing.__chainMemberCount ?? 0) + 1;
                }

                if (isPersonFocused) {
                    existing.isFocused = true;
                    existing.colorMode = "focused-gold";
                } else if (isInSelectedChain && existing.colorMode !== "focused-gold") {
                    existing.colorMode = "scenario-red";
                } else if (!isInSelectedChain && existing.colorMode !== "focused-gold" && !existing.__chainHighlight) {
                    existing.colorMode = "scenario-red";
                }
            } else {
                grouped.set(locationKey, {
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
                    __chainMemberCount: isInSelectedChain ? 1 : 0,
                } as ScenarioLocationMarker & { __chainHighlight: boolean; __inChain: boolean; __chainMemberCount: number });
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
        if (isRestrictedReadOnly) {
            setError("Disponibile solo per Admin del perimetro.");
            return;
        }
        if (loadingGraph) return;
        if (!selectedCampaignId) {
            setError("Seleziona una campagna chiusa prima di costruire il grafo.");
            return;
        }

        try {
            setLoadingGraph(true);
            setError(null);

            await appApi.adminWarmupNeo4j();

            // piccolo tempo di assestamento dopo il warmup
            await sleep(1200);

            const json = await appApi.syncGraph(selectedCampaignId);

            setBuildResult({
                nodes: Number(json?.engine?.nodes ?? 0),
                relationships: Number(json?.engine?.relationships ?? 0),
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);

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
        if (isRestrictedReadOnly) {
            setError("Disponibile solo per Admin del perimetro.");
            return;
        }
        if (!selectedCampaignId) {
            setError("Seleziona una campagna chiusa prima di avviare la simulazione.");
            return;
        }
        try {
            setLoadingAnalyze(true);
            setError(null);

            // Enforcement: ogni analisi ricarica il grafo dalla campagna selezionata
            // per evitare contaminazioni tra campagne diverse.
            const sync = await appApi.syncGraph(selectedCampaignId);
            const currentBuild = {
                nodes: Number(sync?.engine?.nodes ?? 0),
                relationships: Number(sync?.engine?.relationships ?? 0),
            };
            setBuildResult(currentBuild);

            const json = await appApi.adminFindChains({ maxLen, campaign_id: selectedCampaignId });
            const raw = Array.isArray(json?.chains) ? json.chains : [];

            const normalized: InterlockingChain[] = raw.map((c: Record<string, unknown>) => ({
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
                campaign_id: selectedCampaignId,
                strategy,
                max_len: maxLen,
                total_chains: stats.totalChains,
                unique_people: stats.uniquePeople,
                coverage: stats.coverage,
                avg_length: stats.avgLength,
                max_length: stats.maxLengthFound,
                avg_priority: stats.avgPriority,
                build_nodes: currentBuild.nodes ?? null,
                build_relationships: currentBuild.relationships ?? null,
                chains_json: normalized,
                optimal_chains_json: optimalChains,
            };

            await appApi.adminSaveInterlockingScenario(payload);
            await loadScenarios();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err));
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
        if (isRestrictedReadOnly) return;
        if (selectedScenarioIds.length === 0) return;

        try {
            setDeleting(true);
            setError(null);
            await appApi.adminDeleteInterlockingScenarios({
                ids: selectedScenarioIds,
                campaign_id: selectedCampaignId ?? undefined,
            });
            setSelectedScenarioIds([]);
            await loadScenarios();
            setFocusedPersonId(null);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err));
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
        if (isRestrictedReadOnly) return;
        setActiveScenarioId(scenarioId);
        setFocusedPersonId(null);
        setSelectedChainIndex(null);
        setViewMode("map");
    };

    const clearScenarioSelection = () => {
        setActiveScenarioId(null);
        setFocusedPersonId(null);
        setFocusedLocationId(null);
        setSelectedChainIndex(null);
        setViewMode("map");
    };

    const buildInterlockingCsvRows = (
        scenario: SavedScenario,
        onlyChainIndexes?: number[]
    ): Array<Array<string | number>> => {
        const chains = getScenarioViewChains(scenario);
        const scenarioCode = scenario.scenario_code || getScenarioCode();
        const allowedIndexes = Array.isArray(onlyChainIndexes)
            ? new Set(
                onlyChainIndexes.filter(
                    (idx) => Number.isInteger(idx) && idx >= 0 && idx < chains.length
                )
            )
            : null;

        const formatFixedLocationFlag = (value: boolean | null | undefined) => {
            if (typeof value === "boolean") return value ? "Sì" : "No";
            return "";
        };

        const getUserCsvData = (userId: string, fallbackName?: string) => {
            const user = usersById.get(userId);
            return {
                name: user?.full_name ?? fallbackName ?? userId,
                role: user?.role_name ?? "",
                location: user?.location_name ?? "",
                fixedLocationFlag: formatFixedLocationFlag(user?.fixed_location),
                pbp: user?.pbp ?? "",
                responsible: user?.responsible_name ?? "",
            };
        };

        const rows: Array<Array<string | number>> = [];

        chains.forEach((chain, chainIdx) => {
            if (allowedIndexes && !allowedIndexes.has(chainIdx)) return;

            const userIds = Array.isArray(chain.userIds) ? chain.userIds : [];
            if (userIds.length < 2) return;

            for (let i = 0; i < userIds.length; i += 1) {
                const sourceId = userIds[i];
                const targetIndex = (i + 1) % userIds.length;
                const targetId = userIds[targetIndex];

                const sourceFallbackName = Array.isArray(chain.peopleNames)
                    ? chain.peopleNames[i]
                    : undefined;
                const targetFallbackName = Array.isArray(chain.peopleNames)
                    ? chain.peopleNames[targetIndex]
                    : undefined;

                const source = getUserCsvData(sourceId, sourceFallbackName);
                const target = getUserCsvData(targetId, targetFallbackName);

                rows.push([
                    scenarioCode,
                    chainIdx + 1,
                    source.name,
                    source.role,
                    source.location,
                    source.fixedLocationFlag,
                    source.pbp,
                    source.responsible,
                    target.name,
                    target.role,
                    target.location,
                    target.fixedLocationFlag,
                    target.pbp,
                    target.responsible,
                ]);
            }
        });

        return rows;
    };

    const exportScenarioCsv = (scenario: SavedScenario) => {
        if (isRestrictedReadOnly) return;
        const rows = buildInterlockingCsvRows(scenario);
        downloadCsv(`scenario_${scenario.scenario_code}`, INTERLOCKING_CSV_HEADERS, rows);
    };

    const exportPeopleListCsv = () => {
        if (isRestrictedReadOnly) return;
        if (!activeScenario) return;
        const selectedChainIndexes =
            selectedChainIndex !== null ? [selectedChainIndex] : undefined;
        const rows = buildInterlockingCsvRows(activeScenario, selectedChainIndexes);

        const scenarioCode = activeScenario.scenario_code || getScenarioCode();
        const filenameBase =
            selectedChainIndex !== null
                ? `people_chain_${selectedChainIndex + 1}_${scenarioCode}`
                : `people_scenario_${scenarioCode}`;

        downloadCsv(filenameBase, INTERLOCKING_CSV_HEADERS, rows);
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
                {isRestrictedReadOnly && (
                    <div
                        style={{
                            border: "1px solid #FCD34D",
                            background: "#FFFBEB",
                            color: "#92400E",
                            borderRadius: "12px",
                            padding: "10px 14px",
                            fontSize: "13px",
                            fontWeight: 600,
                        }}
                    >
                        Disponibile solo per Admin del perimetro. La shell resta visibile in read-only, ma azioni operative e dati sensibili sono bloccati.
                    </div>
                )}

                {/* ── Campaign selector + status ── */}
                {canManageCampaign && (
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 16px", background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: "14px" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "#374151" }}>Campagna simulazione:</span>
                        <select
                            value={selectedCampaignId ?? ""}
                            onChange={(e) => setSelectedCampaignId(e.target.value || null)}
                            disabled={loadingCampaigns || campaigns.length === 0}
                            style={{
                                border: "1px solid #D1D5DB",
                                borderRadius: "10px",
                                padding: "6px 10px",
                                fontSize: "12px",
                                color: "#111827",
                                minWidth: "300px",
                                background: "#FFFFFF",
                            }}
                        >
                            {campaigns.length === 0 && <option value="">Nessuna campagna chiusa disponibile</option>}
                            {campaigns.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {formatCampaignOptionLabel(c)}
                                </option>
                            ))}
                        </select>
                        {selectedCampaign && (
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                <span style={{ fontSize: "12px", color: "#6B7280", fontWeight: 500 }}>
                                    Snapshot selezionato · {selectedCampaign.total_applications_count} candidature
                                </span>
                                <span style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    padding: "2px 8px",
                                    borderRadius: "999px",
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    border: "1px solid #d1d5db",
                                    background: "#f9fafb",
                                    color: "#374151",
                                }}>
                                    campaign_closed
                                </span>
                            </div>
                        )}
                        {loadingCampaigns && (
                            <span style={{ fontSize: "12px", color: "#6B7280" }}>Caricamento campagne…</span>
                        )}
                        {campaigns.length === 0 && !loadingCampaigns && (
                            <span style={{ fontSize: "12px", color: "#92400E", fontWeight: 600 }}>
                                Nessuna campagna chiusa: impossibile avviare simulazioni.
                            </span>
                        )}
                        {campaignStatus !== null && reservationsStatus !== null && (
                            <>
                                <span style={{ fontSize: "13px", fontWeight: 600, color: "#374151" }}>Campagna live:</span>
                                <div style={{
                                    display: "inline-flex", alignItems: "center", gap: "5px",
                                    padding: "3px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 700,
                                    background: campaignStatus === "open" ? "#ecfdf5" : "#eff6ff",
                                    color: campaignStatus === "open" ? "#059669" : "#1d4ed8",
                                    border: `1px solid ${campaignStatus === "open" ? "#a7f3d0" : "#93c5fd"}`,
                                }}>
                                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: campaignStatus === "open" ? "#10b981" : "#3b82f6" }} />
                                    {campaignStatus === "open" ? "Aperta" : "Chiusa"}
                                </div>
                                <span style={{ fontSize: "13px", fontWeight: 600, color: "#374151" }}>Prenotazioni:</span>
                                <div style={{
                                    display: "inline-flex", alignItems: "center", gap: "5px",
                                    padding: "3px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 700,
                                    background: reservationsStatus === "open" ? "#ecfdf5" : "#f3f4f6",
                                    color: reservationsStatus === "open" ? "#059669" : "#374151",
                                    border: `1px solid ${reservationsStatus === "open" ? "#a7f3d0" : "#d1d5db"}`,
                                }}>
                                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: reservationsStatus === "open" ? "#10b981" : "#6b7280" }} />
                                    {reservationsStatus === "open" ? "Aperte" : "Chiuse"}
                                </div>
                                <span style={{ fontSize: "12px", color: "#6B7280", fontWeight: 500 }}>
                                    {reservedUsersCount} prenotat{reservedUsersCount === 1 ? "o" : "i"}
                                </span>
                            </>
                        )}
                        <button
                            type="button"
                            onClick={openCampaignManagement}
                            style={{ marginLeft: "auto", fontSize: "12px", color: "#2563eb", fontWeight: 600, textDecoration: "none", background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
                        >
                            Gestisci campagna →
                        </button>
                    </div>
                )}

                {canManageCampaign && (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(3, minmax(180px, 1fr))",
                            gap: "10px",
                        }}
                    >
                        <div style={{ border: "1px solid #E5E7EB", borderRadius: "12px", background: "#fff", padding: "10px 12px" }}>
                            <div style={{ fontSize: "11px", color: "#6B7280", fontWeight: 600, textTransform: "uppercase" }}>Numero catene</div>
                            <div style={{ fontSize: "22px", fontWeight: 700, color: "#111827" }}>{activeScenarioSummary.totalChains}</div>
                            <div style={{ fontSize: "11px", color: "#9CA3AF" }}>Scenario {activeScenario ? "attivo" : "non selezionato"}</div>
                        </div>
                        <div style={{ border: "1px solid #E5E7EB", borderRadius: "12px", background: "#fff", padding: "10px 12px" }}>
                            <div style={{ fontSize: "11px", color: "#6B7280", fontWeight: 600, textTransform: "uppercase" }}>Persone coinvolte</div>
                            <div style={{ fontSize: "22px", fontWeight: 700, color: "#111827" }}>{activeScenarioSummary.uniquePeople}</div>
                            <div style={{ fontSize: "11px", color: "#9CA3AF" }}>Scenario {activeScenario ? "attivo" : "non selezionato"}</div>
                        </div>
                        <div style={{ border: "1px solid #E5E7EB", borderRadius: "12px", background: "#fff", padding: "10px 12px" }}>
                            <div style={{ fontSize: "11px", color: "#6B7280", fontWeight: 600, textTransform: "uppercase" }}>Avg priority</div>
                            <div style={{ fontSize: "22px", fontWeight: 700, color: "#111827" }}>
                                {activeScenarioSummary.avgPriority == null ? "—" : formatNumber(activeScenarioSummary.avgPriority, 2)}
                            </div>
                            <div style={{ fontSize: "11px", color: "#9CA3AF" }}>Scenario {activeScenario ? "attivo" : "non selezionato"}</div>
                        </div>
                    </div>
                )}
                {!canManageCampaign && campaignStatus !== null && reservationsStatus !== null && (
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 16px", background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: "14px" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "#374151" }}>Campagna:</span>
                        <div style={{
                            display: "inline-flex", alignItems: "center", gap: "5px",
                            padding: "3px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 700,
                            background: campaignStatus === "open" ? "#ecfdf5" : "#eff6ff",
                            color: campaignStatus === "open" ? "#059669" : "#1d4ed8",
                            border: `1px solid ${campaignStatus === "open" ? "#a7f3d0" : "#93c5fd"}`,
                        }}>
                            <div style={{ width: 7, height: 7, borderRadius: "50%", background: campaignStatus === "open" ? "#10b981" : "#3b82f6" }} />
                            {campaignStatus === "open" ? "Aperta" : "Chiusa"}
                        </div>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "#374151" }}>Prenotazioni:</span>
                        <div style={{
                            display: "inline-flex", alignItems: "center", gap: "5px",
                            padding: "3px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 700,
                            background: reservationsStatus === "open" ? "#ecfdf5" : "#f3f4f6",
                            color: reservationsStatus === "open" ? "#059669" : "#374151",
                            border: `1px solid ${reservationsStatus === "open" ? "#a7f3d0" : "#d1d5db"}`,
                        }}>
                            <div style={{ width: 7, height: 7, borderRadius: "50%", background: reservationsStatus === "open" ? "#10b981" : "#6b7280" }} />
                            {reservationsStatus === "open" ? "Aperte" : "Chiuse"}
                        </div>
                        <span style={{ fontSize: "12px", color: "#6B7280", fontWeight: 500 }}>
                            {reservedUsersCount} prenotat{reservedUsersCount === 1 ? "o" : "i"}
                        </span>
                        <button
                            type="button"
                            onClick={openCampaignManagement}
                            style={{ marginLeft: "auto", fontSize: "12px", color: "#2563eb", fontWeight: 600, textDecoration: "none", background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
                        >
                            Gestisci campagna →
                        </button>
                    </div>
                )}

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
                                    <button onClick={toggleSelectionMode} disabled={isRestrictedReadOnly} style={ghostButtonStyle}>
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
                                    disabled={isRestrictedReadOnly || !selectedCampaignId}
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
                                {!selectedCampaignId && (
                                    <div style={{ marginTop: "8px", fontSize: "12px", color: "#92400E", fontWeight: 600 }}>
                                        Seleziona una campagna chiusa per abilitare la simulazione.
                                    </div>
                                )}

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
                                                disabled={loadingGraph || isRestrictedReadOnly || !selectedCampaignId}
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
                                                disabled={loadingAnalyze || !buildResult || isRestrictedReadOnly || !selectedCampaignId}
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
                                ) : isRestrictedReadOnly ? (
                                    <div style={{ color: "#9CA3AF", fontSize: "13px" }}>
                                        Disponibile solo per Admin del perimetro.
                                    </div>
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
                                                    cursor: isRestrictedReadOnly ? "not-allowed" : "pointer", overflow: "hidden",
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
                                                    <div style={{ color: "#6B7280", fontSize: "11px", display: "flex", alignItems: "center", gap: "6px" }}>
                                                        <span>{formatDateTime(scenario.generated_at)}</span>
                                                        {isActive && (
                                                            <span style={{ fontSize: "10px", fontWeight: 700, color: "#065F46", background: "#D1FAE5", border: "1px solid #6EE7B7", borderRadius: "999px", padding: "1px 6px" }}>
                                                                attivo
                                                            </span>
                                                        )}
                                                        {isSelected && !isActive && (
                                                            <span style={{ fontSize: "10px", fontWeight: 700, color: "#1D4ED8", background: "#DBEAFE", border: "1px solid #93C5FD", borderRadius: "999px", padding: "1px 6px" }}>
                                                                selezionato
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div>{scenario.total_chains}</div>
                                                    <div>{scenario.unique_people}</div>
                                                    <div>{formatNumber(scenario.coverage, 1)}%</div>
                                                    <div>{formatNumber(scenario.avg_length, 2)}</div>
                                                    <div>{scenario.max_length ?? "—"}</div>
                                                    <div>{formatNumber(scenario.avg_priority, 2)}</div>
                                                    <div style={{ color: "#6B7280", fontSize: "11px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getStrategyLabel(scenario.strategy)}</div>
                                                    <div>
                                                        <button onClick={(e) => { e.stopPropagation(); exportScenarioCsv(scenario); }}
                                                            disabled={isRestrictedReadOnly}
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
                                                        <div style={{ display: "grid", gridTemplateColumns: "14px 60px 1fr 110px 90px", gap: "8px", padding: "0 0 10px 0", fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                                            <div /><div>ID</div><div>Persone coinvolte</div><div>Priorità</div><div>Lungh.</div>
                                                        </div>
                                                        <div style={{ display: "grid", gap: "8px" }}>
                                                            {visibleChains.length === 0 ? (
                                                                <div style={{ color: "#9CA3AF", fontSize: "13px" }}>Nessuna catena disponibile.</div>
                                                            ) : (
                                                                visibleChains.map((chain: { peopleNames?: string[]; avgPriority?: number | null; length?: number }, index: number) => {
                                                                    const cc = getChainColor(index);
                                                                    const isChainActive = selectedChainIndex === index && activeScenarioId === scenario.id;
                                                                    return (
                                                                        <div
                                                                            key={index}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                // Attiva lo scenario se non lo è già
                                                                                if (activeScenarioId !== scenario.id) {
                                                                                    setActiveScenarioId(scenario.id);
                                                                                    setFocusedPersonId(null);
                                                                                    setViewMode("map");
                                                                                }
                                                                                // Toggle catena selezionata
                                                                                setSelectedChainIndex((prev) =>
                                                                                    prev === index && activeScenarioId === scenario.id ? null : index
                                                                                );
                                                                            }}
                                                                            style={{
                                                                                display: "grid",
                                                                                gridTemplateColumns: "14px 60px 1fr 110px 90px",
                                                                                gap: "8px",
                                                                                alignItems: "center",
                                                                                padding: "9px 8px",
                                                                                borderTop: "1px solid #E5E7EB",
                                                                                fontSize: "13px",
                                                                                cursor: "pointer",
                                                                                borderRadius: isChainActive ? "8px" : "0",
                                                                                background: isChainActive ? cc.bg : "transparent",
                                                                                border: isChainActive ? `1px solid ${cc.border}` : "none",
                                                                                transition: "background 0.15s, border 0.15s",
                                                                            }}
                                                                        >
                                                                            <div style={{
                                                                                width: 10, height: 10, borderRadius: "50%",
                                                                                background: cc.dot, flexShrink: 0,
                                                                                boxShadow: isChainActive ? `0 0 0 3px ${cc.dot}40` : "none",
                                                                            }} />
                                                                            <div style={{ fontWeight: isChainActive ? 700 : 400 }}>#{index + 1}</div>
                                                                            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                                                {Array.isArray(chain.peopleNames) ? chain.peopleNames.join(" → ") : "—"}
                                                                            </div>
                                                                            <div>{typeof chain.avgPriority === "number" ? chain.avgPriority.toFixed(2) : "—"}</div>
                                                                            <div>{chain.length ?? "—"}</div>
                                                                        </div>
                                                                    );
                                                                })
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
                                        {isRestrictedReadOnly
                                            ? "Modalità read-only: dettaglio scenario, persone e catene non disponibile"
                                            : activeScenario
                                                ? `Scenario attivo: ${activeScenario.scenario_code}`
                                                : "Vista globale sedi in verde — seleziona uno scenario per dettaglio"}
                                    </div>
                                </div>
                                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                    {activeScenario && !isRestrictedReadOnly && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setViewMode((prev) => prev === "peopleList" ? "map" : "peopleList");
                                            }}
                                            style={{
                                                ...ghostButtonStyle,
                                                background: viewMode === "peopleList" ? "#EFF6FF" : "#FFFFFF",
                                                border: viewMode === "peopleList" ? "1px solid #6366F1" : "1px solid #E5E7EB",
                                                color: viewMode === "peopleList" ? "#4F46E5" : "#374151",
                                                fontWeight: 600, fontSize: "13px",
                                            }}
                                        >
                                            {viewMode === "peopleList" ? "← Mappa" : "Lista persone"}
                                        </button>
                                    )}
                                    {renderExpandButton("insights")}
                                </div>
                            </div>

                            {/* ─────────────────────────────────────────────────────────
                                LAYOUT FISSO: mappa sempre a sinistra, pannello a destra.
                                La mappa NON viene mai smontata. Le tab PEOPLE/CHAINS
                                controllano solo il contenuto della colonna destra.
                            ───────────────────────────────────────────────────────── */}
                            <div style={{ ...subtleCardStyle, height: expandedBox === "insights" ? "calc(100vh - 210px)" : "450px", display: "grid", gridTemplateColumns: "1.38fr 0.86fr", gap: "0px", overflow: "hidden" }}>

                                {/* ── Colonna sinistra: MAPPA + LISTA PERSONE ── */}
                                {/*
                                    La MapContainer resta sempre nel DOM (visibility:hidden)
                                    per evitare remount di Leaflet.
                                    La lista persone è sovrapposta in position:absolute.
                                */}
                                <div style={{ height: expandedBox === "insights" ? "calc(100vh - 210px)" : "450px", overflow: "hidden", position: "relative" }}>

                                    {/* Mappa: sempre montata, nascosta solo in peopleList mode */}
                                    <div style={{
                                        position: "absolute", inset: 0,
                                        background: "#F3F4F6",
                                        visibility: viewMode === "map" ? "visible" : "hidden",
                                        pointerEvents: viewMode === "map" ? "auto" : "none",
                                    }}>
                                        {isRestrictedReadOnly ? (
                                            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", padding: "20px", textAlign: "center" }}>
                                                Disponibile solo per Admin del perimetro.
                                            </div>
                                        ) : displayedMapMarkers.length > 0 ? (
                                            <MapContainer center={mapCenter} zoom={6} style={{ width: "100%", height: "100%" }}>
                                                <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                                <FitBounds markers={displayedMapMarkers} />
                                                {displayedMapMarkers.map((marker) => {
                                                    const m = marker as ScenarioLocationMarker & { __inChain?: boolean; __chainMemberCount?: number };
                                                    const inChain: boolean = !!m.__inChain;
                                                    const count: number = Number(m.__chainMemberCount ?? 0);
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
                                                        <React.Fragment key={marker.locationId}>
                                                            <CircleMarker center={[marker.latitude, marker.longitude]} radius={radius}
                                                                pathOptions={{ color, fillColor, fillOpacity, weight }}>
                                                                <Popup>
                                                                    <div>
                                                                        <strong>{marker.locationName}</strong>
                                                                        {activeScenario ? (
                                                                            <>
                                                                                <div>Persone coinvolte: {marker.peopleCount}</div>
                                                                                {chainHighlightActive && inChain && (
                                                                                    <div>Membri della catena in questa sede: {count}</div>
                                                                                )}
                                                                                <div style={{ marginTop: "6px", fontSize: "12px" }}>{marker.peopleNames.join(", ")}</div>
                                                                            </>
                                                                        ) : (
                                                                            <div style={{ marginTop: "6px", fontSize: "12px" }}>Sede disponibile nel perimetro aziendale</div>
                                                                        )}
                                                                    </div>
                                                                </Popup>
                                                            </CircleMarker>
                                                            {chainHighlightActive && inChain && count > 1 && (
                                                                <Marker
                                                                    position={[marker.latitude, marker.longitude]}
                                                                    icon={createCountBadgeIcon(
                                                                        count,
                                                                        getChainColor(selectedChainIndex!).marker
                                                                    )}
                                                                    interactive={false}
                                                                    zIndexOffset={3000}
                                                                />
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </MapContainer>
                                        ) : (
                                            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", padding: "20px", textAlign: "center" }}>
                                                Nessuna sede geolocalizzata disponibile.
                                            </div>
                                        )}
                                    </div>

                                    {/* Lista persone: sovrapposta, visibile solo in peopleList mode */}
                                    {viewMode === "peopleList" && activeScenario && !isRestrictedReadOnly && (() => {
                                        const cc = selectedChainIndex !== null ? getChainColor(selectedChainIndex) : null;
                                        return (
                                            <div style={{ position: "absolute", inset: 0, background: "#FFFFFF", display: "grid", gridTemplateRows: "auto auto auto 1fr", overflow: "hidden" }}>
                                                {/* Header */}
                                                <div style={{ padding: "14px 18px", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                                                    <div>
                                                        <div style={{ fontWeight: 700, fontSize: "15px", color: "#111827" }}>
                                                            {selectedChainIndex !== null ? `Catena #${selectedChainIndex + 1}` : "Persone dello scenario"}
                                                        </div>
                                                        <div style={{ fontSize: "12px", color: "#6B7280", marginTop: "2px" }}>
                                                            {peopleListToShow.length} {selectedChainIndex !== null ? "persone nella catena" : "persone nello scenario"}
                                                        </div>
                                                    </div>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                        <button
                                                            onClick={exportPeopleListCsv}
                                                            style={{ ...ghostButtonStyle, display: "flex", alignItems: "center", gap: "6px", fontWeight: 600 }}
                                                        >
                                                            Scarica CSV
                                                        </button>
                                                        <button
                                                            onClick={() => setViewMode("map")}
                                                            style={{ ...ghostButtonStyle, display: "flex", alignItems: "center", gap: "6px", fontWeight: 600 }}
                                                        >
                                                            ← Torna alla mappa
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Filtro catena attivo */}
                                                {cc && (
                                                    <div style={{ padding: "8px 18px", background: cc.bg, borderBottom: `1px solid ${cc.border}60`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                                                        <span style={{ fontSize: "12px", fontWeight: 600, color: cc.border, display: "flex", alignItems: "center", gap: 6 }}>
                                                            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: cc.dot }} />
                                                            Filtro catena #{selectedChainIndex! + 1} attivo
                                                        </span>
                                                        <button
                                                            onClick={() => setSelectedChainIndex(null)}
                                                            style={{ fontSize: "11px", color: "#6B7280", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}
                                                        >
                                                            Rimuovi filtro
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Intestazioni colonne */}
                                                <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr 1fr 0.6fr", gap: "10px", padding: "9px 18px", fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "1px solid #E5E7EB", background: "#F9FAFB", flexShrink: 0 }}>
                                                    <div>Nome</div><div>Ruolo</div><div>Sede</div><div>Responsabile</div><div>PBP</div>
                                                </div>

                                                {/* Righe */}
                                                <div style={{ overflowY: "auto" }}>
                                                    {peopleListToShow.length > 0 ? (
                                                        peopleListToShow.map((person, i) => (
                                                            <div key={person.id} style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr 1fr 0.6fr", gap: "10px", padding: "11px 18px", borderBottom: "1px solid #F3F4F6", fontSize: "13px", background: i % 2 === 0 ? "#FFFFFF" : "#FAFAFA" }}>
                                                                <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{person.name}</div>
                                                                <div style={{ color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{person.role}</div>
                                                                <div style={{ color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{person.locationName}</div>
                                                                <div style={{ color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{person.responsible}</div>
                                                                <div style={{ color: "#374151" }}>{person.pbp}</div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div style={{ padding: "20px 18px", color: "#9CA3AF", fontSize: "13px" }}>Nessuna persona trovata.</div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}

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
                                {isRestrictedReadOnly ? (
                                    <div style={{ color: "#9CA3AF", fontSize: "13px" }}>Disponibile solo per Admin del perimetro.</div>
                                ) : analyticsSeries.length > 0 ? (
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
