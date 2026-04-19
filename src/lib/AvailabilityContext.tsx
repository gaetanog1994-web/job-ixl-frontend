import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { appApi } from "./appApi";
import { useAuth } from "./AuthContext";

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
  const { user } = useAuth();
  const [availabilityStatus, setAvailabilityStatus] = useState<"available" | "inactive" | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const reload = useCallback(async () => {
    if (!user?.id) {
      setIsAdmin(false);
      setAvailabilityStatus(null);
      return;
    }
    try {
      const me = await appApi.getMe();
      setIsAdmin(!!me?.isAdmin);

      const hasPerimeter = !!me?.access?.currentPerimeterId;
      if (!hasPerimeter) {
        setAvailabilityStatus(null);
        return;
      }

      const userInfo = await appApi.getMyUser();
      const status = userInfo?.availability_status;
      setAvailabilityStatus((status === "available" || status === "inactive") ? status : null);
    } catch { /* silently ignore fetch errors */ }
  }, [user?.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!user?.id) return;
    const interval = setInterval(() => { reload(); }, 30_000);
    return () => clearInterval(interval);
  }, [reload, user?.id]);

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
    // RC2 lifecycle: manual availability toggle is intentionally disabled.
    console.warn("[AvailabilityContext] toggleAvailability is disabled by reservation lifecycle.");
  }, [isAdmin]);

  return (
    <AvailabilityContext.Provider value={{ availabilityStatus, isAdmin, setAvailabilityStatus, toggleAvailability, reload }}>
      {children}
    </AvailabilityContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAvailability = () => useContext(AvailabilityContext);
