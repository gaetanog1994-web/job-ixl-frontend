import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { appApi } from "../lib/appApi";

export default function RequireCompanyAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!user) {
        if (!cancelled) {
          setAllowed(false);
          setChecking(false);
        }
        return;
      }

      try {
        const me = await appApi.getMe();
        if (!cancelled) {
          setAllowed(me?.isOwner === true || me?.isSuperAdmin === true);
        }
      } catch {
        if (!cancelled) setAllowed(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    };

    setChecking(true);
    run();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (authLoading || checking) return <p style={{ padding: 20 }}>Verifica permessi company…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (!allowed) return <Navigate to="/" replace />;

  return <>{children}</>;
}
