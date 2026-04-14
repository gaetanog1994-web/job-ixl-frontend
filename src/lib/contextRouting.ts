import { labelAccessRole } from "./accessLabels";
import type { AccessRole, HighestRole } from "./accessLabels";
import type { TenantContextSelection } from "./appApi";

type CompanyMembership = {
  company_id: string;
  company_name?: string | null;
};

type PerimeterMembership = {
  perimeter_id: string;
  perimeter_name?: string | null;
  company_id: string;
  company_name?: string | null;
  access_role?: AccessRole;
};

type AccessPayload = {
  currentCompanyId?: string | null;
  currentPerimeterId?: string | null;
  highestRole?: HighestRole;
  companies?: CompanyMembership[];
  perimeters?: PerimeterMembership[];
};

export type MePayload = {
  isOwner?: boolean;
  isSuperAdmin?: boolean;
  isAdmin?: boolean;
  access?: AccessPayload | null;
};

export type AvailableContext = {
  key: string;
  level: "platform" | "company" | "workspace";
  title: string;
  subtitle: string;
  companyId: string | null;
  perimeterId: string | null;
  destination: string;
  accessRoleLabel: string;
  sortWeight: number;
};

function roleWeight(level: AvailableContext["level"]) {
  if (level === "platform") return 0;
  if (level === "company") return 1;
  return 2;
}

function dedupeCompanies(access: AccessPayload | null | undefined): CompanyMembership[] {
  const seen = new Set<string>();
  const list = Array.isArray(access?.companies) ? access.companies : [];
  const output: CompanyMembership[] = [];

  for (const company of list) {
    const id = typeof company?.company_id === "string" ? company.company_id : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    output.push(company);
  }

  return output;
}

function dedupePerimeters(access: AccessPayload | null | undefined): PerimeterMembership[] {
  const seen = new Set<string>();
  const list = Array.isArray(access?.perimeters) ? access.perimeters : [];
  const output: PerimeterMembership[] = [];

  for (const perimeter of list) {
    const id = typeof perimeter?.perimeter_id === "string" ? perimeter.perimeter_id : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    output.push(perimeter);
  }

  return output;
}

export function getAvailableContexts(me: MePayload | null | undefined): AvailableContext[] {
  const access = me?.access ?? null;
  const contexts: AvailableContext[] = [];

  if (me?.isOwner === true) {
    // Owner context always routes to /owner (platform area). No companyId/perimeterId needed.
    contexts.push({
      key: "platform-owner",
      level: "platform",
      title: "Owner / Platform",
      subtitle: "Gestione livello piattaforma",
      companyId: null,
      perimeterId: null,
      destination: "/owner",
      accessRoleLabel: "Owner",
      sortWeight: roleWeight("platform"),
    });
  }

  for (const company of dedupeCompanies(access)) {
    const companyName = company.company_name?.trim() || "Company";
    contexts.push({
      key: `company-${company.company_id}`,
      level: "company",
      title: `Super Admin — ${companyName}`,
      subtitle: "Gestione company / perimeters",
      companyId: company.company_id,
      perimeterId: null,
      destination: `/companies/${company.company_id}/perimeters`,
      accessRoleLabel: "Super Admin",
      sortWeight: roleWeight("company"),
    });
  }

  for (const perimeter of dedupePerimeters(access)) {
    const companyName = perimeter.company_name?.trim() || "Company";
    const perimeterName = perimeter.perimeter_name?.trim() || "Perimeter";
    const roleLabel = labelAccessRole(perimeter.access_role);
    const canManage = perimeter.access_role === "admin" || perimeter.access_role === "admin_user";

    contexts.push({
      key: `workspace-${perimeter.perimeter_id}`,
      level: "workspace",
      title: `${roleLabel} — ${companyName} / ${perimeterName}`,
      subtitle: "Contesto operativo perimeter",
      companyId: perimeter.company_id,
      perimeterId: perimeter.perimeter_id,
      destination: canManage ? "/admin/interlocking" : "/dashboard",
      accessRoleLabel: roleLabel,
      sortWeight: roleWeight("workspace"),
    });
  }

  return contexts.sort((a, b) => {
    if (a.sortWeight !== b.sortWeight) return a.sortWeight - b.sortWeight;
    return a.title.localeCompare(b.title);
  });
}

export function toTenantSelection(context: AvailableContext): TenantContextSelection {
  return {
    companyId: context.companyId,
    perimeterId: context.perimeterId,
  };
}

export function isContextMatch(
  context: AvailableContext,
  selection: TenantContextSelection | null | undefined
) {
  if (!selection) return false;

  const selectedCompanyId = selection.companyId ?? null;
  const selectedPerimeterId = selection.perimeterId ?? null;

  return context.companyId === selectedCompanyId && context.perimeterId === selectedPerimeterId;
}
