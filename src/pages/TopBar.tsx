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
                <button style={styles.navButton} onClick={() => navigate("/")}>Dashboard</button>
                <button style={styles.navButton} onClick={() => navigate("/account")}>Area Utente</button>

                {isAdmin && (
                    <div
                        style={styles.adminContainer}
                        onMouseEnter={() => setShowAdminMenu(true)}
                        onMouseLeave={() => setShowAdminMenu(false)}
                    >
                        <button style={styles.navButton}>Area Admin ▾</button>

                        {showAdminMenu && (
                            <div style={styles.dropdown}>
                                <div style={{...styles.dropdownItem, borderBottom: '1px solid #F3F4F6'}} onClick={() => navigate("/admin/candidatures")}>
                                    Tabelle candidature
                                </div>
                                <div style={{...styles.dropdownItem, borderBottom: '1px solid #F3F4F6'}} onClick={() => navigate("/admin/maps")}>
                                    Mappe utenti attivi
                                </div>
                                <div style={{...styles.dropdownItem, borderBottom: '1px solid #F3F4F6'}} onClick={() => navigate("/admin/interlocking")}>
                                    Catene di interlocking
                                </div>
                                <div style={styles.dropdownItem} onClick={() => navigate("/admin/test-users")}>
                                    <span style={{ marginRight: '6px' }}>⚙️</span> Pannello di Configurazione
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div style={styles.right}>
                <button
                    style={{
                        ...styles.navButton,
                        background: "#FFFFFF",
                        border: "1.5px solid #EF4444",
                        color: "#EF4444",
                        fontWeight: 600,
                    }}
                    onClick={handleLogout}
                >
                    Logout
                </button>
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
        height: "64px",
        background: "#FFFFFF",
        borderBottom: "3px solid #E8511A",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0 24px",
        zIndex: 1000,
        fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    },
    left: { display: "flex", gap: "4px", alignItems: "center" },
    right: { display: "flex", alignItems: "center" },
    adminContainer: { position: "relative", display: "flex", alignItems: "center" },
    navButton: {
        background: "transparent",
        border: "1px solid transparent",
        color: "#E8511A",
        fontSize: "14px",
        fontWeight: 600,
        cursor: "pointer",
        padding: "7px 14px",
        borderRadius: "10px",
        transition: "background-color 0.18s, border-color 0.18s",
        fontFamily: "inherit",
        letterSpacing: "0.01em",
    },
    dropdown: {
        position: "absolute",
        top: "calc(100% + 10px)",
        left: 0,
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
        boxShadow: "0 12px 24px -4px rgba(0, 0, 0, 0.14), 0 4px 8px -2px rgba(0, 0, 0, 0.07)",
        borderRadius: "14px",
        minWidth: "240px",
        zIndex: 1001,
        overflow: "hidden",
        padding: "4px 0",
    },
    dropdownItem: {
        padding: "11px 16px",
        cursor: "pointer",
        fontSize: "14px",
        color: "#1F2937",
        fontWeight: 500,
        transition: "background-color 0.15s",
    },
};

export default TopBar;
