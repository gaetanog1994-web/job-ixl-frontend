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
      const [me, userInfo] = await Promise.allSettled([appApi.getMe(), appApi.getMyUser()]);
      if (me.status === "fulfilled") setIsAdmin(!!me.value?.isAdmin);
      if (userInfo.status === "fulfilled") setAvailabilityStatus(userInfo.value?.availability_status ?? null);
    } catch {}
  }, []);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    const interval = setInterval(() => { reload(); }, 10_000);
    return () => clearInterval(interval);
  }, [reload]);

  const toggleAvailability = useCallback(async () => {
    if (!isAdmin) return;
    try {
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
