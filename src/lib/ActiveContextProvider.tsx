import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { appApi } from "./appApi";
import {
  buildActiveContextSource,
  getContextDestinationPath,
  readStoredActiveProfile,
  resolveDefaultSelection,
  resolveSelectionForProfile,
  toTenantContext,
  writeStoredActiveProfile,
  type ActiveContextSelection,
  type ActiveContextSource,
  type ActiveProfile,
} from "./activeContextModel";

type ActiveContextValue = {
  meData: Awaited<ReturnType<typeof appApi.getMe>> | null;
  activeContextSource: ActiveContextSource | null;
  activeSelection: ActiveContextSelection | null;
  activeProfile: ActiveProfile | null;
  activeCompanyId: string | null;
  activePerimeterId: string | null;
  isBootstrappingContext: boolean;
  isContextResolved: boolean;
  contextError: string | null;
  switchProfile: (profile: ActiveProfile) => string | null;
  switchCompany: (companyId: string) => string | null;
  switchPerimeter: (perimeterId: string) => string | null;
  resolveDestinationForSelection: (selection: ActiveContextSelection) => string;
  refreshContext: () => Promise<void>;
};

const ActiveContextState = createContext<ActiveContextValue | null>(null);

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Errore risoluzione contesto attivo";
}

export const ActiveContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const bootstrapInFlightRef = useRef<Promise<void> | null>(null);

  const [meData, setMeData] = useState<Awaited<ReturnType<typeof appApi.getMe>> | null>(null);
  const [activeContextSource, setActiveContextSource] = useState<ActiveContextSource | null>(null);
  const [activeSelection, setActiveSelection] = useState<ActiveContextSelection | null>(null);
  const [isBootstrappingContext, setIsBootstrappingContext] = useState(false);
  const [isContextResolved, setIsContextResolved] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);

  const applySelection = useCallback(
    (selection: ActiveContextSelection, syncTenantContext = true) => {
      writeStoredActiveProfile(selection.profile);
      setActiveSelection(selection);
      if (syncTenantContext) {
        const nextTenant = toTenantContext(selection);
        const currentTenant = appApi.getTenantContext();
        if (
          currentTenant.companyId !== nextTenant.companyId ||
          currentTenant.perimeterId !== nextTenant.perimeterId
        ) {
          appApi.setTenantContext(nextTenant);
        }
      }
    },
    []
  );

  const refreshContext = useCallback(async () => {
    if (!user?.id) return;
    if (bootstrapInFlightRef.current) {
      return bootstrapInFlightRef.current;
    }

    bootstrapInFlightRef.current = (async () => {
      setIsBootstrappingContext(true);
      setContextError(null);
      try {
        let mePayload: Awaited<ReturnType<typeof appApi.getMe>>;
        try {
          mePayload = await appApi.getMe();
        } catch {
          appApi.clearTenantContext();
          mePayload = await appApi.getMe();
        }

        const source = buildActiveContextSource(mePayload);
        const storedProfile = readStoredActiveProfile();

        const resolvedSelection =
          (storedProfile
            ? resolveSelectionForProfile(source, {
              profile: storedProfile,
              preferredCompanyId: mePayload?.access?.currentCompanyId ?? null,
              preferredPerimeterId: mePayload?.access?.currentPerimeterId ?? null,
            })
            : null) ??
          resolveDefaultSelection(source);

        setMeData(mePayload);
        setActiveContextSource(source);

        if (!resolvedSelection) {
          setActiveSelection(null);
          setIsContextResolved(false);
          setContextError("Nessun contesto tenant disponibile per questo account.");
          return;
        }

        applySelection(resolvedSelection, true);
        setIsContextResolved(true);
      } catch (error: unknown) {
        setContextError(getErrorMessage(error));
        setIsContextResolved(false);
      } finally {
        setIsBootstrappingContext(false);
        bootstrapInFlightRef.current = null;
      }
    })();

    return bootstrapInFlightRef.current;
  }, [applySelection, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setMeData(null);
      setActiveContextSource(null);
      setActiveSelection(null);
      setIsBootstrappingContext(false);
      setIsContextResolved(false);
      setContextError(null);
      return;
    }
    void refreshContext();
  }, [refreshContext, user?.id]);

  useEffect(() => {
    const handleTenantStructureChanged = () => {
      void refreshContext();
    };
    const handleTenantContextChanged = () => {
      void refreshContext();
    };
    window.addEventListener("tenant-structure-changed", handleTenantStructureChanged);
    window.addEventListener("tenant-context-changed", handleTenantContextChanged);
    return () => {
      window.removeEventListener("tenant-structure-changed", handleTenantStructureChanged);
      window.removeEventListener("tenant-context-changed", handleTenantContextChanged);
    };
  }, [refreshContext]);

  const resolveDestinationForSelection = useCallback((selection: ActiveContextSelection) => {
    return getContextDestinationPath(selection, window.location.pathname);
  }, []);

  const switchProfile = useCallback(
    (profile: ActiveProfile): string | null => {
      if (!activeContextSource) return null;
      const nextSelection = resolveSelectionForProfile(activeContextSource, {
        profile,
        preferredCompanyId: activeSelection?.companyId ?? null,
        preferredPerimeterId: activeSelection?.perimeterId ?? null,
      });
      if (!nextSelection) return null;
      applySelection(nextSelection, true);
      return resolveDestinationForSelection(nextSelection);
    },
    [activeContextSource, activeSelection?.companyId, activeSelection?.perimeterId, applySelection, resolveDestinationForSelection]
  );

  const switchCompany = useCallback(
    (companyId: string): string | null => {
      if (!activeContextSource || !activeSelection) return null;
      const nextSelection = resolveSelectionForProfile(activeContextSource, {
        profile: activeSelection.profile,
        preferredCompanyId: companyId,
        preferredPerimeterId: activeSelection.perimeterId,
      });
      if (!nextSelection) return null;
      applySelection(nextSelection, true);
      return resolveDestinationForSelection(nextSelection);
    },
    [activeContextSource, activeSelection, applySelection, resolveDestinationForSelection]
  );

  const switchPerimeter = useCallback(
    (perimeterId: string): string | null => {
      if (!activeContextSource || !activeSelection) return null;
      const nextSelection = resolveSelectionForProfile(activeContextSource, {
        profile: activeSelection.profile,
        preferredCompanyId: activeSelection.companyId,
        preferredPerimeterId: perimeterId,
      });
      if (!nextSelection) return null;
      applySelection(nextSelection, true);
      return resolveDestinationForSelection(nextSelection);
    },
    [activeContextSource, activeSelection, applySelection, resolveDestinationForSelection]
  );

  const value = useMemo<ActiveContextValue>(() => {
    return {
      meData,
      activeContextSource,
      activeSelection,
      activeProfile: activeSelection?.profile ?? null,
      activeCompanyId: activeSelection?.companyId ?? null,
      activePerimeterId: activeSelection?.perimeterId ?? null,
      isBootstrappingContext,
      isContextResolved,
      contextError,
      switchProfile,
      switchCompany,
      switchPerimeter,
      resolveDestinationForSelection,
      refreshContext,
    };
  }, [
    meData,
    activeContextSource,
    activeSelection,
    isBootstrappingContext,
    isContextResolved,
    contextError,
    switchProfile,
    switchCompany,
    switchPerimeter,
    resolveDestinationForSelection,
    refreshContext,
  ]);

  return <ActiveContextState.Provider value={value}>{children}</ActiveContextState.Provider>;
};

export function useActiveContext() {
  const context = useContext(ActiveContextState);
  if (!context) {
    throw new Error("useActiveContext must be used within ActiveContextProvider");
  }
  return context;
}
