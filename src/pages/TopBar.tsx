import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useSidebar } from "../lib/SidebarContext";
import { appApi } from "../lib/appApi";
import {
  buildActiveContextSource,
  deriveProfileFromPath,
  getContextDestinationPath,
  getDefaultProfile,
  isSameSelection,
  PROFILE_LABELS,
  readStoredActiveProfile,
  resolveDefaultSelection,
  resolveSelectionForProfile,
  toTenantContext,
  type ActiveContextSelection,
  type ActiveContextSource,
  type ActiveProfile,
  writeStoredActiveProfile,
} from "../lib/activeContextModel";
import "../styles/dashboard.css";

type TopBarMeData = Awaited<ReturnType<typeof appApi.getMe>>;
type ContextMenuKey = "profile" | "company" | "perimeter" | null;

const TopBar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toggle: toggleSidebar } = useSidebar();
  const rootRef = useRef<HTMLDivElement | null>(null);

  const [meData, setMeData] = useState<TopBarMeData | null>(null);
  const [contextSource, setContextSource] = useState<ActiveContextSource | null>(null);
  const [activeSelection, setActiveSelection] = useState<ActiveContextSelection | null>(null);
  const [openMenu, setOpenMenu] = useState<ContextMenuKey>(null);
  const [switchingContext, setSwitchingContext] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const me = await appApi.getMe();
        if (cancelled) return;

        const source = buildActiveContextSource(me);
        const defaultProfile = getDefaultProfile(source);
        const preferredProfile =
          readStoredActiveProfile() ??
          deriveProfileFromPath(location.pathname, source) ??
          defaultProfile;

        const resolved =
          (preferredProfile
            ? resolveSelectionForProfile(source, {
              profile: preferredProfile,
              preferredCompanyId: me?.access?.currentCompanyId ?? null,
              preferredPerimeterId: me?.access?.currentPerimeterId ?? null,
            })
            : null) ??
          resolveDefaultSelection(source);

        setMeData(me);
        setContextSource(source);
        setActiveSelection(resolved);

        if (resolved) {
          writeStoredActiveProfile(resolved.profile);
          const currentTenant = appApi.getTenantContext();
          const expectedTenant = toTenantContext(resolved);
          if (
            currentTenant.companyId !== expectedTenant.companyId ||
            currentTenant.perimeterId !== expectedTenant.perimeterId
          ) {
            appApi.setTenantContext(expectedTenant);
          }
        }
      } catch {
        if (!cancelled) {
          setMeData(null);
          setContextSource(null);
          setActiveSelection(null);
        }
      }
    };

    const handleRefresh = () => {
      setOpenMenu(null);
      load();
    };

    load();
    window.addEventListener("tenant-structure-changed", handleRefresh);
    window.addEventListener("tenant-context-changed", handleRefresh);

    return () => {
      cancelled = true;
      window.removeEventListener("tenant-structure-changed", handleRefresh);
      window.removeEventListener("tenant-context-changed", handleRefresh);
    };
  }, [location.pathname]);

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

  useEffect(() => {
    setOpenMenu(null);
  }, [location.pathname]);

  const activeProfile = activeSelection?.profile ?? null;
  const availableProfiles = contextSource?.availableProfiles ?? [];
  const canSwitchProfile = availableProfiles.length > 1;

  const companyOptions = useMemo(() => {
    if (!contextSource || !activeProfile) return [];
    return contextSource.availableCompaniesByProfile[activeProfile] ?? [];
  }, [contextSource, activeProfile]);

  const perimeterOptions = useMemo(() => {
    if (!contextSource || !activeProfile || !activeSelection?.companyId) return [];
    return (
      contextSource.availablePerimetersByProfileAndCompany[activeProfile]?.[activeSelection.companyId] ??
      []
    );
  }, [contextSource, activeProfile, activeSelection?.companyId]);

  const showCompany = activeProfile === "user" || activeProfile === "admin" || activeProfile === "super_admin";
  const showPerimeter = activeProfile === "user" || activeProfile === "admin";
  const canSwitchCompany = showCompany && companyOptions.length > 1;
  const canSwitchPerimeter = showPerimeter && perimeterOptions.length > 1;

  const profileLabel = activeProfile ? PROFILE_LABELS[activeProfile] : "—";
  const companyLabel =
    companyOptions.find((company) => company.companyId === activeSelection?.companyId)?.companyName ??
    meData?.access?.currentCompanyName ??
    "Company";
  const perimeterLabel =
    perimeterOptions.find((perimeter) => perimeter.perimeterId === activeSelection?.perimeterId)?.perimeterName ??
    meData?.access?.currentPerimeterName ??
    "Perimetro";

  const hardNavigateTo = (path: string) => {
    if (window.location.pathname === path) {
      window.location.reload();
      return;
    }
    window.location.assign(path);
  };

  const applySelection = (nextSelection: ActiveContextSelection) => {
    if (switchingContext || !contextSource) return;
    const isSame = isSameSelection(activeSelection, nextSelection);
    setOpenMenu(null);
    if (isSame) return;

    setSwitchingContext(true);
    writeStoredActiveProfile(nextSelection.profile);
    appApi.setTenantContext(toTenantContext(nextSelection));
    const destination = getContextDestinationPath(nextSelection, location.pathname);
    hardNavigateTo(destination);
  };

  const handleProfileChange = (profile: ActiveProfile) => {
    if (!contextSource) return;
    const nextSelection = resolveSelectionForProfile(contextSource, {
      profile,
      preferredCompanyId: activeSelection?.companyId ?? null,
      preferredPerimeterId: activeSelection?.perimeterId ?? null,
    });
    if (!nextSelection) return;
    applySelection(nextSelection);
  };

  const handleCompanyChange = (companyId: string) => {
    if (!contextSource || !activeSelection) return;
    const nextSelection = resolveSelectionForProfile(contextSource, {
      profile: activeSelection.profile,
      preferredCompanyId: companyId,
      preferredPerimeterId: activeSelection.perimeterId,
    });
    if (!nextSelection) return;
    applySelection(nextSelection);
  };

  const handlePerimeterChange = (perimeterId: string) => {
    if (!contextSource || !activeSelection) return;
    const nextSelection = resolveSelectionForProfile(contextSource, {
      profile: activeSelection.profile,
      preferredCompanyId: activeSelection.companyId,
      preferredPerimeterId: perimeterId,
    });
    if (!nextSelection) return;
    applySelection(nextSelection);
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
        <span className="app-context-bar-title">Contesto attivo</span>
      </div>

      <div className="app-topbar-slim-right">
        {contextSource && activeSelection && (
          <div className="app-context-bar" aria-label="Barra di contesto">
            <div className="app-topbar-nav-group">
              {canSwitchProfile ? (
                <button
                  type="button"
                  className={`app-context-box app-context-box-btn ${openMenu === "profile" ? "open" : ""}`}
                  onClick={() => setOpenMenu((prev) => (prev === "profile" ? null : "profile"))}
                  disabled={switchingContext}
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
                      disabled={switchingContext}
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
                    disabled={switchingContext}
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
                        disabled={switchingContext}
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
                    disabled={switchingContext}
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
                        disabled={switchingContext}
                      >
                        {perimeter.perimeterName}
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
