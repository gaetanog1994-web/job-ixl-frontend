import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useSidebar } from "../lib/SidebarContext";
import { appApi } from "../lib/appApi";
import { labelAccessRole } from "../lib/accessLabels";
import {
  buildPrimaryNavigationModel,
  buildTopBarHierarchy,
  type AccessiblePerimeterMembership,
  type NavLeafItem,
  type TopBarSectionTree,
} from "../lib/navigationModel";
import {
  getAccessibleCompanies,
  getAccessiblePerimetersForCompany,
  hasMultipleCompanyChoices,
  hasMultiplePerimeterChoicesInCurrentCompany,
  resolveContextForCompanyChange,
  resolveContextForPerimeterChange,
  type AccessPayload,
} from "../lib/tenantContextResolver";
import "../styles/dashboard.css";

type PlatformCompany = {
  id: string;
  name: string;
};

type PlatformPerimeter = {
  id: string;
  name: string;
  company_id?: string;
  company_name?: string;
  perimeter_id?: string;
  perimeter_name?: string;
  access_role?: string;
};

type ContextData = {
  company: string;
  perimeter: string;
  accessRole: string;
};

const TopBar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toggle: toggleSidebar } = useSidebar();
  const rootRef = useRef<HTMLDivElement | null>(null);

  const [contextData, setContextData] = useState<ContextData | null>(null);
  const [meData, setMeData] = useState<any>(null);
  const [ownerCompanies, setOwnerCompanies] = useState<PlatformCompany[]>([]);
  const [superAdminPerimetersByCompany, setSuperAdminPerimetersByCompany] = useState<Record<string, PlatformPerimeter[]>>({});
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [expandedSuperAdminNodes, setExpandedSuperAdminNodes] = useState<Record<string, boolean>>({});
  const [expandedAdminNodes, setExpandedAdminNodes] = useState<Record<string, boolean>>({});
  const [openContextMenu, setOpenContextMenu] = useState<"company" | "perimeter" | null>(null);
  const [switchingContext, setSwitchingContext] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const mePayload = await appApi.getMe();
        if (cancelled) return;

        setMeData(mePayload);
        const access = mePayload?.access ?? null;
        setContextData({
          company: access?.currentCompanyName || "Company non selezionata",
          perimeter: access?.currentPerimeterName || "Perimeter non selezionato",
          accessRole: labelAccessRole(access?.accessRole),
        });

        if (mePayload?.isOwner === true) {
          const companyRows = await appApi.platformGetCompanies();
          if (!cancelled) {
            setOwnerCompanies(
              (companyRows ?? []).map((company: { id?: string; company_id?: string; name?: string; company_name?: string }) => ({
                id: String(company?.id ?? company?.company_id ?? ""),
                name: String(company?.name ?? company?.company_name ?? "Company"),
              })).filter((company: PlatformCompany) => company.id)
            );
          }
        } else if (!cancelled) {
          setOwnerCompanies([]);
        }

        const companyMemberships = Array.isArray(access?.companies) ? access.companies : [];
        if (companyMemberships.length > 0) {
          const prevTenantContext = appApi.getTenantContext();
          const map: Record<string, PlatformPerimeter[]> = {};
          try {
            await Promise.all(
              companyMemberships.map(async (company: { company_id?: string }) => {
                const companyId = String(company?.company_id ?? "");
                if (!companyId) return;
                try {
                  appApi.setTenantContext({ companyId, perimeterId: null });
                  const rows = await appApi.platformGetPerimeters(companyId);
                  map[companyId] = (rows ?? []) as PlatformPerimeter[];
                } catch {
                  map[companyId] = [];
                }
              })
            );
          } finally {
            appApi.setTenantContext(prevTenantContext);
          }
          if (!cancelled) setSuperAdminPerimetersByCompany(map);
        } else if (!cancelled) {
          setSuperAdminPerimetersByCompany({});
        }
      } catch {
        if (!cancelled) {
          setMeData(null);
          setContextData(null);
          setOwnerCompanies([]);
          setSuperAdminPerimetersByCompany({});
        }
      }
    };

    const handleStructureRefresh = () => {
      setOpenSection(null);
      load();
    };

    load();
    window.addEventListener("tenant-structure-changed", handleStructureRefresh);

    return () => {
      cancelled = true;
      window.removeEventListener("tenant-structure-changed", handleStructureRefresh);
    };
  }, [location.pathname]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpenSection(null);
        setOpenContextMenu(null);
      }
    };
    window.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  useEffect(() => {
    setOpenSection(null);
    setOpenContextMenu(null);
  }, [location.pathname]);

  const hasActivePerimeter = Boolean(meData?.access?.currentPerimeterId);
  const isOwner = meData?.isOwner === true;
  const isSuperAdmin = meData?.isSuperAdmin === true;
  const isAdmin = meData?.isAdmin === true;
  const accessCompanies = useMemo(
    () => (Array.isArray(meData?.access?.companies) ? meData.access.companies : []),
    [meData?.access?.companies]
  );

  const navSections = useMemo(() => buildPrimaryNavigationModel({
    pathname: location.pathname,
    currentCompanyId: meData?.access?.currentCompanyId ?? null,
    currentPerimeterId: meData?.access?.currentPerimeterId ?? null,
    hasActivePerimeter,
    isOwner,
    isSuperAdmin,
    isAdmin,
    ownerCompanies,
    accessCompanies,
    superAdminPerimetersByCompany,
  }), [
    location.pathname,
    hasActivePerimeter,
    isOwner,
    isSuperAdmin,
    isAdmin,
    ownerCompanies,
    accessCompanies,
    superAdminPerimetersByCompany,
  ]);
  const accessPerimeters = useMemo(
    () => ((Array.isArray(meData?.access?.perimeters) ? meData.access.perimeters : []) as AccessiblePerimeterMembership[]),
    [meData?.access?.perimeters]
  );
  const topBarTreesBySection = useMemo(() => {
    const trees = buildTopBarHierarchy({
      pathname: location.pathname,
      currentCompanyId: meData?.access?.currentCompanyId ?? null,
      currentPerimeterId: meData?.access?.currentPerimeterId ?? null,
      hasActivePerimeter,
      isOwner,
      isSuperAdmin,
      isAdmin,
      ownerCompanies,
      accessCompanies,
      superAdminPerimetersByCompany,
      accessPerimeters,
    });
    return trees.reduce<Record<string, TopBarSectionTree>>((acc, tree) => {
      acc[tree.sectionId] = tree;
      return acc;
    }, {});
  }, [
    location.pathname,
    meData?.access?.currentCompanyId,
    meData?.access?.currentPerimeterId,
    hasActivePerimeter,
    isOwner,
    isSuperAdmin,
    isAdmin,
    ownerCompanies,
    accessCompanies,
    superAdminPerimetersByCompany,
    accessPerimeters,
  ]);

  useEffect(() => {
    const superAdminTree = topBarTreesBySection.super_admin;
    if (openSection !== "super_admin" || !superAdminTree) return;
    const activeNode = superAdminTree.nodes.find((node) => node.isActive);
    if (!activeNode || activeNode.children.length === 0) return;
    setExpandedSuperAdminNodes((prev) => ({ ...prev, [activeNode.id]: true }));
  }, [openSection, topBarTreesBySection]);

  useEffect(() => {
    const adminTree = topBarTreesBySection.admin;
    if (openSection !== "admin" || !adminTree) return;
    const activeNode = adminTree.nodes.find((node) => node.isActive);
    if (!activeNode || activeNode.children.length === 0) return;
    setExpandedAdminNodes((prev) => ({ ...prev, [activeNode.id]: true }));
  }, [openSection, topBarTreesBySection]);

  const goToItem = (item: NavLeafItem) => {
    setOpenSection(null);
    setOpenContextMenu(null);
    if (item.tenantContext) {
      appApi.setTenantContext(item.tenantContext);
    }
    navigate(item.path);
  };

  const toggleSuperAdminNode = (nodeId: string) => {
    setExpandedSuperAdminNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const toggleAdminNode = (nodeId: string) => {
    setExpandedAdminNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const canSwitchCompany = useMemo(
    () => hasMultipleCompanyChoices((meData?.access ?? null) as AccessPayload | null),
    [meData?.access]
  );

  const canSwitchPerimeter = useMemo(
    () => hasMultiplePerimeterChoicesInCurrentCompany((meData?.access ?? null) as AccessPayload | null),
    [meData?.access]
  );

  const companyOptions = useMemo(
    () => getAccessibleCompanies((meData?.access ?? null) as AccessPayload | null),
    [meData?.access]
  );

  const perimeterOptions = useMemo(
    () => getAccessiblePerimetersForCompany(
      (meData?.access ?? null) as AccessPayload | null,
      meData?.access?.currentCompanyId ?? null
    ),
    [meData?.access]
  );

  const handleCompanyChange = (targetCompanyId: string) => {
    if (switchingContext) return;
    const nextContext = resolveContextForCompanyChange(
      (meData?.access ?? null) as AccessPayload | null,
      targetCompanyId
    );
    if (!nextContext) return;

    const currentCompanyId = meData?.access?.currentCompanyId ?? null;
    const currentPerimeterId = meData?.access?.currentPerimeterId ?? null;
    const isSameSelection = currentCompanyId === nextContext.companyId
      && currentPerimeterId === nextContext.perimeterId;

    setOpenContextMenu(null);
    if (isSameSelection) return;

    setSwitchingContext(true);
    appApi.setTenantContext(nextContext);
    window.location.reload();
  };

  const handlePerimeterChange = (targetPerimeterId: string) => {
    if (switchingContext) return;
    const nextContext = resolveContextForPerimeterChange(
      (meData?.access ?? null) as AccessPayload | null,
      targetPerimeterId
    );
    if (!nextContext) return;

    const currentCompanyId = meData?.access?.currentCompanyId ?? null;
    const currentPerimeterId = meData?.access?.currentPerimeterId ?? null;
    const isSameSelection = currentCompanyId === nextContext.companyId
      && currentPerimeterId === nextContext.perimeterId;

    setOpenContextMenu(null);
    if (isSameSelection) return;

    setSwitchingContext(true);
    appApi.setTenantContext(nextContext);
    window.location.reload();
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

        <nav className="app-topbar-primary-nav" aria-label="Navigazione primaria">
          {navSections.map((section) => {
            if (section.id === "super_admin" && topBarTreesBySection.super_admin) {
              const tree = topBarTreesBySection.super_admin;
              const isOpen = openSection === section.id;
              return (
                <div key={section.id} className="app-topbar-nav-group">
                  <button
                    type="button"
                    className={`app-topbar-nav-item ${section.isActive ? "active" : ""}`}
                    onClick={() => setOpenSection((prev) => (prev === section.id ? null : section.id))}
                  >
                    {section.label}
                    <span className={`app-topbar-nav-caret ${isOpen ? "open" : ""}`}>▾</span>
                  </button>
                  {isOpen && (
                    <div className="app-topbar-dropdown app-topbar-tree-dropdown">
                      {tree.nodes.map((node) => {
                        const isExpanded = expandedSuperAdminNodes[node.id] === true;
                        const hasChildren = node.children.length > 0;
                        return (
                          <div key={node.id} className="app-topbar-tree-node">
                            <div className="app-topbar-tree-row">
                              <button
                                type="button"
                                className={`app-topbar-tree-label app-topbar-dropdown-item ${node.isActive ? "active" : ""}`}
                                onClick={() => node.navigationItem && goToItem(node.navigationItem)}
                                disabled={!node.navigationItem}
                              >
                                {node.label}
                              </button>
                              {hasChildren && (
                                <button
                                  type="button"
                                  className={`app-topbar-tree-toggle ${isExpanded ? "expanded" : ""}`}
                                  onClick={() => toggleSuperAdminNode(node.id)}
                                  aria-label={isExpanded ? "Chiudi perimetri" : "Apri perimetri"}
                                >
                                  ▸
                                </button>
                              )}
                            </div>
                            {hasChildren && isExpanded && (
                              <div className="app-topbar-tree-children">
                                {node.children.map((child) => (
                                  <button
                                    key={child.id}
                                    type="button"
                                    className={`app-topbar-dropdown-item ${child.isActive ? "active" : ""}`}
                                    onClick={() => goToItem(child)}
                                  >
                                    {child.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            if (section.id === "admin" && topBarTreesBySection.admin) {
              const tree = topBarTreesBySection.admin;
              const isOpen = openSection === section.id;
              return (
                <div key={section.id} className="app-topbar-nav-group">
                  <button
                    type="button"
                    className={`app-topbar-nav-item ${section.isActive ? "active" : ""}`}
                    onClick={() => setOpenSection((prev) => (prev === section.id ? null : section.id))}
                  >
                    {section.label}
                    <span className={`app-topbar-nav-caret ${isOpen ? "open" : ""}`}>▾</span>
                  </button>
                  {isOpen && (
                    <div className="app-topbar-dropdown app-topbar-tree-dropdown">
                      {tree.nodes.map((node) => {
                        const isExpanded = expandedAdminNodes[node.id] === true;
                        const hasChildren = node.children.length > 0;
                        return (
                          <div key={node.id} className="app-topbar-tree-node">
                            <div className="app-topbar-tree-row">
                              <button
                                type="button"
                                className={`app-topbar-tree-label app-topbar-dropdown-item ${node.isActive ? "active" : ""}`}
                                onClick={() => node.navigationItem && goToItem(node.navigationItem)}
                                disabled={!node.navigationItem}
                              >
                                {node.label}
                              </button>
                              {hasChildren && (
                                <button
                                  type="button"
                                  className={`app-topbar-tree-toggle ${isExpanded ? "expanded" : ""}`}
                                  onClick={() => toggleAdminNode(node.id)}
                                  aria-label={isExpanded ? "Chiudi sezioni" : "Apri sezioni"}
                                >
                                  ▸
                                </button>
                              )}
                            </div>
                            {hasChildren && isExpanded && (
                              <div className="app-topbar-tree-children">
                                {node.children.map((child) => (
                                  <button
                                    key={child.id}
                                    type="button"
                                    className={`app-topbar-dropdown-item ${child.isActive ? "active" : ""}`}
                                    onClick={() => goToItem(child)}
                                  >
                                    {child.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            if (section.items.length === 1) {
              const onlyItem = section.items[0];
              return (
                <button
                  key={section.id}
                  type="button"
                  className={`app-topbar-nav-item ${section.isActive ? "active" : ""}`}
                  onClick={() => goToItem(onlyItem)}
                >
                  {section.label}
                </button>
              );
            }

            const isOpen = openSection === section.id;
            return (
              <div key={section.id} className="app-topbar-nav-group">
                <button
                  type="button"
                  className={`app-topbar-nav-item ${section.isActive ? "active" : ""}`}
                  onClick={() => setOpenSection((prev) => (prev === section.id ? null : section.id))}
                >
                  {section.label}
                  <span className={`app-topbar-nav-caret ${isOpen ? "open" : ""}`}>▾</span>
                </button>
                {isOpen && (
                  <div className="app-topbar-dropdown">
                    {section.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`app-topbar-dropdown-item ${item.isActive ? "active" : ""}`}
                        onClick={() => goToItem(item)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      <div className="app-topbar-slim-right">
        {contextData && (
          <div className="app-topbar-context-pill-wrap" aria-label="Contesto attivo">
            <div className="app-topbar-nav-group">
              {canSwitchCompany ? (
                <button
                  type="button"
                  className={`app-topbar-context-pill app-topbar-context-pill-btn ${openContextMenu === "company" ? "open" : ""}`}
                  onClick={() => setOpenContextMenu((prev) => (prev === "company" ? null : "company"))}
                  disabled={switchingContext}
                >
                  {contextData.company}
                  <span className={`app-topbar-nav-caret ${openContextMenu === "company" ? "open" : ""}`}>▾</span>
                </button>
              ) : (
                <span className="app-topbar-context-pill">{contextData.company}</span>
              )}
              {canSwitchCompany && openContextMenu === "company" && (
                <div className="app-topbar-dropdown app-topbar-dropdown-right">
                  {companyOptions.map((company) => (
                    <button
                      key={company.companyId}
                      type="button"
                      className={`app-topbar-dropdown-item ${company.companyId === meData?.access?.currentCompanyId ? "active" : ""}`}
                      onClick={() => handleCompanyChange(company.companyId)}
                      disabled={switchingContext}
                    >
                      {company.companyName}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="app-topbar-nav-group">
              {canSwitchPerimeter ? (
                <button
                  type="button"
                  className={`app-topbar-context-pill app-topbar-context-pill-btn ${openContextMenu === "perimeter" ? "open" : ""}`}
                  onClick={() => setOpenContextMenu((prev) => (prev === "perimeter" ? null : "perimeter"))}
                  disabled={switchingContext}
                >
                  {contextData.perimeter}
                  <span className={`app-topbar-nav-caret ${openContextMenu === "perimeter" ? "open" : ""}`}>▾</span>
                </button>
              ) : (
                <span className="app-topbar-context-pill">{contextData.perimeter}</span>
              )}
              {canSwitchPerimeter && openContextMenu === "perimeter" && (
                <div className="app-topbar-dropdown app-topbar-dropdown-right">
                  {perimeterOptions.map((perimeter) => (
                    <button
                      key={perimeter.perimeterId}
                      type="button"
                      className={`app-topbar-dropdown-item ${perimeter.perimeterId === meData?.access?.currentPerimeterId ? "active" : ""}`}
                      onClick={() => handlePerimeterChange(perimeter.perimeterId)}
                      disabled={switchingContext}
                    >
                      {perimeter.perimeterName}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <span className="app-topbar-context-pill">{contextData.accessRole}</span>
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
