import { type CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
import { appApi } from "../lib/appApi";

type TestScenario = {
  id: string;
  name: string;
};

type ScenarioApplication = {
  id: string;
  user_id: string;
  position_id: string;
  priority: number;
};

type InitializeResult = {
  insertedApplications?: number;
  activatedUsers?: number;
};

export default function AdminTestScenario() {
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [scenarios, setScenarios] = useState<TestScenario[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [applications, setApplications] = useState<ScenarioApplication[]>([]);

  const selectedScenario = useMemo(
    () => scenarios.find((s) => s.id === selectedScenarioId) ?? null,
    [scenarios, selectedScenarioId]
  );

  const loadScenarios = useCallback(async () => {
    const list = await appApi.adminGetScenarios();
    const normalized = (Array.isArray(list) ? list : [])
      .map((s) => ({ id: String(s?.id ?? ""), name: String(s?.name ?? "") }))
      .filter((s) => s.id);

    setScenarios(normalized);
    setSelectedScenarioId((prev) => {
      if (prev && normalized.some((s) => s.id === prev)) return prev;
      return normalized[0]?.id ?? null;
    });
  }, []);

  const loadScenarioApplications = useCallback(async (scenarioId: string) => {
    const rows = await appApi.adminGetScenarioApplications(scenarioId);
    setApplications(Array.isArray(rows) ? rows : []);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await loadScenarios();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore caricamento test scenarios");
    } finally {
      setLoading(false);
    }
  }, [loadScenarios]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!selectedScenarioId) {
      setApplications([]);
      return;
    }
    void (async () => {
      try {
        await loadScenarioApplications(selectedScenarioId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore caricamento candidature scenario");
      }
    })();
  }, [selectedScenarioId, loadScenarioApplications]);

  async function handleInitialize() {
    if (!selectedScenarioId) return;
    setInitializing(true);
    setError(null);
    setMessage(null);
    try {
      const response = await appApi.initializeTestScenario(selectedScenarioId);
      const result: InitializeResult = response?.result ?? {};
      const inserted = Number(result.insertedApplications ?? 0);
      const activated = Number(result.activatedUsers ?? 0);
      setMessage(
        `Scenario inizializzato. Candidature inserite: ${inserted}. Utenti attivati: ${activated}.`
      );
      await loadScenarioApplications(selectedScenarioId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore inizializzazione scenario");
    } finally {
      setInitializing(false);
    }
  }

  async function handleClearScenario() {
    if (!selectedScenarioId) return;
    setClearing(true);
    setError(null);
    setMessage(null);
    try {
      await appApi.adminDeleteAllScenarioApplications(selectedScenarioId);
      setMessage("Scenario svuotato: tutte le candidature di test sono state rimosse.");
      await loadScenarioApplications(selectedScenarioId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore durante lo svuotamento scenario");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div style={{ padding: "32px 40px", fontFamily: "'Inter', sans-serif", maxWidth: 1100 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 8 }}>Test Scenario</h2>
      <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 24 }}>
        Configura e inizializza scenari di test nel perimetro corrente.
      </p>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", color: "#dc2626", fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}
      {message && (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "10px 14px", color: "#166534", fontSize: 13, marginBottom: 16 }}>
          {message}
        </div>
      )}

      {loading ? (
        <div style={{ color: "#64748b", fontSize: 14 }}>Caricamento scenari…</div>
      ) : (
        <>
          <section style={{ marginBottom: 24, border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", padding: "16px" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <label htmlFor="test-scenario-select" style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                Scenario disponibile:
              </label>
              <select
                id="test-scenario-select"
                value={selectedScenarioId ?? ""}
                onChange={(e) => setSelectedScenarioId(e.target.value || null)}
                disabled={scenarios.length === 0 || initializing || clearing}
                style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", minWidth: 320, fontSize: 13 }}
              >
                {scenarios.length === 0 && <option value="">Nessuno scenario disponibile</option>}
                {scenarios.map((scenario) => (
                  <option key={scenario.id} value={scenario.id}>
                    {scenario.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleInitialize}
                disabled={!selectedScenarioId || initializing || clearing}
                style={{ ...buttonStyle, background: "#ecfdf5", borderColor: "#86efac", color: "#166534" }}
              >
                {initializing ? "Inizializzazione…" : "Inizializza scenario"}
              </button>

              <button
                type="button"
                onClick={handleClearScenario}
                disabled={!selectedScenarioId || clearing || initializing}
                style={{ ...buttonStyle, background: "#fef2f2", borderColor: "#fca5a5", color: "#b91c1c" }}
              >
                {clearing ? "Svuotamento…" : "Svuota scenario"}
              </button>

              <button
                type="button"
                onClick={() => void reload()}
                disabled={initializing || clearing}
                style={buttonStyle}
              >
                Ricarica
              </button>
            </div>
          </section>

          <section style={{ border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", overflowX: "auto" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #e5e7eb", fontSize: 13, color: "#374151", fontWeight: 600 }}>
              {selectedScenario ? `Candidature test per: ${selectedScenario.name}` : "Candidature test scenario"}
              <span style={{ marginLeft: 8, color: "#6b7280", fontWeight: 500 }}>({applications.length})</span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={thStyle}>ID candidatura</th>
                  <th style={thStyle}>Utente</th>
                  <th style={thStyle}>Posizione</th>
                  <th style={thStyle}>Priorità</th>
                </tr>
              </thead>
              <tbody>
                {applications.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: "18px 12px", textAlign: "center", color: "#6b7280" }}>
                      Nessuna candidatura nel test scenario selezionato.
                    </td>
                  </tr>
                ) : (
                  applications.map((row) => (
                    <tr key={row.id}>
                      <td style={tdStyle}>{row.id}</td>
                      <td style={tdStyle}>{row.user_id}</td>
                      <td style={tdStyle}>{row.position_id}</td>
                      <td style={tdStyle}>{row.priority}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}

const buttonStyle: CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 8,
  background: "#f9fafb",
  color: "#111827",
  padding: "8px 12px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "9px 12px",
  borderBottom: "1px solid #e5e7eb",
  color: "#374151",
  fontWeight: 700,
};

const tdStyle: CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  borderBottom: "1px solid #f1f5f9",
  color: "#111827",
};
