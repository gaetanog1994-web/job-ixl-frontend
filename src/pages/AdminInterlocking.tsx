import { useEffect, useMemo, useState } from "react";
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
type RightPanelTab = "MAP" | "PEOPLE";

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
};

const boxStyle: React.CSSProperties = {
    border: "1px solid #2f2f2f",
    borderRadius: "18px",
    padding: "18px",
    background: "#141414",
    boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
};

const mutedTextStyle: React.CSSProperties = {
    fontSize: "12px",
    color: "#8a8a8a",
};

const actionButtonStyle: React.CSSProperties = {
    background: "#242424",
    border: "1px solid #2f2f2f",
    color: "#f2e6d0",
    borderRadius: "12px",
    padding: "10px 14px",
    cursor: "pointer",
};

const selectedTabStyle: React.CSSProperties = {
    ...actionButtonStyle,
    background: "#2d2a22",
    border: "1px solid #756548",
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
            map.setView([markers[0].latitude, markers[0].longitude], 8);
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
    const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>("MAP");
    const [focusedPersonId, setFocusedPersonId] = useState<string | null>(null);

    const [usersDirectory, setUsersDirectory] = useState<AdminUserRow[]>([]);
    const [locationsDirectory, setLocationsDirectory] = useState<LocationRow[]>([]);
    const [rolesDirectory, setRolesDirectory] = useState<RoleRow[]>([]);

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

    const stopRowClick = (e: React.MouseEvent) => {
        e.stopPropagation();
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

            setRolesDirectory(roles);
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

    const activeScenarioChains = useMemo(() => {
        return getScenarioViewChains(activeScenario);
    }, [activeScenario, usersById]);

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
            const location =
                user?.location_id ? locationsById.get(user.location_id) ?? null : null;

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

    const activeScenarioLocationMarkers = useMemo<ScenarioLocationMarker[]>(() => {
        const grouped = new Map<string, ScenarioLocationMarker>();

        for (const person of activeScenarioPeople) {
            if (
                !person.locationId ||
                person.latitude === null ||
                person.longitude === null
            ) {
                continue;
            }

            const existing = grouped.get(person.locationId);
            if (existing) {
                existing.peopleCount += 1;
                existing.peopleNames.push(person.name);
                existing.isFocused =
                    existing.isFocused || focusedPersonId === person.id;
            } else {
                grouped.set(person.locationId, {
                    locationId: person.locationId,
                    locationName: person.locationName,
                    latitude: person.latitude,
                    longitude: person.longitude,
                    peopleCount: 1,
                    peopleNames: [person.name],
                    isFocused: focusedPersonId === person.id,
                });
            }
        }

        return Array.from(grouped.values());
    }, [activeScenarioPeople, focusedPersonId]);

    const mapCenter = useMemo<[number, number]>(() => {
        if (!activeScenarioLocationMarkers.length) return [41.9028, 12.4964];

        const latAvg =
            activeScenarioLocationMarkers.reduce((acc, m) => acc + m.latitude, 0) /
            activeScenarioLocationMarkers.length;
        const lngAvg =
            activeScenarioLocationMarkers.reduce((acc, m) => acc + m.longitude, 0) /
            activeScenarioLocationMarkers.length;

        return [latAvg, lngAvg];
    }, [activeScenarioLocationMarkers]);

    const allSelected = useMemo(() => {
        return scenarios.length > 0 && selectedScenarioIds.length === scenarios.length;
    }, [scenarios, selectedScenarioIds]);

    const handleBuildGraph = async () => {
        try {
            setLoadingGraph(true);
            setError(null);

            await appApi.adminWarmupNeo4j();
            const json = await appApi.syncGraph();

            setBuildResult({
                nodes: Number(json?.engine?.nodes ?? 0),
                relationships: Number(json?.engine?.relationships ?? 0),
            });
        } catch (err: any) {
            setError(err?.message ?? String(err));
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

    return (
        <div style={{ padding: "30px" }}>
            <h3>C. Tabelle di interlocking</h3>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1.1fr 1fr",
                    gap: "20px",
                    alignItems: "start",
                    marginTop: "20px",
                }}
            >
                <div style={{ display: "grid", gap: "20px" }}>
                    <div style={boxStyle}>
                        <div
                            style={{
                                margin: "0 0 15px 0",
                                display: "flex",
                                gap: "10px",
                                flexWrap: "wrap",
                                alignItems: "center",
                            }}
                        >
                            <label>
                                Strategia:
                                <select
                                    style={{ marginLeft: "8px" }}
                                    value={strategy}
                                    onChange={(e) => setStrategy(e.target.value as UiStrategy)}
                                >
                                    <option value="NONE">Nessuna</option>
                                    <option value="MAX_IMPACT">Massimo impatto</option>
                                    <option value="QUALITY_FIRST">Qualità delle scelte</option>
                                </select>
                            </label>

                            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                MaxLen:
                                <select
                                    value={maxLen}
                                    onChange={(e) => setMaxLen(Number(e.target.value))}
                                >
                                    {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((n) => (
                                        <option key={n} value={n}>
                                            {n}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <button onClick={handleBuildGraph} disabled={loadingGraph}>
                                {loadingGraph ? "Costruzione in corso…" : "Prepara simulazione"}
                            </button>

                            <button onClick={handleAnalyzeScenarios} disabled={loadingAnalyze}>
                                {loadingAnalyze ? "Analisi in corso…" : "Analizza scenari"}
                            </button>
                        </div>

                        {buildResult && (
                            <div
                                style={{
                                    marginTop: "10px",
                                    padding: "12px 14px",
                                    border: "1px solid #4CAF50",
                                    borderRadius: "12px",
                                    background: "#0f2a1d",
                                    color: "#9cffc7",
                                    width: "fit-content",
                                }}
                            >
                                ✅ <strong>Simulazione pronta</strong>
                                <div>Numero Persone: {buildResult.nodes}</div>
                                <div>Numero Candidature: {buildResult.relationships}</div>
                            </div>
                        )}

                        {error && (
                            <div
                                style={{
                                    marginTop: "15px",
                                    padding: "12px 14px",
                                    border: "1px solid #e74c3c",
                                    borderRadius: "12px",
                                    background: "#2a0f0f",
                                    color: "#ffb3b3",
                                    width: "fit-content",
                                }}
                            >
                                ❌ Errore: {error}
                            </div>
                        )}
                    </div>

                    <div style={{ ...boxStyle, minHeight: "360px" }}>
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: "14px",
                                gap: "12px",
                            }}
                        >
                            <div>
                                <h4 style={{ margin: 0 }}>Simulazioni e scenari</h4>
                                <div style={{ ...mutedTextStyle, marginTop: "4px" }}>
                                    Scenari salvati e persistiti su database
                                </div>
                            </div>

                            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                <button onClick={toggleSelectionMode}>
                                    {selectionMode ? "Annulla" : "Seleziona"}
                                </button>

                                {selectionMode && (
                                    <>
                                        <button onClick={handleSelectAll}>
                                            {allSelected ? "Deseleziona tutto" : "Seleziona tutto"}
                                        </button>
                                        <button
                                            onClick={handleDeleteSelected}
                                            disabled={selectedScenarioIds.length === 0 || deleting}
                                        >
                                            {deleting ? "Eliminazione…" : "Elimina"}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns:
                                    "44px 1fr 1.2fr 0.8fr 0.8fr 0.8fr 0.9fr 0.8fr 1.1fr 1fr 70px 44px",
                                gap: "8px",
                                padding: "0 8px 10px 8px",
                                fontSize: "11px",
                                color: "#8a8a8a",
                                textTransform: "uppercase",
                                letterSpacing: "0.04em",
                                alignItems: "center",
                            }}
                        >
                            <div />
                            <div>ID</div>
                            <div>Data e ora</div>
                            <div>Catene</div>
                            <div>Persone</div>
                            <div>Coverage</div>
                            <div>Lung media</div>
                            <div>Lung max</div>
                            <div>Priorità media</div>
                            <div>Strategia</div>
                            <div>CSV</div>
                            <div />
                        </div>

                        {loadingScenarios ? (
                            <div style={{ color: "#777", fontSize: "13px" }}>
                                Caricamento scenari...
                            </div>
                        ) : scenarios.length === 0 ? (
                            <div style={{ color: "#777", fontSize: "13px" }}>
                                Nessuno scenario disponibile.
                            </div>
                        ) : (
                            <div style={{ display: "grid", gap: "10px" }}>
                                {scenarios.map((scenario) => {
                                    const isExpanded = expandedScenarioIds.includes(scenario.id);
                                    const isSelected = selectedScenarioIds.includes(scenario.id);
                                    const isActive = activeScenarioId === scenario.id;

                                    const visibleChains =
                                        scenario.strategy !== "NONE" &&
                                            scenario.optimal_chains_json &&
                                            scenario.optimal_chains_json.length > 0
                                            ? scenario.optimal_chains_json.map((c) => ({
                                                peopleNames: c.nodeIds.map(
                                                    (id) => usersById.get(id)?.full_name ?? id
                                                ),
                                                avgPriority: c.avgPriority ?? null,
                                                length: c.length ?? c.nodeIds.length,
                                            }))
                                            : scenario.chains_json;

                                    return (
                                        <div
                                            key={scenario.id}
                                            onClick={() => handleScenarioRowClick(scenario.id)}
                                            style={{
                                                border: isActive
                                                    ? "1px solid #9f7b3a"
                                                    : "1px solid #2b2b2b",
                                                borderRadius: "12px",
                                                background: isActive
                                                    ? "#2b2418"
                                                    : isSelected
                                                        ? "#202632"
                                                        : "#191919",
                                                overflow: "hidden",
                                                cursor: "pointer",
                                                boxShadow: isActive
                                                    ? "0 0 0 1px rgba(159,123,58,0.2), 0 0 20px rgba(159,123,58,0.15)"
                                                    : "none",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: "grid",
                                                    gridTemplateColumns:
                                                        "44px 1fr 1.2fr 0.8fr 0.8fr 0.8fr 0.9fr 0.8fr 1.1fr 1fr 70px 44px",
                                                    gap: "8px",
                                                    alignItems: "center",
                                                    padding: "12px 8px",
                                                    fontSize: "13px",
                                                }}
                                            >
                                                <div style={{ display: "flex", justifyContent: "center" }}>
                                                    {selectionMode ? (
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onClick={stopRowClick}
                                                            onChange={() => toggleScenarioSelected(scenario.id)}
                                                        />
                                                    ) : null}
                                                </div>

                                                <div>{scenario.scenario_code}</div>
                                                <div>{formatDateTime(scenario.generated_at)}</div>
                                                <div>{scenario.total_chains}</div>
                                                <div>{scenario.unique_people}</div>
                                                <div>{formatNumber(scenario.coverage, 1)}%</div>
                                                <div>{formatNumber(scenario.avg_length, 2)}</div>
                                                <div>{scenario.max_length ?? "—"}</div>
                                                <div>{formatNumber(scenario.avg_priority, 2)}</div>
                                                <div>{getStrategyLabel(scenario.strategy)}</div>

                                                <div>
                                                    <button
                                                        onClick={(e) => {
                                                            stopRowClick(e);
                                                            exportScenarioCsv(scenario);
                                                        }}
                                                    >
                                                        CSV
                                                    </button>
                                                </div>

                                                <div>
                                                    <button
                                                        onClick={(e) => {
                                                            stopRowClick(e);
                                                            toggleExpanded(scenario.id);
                                                        }}
                                                        title={isExpanded ? "Comprimi" : "Espandi"}
                                                    >
                                                        {isExpanded ? "↓" : "→"}
                                                    </button>
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div
                                                    style={{
                                                        borderTop: "1px solid #2b2b2b",
                                                        background: "#151515",
                                                        padding: "10px 12px 14px 12px",
                                                    }}
                                                    onClick={stopRowClick}
                                                >
                                                    <div
                                                        style={{
                                                            display: "grid",
                                                            gridTemplateColumns: "80px 1fr 120px 100px",
                                                            gap: "8px",
                                                            padding: "0 0 10px 0",
                                                            fontSize: "11px",
                                                            color: "#8a8a8a",
                                                            textTransform: "uppercase",
                                                            letterSpacing: "0.04em",
                                                        }}
                                                    >
                                                        <div>ID catena</div>
                                                        <div>Persone coinvolte</div>
                                                        <div>Priorità</div>
                                                        <div>Lunghezza</div>
                                                    </div>

                                                    <div style={{ display: "grid", gap: "8px" }}>
                                                        {visibleChains.length === 0 ? (
                                                            <div style={{ color: "#777", fontSize: "13px" }}>
                                                                Nessuna catena disponibile.
                                                            </div>
                                                        ) : (
                                                            visibleChains.map((chain, index) => (
                                                                <div
                                                                    key={index}
                                                                    style={{
                                                                        display: "grid",
                                                                        gridTemplateColumns: "80px 1fr 120px 100px",
                                                                        gap: "8px",
                                                                        alignItems: "center",
                                                                        padding: "10px 0",
                                                                        borderTop: "1px solid #242424",
                                                                        fontSize: "13px",
                                                                    }}
                                                                >
                                                                    <div>{index + 1}</div>
                                                                    <div>
                                                                        {Array.isArray(chain.peopleNames)
                                                                            ? chain.peopleNames.join(" → ")
                                                                            : "—"}
                                                                    </div>
                                                                    <div>
                                                                        {typeof chain.avgPriority === "number"
                                                                            ? chain.avgPriority.toFixed(2)
                                                                            : "—"}
                                                                    </div>
                                                                    <div>{chain.length ?? "—"}</div>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ ...boxStyle, minHeight: "740px" }}>
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            gap: "14px",
                            marginBottom: "14px",
                            flexWrap: "wrap",
                        }}
                    >
                        <div>
                            <h4 style={{ margin: 0 }}>Scenario insight</h4>
                            <div style={{ ...mutedTextStyle, marginTop: "4px" }}>
                                {activeScenario
                                    ? `Scenario attivo: ${activeScenario.scenario_code}`
                                    : "Seleziona uno scenario per vedere sedi e persone coinvolte"}
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: "8px" }}>
                            <button
                                onClick={() => setRightPanelTab("MAP")}
                                style={rightPanelTab === "MAP" ? selectedTabStyle : actionButtonStyle}
                            >
                                Mappa
                            </button>
                            <button
                                onClick={() => setRightPanelTab("PEOPLE")}
                                style={rightPanelTab === "PEOPLE" ? selectedTabStyle : actionButtonStyle}
                            >
                                Lista persone
                            </button>
                        </div>
                    </div>

                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: rightPanelTab === "MAP" ? "1.4fr 0.9fr" : "1fr",
                            gap: "16px",
                            minHeight: "650px",
                        }}
                    >
                        {rightPanelTab === "MAP" ? (
                            <>
                                <div
                                    style={{
                                        border: "1px solid #2b2b2b",
                                        borderRadius: "16px",
                                        overflow: "hidden",
                                        minHeight: "650px",
                                        background: "#101010",
                                    }}
                                >
                                    {activeScenario ? (
                                        activeScenarioLocationMarkers.length > 0 ? (
                                            <MapContainer
                                                center={mapCenter}
                                                zoom={6}
                                                style={{ width: "100%", height: "650px" }}
                                            >
                                                <TileLayer
                                                    attribution='&copy; OpenStreetMap contributors'
                                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                                />
                                                <FitBounds markers={activeScenarioLocationMarkers} />
                                                {activeScenarioLocationMarkers.map((marker) => (
                                                    <CircleMarker
                                                        key={marker.locationId}
                                                        center={[marker.latitude, marker.longitude]}
                                                        radius={marker.isFocused ? 16 : 10 + Math.min(marker.peopleCount, 6)}
                                                        pathOptions={{
                                                            color: marker.isFocused ? "#ffd166" : "#ff4d4f",
                                                            fillColor: marker.isFocused ? "#ff8c42" : "#ff4d4f",
                                                            fillOpacity: marker.isFocused ? 0.9 : 0.7,
                                                            weight: marker.isFocused ? 4 : 2,
                                                        }}
                                                    >
                                                        <Popup>
                                                            <div>
                                                                <strong>{marker.locationName}</strong>
                                                                <div>Persone coinvolte: {marker.peopleCount}</div>
                                                                <div style={{ marginTop: "6px" }}>
                                                                    {marker.peopleNames.join(", ")}
                                                                </div>
                                                            </div>
                                                        </Popup>
                                                    </CircleMarker>
                                                ))}
                                            </MapContainer>
                                        ) : (
                                            <div
                                                style={{
                                                    height: "650px",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    color: "#8a8a8a",
                                                    padding: "20px",
                                                    textAlign: "center",
                                                }}
                                            >
                                                Nessuna sede geolocalizzata disponibile per questo scenario.
                                            </div>
                                        )
                                    ) : (
                                        <div
                                            style={{
                                                height: "650px",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                color: "#8a8a8a",
                                                padding: "20px",
                                                textAlign: "center",
                                            }}
                                        >
                                            Seleziona uno scenario per visualizzare la mappa delle sedi coinvolte.
                                        </div>
                                    )}
                                </div>

                                <div
                                    style={{
                                        border: "1px solid #2b2b2b",
                                        borderRadius: "16px",
                                        padding: "14px",
                                        background: "#111111",
                                        minHeight: "650px",
                                        display: "grid",
                                        gridTemplateRows: "auto 1fr",
                                        gap: "12px",
                                    }}
                                >
                                    <div>
                                        <div style={{ fontWeight: 600 }}>Persone coinvolte</div>
                                        <div style={{ ...mutedTextStyle, marginTop: "4px" }}>
                                            Clicca una persona per enfatizzare la sede in mappa
                                        </div>
                                    </div>

                                    <div
                                        style={{
                                            display: "grid",
                                            gap: "8px",
                                            alignContent: "start",
                                            overflowY: "auto",
                                        }}
                                    >
                                        {activeScenarioPeople.length === 0 ? (
                                            <div style={{ color: "#8a8a8a", fontSize: "13px" }}>
                                                Nessuna persona disponibile.
                                            </div>
                                        ) : (
                                            activeScenarioPeople.map((person) => {
                                                const isFocused = focusedPersonId === person.id;

                                                return (
                                                    <button
                                                        key={person.id}
                                                        onClick={() =>
                                                            setFocusedPersonId((prev) =>
                                                                prev === person.id ? null : person.id
                                                            )
                                                        }
                                                        style={{
                                                            textAlign: "left",
                                                            padding: "12px",
                                                            borderRadius: "12px",
                                                            border: isFocused
                                                                ? "1px solid #9f7b3a"
                                                                : "1px solid #2b2b2b",
                                                            background: isFocused ? "#2b2418" : "#171717",
                                                            color: "#f2e6d0",
                                                            cursor: "pointer",
                                                        }}
                                                    >
                                                        <div style={{ fontWeight: 600 }}>{person.name}</div>
                                                        <div style={{ ...mutedTextStyle, marginTop: "4px" }}>
                                                            {person.role !== "—" ? person.role : "Ruolo non disponibile"}
                                                        </div>
                                                        <div style={{ ...mutedTextStyle, marginTop: "2px" }}>
                                                            {person.locationName}
                                                        </div>
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div
                                style={{
                                    border: "1px solid #2b2b2b",
                                    borderRadius: "16px",
                                    background: "#111111",
                                    overflow: "hidden",
                                }}
                            >
                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "1.2fr 1fr 1fr 1fr 0.8fr",
                                        gap: "10px",
                                        padding: "14px 16px",
                                        fontSize: "11px",
                                        color: "#8a8a8a",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.04em",
                                        borderBottom: "1px solid #242424",
                                    }}
                                >
                                    <div>Nome</div>
                                    <div>Ruolo</div>
                                    <div>Sede</div>
                                    <div>Responsabile</div>
                                    <div>PBP</div>
                                </div>

                                {activeScenario ? (
                                    activeScenarioPeople.length > 0 ? (
                                        <div style={{ display: "grid" }}>
                                            {activeScenarioPeople.map((person) => (
                                                <div
                                                    key={person.id}
                                                    style={{
                                                        display: "grid",
                                                        gridTemplateColumns: "1.2fr 1fr 1fr 1fr 0.8fr",
                                                        gap: "10px",
                                                        padding: "14px 16px",
                                                        borderBottom: "1px solid #1f1f1f",
                                                        fontSize: "13px",
                                                        background:
                                                            focusedPersonId === person.id
                                                                ? "#2b2418"
                                                                : "transparent",
                                                    }}
                                                >
                                                    <div>{person.name}</div>
                                                    <div>{person.role}</div>
                                                    <div>{person.locationName}</div>
                                                    <div>{person.responsible}</div>
                                                    <div>{person.pbp}</div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div
                                            style={{
                                                padding: "20px",
                                                color: "#8a8a8a",
                                                fontSize: "13px",
                                            }}
                                        >
                                            Nessuna persona disponibile per lo scenario selezionato.
                                        </div>
                                    )
                                ) : (
                                    <div
                                        style={{
                                            padding: "20px",
                                            color: "#8a8a8a",
                                            fontSize: "13px",
                                        }}
                                    >
                                        Seleziona uno scenario per vedere la tabella delle persone coinvolte.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div
                        style={{
                            marginTop: "14px",
                            display: "flex",
                            gap: "18px",
                            flexWrap: "wrap",
                            ...mutedTextStyle,
                        }}
                    >
                        <div>Scenario attivo: {activeScenario?.scenario_code ?? "—"}</div>
                        <div>Persone coinvolte: {activeScenarioPeople.length}</div>
                        <div>Sedi coinvolte: {activeScenarioLocationMarkers.length}</div>
                        <div>
                            Reference data:{" "}
                            {loadingReferenceData ? "caricamento..." : "ok"}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminInterlocking;