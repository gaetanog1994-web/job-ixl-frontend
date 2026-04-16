import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { appApi } from "../lib/appApi";
import {
  getAvailableContexts,
  isContextMatch,
  toTenantSelection,
  type AvailableContext,
} from "../lib/contextRouting";
import "../styles/dashboard.css";

const sectionTitleByLevel: Record<AvailableContext["level"], string> = {
  platform: "Livello piattaforma",
  company: "Livello company",
  workspace: "Livello workspace",
};

const ContextSwitcherPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contexts, setContexts] = useState<AvailableContext[]>([]);
  const [lastContextKey, setLastContextKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const me = await appApi.getMe();
        const availableContexts = getAvailableContexts(me);
        const lastSelection = appApi.getTenantContext();
        const matchedLastContext =
          availableContexts.find((context) => isContextMatch(context, lastSelection)) ?? null;

        if (cancelled) return;
        setContexts(availableContexts);
        setLastContextKey(matchedLastContext?.key ?? null);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Errore caricamento contesti");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const groupedContexts = useMemo(() => {
    return {
      platform: contexts.filter((context) => context.level === "platform"),
      company: contexts.filter((context) => context.level === "company"),
      workspace: contexts.filter((context) => context.level === "workspace"),
    };
  }, [contexts]);

  const handleSelect = (context: AvailableContext) => {
    appApi.setTenantContext(toTenantSelection(context));
    navigate(context.destination);
  };

  if (loading) {
    return (
      <div style={{ padding: 24, color: "var(--text-secondary)", fontFamily: "var(--font)" }}>
        Caricamento contesti...
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--surface, #f1f5f9)",
        fontFamily: "var(--font, 'Inter', sans-serif)",
        padding: "24px",
      }}
    >
      <div className="db-card" style={{ padding: "18px 20px", marginBottom: "18px" }}>
        <h1 style={{ margin: 0, fontSize: "22px", color: "var(--text-primary)" }}>Scegli contesto</h1>
        <p style={{ margin: "8px 0 0", fontSize: "13px", color: "var(--text-secondary)" }}>
          Seleziona il livello operativo con cui vuoi lavorare adesso. Potrai cambiare contesto in qualsiasi momento.
        </p>
      </div>

      {lastContextKey && (
        <div className="db-card" style={{ padding: "12px 14px", marginBottom: "18px" }}>
          <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>
            Ultimo contesto usato pre-selezionato in evidenza.
          </span>
        </div>
      )}

      {error && (
        <div className="db-card" style={{ padding: "12px 14px", marginBottom: "18px" }}>
          <span style={{ fontSize: 13, color: "#b91c1c", fontWeight: 600 }}>{error}</span>
        </div>
      )}

      {contexts.length === 0 && !error && (
        <div className="db-card" style={{ padding: "16px 18px" }}>
          <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            Nessun contesto operativo disponibile per questo account.
          </span>
        </div>
      )}

      {(["platform", "company", "workspace"] as const).map((level) => {
        const levelContexts = groupedContexts[level];
        if (levelContexts.length === 0) return null;

        return (
          <div key={level} className="db-card" style={{ padding: "16px 18px", marginBottom: "16px" }}>
            <h2 style={{ margin: 0, fontSize: "15px", color: "var(--text-primary)" }}>
              {sectionTitleByLevel[level]}
            </h2>

            <div
              style={{
                marginTop: "12px",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "12px",
              }}
            >
              {levelContexts.map((context) => {
                const isLast = context.key === lastContextKey;
                return (
                  <button
                    key={context.key}
                    onClick={() => handleSelect(context)}
                    style={{
                      border: isLast ? "1.5px solid var(--brand)" : "1px solid var(--border)",
                      background: "#fff",
                      borderRadius: "12px",
                      padding: "14px 14px 12px",
                      textAlign: "left",
                      cursor: "pointer",
                      display: "grid",
                      gap: "8px",
                      boxShadow: isLast ? "0 0 0 3px var(--brand-light)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{context.title}</span>
                      {isLast && (
                        <span
                          style={{
                            border: "1px solid var(--brand)",
                            color: "var(--brand)",
                            borderRadius: 999,
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "2px 8px",
                          }}
                        >
                          Ultimo
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{context.subtitle}</span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Accesso: {context.accessRoleLabel}</span>
                    <span
                      style={{
                        marginTop: 2,
                        display: "inline-flex",
                        width: "fit-content",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        padding: "4px 9px",
                        fontSize: 12,
                        color: "var(--text-primary)",
                        fontWeight: 600,
                      }}
                    >
                      Entra nel contesto
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ContextSwitcherPage;
