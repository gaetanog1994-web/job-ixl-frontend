import { useState, useEffect, useCallback } from "react";
import { appApi, type CampaignDetail, type CampaignRecord, type CampaignLifecycleStatus } from "../lib/appApi";

type LifecycleAction = "openReservations" | "closeReservations" | "openCampaign" | "closeCampaign";

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

function ActionButton({
    label,
    enabled,
    loading,
    onClick,
    tone = "default",
}: {
    label: string;
    enabled: boolean;
    loading: boolean;
    onClick: () => void;
    tone?: "default" | "open" | "danger";
}) {
    const toneStyle: React.CSSProperties = tone === "open"
        ? { background: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0" }
        : tone === "danger"
            ? { background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5" }
            : {};

    return (
        <button
            type="button"
            disabled={!enabled || loading}
            style={{
                ...btnStyle,
                ...toneStyle,
                opacity: !enabled || loading ? 0.5 : 1,
                cursor: !enabled || loading ? "not-allowed" : "pointer",
            }}
            onClick={onClick}
        >
            {label}
        </button>
    );
}

function CampaignRow({
    campaign,
    isOpen,
    detail,
    loadingDetail,
    onToggle,
}: {
    campaign: CampaignRecord;
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
                        <>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
                                Dettaglio campagna · {detail.applications.length} candidature archiviate
                            </div>
                            {detail.applications.length === 0 ? (
                                <div style={{ fontSize: 12, color: "#6b7280" }}>Nessuna candidatura archiviata per questa campagna.</div>
                            ) : (
                                <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff" }}>
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
                                            {detail.applications.map((row) => (
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
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

export default function AdminCampaigns() {
    const [lifecycle, setLifecycle] = useState<CampaignLifecycleStatus | null>(null);
    const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
    const [campaignDetails, setCampaignDetails] = useState<Record<string, CampaignDetail>>({});
    const [openCampaignId, setOpenCampaignId] = useState<string | null>(null);
    const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const [lc, list] = await Promise.all([
                appApi.adminGetCampaignStatus(),
                appApi.adminListCampaigns(),
            ]);
            setLifecycle(lc);
            setCampaigns(list);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Errore caricamento campagne");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

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
                setCampaignDetails({});
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
        if (!willOpen || campaign.status !== "campaign_closed" || campaignDetails[campaign.id]) return;

        setLoadingDetailId(campaign.id);
        try {
            const detail = await appApi.adminGetCampaignDetail(campaign.id);
            setCampaignDetails((prev) => ({ ...prev, [campaign.id]: detail }));
        } catch (e) {
            setError(e instanceof Error ? e.message : "Errore caricamento dettaglio campagna");
        } finally {
            setLoadingDetailId(null);
        }
    }

    const cs = lifecycle?.campaign_status ?? "closed";
    const rs = lifecycle?.reservations_status ?? "closed";
    const reservedCount = lifecycle?.reserved_users_count ?? 0;
    const availableCount = lifecycle?.available_users_count ?? 0;

    const canOpenReservations = cs === "closed" && rs === "closed";
    const canCloseReservations = cs === "closed" && rs === "open";
    const canOpenCampaign = cs === "closed" && rs === "closed" && reservedCount > 0;
    const canCloseCampaign = cs === "open";
    const lifecycleHint = canCloseCampaign
        ? "Campagna attiva: puoi chiuderla per congelare snapshot e azzerare il ciclo operativo."
        : canOpenCampaign
            ? "Prenotazioni chiuse e utenti prenotati presenti: puoi aprire la campagna."
            : canCloseReservations
                ? "Prenotazioni attive: chiudile prima di aprire la campagna."
                : canOpenReservations
                    ? "Ciclo in stato iniziale: puoi aprire la finestra prenotazioni."
                    : "Azione non disponibile nello stato lifecycle corrente.";

    const activeCampaign = campaigns.find((c) => c.status !== "campaign_closed") ?? null;

    if (loading) {
        return <div style={{ padding: 40, color: "#64748b" }}>Caricamento campagne candidature…</div>;
    }

    return (
        <div style={{ padding: "32px 40px", fontFamily: "'Inter', sans-serif", maxWidth: 1200 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 8 }}>Campagne candidature</h2>
            <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 28 }}>
                Gestisci lifecycle campagne e consulta lo storico candidature del perimetro attivo.
            </p>

            {error && (
                <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", color: "#dc2626", fontSize: 13, marginBottom: 20 }}>
                    {error}
                </div>
            )}

            <section style={{ marginBottom: 32 }}>
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
                            { label: "Prenotazioni aperte", active: cs === "closed" && rs === "open" },
                            { label: "Prenotazioni chiuse", active: cs === "closed" && rs === "closed" && reservedCount > 0 },
                            { label: "Campagna aperta", active: cs === "open" },
                            { label: "Campagna chiusa", active: cs === "closed" && rs === "closed" && !activeCampaign },
                        ].map((step) => (
                            <div
                                key={step.label}
                                style={{
                                    borderRadius: 8,
                                    border: `1px solid ${step.active ? "#86efac" : "#e5e7eb"}`,
                                    background: step.active ? "#f0fdf4" : "#ffffff",
                                    color: step.active ? "#166534" : "#6b7280",
                                    fontSize: 12,
                                    fontWeight: 600,
                                    padding: "8px 10px",
                                }}
                            >
                                {step.label}
                            </div>
                        ))}
                    </div>
                    {activeCampaign ? (
                        <div style={{ marginBottom: 14 }}>
                            <StatusBadge status={activeCampaign.status} />
                            <span style={{ fontSize: 13, color: "#374151", marginLeft: 10 }}>
                                {reservedCount} prenotat{reservedCount === 1 ? "o" : "i"} · {availableCount} disponibili
                            </span>
                        </div>
                    ) : (
                        <div style={{ marginBottom: 14, fontSize: 13, color: "#6b7280" }}>
                            Nessuna campagna attiva. Puoi aprire una nuova finestra prenotazioni.
                        </div>
                    )}

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <ActionButton
                            label="Apri prenotazioni"
                            enabled={canOpenReservations}
                            loading={actionLoading}
                            onClick={() => runAction("openReservations")}
                        />
                        <ActionButton
                            label="Chiudi prenotazioni"
                            enabled={canCloseReservations}
                            loading={actionLoading}
                            onClick={() => runAction("closeReservations")}
                        />
                        <ActionButton
                            label="Apri campagna"
                            enabled={canOpenCampaign}
                            loading={actionLoading}
                            tone="open"
                            onClick={() => runAction("openCampaign")}
                        />
                        <ActionButton
                            label="Chiudi campagna"
                            enabled={canCloseCampaign}
                            loading={actionLoading}
                            tone="danger"
                            onClick={() => runAction("closeCampaign")}
                        />
                    </div>
                    <div style={{ marginTop: "10px", fontSize: "12px", color: "#64748b" }}>{lifecycleHint}</div>
                </div>
            </section>

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
                                isOpen={openCampaignId === campaign.id}
                                detail={campaignDetails[campaign.id] ?? null}
                                loadingDetail={loadingDetailId === campaign.id}
                                onToggle={() => handleToggleCampaignDetail(campaign)}
                            />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

const btnStyle: React.CSSProperties = {
    border: "1px solid #d1d5db",
    background: "#f9fafb",
    color: "#111827",
    borderRadius: 10,
    padding: "6px 14px",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
};

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
