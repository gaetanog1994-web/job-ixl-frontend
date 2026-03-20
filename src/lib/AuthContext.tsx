import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

type AuthContextType = {
    user: any | null;
    loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            const { data } = await supabase.auth.getUser();
            setUser(data.user ?? null);
            setLoading(false);
        };

        load();

        const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => {
            sub.subscription.unsubscribe();
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
