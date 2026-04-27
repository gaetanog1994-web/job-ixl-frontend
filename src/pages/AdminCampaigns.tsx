import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { appApi, type CampaignDetail, type CampaignRecord, type CampaignLifecycleStatus } from "../lib/appApi";

type LifecycleAction = "openReservations" | "closeReservations" | "openCampaign" | "closeCampaign";
type CampaignTab = "lifecycle" | "candidatures" | "map";
type LocationRow = { id: string; name: string; latitude: number | null; longitude: number | null };

type CampaignMarker = {
    key: string;
    name: string;
    latitude: number;
    longitude: number;
    radius: number;
    stroke: string;
    fill: string;
    fillOpacity: number;
    weight: number;
    popupLines: string[];
};

type CampaignMapPerson = {
    key: string;
    fullName: string;
    roleName: string;
    locationName: string;
    latitude: number | null;
    longitude: number | null;
};

const STATUS_LABEL: Record<string, string> = {
    reservations_open: "Prenotazioni aperte",
    reservations_closed: "Prenotazioni chiuse",
    campaign_open: "Campagna aperta",
    campaign_closed: "Campagna chiusa",
};

const STATUS_COLOR: Record<string, { bg: string; color: string; border: string; dot: string }> = {
    reservations_open: { bg: "#eff6ff", color: "#1d4ed8", border: "#93c5fd", dot: "#3b82f6" },
    reservations_closed: { bg: "#f3f4f6", color: "#374151", border: "#d1d5db", dot: "#6b7280" },
    campaign_open: { bg: "#ecfdf5", color: "#059669", border: "#a7f3d0", dot: "#10b981" },
    campaign_closed: { bg: "#f3f4f6", color: "#374151", border: "#d1d5db", dot: "#6b7280" },
};

function StatusBadge({ status }: { status: string }) {
    const c = STATUS_COLOR[status] ?? STATUS_COLOR.campaign_closed;
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "3px 10px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                background: c.bg,
                color: c.color,
                border: `1px solid ${c.border}`,
            }}
        >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.dot, display: "inline-block" }} />
            {STATUS_LABEL[status] ?? status}
        </span>
    );
}

function formatDate(iso: string | null | undefined) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
}

function formatCampaignDate(iso: string | null | undefined) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("it-IT");
}

function FitMapBounds({ markers }: { markers: CampaignMarker[] }) {
    const map = useMap();

    useEffect(() => {
        if (!markers.length) return;
        if (markers.length === 1) {
            map.setView([markers[0].latitude, markers[0].longitude], 7);
            return;
        }
        const bounds = markers.map((m) => [m.latitude, m.longitude]) as [number, number][];
        map.fitBounds(bounds, { padding: [40, 40] });
    }, [map, markers]);

    return null;
}

