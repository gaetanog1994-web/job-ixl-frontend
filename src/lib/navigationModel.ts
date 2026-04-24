type PlatformCompany = {
  id: string;
  name: string;
};

type AccessCompany = {
  company_id?: string;
  company_name?: string;
};

type AccessPerimeter = {
  company_id?: string;
  company_name?: string;
  id?: string;
  perimeter_id?: string;
  name?: string;
  perimeter_name?: string;
  access_role?: string;
};

export type AccessiblePerimeterMembership = {
  company_id?: string;
  company_name?: string;
  perimeter_id?: string;
  perimeter_name?: string;
  access_role?: string;
};

export type NavLeafItem = {
  id: string;
  label: string;
  path: string;
  isActive: boolean;
};

export type NavSection = {
  id: "dashboard" | "owner" | "super_admin" | "admin";
  label: string;
  items: NavLeafItem[];
  isActive: boolean;
  isVisible: boolean;
};

type BuildModelInput = {
  pathname: string;
  currentCompanyId: string | null;
  currentPerimeterId: string | null;
  hasActivePerimeter: boolean;
  isOwner: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  ownerCompanies: PlatformCompany[];
  accessCompanies: AccessCompany[];
  superAdminPerimetersByCompany: Record<string, AccessPerimeter[]>;
};

export type TopBarSectionTree = {
  sectionId: "super_admin" | "admin";
  nodes: TopBarTreeNode[];
};

export type TopBarTreeNode = {
  id: string;
  label: string;
  isActive: boolean;
  navigationItem?: NavLeafItem;
  children: NavLeafItem[];
};

const ADMIN_ACCESS_ROLES = new Set(["admin", "admin_user"]);
export type AdminPageKey = "interlocking" | "configuration" | "campaigns" | "testScenario" | "maps" | "candidatures";

type AdminPageDefinition = {
  key: AdminPageKey;
  id: string;
  label: string;
  path: string;
};

export const ADMIN_PAGE_DEFINITIONS: AdminPageDefinition[] = [
  { key: "interlocking", id: "admin-interlocking", label: "Interlocking", path: "/admin/interlocking" },
  { key: "configuration", id: "admin-configurazione", label: "Configurazione", path: "/admin/configurazione" },
  { key: "campaigns", id: "admin-campagne", label: "Campagne candidature", path: "/admin/campagne" },
  { key: "testScenario", id: "admin-test-scenario", label: "Test Scenario", path: "/admin/test-scenario" },
  { key: "maps", id: "admin-maps", label: "Mappe utenti attivi", path: "/admin/maps" },
  { key: "candidatures", id: "admin-candidatures", label: "Lista candidature", path: "/admin/candidatures" },
];

function isPathActive(pathname: string, targetPath: string): boolean {
  if (targetPath === "/dashboard") {
    return pathname === "/dashboard";
  }
  if (targetPath === "/owner") {
    return pathname === "/owner";
  }
  if (targetPath === "/admin/interlocking") {
    return pathname === "/admin" || pathname === "/admin/interlocking" || pathname.startsWith("/admin/interlocking/");
  }
  if (targetPath.startsWith("/companies/")) {
    return pathname === targetPath || pathname.startsWith(`${targetPath}/`);
  }
  return pathname === targetPath;
}

export function buildAdminPageNavigation(pathname: string): NavLeafItem[] {
  return ADMIN_PAGE_DEFINITIONS.map((page) => ({
    id: page.id,
    label: page.label,
    path: page.path,
    isActive: isPathActive(pathname, page.path),
  }));
}

export function resolveActiveAdminPage(pathname: string): NavLeafItem | null {
  const pages = buildAdminPageNavigation(pathname);
  return pages.find((page) => page.isActive) ?? null;
}

function isOperationalAdminAccess(role: unknown): boolean {
  return typeof role === "string" && ADMIN_ACCESS_ROLES.has(role);
}

