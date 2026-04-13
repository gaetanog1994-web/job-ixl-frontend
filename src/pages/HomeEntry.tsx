import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { appApi } from "../lib/appApi";
import { getAvailableContexts, isContextMatch, toTenantSelection } from "../lib/contextRouting";

const HomeEntry: React.FC = () => {
  const [targetPath, setTargetPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const resolveHome = async () => {
      try {
        let me: any;
        try {
          me = await appApi.getMe();
        } catch {
          appApi.clearTenantContext();
          me = await appApi.getMe();
        }
        const availableContexts = getAvailableContexts(me);
        const lastSelection = appApi.getTenantContext();

        if (availableContexts.length === 1) {
          const onlyContext = availableContexts[0];
          appApi.setTenantContext(toTenantSelection(onlyContext));
          if (!cancelled) setTargetPath(onlyContext.destination);
          return;
        }

        if (availableContexts.length > 1) {
          const lastContext = availableContexts.find((context) =>
            isContextMatch(context, lastSelection)
          );

          if (lastContext) {
            appApi.setTenantContext(toTenantSelection(lastContext));
            if (!cancelled) setTargetPath(lastContext.destination);
            return;
          }

          if (!cancelled) setTargetPath("/select-context");
          return;
        }

        if (!cancelled) {
          setError("Nessun contesto tenant disponibile per questo account.");
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Errore risoluzione contesto");
        }
      }
    };

    resolveHome();
    return () => {
      cancelled = true;
    };
  }, []);

  if (targetPath) {
    return <Navigate to={targetPath} replace />;
  }

  if (error) {
    return (
      <div style={{ padding: "24px", fontFamily: "'Inter', sans-serif", color: "#991b1b" }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ padding: "24px", fontFamily: "'Inter', sans-serif", color: "#64748b" }}>
      Caricamento contesto...
    </div>
  );
};

export default HomeEntry;
