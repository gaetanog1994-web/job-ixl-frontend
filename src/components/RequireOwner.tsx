import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { appApi } from "../lib/appApi";

export default function RequireOwner({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!user) {
        if (!cancelled) {
          setIsOwner(false);
          setChecking(false);
        }
        return;
      }

      try {
        const me = await appApi.getMe();
        if (!cancelled) setIsOwner(me.isOwner === true);
      } catch {
        if (!cancelled) setIsOwner(false);
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

  if (authLoading || checking) return <p style={{ padding: 20 }}>Verifica permessi owner…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (!isOwner) return <Navigate to="/" replace />;

  return <>{children}</>;
}
