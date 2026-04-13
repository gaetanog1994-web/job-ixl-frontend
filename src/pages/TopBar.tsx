import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSidebar } from "../lib/SidebarContext";
import { appApi } from "../lib/appApi";
import { labelAccessRole } from "../lib/accessLabels";

const TopBar: React.FC = () => {
  const navigate = useNavigate();
  const { toggle: toggleSidebar } = useSidebar();
  const [contextData, setContextData] = useState<{
    company: string;
    perimeter: string;
    accessRole: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadContext = async () => {
      try {
        const me = await appApi.getMe();
        const company = me?.access?.currentCompanyName ?? "";
        const perimeter = me?.access?.currentPerimeterName ?? "";
        const accessRole = labelAccessRole(me?.access?.accessRole);
        if (!cancelled) {
          setContextData({
            company: company || "Company non selezionata",
            perimeter: perimeter || "Perimeter non selezionato",
            accessRole,
          });
        }
      } catch {
        if (!cancelled) setContextData(null);
      }
    };
    loadContext();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    appApi.clearTenantContext();
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
        {contextData ? (
          <div style={styles.contextWrap}>
            <div style={styles.contextBadge}>Company: {contextData.company}</div>
            <div style={styles.contextBadge}>Perimeter: {contextData.perimeter}</div>
            <div style={styles.contextBadge}>Access: {contextData.accessRole}</div>
          </div>
        ) : null}
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
  contextWrap: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
  },
  contextBadge: {
    border: "1px solid #E2E8F0",
    background: "#F8FAFC",
    borderRadius: "10px",
    padding: "6px 10px",
    fontSize: "12px",
    color: "#475569",
    fontWeight: 600,
    maxWidth: "420px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
};

export default TopBar;
