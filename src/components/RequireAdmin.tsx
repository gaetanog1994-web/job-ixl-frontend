import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { appApi } from "../lib/appApi";

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
    const { user, loading: authLoading } = useAuth();
    const [checking, setChecking] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            if (!user) {
                if (!cancelled) {
                    setIsAdmin(false);
                    setChecking(false);
                }
                return;
            }

            try {
                const me = await appApi.getMe();
                if (!cancelled) setIsAdmin(me.isAdmin === true);
            } catch {
                if (!cancelled) setIsAdmin(false);
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
    if (!isAdmin) return <Navigate to="/" replace />;

    return <>{children}</>;
}
