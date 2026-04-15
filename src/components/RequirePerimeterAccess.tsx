import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { appApi } from "../lib/appApi";

export default function RequirePerimeterAccess({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [needsContext, setNeedsContext] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!user) {
        if (!cancelled) {
          setAllowed(false);
          setNeedsContext(false);
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
          setNeedsContext(!hasPerimeter && (me?.access?.perimeters?.length ?? 0) > 0);
        }
      } catch {
        if (!cancelled) {
          setAllowed(false);
          setNeedsContext(false);
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
  }, [user?.id]);

  if (authLoading || checking) return <p style={{ padding: 20 }}>Verifica accesso perimetro…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (!allowed) return <Navigate to={needsContext ? "/select-context" : "/"} replace />;

  return <>{children}</>;
}
