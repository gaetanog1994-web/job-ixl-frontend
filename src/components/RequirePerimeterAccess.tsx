import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { appApi } from "../lib/appApi";

export default function RequirePerimeterAccess({ children }: { children: React.ReactNode }) {
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
        const hasPerimeter = !!me?.access?.currentPerimeterId;
        const canAccess = me?.access?.canAccessPerimeter === true;
        if (!cancelled) {
          setAllowed(hasPerimeter && canAccess);
        }
      } catch {
        if (!cancelled) {
          setAllowed(false);
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    };

    setChecking(true);
    run();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (authLoading || checking) return <p style={{ padding: 20 }}>Verifica accesso perimetro…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (!allowed) return <Navigate to="/" replace />;

  return <>{children}</>;
}
