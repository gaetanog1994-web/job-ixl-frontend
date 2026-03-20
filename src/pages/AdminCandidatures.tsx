import { useEffect, useState } from "react";
import { appApi } from "../lib/appApi";

type BuildResult = {
    nodes: number;
    relationships: number;
};

type AdminCandidatureRow = {
    id: string;
    priority: number | null;
    created_at: string;

    candidate_full_name: string | null;
    candidate_role_name: string | null;
    candidate_location_name: string | null;

    occupant_full_name: string | null;
    occupant_role_name: string | null;
    occupant_location_name: string | null;
};

const cellStyle: React.CSSProperties = {
    textAlign: "left",
    padding: "6px 8px",
    verticalAlign: "top",
    whiteSpace: "nowrap",
};

const AdminCandidatures = () => {
    const [applications, setApplications] = useState<AdminCandidatureRow[]>([]);
    const [loadingGraph, setLoadingGraph] = useState(false);
    const [graphLoading, setGraphLoading] = useState(false);
    const [graphError, setGraphError] = useState<string | null>(null);
    const [buildResult, setBuildResult] = useState<BuildResult | null>(null);
    const [graphSummary, setGraphSummary] = useState<any[] | null>(null);

    const handleBuildGraph = async () => {
        try {
            setLoadingGraph(true);
            const out = await appApi.syncGraph();
            // puoi mappare out.engine o out.dataset in buildResult se vuoi
            setBuildResult({ nodes: out.engine?.nodes ?? 0, relationships: out.engine?.relationships ?? 0 });
        } catch (e: any) {
            alert(`❌ Errore: ${e?.message ?? e}`);
        } finally {
            setLoadingGraph(false);
        }
    };

    const handleViewGraph = async () => {
        try {
            setGraphLoading(true);
            setGraphError(null);
            const json = await appApi.adminGraphSummary(); // wrapper su /api/admin/graph/summary
            setGraphSummary(json.relationships ?? []);
        } catch (e: any) {
            setGraphError(e?.message ?? String(e));
        } finally {
            setGraphLoading(false);
        }
    };


    /* ---------------- LOAD DATA (via backend) ---------------- */
    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const rows = await appApi.adminGetCandidatures();
                if (!cancelled) setApplications(rows ?? []);
            } catch (e: any) {
                console.error("[AdminCandidatures] load error:", e?.message ?? e);
                if (!cancelled) setApplications([]);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div style={{ padding: "30px" }}>
            <h3>A. Tabelle delle candidature</h3>

            <div style={{ margin: "15px 0", display: "flex", gap: "10px" }}>
                <button onClick={handleBuildGraph} disabled={loadingGraph}>
                    {loadingGraph ? "Costruzione in corso…" : "Prepara simulazione"}
                </button>

                <button onClick={handleViewGraph} disabled={graphLoading}>
                    {graphLoading ? "Caricamento grafo…" : "Visualizza grafo"}
                </button>
            </div>

            {graphError && (
                <div style={{ marginTop: 10, color: "#ff6b6b" }}>
                    ❌ {graphError}
                </div>
            )}

            {buildResult && (
                <div
                    style={{
                        marginTop: "10px",
                        padding: "10px",
                        border: "1px solid #4CAF50",
                        borderRadius: "6px",
                        background: "#0f2a1d",
                        color: "#9cffc7",
                        width: "fit-content",
                    }}
                >
                    ✅ <strong>Simulazione pronta</strong>
                    <div>Nodi: {buildResult.nodes}</div>
                    <div>Relazioni: {buildResult.relationships}</div>
                </div>
            )}

            {/* TABELLA CANDIDATURE */}
            <table
                width="100%"
                style={{
                    marginTop: "20px",
                    tableLayout: "fixed",
                    borderCollapse: "collapse",
                }}
            >
                <thead>
                    <tr>
                        <th style={cellStyle}>Candidato</th>
                        <th style={cellStyle}>Ruolo</th>
                        <th style={cellStyle}>Sede</th>

                        <th style={cellStyle}>Occupata da</th>
                        <th style={cellStyle}>Ruolo</th>
                        <th style={cellStyle}>Sede</th>

                        <th style={cellStyle}>Data / Ora</th>
                        <th style={cellStyle}>Priorità</th>
                    </tr>
                </thead>

                <tbody>
                    {applications.map((a) => (
                        <tr key={a.id}>
                            <td style={cellStyle}>{a.candidate_full_name ?? "—"}</td>
                            <td style={cellStyle}>{a.candidate_role_name ?? "—"}</td>
                            <td style={cellStyle}>{a.candidate_location_name ?? "—"}</td>

                            <td style={cellStyle}>{a.occupant_full_name ?? "—"}</td>
                            <td style={cellStyle}>{a.occupant_role_name ?? "—"}</td>
                            <td style={cellStyle}>{a.occupant_location_name ?? "—"}</td>

                            <td style={cellStyle}>
                                {a.created_at
                                    ? new Date(a.created_at).toLocaleString("it-IT", {
                                        day: "2-digit",
                                        month: "2-digit",
                                        year: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    })
                                    : "—"}
                            </td>

                            <td style={cellStyle}>{a.priority ?? "—"}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* GRAFO */}
            {graphSummary && (
                <>
                    <h4 style={{ marginTop: "30px" }}>Relazioni nel grafo</h4>
                    <pre style={{ whiteSpace: "pre-wrap" }}>
                        {JSON.stringify(graphSummary, null, 2)}
                    </pre>
                </>
            )}
        </div>
    );
};

export default AdminCandidatures;
