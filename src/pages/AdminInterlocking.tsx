import { useState } from "react";
import { solveOptimalChains } from "../lib/optimalChainsSolver";
import type {
    ChainCandidate,
    OptimizationStrategy,
} from "../lib/optimalChainsSolver";
import { appApi } from "../lib/appApi";

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

const AdminInterlocking = () => {
    const [loadingGraph, setLoadingGraph] = useState(false);
    const [loadingChains, setLoadingChains] = useState(false);

    const [buildResult, setBuildResult] = useState<BuildResult | null>(null);
    const [chains, setChains] = useState<InterlockingChain[] | null>(null);
    const [strategy, setStrategy] =
        useState<OptimizationStrategy>("MAX_IMPACT");

    const [optimalChains, setOptimalChains] =
        useState<ChainCandidate[] | null>(null);

    const [error, setError] = useState<string | null>(null);
    const [namesById, setNamesById] = useState<Record<string, string>>({});
    const [maxLen, setMaxLen] = useState<number>(8);

    /* ---------------- CSV UTILS ---------------- */
    const getTimestampForFilename = () => {
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
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

        // BOM UTF-8 per compatibilità Excel
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

    const exportChainsCsv = () => {
        if (!chains || chains.length === 0) return;

        const headers = [
            "ID Catena",
            "Persone coinvolte",
            "Priorità catena",
            "Lunghezza",
            "MaxLen usato",
        ];

        const rows = chains.map((c, i) => [
            i + 1,
            Array.isArray(c.peopleNames) ? c.peopleNames.join(" -> ") : "",
            typeof c.avgPriority === "number" ? c.avgPriority : "",
            c.length ?? (Array.isArray(c.users) ? c.users.length : ""),
            maxLen,
        ]);

        downloadCsv("interlocking_chains", headers, rows);
    };

    const exportOptimalChainsCsv = () => {
        if (!optimalChains || optimalChains.length === 0) return;

        const headers = [
            "ID Catena",
            "Persone coinvolte",
            "Priorità catena",
            "Lunghezza",
            "Strategia",
            "MaxLen usato",
        ];

        const rows = optimalChains.map((c, i) => [
            i + 1,
            c.nodeIds.map((id) => namesById[id] ?? id).join(" -> "),
            typeof c.avgPriority === "number" ? c.avgPriority : "",
            c.length ?? c.nodeIds.length,
            strategy,
            maxLen,
        ]);

        downloadCsv("interlocking_optimal_chains", headers, rows);
    };

    /* ---------------- BUILD GRAPH ---------------- */
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

    /* ---------------- FIND CHAINS ---------------- */
    const handleFindChains = async () => {
        try {
            setLoadingChains(true);
            setError(null);
            setChains([]);
            setOptimalChains(null);

            const json = await appApi.adminFindChains({ maxLen });
            console.log("CHAINS RESPONSE:", json);

            const raw = Array.isArray(json?.chains) ? json.chains : [];

            const normalized: InterlockingChain[] = raw.map((c: any) => ({
                users: Array.isArray(c?.users) ? c.users : [],
                peopleNames: Array.isArray(c?.peopleNames) ? c.peopleNames : [],
                length: Number(c?.length ?? (Array.isArray(c?.users) ? c.users.length : 0)),
                avgPriority: c?.avgPriority ?? null,
            }));

            setChains(normalized);

            const map: Record<string, string> = {};
            for (const c of normalized) {
                for (let i = 0; i < (c.users?.length ?? 0); i++) {
                    const id = c.users?.[i];
                    const nm = c.peopleNames?.[i];
                    if (id && nm) map[id] = nm;
                }
            }
            setNamesById(map);
        } catch (err: any) {
            setError(err?.message ?? String(err));
        } finally {
            setLoadingChains(false);
        }
    };

    const buildCandidatesForSolver = (): ChainCandidate[] => {
        if (!chains) return [];

        return chains
            .filter((c) => Array.isArray(c.users) && c.users.length > 1)
            .map((c, index) => ({
                id: `chain_${index + 1}`,
                nodeIds: c.users!,
                avgPriority: c.avgPriority ?? 999,
                length: c.length ?? c.users!.length,
            }));
    };

    return (
        <div style={{ padding: "30px" }}>
            <h3>C. Tabelle di interlocking</h3>

            <div style={{ margin: "15px 0", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {chains && chains.length > 0 && (
                    <div style={{ margin: "20px 0", display: "flex", gap: "12px", alignItems: "center" }}>
                        <label>
                            Strategia:
                            <select
                                style={{ marginLeft: "8px" }}
                                value={strategy}
                                onChange={(e) =>
                                    setStrategy(e.target.value as OptimizationStrategy)
                                }
                            >
                                <option value="MAX_IMPACT">Massimo impatto</option>
                                <option value="QUALITY_FIRST">Qualità delle scelte</option>
                            </select>
                        </label>

                        <button
                            onClick={() => {
                                const candidates = buildCandidatesForSolver();
                                const { selectedChains } = solveOptimalChains(
                                    candidates,
                                    strategy
                                );
                                setOptimalChains(selectedChains);
                            }}
                        >
                            Costruisci tabella ottimale
                        </button>
                    </div>
                )}

                <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    MaxLen:
                    <select
                        value={maxLen}
                        onChange={(e) => setMaxLen(Number(e.target.value))}
                    >
                        {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((n) => (
                            <option key={n} value={n}>{n}</option>
                        ))}
                    </select>
                </label>

                <button onClick={handleBuildGraph} disabled={loadingGraph}>
                    {loadingGraph ? "Costruzione in corso…" : "Prepara simulazione"}
                </button>

                <button onClick={handleFindChains} disabled={loadingChains}>
                    {loadingChains ? "Ricerca in corso…" : "Analizza scenari"}
                </button>
            </div>

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
                    <div>Numero Persone: {buildResult.nodes}</div>
                    <div>Numero Candidature: {buildResult.relationships}</div>
                </div>
            )}

            {error && (
                <div
                    style={{
                        marginTop: "15px",
                        padding: "10px",
                        border: "1px solid #e74c3c",
                        background: "#2a0f0f",
                        color: "#ffb3b3",
                        width: "fit-content",
                    }}
                >
                    ❌ Errore: Riconnettersi al motore dei grafi {error}
                </div>
            )}

            {(chains || optimalChains) && (
                <div
                    style={{
                        marginTop: "30px",
                        display: "flex",
                        gap: "20px",
                        alignItems: "stretch",
                    }}
                >
                    {/* ===== SINISTRA: CATENE GENERALI ===== */}
                    <div style={{ flex: 1 }}>
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: "12px",
                            }}
                        >
                            <h4>🔁 Catene di interlocking</h4>
                            {chains && chains.length > 0 && (
                                <button onClick={exportChainsCsv}>
                                    Esporta CSV
                                </button>
                            )}
                        </div>

                        {!chains || chains.length === 0 ? (
                            <p style={{ color: "#777" }}>
                                Nessuna catena di interlocking trovata.
                            </p>
                        ) : (
                            <table
                                width="100%"
                                style={{
                                    marginTop: "10px",
                                    borderCollapse: "collapse",
                                    fontSize: "13px",
                                }}
                            >
                                <thead>
                                    <tr>
                                        <th align="center">ID Catena</th>
                                        <th align="left">Persone coinvolte</th>
                                        <th align="center">Priorità catena</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {chains.map((c, i) => (
                                        <tr key={i} style={{ borderBottom: "1px solid #333" }}>
                                            <td align="center">{i + 1}</td>
                                            <td>
                                                {Array.isArray(c.peopleNames)
                                                    ? c.peopleNames.join(" → ")
                                                    : "—"}
                                            </td>
                                            <td align="center">
                                                {typeof c.avgPriority === "number" ? c.avgPriority.toFixed(2) : "—"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div
                        style={{
                            width: "1px",
                            background: "#444",
                            marginTop: "32px",
                        }}
                    />

                    {/* ===== DESTRA: CATENE OTTIMALI ===== */}
                    <div style={{ flex: 1 }}>
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: "12px",
                            }}
                        >
                            <h4>✨ Catene di interlocking ottimali</h4>
                            {optimalChains && optimalChains.length > 0 && (
                                <button onClick={exportOptimalChainsCsv}>
                                    Esporta CSV ottimali
                                </button>
                            )}
                        </div>

                        {!optimalChains || optimalChains.length === 0 ? (
                            <p style={{ color: "#777" }}>
                                Nessuna catena di interlocking ottimale trovata.
                            </p>
                        ) : (
                            <table
                                width="100%"
                                style={{
                                    marginTop: "10px",
                                    borderCollapse: "collapse",
                                    fontSize: "13px",
                                }}
                            >
                                <thead>
                                    <tr>
                                        <th align="center">ID Catena</th>
                                        <th align="left">Persone coinvolte</th>
                                        <th align="center">Priorità catena</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {optimalChains.map((c, i) => (
                                        <tr key={i} style={{ borderBottom: "1px solid #333" }}>
                                            <td align="center">{i + 1}</td>
                                            <td>{c.nodeIds.map((id) => namesById[id] ?? id).join(" → ")}</td>
                                            <td align="center">
                                                {typeof c.avgPriority === "number" ? c.avgPriority.toFixed(2) : "—"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminInterlocking;