import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useSidebar } from "../lib/SidebarContext";

const TopBar: React.FC = () => {
  const navigate = useNavigate();
  const { toggle: toggleSidebar } = useSidebar();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <div style={styles.bar}>
      <div style={styles.left}>
        <button
          id="topbar-hamburger"
          style={styles.hamburgerBtn}
          onClick={toggleSidebar}
          title="Apri menu navigazione"
        >
          ☰
        </button>
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
          id="topbar-logout-btn"
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
    zIndex: 900, // below GlobalSidebar (z:1000) but above content
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  left: { display: "flex", gap: "4px", alignItems: "center" },
  right: { display: "flex", alignItems: "center" },
  hamburgerBtn: {
    background: "transparent",
    border: "1px solid #E5E7EB",
    borderRadius: "10px",
    width: "36px",
    height: "36px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    fontSize: "18px",
    color: "#374151",
    marginRight: "8px",
    transition: "background 0.15s",
  },
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
};

export default TopBar;
