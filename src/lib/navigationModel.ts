import type { TenantContextSelection } from "./appApi";

type PlatformCompany = {
  id: string;
  name: string;
};

type AccessCompany = {
  company_id?: string;
  company_name?: string;
};

type AccessPerimeter = {
  id?: string;
  perimeter_id?: string;
  name?: string;
  perimeter_name?: string;
  access_role?: string;
};

export type NavLeafItem = {
  id: string;
  label: string;
  path: string;
  isActive: boolean;
  tenantContext?: TenantContextSelection;
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

function isPathActive(pathname: string, targetPath: string): boolean {
  if (targetPath === "/dashboard") {
    return pathname === "/dashboard";
  }
  if (targetPath === "/owner") {
    return pathname === "/owner";
  }
  if (targetPath === "/admin/interlocking") {
    return pathname.startsWith("/admin");
  }
  if (targetPath.startsWith("/companies/")) {
    return pathname === targetPath || pathname.startsWith(`${targetPath}/`);
  }
  return pathname === targetPath;
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
          tenantContext: { companyId: company.id, perimeterId: null },
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
        tenantContext: { companyId, perimeterId: null },
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
            tenantContext: { companyId, perimeterId },
          });
          return acc;
        }, []);

      return [companyEntry, ...perimeterEntries];
    })
    : [];

  const adminItems: NavLeafItem[] = input.isAdmin
    ? [
      { id: "admin-candidatures", label: "Candidature", path: "/admin/candidatures", isActive: isPathActive(input.pathname, "/admin/candidatures") },
      { id: "admin-maps", label: "Mappe utenti", path: "/admin/maps", isActive: isPathActive(input.pathname, "/admin/maps") },
      { id: "admin-interlocking", label: "Interlocking", path: "/admin/interlocking", isActive: isPathActive(input.pathname, "/admin/interlocking") },
      { id: "admin-test-users", label: "Configurazione", path: "/admin/test-users", isActive: isPathActive(input.pathname, "/admin/test-users") },
    ]
    : [];

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
