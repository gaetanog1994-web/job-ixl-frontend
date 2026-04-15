import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSidebar } from "../lib/SidebarContext";
import { appApi } from "../lib/appApi";
import { labelAccessRole } from "../lib/accessLabels";
import {
  getAccessibleCompanies,
  getAccessiblePerimetersForCompany,
  hasMultipleCompanyChoices,
  hasMultiplePerimeterChoicesInCurrentCompany,
  resolveContextForCompanyChange,
  resolveContextForPerimeterChange,
  type AccessPayload,
} from "../lib/tenantContextResolver";

type ContextData = {
  company: string;
  perimeter: string;
  accessRole: string;
  access: AccessPayload | null;
};

type OpenMenu = "company" | "perimeter" | null;

const TopBar: React.FC = () => {
  const navigate = useNavigate();
  const { toggle: toggleSidebar } = useSidebar();
  const menuRootRef = useRef<HTMLDivElement | null>(null);
  const [contextData, setContextData] = useState<ContextData | null>(null);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [switchingContext, setSwitchingContext] = useState(false);

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
            access: (me?.access ?? null) as AccessPayload | null,
          });
        }
      } catch {
        if (!cancelled) setContextData(null);
      }
    };

    const handleContextChanged = () => {
      loadContext();
    };

    loadContext();
    window.addEventListener("tenant-context-changed", handleContextChanged);

    return () => {
      cancelled = true;
      window.removeEventListener("tenant-context-changed", handleContextChanged);
    };
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRootRef.current) return;
      if (!menuRootRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };
    window.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  const canSwitchCompany = useMemo(
    () => hasMultipleCompanyChoices(contextData?.access),
    [contextData?.access]
  );

  const companyOptions = useMemo(
    () => getAccessibleCompanies(contextData?.access),
    [contextData?.access]
  );

  const perimeterOptions = useMemo(() => {
    const currentCompanyId = contextData?.access?.currentCompanyId ?? null;
    return getAccessiblePerimetersForCompany(contextData?.access, currentCompanyId);
  }, [contextData?.access]);

  const canSwitchPerimeter = useMemo(
    () => hasMultiplePerimeterChoicesInCurrentCompany(contextData?.access),
    [contextData?.access]
  );

  const handleLogout = async () => {
    appApi.clearTenantContext();
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleCompanyChange = async (targetCompanyId: string) => {
    if (!contextData?.access || switchingContext) return;
    const nextContext = resolveContextForCompanyChange(contextData.access, targetCompanyId);
    if (!nextContext) return;

    const currentCompanyId = contextData.access.currentCompanyId ?? null;
    const currentPerimeterId = contextData.access.currentPerimeterId ?? null;
    const isSameSelection = currentCompanyId === nextContext.companyId
      && currentPerimeterId === nextContext.perimeterId;

    setOpenMenu(null);
    if (isSameSelection) return;

    setSwitchingContext(true);
    appApi.setTenantContext(nextContext);
    window.location.reload();
  };

  const handlePerimeterChange = async (targetPerimeterId: string) => {
    if (!contextData?.access || switchingContext) return;
    const nextContext = resolveContextForPerimeterChange(contextData.access, targetPerimeterId);
    if (!nextContext) return;

    const currentCompanyId = contextData.access.currentCompanyId ?? null;
    const currentPerimeterId = contextData.access.currentPerimeterId ?? null;
    const isSameSelection = currentCompanyId === nextContext.companyId
      && currentPerimeterId === nextContext.perimeterId;

    setOpenMenu(null);
    if (isSameSelection) return;

    setSwitchingContext(true);
    appApi.setTenantContext(nextContext);
    window.location.reload();
  };

  const renderSelectableBadge = (
    kind: "company" | "perimeter",
    label: string,
    value: string,
    enabled: boolean
  ) => {
    const isOpen = openMenu === kind;
    if (!enabled) {
      return <div style={styles.contextBadge}>{`${label}: ${value}`}</div>;
    }

    return (
      <button
        type="button"
        style={{ ...styles.contextBadge, ...styles.contextButton, ...(isOpen ? styles.contextButtonOpen : {}) }}
        onClick={() => setOpenMenu((prev) => (prev === kind ? null : kind))}
        disabled={switchingContext}
      >
        <span>{`${label}: ${value}`}</span>
        <span style={styles.contextChevron}>▾</span>
      </button>
    );
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
          <div style={styles.contextWrap} ref={menuRootRef}>
            <div style={styles.contextMenuAnchor}>
              {renderSelectableBadge("company", "Company", contextData.company, canSwitchCompany)}
              {canSwitchCompany && openMenu === "company" && (
                <div style={styles.dropdownMenu}>
                  {companyOptions.map((company) => {
                    const isSelected = company.companyId === contextData.access?.currentCompanyId;
                    return (
                      <button
                        key={company.companyId}
                        type="button"
                        style={{ ...styles.dropdownItem, ...(isSelected ? styles.dropdownItemSelected : {}) }}
                        onClick={() => handleCompanyChange(company.companyId)}
                        disabled={switchingContext}
                      >
                        {company.companyName}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={styles.contextMenuAnchor}>
              {renderSelectableBadge("perimeter", "Perimeter", contextData.perimeter, canSwitchPerimeter)}
              {canSwitchPerimeter && openMenu === "perimeter" && (
                <div style={styles.dropdownMenu}>
                  {perimeterOptions.map((perimeter) => {
                    const isSelected = perimeter.perimeterId === contextData.access?.currentPerimeterId;
                    return (
                      <button
                        key={perimeter.perimeterId}
                        type="button"
                        style={{ ...styles.dropdownItem, ...(isSelected ? styles.dropdownItemSelected : {}) }}
                        onClick={() => handlePerimeterChange(perimeter.perimeterId)}
                        disabled={switchingContext}
                      >
                        {perimeter.perimeterName}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

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
    zIndex: 900,
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
  contextMenuAnchor: {
    position: "relative",
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
  contextButton: {
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  },
  contextButtonOpen: {
    background: "#EEF2FF",
    borderColor: "#C7D2FE",
    color: "#3730A3",
  },
  contextChevron: {
    fontSize: 10,
    opacity: 0.9,
    lineHeight: 1,
  },
  dropdownMenu: {
    position: "absolute",
    top: "calc(100% + 6px)",
    left: 0,
    minWidth: 220,
    maxHeight: 260,
    overflowY: "auto",
    border: "1px solid #CBD5E1",
    background: "#FFFFFF",
    borderRadius: "10px",
    boxShadow: "0 8px 24px rgba(15,23,42,0.12)",
    padding: 6,
    zIndex: 2000,
  },
  dropdownItem: {
    width: "100%",
    border: "none",
    borderRadius: 8,
    background: "transparent",
    color: "#334155",
    textAlign: "left",
    fontSize: 12,
    fontWeight: 600,
    padding: "8px 10px",
    cursor: "pointer",
  },
  dropdownItemSelected: {
    background: "#EEF2FF",
    color: "#3730A3",
  },
};

export default TopBar;
