import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { appApi } from "../lib/appApi";

const TopBar: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [isAdmin, setIsAdmin] = useState(false);
    const [showAdminMenu, setShowAdminMenu] = useState(false);

    useEffect(() => {
        const checkIsAdmin = async () => {
            if (!user) {
                setIsAdmin(false);
                return;
            }

            try {
                const me = await appApi.getMe();
                setIsAdmin(!!me?.isAdmin);
            } catch (e: any) {
                console.error("Errore verifica admin (via backend):", e?.message ?? e);
                setIsAdmin(false);
            }
        };

        checkIsAdmin();
    }, [user]);


    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate("/login");
    };

    return (
        <div style={styles.bar}>
            <div style={styles.left}>
                <button onClick={() => navigate("/")}>Dashboard</button>
                <button onClick={() => navigate("/account")}>Area Utente</button>

                {isAdmin && (
                    <div
                        style={styles.adminContainer}
                        onMouseEnter={() => setShowAdminMenu(true)}
                        onMouseLeave={() => setShowAdminMenu(false)}
                    >
                        <button>Area Admin ▾</button>

                        {showAdminMenu && (
                            <div style={styles.dropdown}>
                                <div style={styles.dropdownItem} onClick={() => navigate("/admin/candidatures")}>
                                    Tabelle candidature
                                </div>
                                <div style={styles.dropdownItem} onClick={() => navigate("/admin/maps")}>
                                    Mappe utenti attivi
                                </div>
                                <div style={styles.dropdownItem} onClick={() => navigate("/admin/interlocking")}>
                                    Catene di interlocking
                                </div>
                                <div style={styles.dropdownItem} onClick={() => navigate("/admin/test-users")}>
                                    🧪 Pannello di Configurazione
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div style={styles.right}>
                <button onClick={handleLogout}>Logout</button>
            </div>
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    bar: {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "50px",
        background: "#fff",
        borderBottom: "1px solid #ddd",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0 20px",
        zIndex: 1000,
    },
    left: { display: "flex", gap: "10px", alignItems: "center" },
    right: { display: "flex", alignItems: "center" },
    adminContainer: { position: "relative" },
    dropdown: {
        position: "absolute",
        top: "100%",
        left: 0,
        background: "#fff",
        border: "1px solid #ccc",
        boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
        minWidth: "220px",
        zIndex: 1001,
    },
    dropdownItem: { padding: "8px 12px", cursor: "pointer" },
};

export default TopBar;
