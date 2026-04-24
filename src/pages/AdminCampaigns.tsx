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
    fromCount: number;
    toCount: number;
};

type CampaignMapPerson = {
    key: string;
    fullName: string;
    roleName: string;
    locationName: string;
    kind: "candidate" | "target";
    markerKey: string | null;
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

    const mapMarkers = useMemo<CampaignMarker[]>(() => {
        if (!selectedApplications.length) return [];
        const grouped = new Map<string, CampaignMarker>();

        const upsert = (locationName: string | null | undefined, kind: "from" | "to") => {
            const name = String(locationName ?? "").trim();
            if (!name) return;
            const loc = locationByName.get(name.toLowerCase());
            if (!loc || loc.latitude == null || loc.longitude == null) return;
            const existing = grouped.get(loc.id || name);
            if (existing) {
                if (kind === "from") existing.fromCount += 1;
                else existing.toCount += 1;
                return;
            }
            grouped.set(loc.id || name, {
                key: loc.id || name,
                name: loc.name || name,
                latitude: Number(loc.latitude),
                longitude: Number(loc.longitude),
                fromCount: kind === "from" ? 1 : 0,
                toCount: kind === "to" ? 1 : 0,
            });
        };

        for (const row of selectedApplications) {
            upsert(row.candidate_location_name, "from");
            upsert(row.target_location_name, "to");
        }

        return Array.from(grouped.values()).sort((a, b) => (b.fromCount + b.toCount) - (a.fromCount + a.toCount));
    }, [selectedApplications, locationByName]);

    const mapPeople = useMemo<CampaignMapPerson[]>(() => {
        const rows: CampaignMapPerson[] = [];

        const pushPerson = (
            kind: "candidate" | "target",
            fullName: string | null | undefined,
            roleName: string | null | undefined,
            locationName: string | null | undefined,
            rowId: string
        ) => {
            const name = String(fullName ?? "").trim();
            if (!name) return;
            const role = String(roleName ?? "").trim() || "—";
            const location = String(locationName ?? "").trim() || "—";
            const loc = locationByName.get(location.toLowerCase());
            const markerKey = loc && loc.latitude != null && loc.longitude != null ? (loc.id || location) : null;
            rows.push({
                key: `${rowId}:${kind}:${name}`,
                fullName: name,
                roleName: role,
                locationName: location,
                kind,
                markerKey,
            });
        };

        for (const row of selectedApplications) {
            pushPerson("candidate", row.candidate_full_name, row.candidate_role_name, row.candidate_location_name, row.id);
            pushPerson("target", row.target_full_name, row.target_role_name, row.target_location_name, row.id);
        }

        const dedup = new Map<string, CampaignMapPerson>();
        for (const person of rows) {
            const key = `${person.kind}:${person.fullName}:${person.locationName}`;
            if (!dedup.has(key)) dedup.set(key, person);
        }

        return Array.from(dedup.values()).sort((a, b) => a.fullName.localeCompare(b.fullName, "it"));
    }, [selectedApplications, locationByName]);

    const focusedMarkerKey = useMemo(() => {
        if (!selectedMapPersonKey) return null;
        const person = mapPeople.find((entry) => entry.key === selectedMapPersonKey);
        return person?.markerKey ?? null;
    }, [selectedMapPersonKey, mapPeople]);

    const activeTabSafe: CampaignTab = activeTab === "candidatures" || activeTab === "map" || activeTab === "lifecycle"
        ? activeTab
        : "lifecycle";

    useEffect(() => {
        setSelectedMapPersonKey(null);
    }, [selectedDataCampaignId, activeTabSafe]);

    if (loading) {
        return <div style={{ padding: 40, color: "#64748b" }}>Caricamento campagne candidature…</div>;
    }

    return (
        <div style={{ padding: "32px 40px", fontFamily: "'Inter', sans-serif", maxWidth: 1400 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 8 }}>Campagne candidature</h2>
            <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 28 }}>
                Gestisci lifecycle, lista candidature e mappa candidature dalla stessa pagina, con campagna selezionabile.
            </p>

            {error && (
                <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", color: "#dc2626", fontSize: 13, marginBottom: 20 }}>
                    {error}
                </div>
            )}

            <section style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "#374151", marginBottom: 12 }}>Stato campagna attiva</h3>
                <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "20px 24px", background: "#f8fafc" }}>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(4, minmax(120px, 1fr))",
                            gap: "10px",
                            marginBottom: "16px",
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
                                    padding: "8px 10px",
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
                    {activeCampaign ? (
                        <div style={{ marginBottom: 14 }}>
                            <StatusBadge status={activeCampaign.status} />
                            <span style={{ fontSize: 13, color: "#374151", marginLeft: 10 }}>
                                ID campagna <b>{campaignCodeById.get(activeCampaign.id) ?? "—"}</b> · {reservedCount} prenotat{reservedCount === 1 ? "o" : "i"} · {availableCount} disponibili
                            </span>
                        </div>
                    ) : (
                        <div style={{ marginBottom: 14, fontSize: 13, color: "#6b7280" }}>
                            Nessuna campagna attiva. Puoi aprire una nuova finestra prenotazioni.
                        </div>
                    )}

                    <div style={{ marginTop: "10px", fontSize: "12px", color: "#64748b" }}>{lifecycleHint}</div>
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
                </div>

                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
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
                                }}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
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
                        <div style={{ padding: "10px 12px", borderBottom: "1px solid #e5e7eb", fontSize: 13, color: "#6b7280" }}>
                            Lista candidature archiviate per la campagna selezionata.
                        </div>
                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                                <thead>
                                    <tr style={{ background: "#f3f4f6" }}>
                                        <th style={thStyle}>Prio</th>
                                        <th style={thStyle}>Candidato</th>
                                        <th style={thStyle}>Posizione target</th>
                                        <th style={thStyle}>Occupante target</th>
                                        <th style={thStyle}>Data candidatura</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedApplications.length === 0 ? (
                                        <tr>
                                            <td style={tdStyle} colSpan={5}>Nessuna candidatura archiviata.</td>
                                        </tr>
                                    ) : selectedApplications.map((row) => (
                                        <tr key={row.id}>
                                            <td style={tdStyle}>{row.priority ?? "—"}</td>
                                            <td style={tdStyle}>
                                                {row.candidate_full_name ?? "—"}
                                                <div style={{ fontSize: 11, color: "#6b7280" }}>
                                                    {row.candidate_role_name ?? "—"} · {row.candidate_department_name ?? "—"} · {row.candidate_location_name ?? "—"}
                                                </div>
                                            </td>
                                            <td style={tdStyle}>{row.position_title ?? "—"}</td>
                                            <td style={tdStyle}>
                                                {row.target_full_name ?? "—"}
                                                <div style={{ fontSize: 11, color: "#6b7280" }}>
                                                    {row.target_role_name ?? "—"} · {row.target_department_name ?? "—"} · {row.target_location_name ?? "—"}
                                                </div>
                                            </td>
                                            <td style={tdStyle}>{formatDate(row.original_created_at)}</td>
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
                            Mappa sedi coinvolte nella campagna selezionata (sede candidato = blu, sede target = arancio).
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
                                            {mapMarkers.map((marker) => {
                                                const isFocused = focusedMarkerKey === marker.key;
                                                return (
                                                    <CircleMarker
                                                        key={marker.key}
                                                        center={[marker.latitude, marker.longitude]}
                                                        radius={isFocused
                                                            ? Math.max(12, Math.min(22, 10 + Math.log(marker.fromCount + marker.toCount + 1) * 4))
                                                            : Math.max(8, Math.min(18, 7 + Math.log(marker.fromCount + marker.toCount + 1) * 4))
                                                        }
                                                        pathOptions={{
                                                            color: isFocused ? "#a16207" : (marker.fromCount > marker.toCount ? "#2563eb" : "#ea580c"),
                                                            fillColor: isFocused ? "#f59e0b" : (marker.fromCount > marker.toCount ? "#3b82f6" : "#f97316"),
                                                            fillOpacity: isFocused ? 0.75 : 0.55,
                                                            weight: isFocused ? 3 : 2,
                                                        }}
                                                    >
                                                        <Popup>
                                                            <div style={{ fontSize: 12 }}>
                                                                <div style={{ fontWeight: 700, marginBottom: 4 }}>{marker.name}</div>
                                                                <div>Da candidati: <b>{marker.fromCount}</b></div>
                                                                <div>Verso target: <b>{marker.toCount}</b></div>
                                                            </div>
                                                        </Popup>
                                                    </CircleMarker>
                                                );
                                            })}
                                        </MapContainer>
                                    </div>
                                    <div style={{ borderLeft: "1px solid #e5e7eb", background: "#fff", minHeight: 0, display: "grid", gridTemplateRows: "auto 1fr" }}>
                                        <div style={{ padding: "10px 12px", borderBottom: "1px solid #e5e7eb" }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Persone coinvolte</div>
                                            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                                                Click per evidenziare la sede in mappa
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
                                                            opacity: person.markerKey ? 1 : 0.65,
                                                        }}
                                                        title={person.markerKey ? "Evidenzia sede sulla mappa" : "Sede non geolocalizzata"}
                                                        disabled={!person.markerKey}
                                                    >
                                                        <div style={{ fontWeight: 600, fontSize: 12, color: "#111827" }}>{person.fullName}</div>
                                                        <div style={{ fontSize: 11, color: "#4b5563", marginTop: 2 }}>{person.roleName}</div>
                                                        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>
                                                            {person.locationName} · {person.kind === "candidate" ? "Candidato" : "Target"}
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

const thStyle: React.CSSProperties = {
    textAlign: "left",
    fontWeight: 700,
    color: "#374151",
    borderBottom: "1px solid #e5e7eb",
    padding: "8px 10px",
};

const tdStyle: React.CSSProperties = {
    borderBottom: "1px solid #f1f5f9",
    padding: "8px 10px",
    color: "#111827",
    verticalAlign: "top",
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