function CampaignRow({
    campaign,
    campaignCode,
    isOpen,
    detail,
    loadingDetail,
    onToggle,
}: {
    campaign: CampaignRecord;
    campaignCode: string;
    isOpen: boolean;
    detail: CampaignDetail | null;
    loadingDetail: boolean;
    onToggle: () => void;
}) {
    return (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
            <button
                type="button"
                style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    textAlign: "left",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                }}
                onClick={onToggle}
            >
                <span
                    style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#9a3412",
                        background: "#fff7ed",
                        border: "1px solid #fdba74",
                        borderRadius: 999,
                        padding: "2px 8px",
                        minWidth: 44,
                        textAlign: "center",
                    }}
                >
                    {campaignCode}
                </span>
                <span style={{ fontSize: 13, color: "#6b7280", minWidth: 180 }}>{formatDate(campaign.created_at)}</span>
                <StatusBadge status={campaign.status} />
                <span style={{ fontSize: 12, color: "#374151", marginLeft: 8 }}>
                    {campaign.reserved_users_count} prenotat{campaign.reserved_users_count === 1 ? "o" : "i"}
                </span>
                <span style={{ fontSize: 12, color: "#374151" }}>
                    · {campaign.total_applications_count} candidature
                </span>
                <span style={{ marginLeft: "auto", fontSize: 13, color: "#9ca3af" }}>{isOpen ? "▲" : "▼"}</span>
            </button>

            {isOpen && (
                <div style={{ padding: "12px 16px", borderTop: "1px solid #e5e7eb", background: "#f9fafb", fontSize: 13, color: "#374151" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 24px", marginBottom: 12 }}>
                        <span>Prenotazioni aperte: <b>{formatDate(campaign.reservations_opened_at)}</b></span>
                        <span>Prenotazioni chiuse: <b>{formatDate(campaign.reservations_closed_at)}</b></span>
                        <span>Campagna aperta: <b>{formatDate(campaign.campaign_opened_at)}</b></span>
                        <span>Campagna chiusa: <b>{formatDate(campaign.campaign_closed_at)}</b></span>
                    </div>

                    {campaign.status !== "campaign_closed" && (
                        <div style={{ fontSize: 12, color: "#6b7280" }}>
                            Dettaglio candidature storiche disponibile dopo chiusura campagna.
                        </div>
                    )}

                    {campaign.status === "campaign_closed" && loadingDetail && (
                        <div style={{ fontSize: 12, color: "#6b7280" }}>Caricamento dettaglio campagna…</div>
                    )}

                    {campaign.status === "campaign_closed" && !loadingDetail && detail && (
                        <div style={{ fontSize: 12, color: "#374151" }}>
                            Snapshot disponibile: <b>{detail.applications.length} candidature archiviate</b>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function AdminCampaigns() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [lifecycle, setLifecycle] = useState<CampaignLifecycleStatus | null>(null);
    const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
    const [campaignDetails, setCampaignDetails] = useState<Record<string, CampaignDetail>>({});
    const [locations, setLocations] = useState<LocationRow[]>([]);
    const [openCampaignId, setOpenCampaignId] = useState<string | null>(null);
    const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);
    const [selectedMapPersonKey, setSelectedMapPersonKey] = useState<string | null>(null);
    const [mapDirection, setMapDirection] = useState<"from" | "to">("from");
    const [candidaturesSearch, setCandidaturesSearch] = useState("");
    const [filterCandidateRole, setFilterCandidateRole] = useState("");
    const [filterCandidateLocation, setFilterCandidateLocation] = useState("");
    const [filterTargetRole, setFilterTargetRole] = useState("");
    const [filterTargetDepartment, setFilterTargetDepartment] = useState("");
    const [candidaturesSortField, setCandidaturesSortField] = useState<"created_at" | "priority" | "candidate" | "target">("created_at");
    const [candidaturesSortDir, setCandidaturesSortDir] = useState<"asc" | "desc">("desc");
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [hoveredStep, setHoveredStep] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const lastRequestedCampaignIdRef = useRef<string | null>(null);

    const activeTab = (searchParams.get("tab") as CampaignTab | null) ?? "lifecycle";
    const selectedDataCampaignId = searchParams.get("campaignId")?.trim() || null;

    const setCampaignQuery = useCallback((nextCampaignId: string | null, nextTab?: CampaignTab) => {
        const next = new URLSearchParams(searchParams);
        if (nextCampaignId) next.set("campaignId", nextCampaignId);
        else next.delete("campaignId");
        if (nextTab) next.set("tab", nextTab);
        setSearchParams(next, { replace: true });
    }, [searchParams, setSearchParams]);

    const load = useCallback(async () => {
        try {
            const [lc, list, locs] = await Promise.all([
                appApi.adminGetCampaignStatus(),
                appApi.adminListCampaigns(),
                appApi.adminGetLocations(),
            ]);
            setLifecycle(lc);
            setCampaigns(list);
            const normalizedLocs: LocationRow[] = Array.isArray(locs)
                ? locs.map((l: Record<string, unknown>) => ({
                    id: String(l.id ?? ""),
                    name: String(l.name ?? ""),
                    latitude: l.latitude == null ? null : Number(l.latitude),
                    longitude: l.longitude == null ? null : Number(l.longitude),
                }))
                : [];
            setLocations(normalizedLocs);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Errore caricamento campagne");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const closedCampaigns = useMemo(
        () => campaigns.filter((c) => c.status === "campaign_closed"),
        [campaigns]
    );

    const campaignCodeById = useMemo(() => {
        const sorted = [...campaigns].sort((a, b) => {
            const ta = new Date(a.created_at).getTime();
            const tb = new Date(b.created_at).getTime();
            if (ta !== tb) return ta - tb;
            return a.id.localeCompare(b.id);
        });
        const map = new Map<string, string>();
        sorted.forEach((campaign, index) => {
            map.set(campaign.id, String(index + 1).padStart(3, "0"));
        });
        return map;
    }, [campaigns]);

    useEffect(() => {
        if (!closedCampaigns.length) return;
        const exists = selectedDataCampaignId && closedCampaigns.some((c) => c.id === selectedDataCampaignId);
        if (!exists) {
            setCampaignQuery(closedCampaigns[0].id, activeTab);
        }
    }, [closedCampaigns, selectedDataCampaignId, setCampaignQuery, activeTab]);

    const selectedDataCampaign = useMemo(
        () => (selectedDataCampaignId ? campaigns.find((c) => c.id === selectedDataCampaignId) ?? null : null),
        [campaigns, selectedDataCampaignId]
    );

    const ensureCampaignDetailLoaded = useCallback(async (campaignId: string) => {
        if (!campaignId || campaignDetails[campaignId]) return;
        setLoadingDetailId(campaignId);
        try {
            const detail = await appApi.adminGetCampaignDetail(campaignId);
            setCampaignDetails((prev) => ({ ...prev, [campaignId]: detail }));
        } catch (e) {
            setError(e instanceof Error ? e.message : "Errore caricamento dettaglio campagna");
        } finally {
            setLoadingDetailId(null);
        }
    }, [campaignDetails]);

    useEffect(() => {
        if (!selectedDataCampaignId) return;
        void ensureCampaignDetailLoaded(selectedDataCampaignId);
    }, [selectedDataCampaignId, ensureCampaignDetailLoaded]);

    useEffect(() => {
        const requestedCampaignId = String(searchParams.get("campaignId") ?? "").trim();
        if (!requestedCampaignId) return;
        const targetCampaign = campaigns.find((c) => c.id === requestedCampaignId);
        if (!targetCampaign) return;
        const requestedChanged = lastRequestedCampaignIdRef.current !== targetCampaign.id;
        if (requestedChanged || openCampaignId === null) {
            setOpenCampaignId(targetCampaign.id);
        }
        if (targetCampaign.status === "campaign_closed") {
            void ensureCampaignDetailLoaded(targetCampaign.id);
        }
        lastRequestedCampaignIdRef.current = targetCampaign.id;
    }, [searchParams, campaigns, openCampaignId, ensureCampaignDetailLoaded]);

    async function runAction(action: LifecycleAction) {
        if (actionLoading) return;
        setActionLoading(true);
        setError(null);
        try {
            let data: CampaignLifecycleStatus;
            if (action === "openReservations") data = await appApi.adminOpenReservations();
            else if (action === "closeReservations") data = await appApi.adminCloseReservations();
            else if (action === "openCampaign") data = await appApi.adminOpenCampaign();
            else data = await appApi.adminCloseCampaign();
            setLifecycle(data);
            const list = await appApi.adminListCampaigns();
            setCampaigns(list);
            if (action === "closeCampaign") {
                setOpenCampaignId(null);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "Errore azione campagna");
        } finally {
            setActionLoading(false);
        }
    }

    async function handleToggleCampaignDetail(campaign: CampaignRecord) {
        const willOpen = openCampaignId !== campaign.id;
        setOpenCampaignId(willOpen ? campaign.id : null);
        if (willOpen && campaign.status === "campaign_closed") {
            setCampaignQuery(campaign.id, activeTab);
        }
        if (!willOpen || campaign.status !== "campaign_closed") return;
        await ensureCampaignDetailLoaded(campaign.id);
    }

    const cs = lifecycle?.campaign_status ?? "closed";
    const rs = lifecycle?.reservations_status ?? "closed";
    const reservedCount = lifecycle?.reserved_users_count ?? 0;
    const availableCount = lifecycle?.available_users_count ?? 0;

    const canOpenReservations = cs === "closed" && rs === "closed";
    const canCloseReservations = cs === "closed" && rs === "open";
    const canOpenCampaign = cs === "closed" && rs === "closed";
    const canCloseCampaign = cs === "open";

    const lifecycleHint = canCloseCampaign
        ? "Campagna attiva: puoi chiuderla per congelare snapshot e azzerare il ciclo operativo."
        : canOpenCampaign
            ? "Prenotazioni chiuse: puoi aprire la campagna anche con 0 prenotati."
            : canCloseReservations
                ? "Prenotazioni attive: chiudile prima di aprire la campagna."
                : canOpenReservations
                    ? "Ciclo in stato iniziale: puoi aprire la finestra prenotazioni."
                    : "Azione non disponibile nello stato lifecycle corrente.";

    const stepActionByKey: Record<string, LifecycleAction | null> = {
        reservations_open: canOpenReservations ? "openReservations" : null,
        reservations_closed: canCloseReservations ? "closeReservations" : null,
        campaign_open: canOpenCampaign ? "openCampaign" : null,
        campaign_closed: canCloseCampaign ? "closeCampaign" : null,
    };

    const activeCampaignId =
        typeof lifecycle?.campaign_id === "string" && lifecycle.campaign_id.trim().length > 0
            ? lifecycle.campaign_id
            : null;
    const activeCampaign = activeCampaignId
        ? campaigns.find((c) => c.id === activeCampaignId) ?? null
        : null;

    const lifecyclePhase: "reservations_open" | "reservations_closed" | "campaign_open" | "campaign_closed" =
        cs === "open"
            ? "campaign_open"
            : rs === "open"
                ? "reservations_open"
                : activeCampaignId
                    ? "reservations_closed"
                    : "campaign_closed";

    const stepLabelByKey: Record<string, string> = {
        reservations_open:
            lifecyclePhase === "reservations_open" ? "Prenotazioni aperte" : "Apri prenotazioni",
        reservations_closed:
            (lifecyclePhase === "reservations_closed" || lifecyclePhase === "campaign_open" || lifecyclePhase === "campaign_closed")
                ? "Prenotazioni chiuse"
                : "Chiudi prenotazioni",
        campaign_open:
            lifecyclePhase === "campaign_open" ? "Campagna aperta" : "Apri campagna",
        campaign_closed:
            lifecyclePhase === "campaign_closed" ? "Campagna chiusa" : "Chiudi campagna",
    };

    const selectedDetail = selectedDataCampaignId ? campaignDetails[selectedDataCampaignId] ?? null : null;
    const selectedApplications = selectedDetail?.applications ?? [];

    const locationByName = useMemo(() => {
        const map = new Map<string, LocationRow>();
        for (const loc of locations) {
            const key = loc.name.trim().toLowerCase();
            if (key) map.set(key, loc);
        }
        return map;
    }, [locations]);

    const mapGraph = useMemo(() => {
        const byKey = new Map<string, CampaignMapPerson>();
        const outgoingByKey = new Map<string, Set<string>>();
        const incomingByKey = new Map<string, Set<string>>();

        const makePersonKey = (
            userId: string | null | undefined,
            fullName: string | null | undefined,
            locationName: string | null | undefined,
            side: "candidate" | "target"
        ) => {
            const id = String(userId ?? "").trim();
            if (id) return `user:${id}`;
            const normalizedName = String(fullName ?? "sconosciuto").trim().toLowerCase();
            const normalizedLocation = String(locationName ?? "sede-sconosciuta").trim().toLowerCase();
            return `${side}:${normalizedName}:${normalizedLocation}`;
        };

        const ensurePerson = (
            key: string,
            fullName: string | null | undefined,
            roleName: string | null | undefined,
            locationName: string | null | undefined
        ) => {
            const normalizedName = String(fullName ?? "").trim() || "Utente sconosciuto";
            const normalizedRole = String(roleName ?? "").trim() || "—";
            const normalizedLocation = String(locationName ?? "").trim() || "—";
            const loc = locationByName.get(normalizedLocation.toLowerCase());
            const latitude = loc?.latitude != null ? Number(loc.latitude) : null;
            const longitude = loc?.longitude != null ? Number(loc.longitude) : null;
            if (!byKey.has(key)) {
                byKey.set(key, {
                    key,
                    fullName: normalizedName,
                    roleName: normalizedRole,
                    locationName: normalizedLocation,
                    latitude,
                    longitude,
                });
            }
        };

        const addEdge = (fromKey: string, toKey: string) => {
            if (fromKey === toKey) return;
            const outgoing = outgoingByKey.get(fromKey) ?? new Set<string>();
            outgoing.add(toKey);
            outgoingByKey.set(fromKey, outgoing);
            const incoming = incomingByKey.get(toKey) ?? new Set<string>();
            incoming.add(fromKey);
            incomingByKey.set(toKey, incoming);
        };

        for (const row of selectedApplications) {
            const candidateKey = makePersonKey(row.user_id, row.candidate_full_name, row.candidate_location_name, "candidate");
            ensurePerson(candidateKey, row.candidate_full_name, row.candidate_role_name, row.candidate_location_name);
            const targetName = row.target_full_name ?? row.position_title ?? "Destinazione";
            const targetKey = makePersonKey(row.target_user_id, targetName, row.target_location_name, "target");
            ensurePerson(targetKey, targetName, row.target_role_name, row.target_location_name);
            addEdge(candidateKey, targetKey);
        }

        const people = Array.from(byKey.values()).sort((a, b) => a.fullName.localeCompare(b.fullName, "it"));
        return { people, outgoingByKey, incomingByKey };
    }, [selectedApplications, locationByName]);

    const mapPeople = mapGraph.people;

    const mapMarkers = useMemo<CampaignMarker[]>(() => {
        const geolocated = mapPeople.filter((person) => person.latitude != null && person.longitude != null);
        if (!geolocated.length) return [];

        if (!selectedMapPersonKey) {
            return geolocated.map((person) => ({
                key: person.key,
                name: person.fullName,
                latitude: Number(person.latitude),
                longitude: Number(person.longitude),
                radius: 8,
                stroke: "#0f766e",
                fill: "#34d399",
                fillOpacity: 0.68,
                weight: 2,
                popupLines: [person.fullName, `${person.roleName} · ${person.locationName}`],
            }));
        }

        const selected = mapPeople.find((person) => person.key === selectedMapPersonKey) ?? null;
        if (!selected) return [];

        const relationKeys =
            mapDirection === "from"
                ? mapGraph.outgoingByKey.get(selected.key) ?? new Set<string>()
                : mapGraph.incomingByKey.get(selected.key) ?? new Set<string>();

        const related = Array.from(relationKeys)
            .map((key) => mapPeople.find((person) => person.key === key) ?? null)
            .filter((person): person is CampaignMapPerson => Boolean(person))
            .filter((person) => person.latitude != null && person.longitude != null);

        const markers: CampaignMarker[] = [];
        if (selected.latitude != null && selected.longitude != null) {
            markers.push({
                key: `selected:${selected.key}`,
                name: selected.fullName,
                latitude: Number(selected.latitude),
                longitude: Number(selected.longitude),
                radius: 11,
                stroke: "#0f172a",
                fill: "#f59e0b",
                fillOpacity: 0.9,
                weight: 3,
                popupLines: [
                    `${selected.fullName} (riferimento)`,
                    `${selected.roleName} · ${selected.locationName}`,
                ],
            });
        }

        const relationStroke = mapDirection === "from" ? "#1d4ed8" : "#b91c1c";
        const relationFill = mapDirection === "from" ? "#3b82f6" : "#ef4444";

        for (const person of related) {
            markers.push({
                key: `related:${person.key}`,
                name: person.fullName,
                latitude: Number(person.latitude),
                longitude: Number(person.longitude),
                radius: 9,
                stroke: relationStroke,
                fill: relationFill,
                fillOpacity: 0.72,
                weight: 2,
                popupLines: [
                    person.fullName,
                    `${person.roleName} · ${person.locationName}`,
                    mapDirection === "from" ? "Candidatura DA utente selezionato" : "Candidatura VERSO utente selezionato",
                ],
            });
        }

        return markers;
    }, [mapPeople, selectedMapPersonKey, mapDirection, mapGraph.outgoingByKey, mapGraph.incomingByKey]);

    const activeTabSafe: CampaignTab = activeTab === "candidatures" || activeTab === "map" || activeTab === "lifecycle"
        ? activeTab
        : "lifecycle";

    useEffect(() => {
        setSelectedMapPersonKey(null);
        setMapDirection("from");
    }, [selectedDataCampaignId, activeTabSafe]);

    useEffect(() => {
        setCandidaturesSearch("");
        setFilterCandidateRole("");
        setFilterCandidateLocation("");
        setFilterTargetRole("");
        setFilterTargetDepartment("");
        setCandidaturesSortField("created_at");
        setCandidaturesSortDir("desc");
    }, [selectedDataCampaignId]);

    const candidateRoles = useMemo(
        () => Array.from(new Set(selectedApplications.map((a) => a.candidate_role_name).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, "it")),
        [selectedApplications]
    );
    const candidateLocations = useMemo(
        () => Array.from(new Set(selectedApplications.map((a) => a.candidate_location_name).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, "it")),
        [selectedApplications]
    );
    const targetRoles = useMemo(
        () => Array.from(new Set(selectedApplications.map((a) => a.target_role_name).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, "it")),
        [selectedApplications]
    );
    const targetDepartments = useMemo(
        () => Array.from(new Set(selectedApplications.map((a) => a.target_org_unit_name).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, "it")),
        [selectedApplications]
    );

    const filteredApplications = useMemo(() => {
        let rows = [...selectedApplications];
        const q = candidaturesSearch.trim().toLowerCase();
        if (q) {
            rows = rows.filter((a) =>
                (a.candidate_full_name ?? "").toLowerCase().includes(q) ||
                (a.candidate_role_name ?? "").toLowerCase().includes(q) ||
                (a.candidate_location_name ?? "").toLowerCase().includes(q) ||
                (a.target_full_name ?? "").toLowerCase().includes(q) ||
                (a.target_role_name ?? "").toLowerCase().includes(q) ||
                (a.target_org_unit_name ?? "").toLowerCase().includes(q) ||
                (a.target_location_name ?? "").toLowerCase().includes(q) ||
                (a.position_title ?? "").toLowerCase().includes(q)
            );
        }
        if (filterCandidateRole) rows = rows.filter((a) => a.candidate_role_name === filterCandidateRole);
        if (filterCandidateLocation) rows = rows.filter((a) => a.candidate_location_name === filterCandidateLocation);
        if (filterTargetRole) rows = rows.filter((a) => a.target_role_name === filterTargetRole);
        if (filterTargetDepartment) rows = rows.filter((a) => a.target_org_unit_name === filterTargetDepartment);

        rows.sort((a, b) => {
            let va: string | number = "";
            let vb: string | number = "";
            if (candidaturesSortField === "created_at") {
                va = new Date(a.original_created_at ?? 0).getTime();
                vb = new Date(b.original_created_at ?? 0).getTime();
            } else if (candidaturesSortField === "priority") {
                va = a.priority ?? 9999;
                vb = b.priority ?? 9999;
            } else if (candidaturesSortField === "candidate") {
                va = a.candidate_full_name ?? "";
                vb = b.candidate_full_name ?? "";
            } else {
                va = a.target_full_name ?? a.position_title ?? "";
                vb = b.target_full_name ?? b.position_title ?? "";
            }
            if (va < vb) return candidaturesSortDir === "asc" ? -1 : 1;
            if (va > vb) return candidaturesSortDir === "asc" ? 1 : -1;
            return 0;
        });

        return rows;
    }, [
        selectedApplications,
        candidaturesSearch,
        filterCandidateRole,
        filterCandidateLocation,
        filterTargetRole,
        filterTargetDepartment,
        candidaturesSortField,
        candidaturesSortDir,
    ]);

    const candidaturesHasFilters = Boolean(
        candidaturesSearch || filterCandidateRole || filterCandidateLocation || filterTargetRole || filterTargetDepartment
    );

    const resetCandidaturesFilters = () => {
        setCandidaturesSearch("");
        setFilterCandidateRole("");
        setFilterCandidateLocation("");
        setFilterTargetRole("");
        setFilterTargetDepartment("");
    };

    const handleCandidaturesSort = (field: "created_at" | "priority" | "candidate" | "target") => {
        if (candidaturesSortField === field) {
            setCandidaturesSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
            return;
        }
        setCandidaturesSortField(field);
        setCandidaturesSortDir("asc");
    };

    const sortIcon = (field: "created_at" | "priority" | "candidate" | "target") =>
        candidaturesSortField === field ? (candidaturesSortDir === "asc" ? " ↑" : " ↓") : " ⇅";

    if (loading) {
        return <div style={{ padding: 40, color: "#64748b" }}>Caricamento campagne candidature…</div>;
    }

    return (
        <div style={{ padding: "16px 40px 28px", fontFamily: "'Inter', sans-serif", maxWidth: 1400 }}>

            {error && (
                <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", color: "#dc2626", fontSize: 13, marginBottom: 20 }}>
                    {error}
                </div>
            )}

            <section style={{ marginBottom: 20 }}>
                <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 14px", background: "#f8fafc" }}>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "auto minmax(0, 1fr) auto",
                            gap: "10px 12px",
                            alignItems: "center",
                            marginBottom: 8,
                        }}
                    >
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                            Stato campagna
                        </div>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(4, minmax(110px, 1fr))",
                                gap: "8px",
                            }}
                        >
                        {[
                            { key: "reservations_open" },
                            { key: "reservations_closed" },
                            { key: "campaign_open" },
                            { key: "campaign_closed" },
                        ].map((step) => (
                            <button
                                key={step.key}
                                type="button"
                                disabled={!stepActionByKey[step.key] || actionLoading}
                                onClick={() => {
                                    const action = stepActionByKey[step.key];
                                    if (!action || actionLoading) return;
                                    void runAction(action);
                                }}
                                onMouseEnter={() => setHoveredStep(step.key)}
                                onMouseLeave={() => setHoveredStep((prev) => (prev === step.key ? null : prev))}
                                style={{
                                    borderRadius: 8,
                                    border: `1px solid ${lifecyclePhase === step.key ? "#fb923c" : "#e5e7eb"}`,
                                    background: lifecyclePhase === step.key ? "#fff7ed" : "#ffffff",
                                    color: lifecyclePhase === step.key ? "#9a3412" : "#6b7280",
                                    boxShadow: lifecyclePhase === step.key
                                        ? "0 0 0 1px rgba(251,146,60,0.35), 0 0 18px rgba(251,146,60,0.28)"
                                        : (stepActionByKey[step.key] && hoveredStep === step.key)
                                            ? "0 0 0 1px rgba(251,146,60,0.28), 0 0 14px rgba(251,146,60,0.24)"
                                            : "none",
                                    fontSize: 12,
                                    fontWeight: 600,
                                    padding: "7px 10px",
                                    textAlign: "left",
                                    cursor: stepActionByKey[step.key] && !actionLoading ? "pointer" : "default",
                                    opacity: !stepActionByKey[step.key] && lifecyclePhase !== step.key ? 0.75 : 1,
                                    transition: "box-shadow 140ms ease, border-color 140ms ease, background-color 140ms ease",
                                }}
                            >
                                {stepLabelByKey[step.key]}
                            </button>
                        ))}
                        </div>
                        <div style={{ fontSize: 12, color: "#374151", fontWeight: 600, whiteSpace: "nowrap" }}>
                            {activeCampaign ? `ID ${campaignCodeById.get(activeCampaign.id) ?? "—"}` : "Nessuna attiva"}
                        </div>
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>
                        Stato corrente: <b style={{ color: "#334155" }}>{STATUS_LABEL[lifecyclePhase]}</b>. {lifecycleHint}
                        {activeCampaign ? ` · ${reservedCount} prenotati, ${availableCount} disponibili.` : ""}
                    </div>
                </div>
            </section>

            <section style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: "#374151", margin: 0 }}>Dati campagna chiusa</h3>
                    <select
                        value={selectedDataCampaignId ?? ""}
                        onChange={(e) => setCampaignQuery(e.target.value || null, activeTabSafe)}
                        style={{
                            minWidth: 520,
                            maxWidth: "100%",
                            border: "1px solid #d1d5db",
                            borderRadius: 8,
                            padding: "8px 10px",
                            fontSize: 13,
                            background: "#fff",
                            color: "#111827",
                        }}
                    >
                        {closedCampaigns.length === 0 ? (
                            <option value="">Nessuna campagna chiusa disponibile</option>
                        ) : (
                            closedCampaigns.map((c) => {
                                const code = campaignCodeById.get(c.id) ?? "—";
                                const label = `${code} - ${formatCampaignDate(c.campaign_opened_at ?? c.created_at)} / ${formatCampaignDate(c.campaign_closed_at)} · ${c.total_applications_count} candidature · ${c.reserved_users_count} prenotati`;
                                return <option key={c.id} value={c.id}>{label}</option>;
                            })
                        )}
                    </select>
                    <div
                        style={{
                            marginLeft: "auto",
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                            border: "1px solid #e5e7eb",
                            background: "#f8fafc",
                            borderRadius: 12,
                            padding: "6px 8px",
                        }}
                    >
                        {[
                            { id: "lifecycle", label: "Lifecycle + Storico" },
                            { id: "candidatures", label: "Lista candidature" },
                            { id: "map", label: "Mappa candidature" },
                        ].map((tab) => {
                            const isActive = activeTabSafe === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setCampaignQuery(selectedDataCampaignId, tab.id as CampaignTab)}
                                    style={{
                                        borderRadius: 999,
                                        border: `1px solid ${isActive ? "#fb923c" : "#d1d5db"}`,
                                        background: isActive ? "#fff7ed" : "#fff",
                                        color: isActive ? "#9a3412" : "#374151",
                                        fontSize: 12,
                                        fontWeight: 700,
                                        padding: "6px 12px",
                                        cursor: "pointer",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {selectedDataCampaign && (
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                        <div style={metricBoxStyle}>
                            <div style={metricLabelStyle}>ID campagna</div>
                            <div style={metricValueStyle}>{campaignCodeById.get(selectedDataCampaign.id) ?? "—"}</div>
                        </div>
                        <div style={metricBoxStyle}>
                            <div style={metricLabelStyle}>Candidature snapshot</div>
                            <div style={metricValueStyle}>{selectedApplications.length}</div>
                        </div>
                        <div style={metricBoxStyle}>
                            <div style={metricLabelStyle}>Marker mappa</div>
                            <div style={metricValueStyle}>{mapMarkers.length}</div>
                        </div>
                        <div style={metricBoxStyle}>
                            <div style={metricLabelStyle}>Persone cliccabili</div>
                            <div style={metricValueStyle}>{mapPeople.length}</div>
                        </div>
                    </div>
                )}

                {loadingDetailId === selectedDataCampaignId && (
                    <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>Caricamento dettagli campagna…</div>
                )}

                {activeTabSafe === "candidatures" && (
                    <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
                        <div style={{ padding: "14px 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Lista candidature</div>
                                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                                    {filteredApplications.length} di {selectedApplications.length} candidature snapshot
                                </div>
                            </div>
                            {candidaturesHasFilters && (
                                <button
                                    type="button"
                                    onClick={resetCandidaturesFilters}
                                    style={{
                                        borderRadius: 999,
                                        border: "1px solid #d1d5db",
                                        background: "#fff",
                                        color: "#374151",
                                        fontSize: 12,
                                        fontWeight: 700,
                                        padding: "6px 12px",
                                        cursor: "pointer",
                                    }}
                                >
                                    ↺ Azzera filtri
                                </button>
                            )}
                        </div>

                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", padding: "12px 16px 14px", borderBottom: "1px solid #e5e7eb", alignItems: "center" }}>
                            <input
                                type="text"
                                value={candidaturesSearch}
                                onChange={(e) => setCandidaturesSearch(e.target.value)}
                                placeholder="Cerca nome, ruolo, sede, reparto…"
                                style={{
                                    flex: 1,
                                    minWidth: 210,
                                    border: "1px solid #d1d5db",
                                    borderRadius: 10,
                                    padding: "8px 10px",
                                    fontSize: 13,
                                    color: "#111827",
                                    background: "#fff",
                                }}
                            />
                            <select value={filterCandidateRole} onChange={(e) => setFilterCandidateRole(e.target.value)} style={tableFilterSelectStyle}>
                                <option value="">Ruolo candidato</option>
                                {candidateRoles.map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
                            <select value={filterCandidateLocation} onChange={(e) => setFilterCandidateLocation(e.target.value)} style={tableFilterSelectStyle}>
                                <option value="">Sede candidato</option>
                                {candidateLocations.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <select value={filterTargetRole} onChange={(e) => setFilterTargetRole(e.target.value)} style={tableFilterSelectStyle}>
                                <option value="">Ruolo target</option>
                                {targetRoles.map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
                            <select value={filterTargetDepartment} onChange={(e) => setFilterTargetDepartment(e.target.value)} style={tableFilterSelectStyle}>
                                <option value="">Reparto target</option>
                                {targetDepartments.map((d) => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>

                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 1320 }}>
                                <thead>
                                    <tr>
                                        <th colSpan={3} style={candidateGroupHeaderStyle}>Candidato</th>
                                        <th colSpan={4} style={targetGroupHeaderStyle}>Posizione target</th>
                                        <th colSpan={3} style={applicationGroupHeaderStyle}>Candidatura</th>
                                    </tr>
                                    <tr style={{ background: "#fafafa" }}>
                                        <th style={tableThStyle} onClick={() => handleCandidaturesSort("candidate")}>
                                            Nome{sortIcon("candidate")}
                                        </th>
                                        <th style={tableThStyle}>Ruolo</th>
                                        <th style={{ ...tableThStyle, borderRight: "2px solid #e5e7eb" }}>Sede</th>

                                        <th style={tableThStyle}>Occupato da</th>
                                        <th style={tableThStyle}>Ruolo</th>
                                        <th style={tableThStyle}>Reparto</th>
                                        <th style={{ ...tableThStyle, borderRight: "2px solid #e5e7eb" }}>Sede</th>

                                        <th style={tableThStyle} onClick={() => handleCandidaturesSort("created_at")}>
                                            Data{sortIcon("created_at")}
                                        </th>
                                        <th style={tableThStyle} onClick={() => handleCandidaturesSort("priority")}>
                                            Priorità{sortIcon("priority")}
                                        </th>
                                        <th style={tableThStyle}>ID</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredApplications.length === 0 ? (
                                        <tr>
                                            <td style={tableTdStyle} colSpan={10}>
                                                {selectedApplications.length === 0
                                                    ? "Nessuna candidatura archiviata per questa campagna."
                                                    : "Nessun risultato con i filtri correnti."}
                                            </td>
                                        </tr>
                                    ) : filteredApplications.map((row, index) => (
                                        <tr
                                            key={row.id}
                                            style={{ background: index % 2 === 0 ? "#ffffff" : "#fafafa" }}
                                        >
                                            <td style={tableTdStyle}>
                                                {row.candidate_full_name ?? "—"}
                                            </td>
                                            <td style={tableTdStyle}>
                                                <span style={candidatePillStyle}>{row.candidate_role_name ?? "—"}</span>
                                            </td>
                                            <td style={{ ...tableTdStyle, borderRight: "2px solid #e5e7eb" }}>
                                                {row.candidate_location_name ?? "—"}
                                            </td>

                                            <td style={tableTdStyle}>
                                                {row.target_full_name ?? "—"}
                                            </td>
                                            <td style={tableTdStyle}>
                                                <span style={targetPillStyle}>{row.target_role_name ?? "—"}</span>
                                            </td>
                                            <td style={tableTdStyle}>{row.target_org_unit_name ?? "—"}</td>
                                            <td style={{ ...tableTdStyle, borderRight: "2px solid #e5e7eb" }}>
                                                {row.target_location_name ?? "—"}
                                            </td>

                                            <td style={tableTdStyle}>{formatDate(row.original_created_at)}</td>
                                            <td style={tableTdStyle}>
                                                {row.priority != null ? <span style={priorityBadgeStyle}>{row.priority}</span> : "—"}
                                            </td>
                                            <td style={tableTdStyle}>{row.id.slice(0, 8)}…</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTabSafe === "map" && (
                    <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
                        <div style={{ padding: "10px 12px", borderBottom: "1px solid #e5e7eb", fontSize: 13, color: "#6b7280" }}>
                            Mappa utenti attivi della campagna selezionata: vista completa iniziale, poi filtro DA/VERSO su persona selezionata.
                        </div>
                        <div style={{ height: 520, position: "relative", display: "grid", gridTemplateColumns: "1.75fr 0.55fr", minHeight: 0 }}>
                            {mapMarkers.length === 0 ? (
                                <div style={{
                                    position: "absolute",
                                    inset: 0,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "#9ca3af",
                                    fontSize: 14,
                                    background: "#f8fafc",
                                }}>
                                    Nessuna sede geolocalizzata disponibile per questa campagna.
                                </div>
                            ) : (
                                <>
                                    <div style={{ minHeight: 0 }}>
                                        <MapContainer
                                            center={[41.9028, 12.4964]}
                                            zoom={6}
                                            style={{ width: "100%", height: "100%" }}
                                            scrollWheelZoom={true}
                                        >
                                            <TileLayer
                                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                            />
                                            <FitMapBounds markers={mapMarkers} />
                                            {mapMarkers.map((marker) => (
                                                <CircleMarker
                                                    key={marker.key}
                                                    center={[marker.latitude, marker.longitude]}
                                                    radius={marker.radius}
                                                    pathOptions={{
                                                        color: marker.stroke,
                                                        fillColor: marker.fill,
                                                        fillOpacity: marker.fillOpacity,
                                                        weight: marker.weight,
                                                    }}
                                                >
                                                    <Popup>
                                                        <div style={{ fontSize: 12 }}>
                                                            {marker.popupLines.map((line, index) => (
                                                                <div key={`${marker.key}:${index}`} style={{ fontWeight: index === 0 ? 700 : 500, marginBottom: index === 0 ? 4 : 0 }}>
                                                                    {line}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </Popup>
                                                </CircleMarker>
                                            ))}
                                        </MapContainer>
                                    </div>
                                    <div style={{ borderLeft: "1px solid #e5e7eb", background: "#fff", minHeight: 0, display: "grid", gridTemplateRows: "auto 1fr" }}>
                                        <div style={{ padding: "10px 12px", borderBottom: "1px solid #e5e7eb" }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Persone coinvolte</div>
                                            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                                                <button
                                                    type="button"
                                                    onClick={() => setMapDirection("from")}
                                                    style={{
                                                        borderRadius: 999,
                                                        border: `1px solid ${mapDirection === "from" ? "#1d4ed8" : "#d1d5db"}`,
                                                        background: mapDirection === "from" ? "#eff6ff" : "#fff",
                                                        color: mapDirection === "from" ? "#1d4ed8" : "#4b5563",
                                                        fontSize: 11,
                                                        fontWeight: 700,
                                                        padding: "4px 10px",
                                                        cursor: "pointer",
                                                    }}
                                                >
                                                    DA
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setMapDirection("to")}
                                                    style={{
                                                        borderRadius: 999,
                                                        border: `1px solid ${mapDirection === "to" ? "#b91c1c" : "#d1d5db"}`,
                                                        background: mapDirection === "to" ? "#fef2f2" : "#fff",
                                                        color: mapDirection === "to" ? "#b91c1c" : "#4b5563",
                                                        fontSize: 11,
                                                        fontWeight: 700,
                                                        padding: "4px 10px",
                                                        cursor: "pointer",
                                                    }}
                                                >
                                                    VERSO
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedMapPersonKey(null)}
                                                    style={{
                                                        borderRadius: 999,
                                                        border: "1px solid #d1d5db",
                                                        background: "#fff",
                                                        color: "#4b5563",
                                                        fontSize: 11,
                                                        fontWeight: 700,
                                                        padding: "4px 10px",
                                                        cursor: "pointer",
                                                        marginLeft: "auto",
                                                    }}
                                                >
                                                    Reset
                                                </button>
                                            </div>
                                            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>
                                                {selectedMapPersonKey
                                                    ? mapDirection === "from"
                                                        ? "Blu: utenti verso cui il selezionato si è candidato"
                                                        : "Rosso: utenti che si sono candidati verso il selezionato"
                                                    : "Nessuna selezione: vedi tutti i partecipanti con colore unico"}
                                            </div>
                                        </div>
                                        <div style={{ overflowY: "auto", padding: "8px", display: "grid", gap: 7, alignContent: "start" }}>
                                            {mapPeople.length === 0 ? (
                                                <div style={{ fontSize: 12, color: "#9ca3af" }}>Nessuna persona geolocalizzabile.</div>
                                            ) : mapPeople.map((person) => {
                                                const isActive = selectedMapPersonKey === person.key;
                                                return (
                                                    <button
                                                        key={person.key}
                                                        type="button"
                                                        onClick={() => setSelectedMapPersonKey(person.key)}
                                                        style={{
                                                            textAlign: "left",
                                                            borderRadius: 10,
                                                            border: isActive ? "1px solid #f59e0b" : "1px solid #e5e7eb",
                                                            background: isActive ? "#fffbeb" : "#fff",
                                                            padding: "8px 9px",
                                                            cursor: "pointer",
                                                            opacity: person.latitude != null && person.longitude != null ? 1 : 0.72,
                                                        }}
                                                        title={person.latitude != null && person.longitude != null ? "Evidenzia sede sulla mappa" : "Sede non geolocalizzata"}
                                                    >
                                                        <div style={{ fontWeight: 600, fontSize: 12, color: "#111827" }}>{person.fullName}</div>
                                                        <div style={{ fontSize: 11, color: "#4b5563", marginTop: 2 }}>{person.roleName}</div>
                                                        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>
                                                            {person.locationName}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </section>

            {activeTabSafe === "lifecycle" && (
                <section>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: "#374151", marginBottom: 12 }}>
                        Storico campagne del perimetro {campaigns.length > 0 ? `(${campaigns.length})` : ""}
                    </h3>
                    {campaigns.length === 0 ? (
                        <div style={{ color: "#9ca3af", fontSize: 13 }}>Nessuna campagna registrata.</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {campaigns.map((campaign) => (
                                <CampaignRow
                                    key={campaign.id}
                                    campaign={campaign}
                                    campaignCode={campaignCodeById.get(campaign.id) ?? "—"}
                                    isOpen={openCampaignId === campaign.id}
                                    detail={campaignDetails[campaign.id] ?? null}
                                    loadingDetail={loadingDetailId === campaign.id}
                                    onToggle={() => { void handleToggleCampaignDetail(campaign); }}
                                />
                            ))}
                        </div>
                    )}
                </section>
            )}
        </div>
    );
}

const tableThStyle: React.CSSProperties = {
    textAlign: "left",
    fontWeight: 700,
    color: "#374151",
    borderBottom: "1px solid #e5e7eb",
    padding: "8px 10px",
    fontSize: 11,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    userSelect: "none",
};

const tableTdStyle: React.CSSProperties = {
    borderBottom: "1px solid #f1f5f9",
    padding: "8px 10px",
    color: "#111827",
    verticalAlign: "top",
    whiteSpace: "nowrap",
};

const metricBoxStyle: React.CSSProperties = {
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    background: "#fff",
    padding: "8px 10px",
    minWidth: 150,
};

const metricLabelStyle: React.CSSProperties = {
    fontSize: 11,
    color: "#6b7280",
    fontWeight: 600,
    textTransform: "uppercase",
};

const metricValueStyle: React.CSSProperties = {
    marginTop: 4,
    fontSize: 20,
    color: "#111827",
    fontWeight: 700,
};

const tableFilterSelectStyle: React.CSSProperties = {
    minWidth: 160,
    height: 36,
    border: "1px solid #d1d5db",
    borderRadius: 10,
    background: "#fff",
    color: "#111827",
    fontSize: 13,
    padding: "0 10px",
};

const candidateGroupHeaderStyle: React.CSSProperties = {
    textAlign: "left",
    padding: "10px 10px 6px",
    fontSize: 10.5,
    fontWeight: 700,
    color: "#9a3412",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    borderBottom: "2px solid #fdba74",
    background: "rgba(251,146,60,0.08)",
    borderRight: "2px solid #e5e7eb",
};

const targetGroupHeaderStyle: React.CSSProperties = {
    textAlign: "left",
    padding: "10px 10px 6px",
    fontSize: 10.5,
    fontWeight: 700,
    color: "#1d4ed8",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    borderBottom: "2px solid #93c5fd",
    background: "rgba(59,130,246,0.07)",
    borderRight: "2px solid #e5e7eb",
};

const applicationGroupHeaderStyle: React.CSSProperties = {
    textAlign: "left",
    padding: "10px 10px 6px",
    fontSize: 10.5,
    fontWeight: 700,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    borderBottom: "2px solid #cbd5e1",
    background: "#f8fafc",
};

const candidatePillStyle: React.CSSProperties = {
    display: "inline-flex",
    padding: "3px 8px",
    borderRadius: 8,
    background: "#fff7ed",
    color: "#c2410c",
    fontSize: 11,
    fontWeight: 600,
};

const targetPillStyle: React.CSSProperties = {
    display: "inline-flex",
    padding: "3px 8px",
    borderRadius: 8,
    background: "#eff6ff",
    color: "#1d4ed8",
    fontSize: 11,
    fontWeight: 600,
};

const priorityBadgeStyle: React.CSSProperties = {
    display: "inline-flex",
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    background: "#ffedd5",
    color: "#c2410c",
    fontSize: 12,
    fontWeight: 700,
};
