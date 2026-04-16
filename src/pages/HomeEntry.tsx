import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { appApi } from "../lib/appApi";
import {
  buildActiveContextSource,
  getContextDestinationPath,
  resolveDefaultSelection,
  toTenantContext,
  writeStoredActiveProfile,
} from "../lib/activeContextModel";

const HomeEntry: React.FC = () => {
  const [targetPath, setTargetPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const resolveHome = async () => {
      try {
        let me: Awaited<ReturnType<typeof appApi.getMe>>;
        try {
          me = await appApi.getMe();
        } catch {
          appApi.clearTenantContext();
          me = await appApi.getMe();
        }
        const source = buildActiveContextSource(me);
        const defaultSelection = resolveDefaultSelection(source);

        if (!defaultSelection) {
          if (!cancelled) {
            setError("Nessun contesto tenant disponibile per questo account.");
          }
          return;
        }

        writeStoredActiveProfile(defaultSelection.profile);
        appApi.setTenantContext(toTenantContext(defaultSelection));
        if (!cancelled) setTargetPath(getContextDestinationPath(defaultSelection, "/"));
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Errore risoluzione contesto");
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