export function buildPrimaryNavigationModel(input: BuildModelInput): NavSection[] {
  const dashboardItems: NavLeafItem[] = input.hasActivePerimeter
    ? [{
      id: "dashboard-main",
      label: "Dashboard",
      path: "/dashboard",
      isActive: isPathActive(input.pathname, "/dashboard"),
    }]
    : [];

  const ownerItems: NavLeafItem[] = input.isOwner
    ? input.ownerCompanies
      .filter((company) => company.id)
      .map((company) => {
        const path = `/companies/${company.id}/perimeters`;
        return {
          id: `owner-company-${company.id}`,
          label: company.name || "Company",
          path,
          isActive: isPathActive(input.pathname, path),
        };
      })
    : [];

  if (input.isOwner) {
    ownerItems.unshift({
      id: "owner-home",
      label: "Owner area",
      path: "/owner",
      isActive: isPathActive(input.pathname, "/owner"),
    });
  }

  const hasSuperAdminArea = input.isSuperAdmin && input.accessCompanies.length > 0;
  const superAdminItems: NavLeafItem[] = hasSuperAdminArea
    ? input.accessCompanies.flatMap((company) => {
      const companyId = String(company?.company_id ?? "");
      if (!companyId) return [];
      const companyName = String(company?.company_name ?? "Company");
      const companyPath = `/companies/${companyId}/perimeters`;
      const perimeters = input.superAdminPerimetersByCompany[companyId] ?? [];

      const companyEntry: NavLeafItem = {
        id: `super-admin-company-${companyId}`,
        label: companyName,
        path: companyPath,
        isActive: input.currentCompanyId === companyId
          && (input.currentPerimeterId === null || isPathActive(input.pathname, companyPath)),
      };

      const perimeterEntries: NavLeafItem[] = perimeters.reduce<NavLeafItem[]>((acc, perimeter) => {
          const perimeterId = String(perimeter?.id ?? perimeter?.perimeter_id ?? "");
          if (!perimeterId) return acc;
          const perimeterName = String(perimeter?.name ?? perimeter?.perimeter_name ?? "Perimeter");
          const canManage =
            input.isSuperAdmin ||
            perimeter?.access_role === "admin" ||
            perimeter?.access_role === "admin_user";
          const path = canManage ? "/admin/interlocking" : "/dashboard";
          const isCurrentPerimeter =
            input.currentCompanyId === companyId
            && input.currentPerimeterId === perimeterId
            && isPathActive(input.pathname, path);
          acc.push({
            id: `super-admin-perimeter-${companyId}-${perimeterId}`,
            label: `${companyName} / ${perimeterName}`,
            path,
            isActive: isCurrentPerimeter,
          });
          return acc;
        }, []);

      return [companyEntry, ...perimeterEntries];
    })
    : [];

  const adminItems: NavLeafItem[] = input.isAdmin ? buildAdminPageNavigation(input.pathname) : [];

  const sections: NavSection[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      items: dashboardItems,
      isVisible: dashboardItems.length > 0,
      isActive: dashboardItems.some((item) => item.isActive),
    },
    {
      id: "owner",
      label: "Owner",
      items: ownerItems,
      isVisible: ownerItems.length > 0,
      isActive: ownerItems.some((item) => item.isActive),
    },
    {
      id: "super_admin",
      label: "Super Admin",
      items: superAdminItems,
      isVisible: superAdminItems.length > 0,
      isActive: superAdminItems.some((item) => item.isActive),
    },
    {
      id: "admin",
      label: "Area Admin",
      items: adminItems,
      isVisible: adminItems.length > 0,
      isActive: adminItems.some((item) => item.isActive),
    },
  ];

  return sections.filter((section) => section.isVisible);
}

export function buildTopBarHierarchy(
  input: BuildModelInput & { accessPerimeters: AccessiblePerimeterMembership[] }
): TopBarSectionTree[] {
  const superAdminNodes: TopBarTreeNode[] = input.isSuperAdmin
    ? input.accessCompanies.flatMap((company) => {
      const companyId = String(company?.company_id ?? "");
      if (!companyId) return [];
      const companyName = String(company?.company_name ?? "Company");
      const companyPath = `/companies/${companyId}/perimeters`;
      const companyNavigationItem: NavLeafItem = {
        id: `super-admin-company-${companyId}`,
        label: companyName,
        path: companyPath,
        isActive: input.currentCompanyId === companyId
          && (input.currentPerimeterId === null || isPathActive(input.pathname, companyPath)),
      };

      const perimeterChildren: NavLeafItem[] = (input.superAdminPerimetersByCompany[companyId] ?? [])
        .reduce<NavLeafItem[]>((acc, perimeter) => {
          const perimeterId = String(perimeter?.id ?? perimeter?.perimeter_id ?? "");
          if (!perimeterId) return acc;
          const perimeterName = String(perimeter?.name ?? perimeter?.perimeter_name ?? "Perimeter");
          acc.push({
            id: `super-admin-perimeter-${companyId}-${perimeterId}`,
            label: perimeterName,
            path: "/admin/interlocking",
            isActive:
              input.currentCompanyId === companyId
              && input.currentPerimeterId === perimeterId
              && input.pathname.startsWith("/admin"),
          });
          return acc;
        }, []);

      return [{
        id: `super-admin-node-${companyId}`,
        label: companyName,
        isActive: companyNavigationItem.isActive || perimeterChildren.some((child) => child.isActive),
        navigationItem: companyNavigationItem,
        children: perimeterChildren,
      }];
    })
    : [];

  const perimeterNodesMap = new Map<string, TopBarTreeNode>();
  if (input.isAdmin) {
    for (const perimeter of input.accessPerimeters) {
      const companyId = String(perimeter?.company_id ?? "");
      const perimeterId = String(perimeter?.perimeter_id ?? "");
      if (!companyId || !perimeterId) continue;
      const companyName = String(perimeter?.company_name ?? "Company");
      const perimeterName = String(perimeter?.perimeter_name ?? "Perimeter");
      const hasOperationalAccess = input.isSuperAdmin || isOperationalAdminAccess(perimeter?.access_role);

      const adminChildren: NavLeafItem[] = hasOperationalAccess
        ? ADMIN_PAGE_DEFINITIONS.map((page) => ({
          id: `area-admin-${page.key}-${companyId}-${perimeterId}`,
          label: page.label,
          path: page.path,
          isActive:
            input.currentCompanyId === companyId
            && input.currentPerimeterId === perimeterId
            && isPathActive(input.pathname, page.path),
        }))
        : [{
          id: `area-admin-interlocking-${companyId}-${perimeterId}`,
          label: "Interlocking",
          path: "/admin/interlocking",
          isActive:
            input.currentCompanyId === companyId
            && input.currentPerimeterId === perimeterId
            && input.pathname.startsWith("/admin/interlocking"),
        }];

      const nodeId = `area-admin-node-${companyId}-${perimeterId}`;
      if (perimeterNodesMap.has(nodeId)) continue;
      const parentNavigationItem = adminChildren.find((item) => item.path === "/admin/interlocking");
      perimeterNodesMap.set(nodeId, {
        id: nodeId,
        label: `${companyName} / ${perimeterName}`,
        isActive: adminChildren.some((child) => child.isActive),
        navigationItem: parentNavigationItem,
        children: adminChildren,
      });
    }
  }

  const adminNodes = Array.from(perimeterNodesMap.values()).sort((a, b) => a.label.localeCompare(b.label));
  const trees: TopBarSectionTree[] = [];
  if (superAdminNodes.length > 0) {
    trees.push({ sectionId: "super_admin", nodes: superAdminNodes });
  }
  if (adminNodes.length > 0) {
    trees.push({ sectionId: "admin", nodes: adminNodes });
  }
  return trees;
}
