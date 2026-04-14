import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { appApi } from "../lib/appApi";

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
    const { user, loading: authLoading } = useAuth();
    const [checking, setChecking] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [me, setMe] = useState<Awaited<ReturnType<typeof appApi.getMe>> | null>(null);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            if (!user) {
                if (!cancelled) {
                    setIsAdmin(false);
                    setMe(null);
                    setChecking(false);
                }
                return;
            }

            try {
                const result = await appApi.getMe();
                if (!cancelled) {
                    setMe(result);
                    setIsAdmin(result.isAdmin === true);
                }
            } catch {
                if (!cancelled) {
                    setMe(null);
                    setIsAdmin(false);
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

    if (authLoading || checking) return <p style={{ padding: 20 }}>Verifica permessi…</p>;
    if (!user) return <Navigate to="/login" replace />;
    if (!isAdmin) {
        // User has perimeters but none selected → needs context selection, not home.
        const needsContext = (me?.access?.perimeters?.length ?? 0) > 0 && !me?.access?.currentPerimeterId;
        return <Navigate to={needsContext ? "/select-context" : "/"} replace />;
    }

    return <>{children}</>;
}
