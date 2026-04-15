import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { appApi } from "./appApi";

type AvailabilityContextType = {
  availabilityStatus: "available" | "inactive" | null;
  isAdmin: boolean;
  setAvailabilityStatus: (s: "available" | "inactive") => void;
  toggleAvailability: () => Promise<void>;
  reload: () => Promise<void>;
};

const AvailabilityContext = createContext<AvailabilityContextType>({
  availabilityStatus: null,
  isAdmin: false,
  setAvailabilityStatus: () => {},
  toggleAvailability: async () => {},
  reload: async () => {},
});

export const AvailabilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [availabilityStatus, setAvailabilityStatus] = useState<"available" | "inactive" | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const reload = useCallback(async () => {
    try {
      const me = await appApi.getMe();
      setIsAdmin(!!me?.isAdmin);

      const hasPerimeter = !!me?.access?.currentPerimeterId;
      if (!hasPerimeter) {
        setAvailabilityStatus(null);
        return;
      }

      const userInfo = await appApi.getMyUser();
      setAvailabilityStatus(userInfo?.availability_status ?? null);
    } catch {}
  }, []);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    const interval = setInterval(() => { reload(); }, 10_000);
    return () => clearInterval(interval);
  }, [reload]);

  useEffect(() => {
    const handleTenantContextChanged = () => {
      reload();
    };
    window.addEventListener("tenant-context-changed", handleTenantContextChanged);
    return () => {
      window.removeEventListener("tenant-context-changed", handleTenantContextChanged);
    };
  }, [reload]);

  const toggleAvailability = useCallback(async () => {
    if (!isAdmin) return;
    try {
      // activateMe/deactivateMe go through apiFetch which auto-injects
      // x-company-id + x-perimeter-id from localStorage tenant context.
      // requireTenantScope on these routes is satisfied without extra wiring here.
      if (availabilityStatus === "available") {
        await appApi.deactivateMe();
        setAvailabilityStatus("inactive");
      } else {
        await appApi.activateMe();
        setAvailabilityStatus("available");
      }
    } catch (e: any) {
      console.error("[AvailabilityContext] toggle error:", e?.message ?? e);
    }
  }, [availabilityStatus, isAdmin]);

  return (
    <AvailabilityContext.Provider value={{ availabilityStatus, isAdmin, setAvailabilityStatus, toggleAvailability, reload }}>
      {children}
    </AvailabilityContext.Provider>
  );
};

export const useAvailability = () => useContext(AvailabilityContext);
