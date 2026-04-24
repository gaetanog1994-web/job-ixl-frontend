import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useSidebar } from "../lib/SidebarContext";
import { appApi } from "../lib/appApi";
import { useActiveContext } from "../lib/ActiveContextProvider";
import { PROFILE_LABELS } from "../lib/activeContextModel";
import { buildAdminPageNavigation, resolveActiveAdminPage } from "../lib/navigationModel";
import "../styles/dashboard.css";

type ContextMenuKey = "profile" | "company" | "perimeter" | "adminPage" | null;

const TopBar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toggle: toggleSidebar } = useSidebar();
  const rootRef = useRef<HTMLDivElement | null>(null);

  const {
    activeContextSource,
    activeSelection,
    switchProfile,
    switchCompany,
    switchPerimeter,
    isBootstrappingContext,
  } = useActiveContext();

  const [openMenu, setOpenMenu] = useState<ContextMenuKey>(null);
  const [switchingContext, setSwitchingContext] = useState(false);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };
    window.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  const activeProfile = activeSelection?.profile ?? null;
  const availableProfiles = activeContextSource?.availableProfiles ?? [];
  const canSwitchProfile = availableProfiles.length > 1;

  const companyOptions = useMemo(() => {
    if (!activeContextSource || !activeProfile) return [];
    return activeContextSource.availableCompaniesByProfile[activeProfile] ?? [];
  }, [activeContextSource, activeProfile]);

  const perimeterOptions = useMemo(() => {
    if (!activeContextSource || !activeProfile || !activeSelection?.companyId) return [];
    return (
      activeContextSource.availablePerimetersByProfileAndCompany[activeProfile]?.[activeSelection.companyId] ??
      []
    );
  }, [activeContextSource, activeProfile, activeSelection?.companyId]);

  const showCompany = activeProfile === "user" || activeProfile === "admin" || activeProfile === "super_admin";
  const showPerimeter = activeProfile === "user" || activeProfile === "admin";
  const showAdminPageSelector = activeProfile === "admin";
  const canSwitchCompany = showCompany && companyOptions.length > 1;
  const canSwitchPerimeter = showPerimeter && perimeterOptions.length > 1;
  const adminPageOptions = useMemo(() => buildAdminPageNavigation(location.pathname), [location.pathname]);
  const currentAdminPage = useMemo(() => resolveActiveAdminPage(location.pathname), [location.pathname]);
  const canSwitchAdminPage = showAdminPageSelector && Boolean(activeSelection?.perimeterId) && adminPageOptions.length > 1;

  const profileLabel = activeProfile ? PROFILE_LABELS[activeProfile] : "—";
  const companyLabel =
    companyOptions.find((company) => company.companyId === activeSelection?.companyId)?.companyName ?? "Company";
  const perimeterLabel =
    perimeterOptions.find((perimeter) => perimeter.perimeterId === activeSelection?.perimeterId)?.perimeterName ??
    "Perimetro";
  const adminPageLabel = currentAdminPage?.label ?? "Area Admin";
  const currentPageLabel = useMemo(() => {
    const path = location.pathname;
    if (path === "/" || path.startsWith("/dashboard")) return "Dashboard";
    if (path.startsWith("/account")) return "Account";
    if (path.startsWith("/admin")) return currentAdminPage?.label ?? "Area Admin";
    return "Contesto";
  }, [location.pathname, currentAdminPage]);

  const handleProfileChange = (profile: (typeof availableProfiles)[number]) => {
    if (switchingContext || isBootstrappingContext) return;
    setSwitchingContext(true);
    setOpenMenu(null);
    try {
      const destination = switchProfile(profile);
      if (destination) {
        navigate(destination, { replace: true });
      }
    } finally {
      setSwitchingContext(false);
    }
  };

  const handleCompanyChange = (companyId: string) => {
    if (switchingContext || isBootstrappingContext) return;
    setSwitchingContext(true);
    setOpenMenu(null);
    try {
      const destination = switchCompany(companyId);
      if (destination) {
        navigate(destination, { replace: true });
      }
    } finally {
      setSwitchingContext(false);
    }
  };

  const handlePerimeterChange = (perimeterId: string) => {
    if (switchingContext || isBootstrappingContext) return;
    setSwitchingContext(true);
    setOpenMenu(null);
    try {
      const destination = switchPerimeter(perimeterId);
      if (destination) {
        navigate(destination, { replace: true });
      }
    } finally {
      setSwitchingContext(false);
    }
  };

  const handleAdminPageChange = (path: string) => {
    if (isBootstrappingContext || !activeSelection?.perimeterId) return;
    setOpenMenu(null);
    if (location.pathname === path) return;
    navigate(path);
  };

  const handleLogout = async () => {
    appApi.clearTenantContext();
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <header className="app-topbar-slim" ref={rootRef}>
      <div className="app-topbar-slim-left">
        <button
          id="topbar-hamburger"
          className="app-topbar-hamburger"
          onClick={toggleSidebar}
          title="Apri menu navigazione"
        >
          ☰
        </button>
        <span className="app-context-bar-title">Contesto</span>
        <span className="app-context-page-title">{currentPageLabel}</span>
      </div>

      <div className="app-topbar-slim-right">
        {activeContextSource && activeSelection && (
          <div className="app-context-bar" aria-label="Barra di contesto">
            <div className="app-topbar-nav-group">
              {canSwitchProfile ? (
                <button
                  type="button"
                  className={`app-context-box app-context-box-btn ${openMenu === "profile" ? "open" : ""}`}
                  onClick={() => setOpenMenu((prev) => (prev === "profile" ? null : "profile"))}
                  disabled={switchingContext || isBootstrappingContext}
                >
                  <span className="app-context-box-label">Profilo</span>
                  <span className="app-context-box-value">{profileLabel}</span>
                  <span className={`app-topbar-nav-caret ${openMenu === "profile" ? "open" : ""}`}>▾</span>
                </button>
              ) : (
                <span className="app-context-box">
                  <span className="app-context-box-label">Profilo</span>
                  <span className="app-context-box-value">{profileLabel}</span>
                </span>
              )}
              {canSwitchProfile && openMenu === "profile" && (
                <div className="app-topbar-dropdown app-topbar-dropdown-right">
                  {availableProfiles.map((profile) => (
                    <button
                      key={profile}
                      type="button"
                      className={`app-topbar-dropdown-item ${profile === activeSelection.profile ? "active" : ""}`}
                      onClick={() => handleProfileChange(profile)}
                      disabled={switchingContext || isBootstrappingContext}
                    >
                      {PROFILE_LABELS[profile]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {showCompany && (
              <div className="app-topbar-nav-group">
                {canSwitchCompany ? (
                  <button
                    type="button"
                    className={`app-context-box app-context-box-btn ${openMenu === "company" ? "open" : ""}`}
                    onClick={() => setOpenMenu((prev) => (prev === "company" ? null : "company"))}
                    disabled={switchingContext || isBootstrappingContext}
                  >
                    <span className="app-context-box-label">Azienda</span>
                    <span className="app-context-box-value">{companyLabel}</span>
                    <span className={`app-topbar-nav-caret ${openMenu === "company" ? "open" : ""}`}>▾</span>
                  </button>
                ) : (
                  <span className="app-context-box">
                    <span className="app-context-box-label">Azienda</span>
                    <span className="app-context-box-value">{companyLabel}</span>
                  </span>
                )}
                {canSwitchCompany && openMenu === "company" && (
                  <div className="app-topbar-dropdown app-topbar-dropdown-right">
                    {companyOptions.map((company) => (
                      <button
                        key={company.companyId}
                        type="button"
                        className={`app-topbar-dropdown-item ${company.companyId === activeSelection.companyId ? "active" : ""}`}
                        onClick={() => handleCompanyChange(company.companyId)}
                        disabled={switchingContext || isBootstrappingContext}
                      >
                        {company.companyName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {showPerimeter && (
              <div className="app-topbar-nav-group">
                {canSwitchPerimeter ? (
                  <button
                    type="button"
                    className={`app-context-box app-context-box-btn ${openMenu === "perimeter" ? "open" : ""}`}
                    onClick={() => setOpenMenu((prev) => (prev === "perimeter" ? null : "perimeter"))}
                    disabled={switchingContext || isBootstrappingContext}
                  >
                    <span className="app-context-box-label">Perimetro</span>
                    <span className="app-context-box-value">{perimeterLabel}</span>
                    <span className={`app-topbar-nav-caret ${openMenu === "perimeter" ? "open" : ""}`}>▾</span>
                  </button>
                ) : (
                  <span className="app-context-box">
                    <span className="app-context-box-label">Perimetro</span>
                    <span className="app-context-box-value">{perimeterLabel}</span>
                  </span>
                )}
                {canSwitchPerimeter && openMenu === "perimeter" && (
                  <div className="app-topbar-dropdown app-topbar-dropdown-right">
                    {perimeterOptions.map((perimeter) => (
                      <button
                        key={perimeter.perimeterId}
                        type="button"
                        className={`app-topbar-dropdown-item ${perimeter.perimeterId === activeSelection.perimeterId ? "active" : ""}`}
                        onClick={() => handlePerimeterChange(perimeter.perimeterId)}
                        disabled={switchingContext || isBootstrappingContext}
                      >
                        {perimeter.perimeterName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {showAdminPageSelector && (
              <div className="app-topbar-nav-group">
                {canSwitchAdminPage ? (
                  <button
                    type="button"
                    className={`app-context-box app-context-box-btn ${openMenu === "adminPage" ? "open" : ""}`}
                    onClick={() => setOpenMenu((prev) => (prev === "adminPage" ? null : "adminPage"))}
                    disabled={isBootstrappingContext}
                  >
                    <span className="app-context-box-label">Pagina Admin</span>
                    <span className="app-context-box-value">{adminPageLabel}</span>
                    <span className={`app-topbar-nav-caret ${openMenu === "adminPage" ? "open" : ""}`}>▾</span>
                  </button>
                ) : (
                  <span className="app-context-box">
                    <span className="app-context-box-label">Pagina Admin</span>
                    <span className="app-context-box-value">{adminPageLabel}</span>
                  </span>
                )}
                {canSwitchAdminPage && openMenu === "adminPage" && (
                  <div className="app-topbar-dropdown app-topbar-dropdown-right">
                    {adminPageOptions.map((page) => (
                      <button
                        key={page.id}
                        type="button"
                        className={`app-topbar-dropdown-item ${page.isActive ? "active" : ""}`}
                        onClick={() => handleAdminPageChange(page.path)}
                        disabled={isBootstrappingContext}
                      >
                        {page.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          className="app-topbar-logout-btn"
          onClick={handleLogout}
          id="topbar-logout-btn"
        >
          Logout
        </button>
      </div>
    </header>
  );
};

export default TopBar;
