import { useState, useEffect, useCallback } from "react";
import { appApi, type CampaignRecord, type CampaignLifecycleStatus } from "../lib/appApi";

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
        <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700,
            background: c.bg, color: c.color, border: `1px solid ${c.border}`,
        }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.dot, display: "inline-block" }} />
            {STATUS_LABEL[status] ?? status}
        </span>
    );
}

function formatDate(iso: string | null | undefined) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
}

function CampaignRow({ campaign, isActive }: { campaign: CampaignRecord; isActive: boolean }) {
    const [open, setOpen] = useState(false);

    return (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", background: isActive ? "#f0fdf4" : "#fff" }}>
            <div
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer" }}
                onClick={() => setOpen((v) => !v)}
            >
                <span style={{ fontSize: 13, color: "#6b7280", minWidth: 180 }}>{formatDate(campaign.created_at)}</span>
                <StatusBadge status={campaign.status} />
                <span style={{ fontSize: 12, color: "#374151", marginLeft: 8 }}>
                    {campaign.reserved_users_count} prenotat{campaign.reserved_users_count === 1 ? "o" : "i"}
                </span>
                {campaign.status === "campaign_closed" && (
                    <span style={{ fontSize: 12, color: "#374151" }}>
                        · {campaign.total_applications_count} candidature frozen
                    </span>
                )}
                <span style={{ marginLeft: "auto", fontSize: 13, color: "#9ca3af" }}>{open ? "▲" : "▼"}</span>
            </div>

            {open && (
                <div style={{ padding: "12px 16px", borderTop: "1px solid #e5e7eb", background: "#f9fafb", fontSize: 13, color: "#374151" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 24px" }}>
                        <span>Prenotazioni aperte: <b>{formatDate(campaign.reservations_opened_at)}</b></span>
                        <span>Prenotazioni chiuse: <b>{formatDate(campaign.reservations_closed_at)}</b></span>
                        <span>Campagna aperta: <b>{formatDate(campaign.campaign_opened_at)}</b></span>
                        <span>Campagna chiusa: <b>{formatDate(campaign.campaign_closed_at)}</b></span>
                        <span>Prenotati: <b>{campaign.reserved_users_count}</b></span>
                        <span>Candidature snapshot: <b>{campaign.total_applications_count}</b></span>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function AdminCampaigns() {
    const [lifecycle, setLifecycle] = useState<CampaignLifecycleStatus | null>(null);
    const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
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
            // reload full list after close to show new history entry
            if (action === "closeCampaign") {
                const list = await appApi.adminListCampaigns();
                setCampaigns(list);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "Errore azione campagna");
        } finally {
            setActionLoading(false);
        }
    }

    const cs = lifecycle?.campaign_status ?? "closed";
    const rs = lifecycle?.reservations_status ?? "closed";
    const reservedCount = lifecycle?.reserved_users_count ?? 0;

    // derive db status from compat fields
    const dbStatus = cs === "open" ? "campaign_open"
        : rs === "open" ? "reservations_open"
        : reservedCount > 0 ? "reservations_closed"
        : "campaign_closed";

    const activeCampaign = campaigns.find((c) => c.status !== "campaign_closed");
    const history = campaigns.filter((c) => c.status === "campaign_closed");

    if (loading) {
        return <div style={{ padding: 40, color: "#64748b" }}>Caricamento campagne…</div>;
    }

    return (
        <div style={{ padding: "32px 40px", fontFamily: "'Inter', sans-serif", maxWidth: 900 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 8 }}>Campagne</h2>
            <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 28 }}>
                Gestisci il lifecycle della campagna di mobilità per questo perimetro.
            </p>

            {error && (
                <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", color: "#dc2626", fontSize: 13, marginBottom: 20 }}>
                    {error}
                </div>
            )}

            {/* ── Active campaign panel ── */}
            <section style={{ marginBottom: 32 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "#374151", marginBottom: 12 }}>Campagna attiva</h3>
                {!activeCampaign && cs === "closed" && rs === "closed" ? (
                    <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "20px 24px", background: "#f9fafb", color: "#6b7280", fontSize: 13 }}>
                        Nessuna campagna attiva. Apri le prenotazioni per avviarne una nuova.
                    </div>
                ) : (
                    <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "20px 24px", background: "#f0fdf4" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                            <StatusBadge status={activeCampaign?.status ?? dbStatus} />
                            <span style={{ fontSize: 13, color: "#374151" }}>
                                {reservedCount} prenotat{reservedCount === 1 ? "o" : "i"}
                            </span>
                            {lifecycle?.available_users_count != null && lifecycle.available_users_count > 0 && (
                                <span style={{ fontSize: 13, color: "#059669" }}>
                                    · {lifecycle.available_users_count} disponibili
                                </span>
                            )}
                        </div>
                        {activeCampaign && (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 24px", fontSize: 12, color: "#374151", marginBottom: 16 }}>
                                <span>Prenotazioni aperte: <b>{formatDate(activeCampaign.reservations_opened_at)}</b></span>
                                <span>Prenotazioni chiuse: <b>{formatDate(activeCampaign.reservations_closed_at)}</b></span>
                                <span>Campagna aperta: <b>{formatDate(activeCampaign.campaign_opened_at)}</b></span>
                            </div>
                        )}
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {cs === "closed" && rs === "closed" && (
                                <button disabled={actionLoading} style={btnStyle} onClick={() => runAction("openReservations")}>
                                    Apri prenotazioni
                                </button>
                            )}
                            {cs === "closed" && rs === "open" && (
                                <button disabled={actionLoading} style={btnStyle} onClick={() => runAction("closeReservations")}>
                                    Chiudi prenotazioni
                                </button>
                            )}
                            {cs === "closed" && rs === "closed" && reservedCount > 0 && (
                                <button disabled={actionLoading} style={{ ...btnStyle, background: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0" }} onClick={() => runAction("openCampaign")}>
                                    Apri campagna
                                </button>
                            )}
                            {cs === "open" && (
                                <button disabled={actionLoading} style={{ ...btnStyle, background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5" }} onClick={() => runAction("closeCampaign")}>
                                    Chiudi campagna
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Phase 0 — no active campaign: show open reservations button */}
                {!activeCampaign && cs === "closed" && rs === "closed" && (
                    <div style={{ marginTop: 12 }}>
                        <button disabled={actionLoading} style={btnStyle} onClick={() => runAction("openReservations")}>
                            Apri prenotazioni (nuova campagna)
                        </button>
                    </div>
                )}
            </section>

            {/* ── Campaign history ── */}
            <section>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "#374151", marginBottom: 12 }}>
                    Storico campagne {history.length > 0 ? `(${history.length})` : ""}
                </h3>
                {history.length === 0 ? (
                    <div style={{ color: "#9ca3af", fontSize: 13 }}>Nessuna campagna completata.</div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {history.map((c) => (
                            <CampaignRow key={c.id} campaign={c} isActive={false} />
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
