import type { TenantContextSelection } from "./appApi";

type CompanyMembership = {
  company_id?: string | null;
  company_name?: string | null;
};

type PerimeterMembership = {
  company_id?: string | null;
  company_name?: string | null;
  perimeter_id?: string | null;
  perimeter_name?: string | null;
  access_role?: string | null;
};

export type AccessPayload = {
  currentCompanyId?: string | null;
  currentPerimeterId?: string | null;
  companies?: CompanyMembership[] | null;
  perimeters?: PerimeterMembership[] | null;
  accessRole?: string | null;
};

export type AccessibleCompany = {
  companyId: string;
  companyName: string;
};

export type AccessiblePerimeter = {
  companyId: string;
  companyName: string;
  perimeterId: string;
  perimeterName: string;
  accessRole: string | null;
};

function normalizeId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getAccessibleCompanies(access: AccessPayload | null | undefined): AccessibleCompany[] {
  const seen = new Set<string>();
  const rows = Array.isArray(access?.companies) ? access.companies : [];
  const output: AccessibleCompany[] = [];

  for (const row of rows) {
    const companyId = normalizeId(row?.company_id);
    if (!companyId || seen.has(companyId)) continue;
    seen.add(companyId);
    output.push({
      companyId,
      companyName: String(row?.company_name ?? "Company").trim() || "Company",
    });
  }

  return output.sort((a, b) => a.companyName.localeCompare(b.companyName));
}

export function getAccessiblePerimetersForCompany(
  access: AccessPayload | null | undefined,
  companyId: string | null | undefined
): AccessiblePerimeter[] {
  const normalizedCompanyId = normalizeId(companyId);
  if (!normalizedCompanyId) return [];

  const seen = new Set<string>();
  const rows = Array.isArray(access?.perimeters) ? access.perimeters : [];
  const output: AccessiblePerimeter[] = [];

  for (const row of rows) {
    const rowCompanyId = normalizeId(row?.company_id);
    const perimeterId = normalizeId(row?.perimeter_id);
    if (!rowCompanyId || !perimeterId) continue;
    if (rowCompanyId !== normalizedCompanyId) continue;
    if (seen.has(perimeterId)) continue;
    seen.add(perimeterId);

    output.push({
      companyId: rowCompanyId,
      companyName: String(row?.company_name ?? "Company").trim() || "Company",
      perimeterId,
      perimeterName: String(row?.perimeter_name ?? "Perimeter").trim() || "Perimeter",
      accessRole: typeof row?.access_role === "string" ? row.access_role : null,
    });
  }

  return output.sort((a, b) => a.perimeterName.localeCompare(b.perimeterName));
}

export function hasMultipleCompanyChoices(access: AccessPayload | null | undefined): boolean {
  return getAccessibleCompanies(access).length > 1;
}

export function hasMultiplePerimeterChoicesInCurrentCompany(
  access: AccessPayload | null | undefined
): boolean {
  const currentCompanyId = normalizeId(access?.currentCompanyId);
  if (!currentCompanyId) return false;
  return getAccessiblePerimetersForCompany(access, currentCompanyId).length > 1;
}

export function resolveContextForCompanyChange(
  access: AccessPayload | null | undefined,
  nextCompanyId: string
): TenantContextSelection | null {
  const companyId = normalizeId(nextCompanyId);
  if (!companyId) return null;

  const companies = getAccessibleCompanies(access);
  if (!companies.some((company) => company.companyId === companyId)) return null;

  const allowedPerimeters = getAccessiblePerimetersForCompany(access, companyId);
  const currentPerimeterId = normalizeId(access?.currentPerimeterId);
  const hasCurrentPerimeterInNextCompany = !!currentPerimeterId
    && allowedPerimeters.some((perimeter) => perimeter.perimeterId === currentPerimeterId);

  return {
    companyId,
    perimeterId: hasCurrentPerimeterInNextCompany
      ? currentPerimeterId
      : (allowedPerimeters[0]?.perimeterId ?? null),
  };
}

export function resolveContextForPerimeterChange(
  access: AccessPayload | null | undefined,
  nextPerimeterId: string
): TenantContextSelection | null {
  const perimeterId = normalizeId(nextPerimeterId);
  const currentCompanyId = normalizeId(access?.currentCompanyId);
  if (!perimeterId || !currentCompanyId) return null;

  const allowedPerimeters = getAccessiblePerimetersForCompany(access, currentCompanyId);
  const selected = allowedPerimeters.find((perimeter) => perimeter.perimeterId === perimeterId);
  if (!selected) return null;

  return {
    companyId: currentCompanyId,
    perimeterId: selected.perimeterId,
  };
}
