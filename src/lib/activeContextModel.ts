import type { MeAccessContext, TenantContextSelection } from "./appApi";

export type ActiveProfile = "user" | "admin" | "super_admin" | "owner";

export type ProfileCompanyOption = {
  companyId: string;
  companyName: string;
};

export type ProfilePerimeterOption = {
  companyId: string;
  companyName: string;
  perimeterId: string;
  perimeterName: string;
  accessRole: string | null;
};

export type ActiveContextSource = {
  availableProfiles: ActiveProfile[];
  availableCompaniesByProfile: Record<ActiveProfile, ProfileCompanyOption[]>;
  availablePerimetersByProfileAndCompany: Record<ActiveProfile, Record<string, ProfilePerimeterOption[]>>;
};

export type ActiveContextSelection = {
  profile: ActiveProfile;
  companyId: string | null;
  perimeterId: string | null;
};

type MeLike = {
  isOwner?: boolean;
  access?: MeAccessContext | null;
};

type PerimeterMembership = {
  company_id?: string | null;
  company_name?: string | null;
  perimeter_id?: string | null;
  perimeter_name?: string | null;
  access_role?: string | null;
};

const PROFILE_PRIORITY: ActiveProfile[] = ["user", "admin", "super_admin", "owner"];
const USER_ACCESS_ROLES = new Set(["user", "admin_user"]);
const ADMIN_ACCESS_ROLES = new Set(["admin", "admin_user"]);

export const ACTIVE_PROFILE_STORAGE_KEY = "jip_active_profile_v1";

export const PROFILE_LABELS: Record<ActiveProfile, string> = {
  user: "User",
  admin: "Admin",
  super_admin: "Super Admin",
  owner: "Owner",
};

function normalizeId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeName(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function dedupePerimeters(rows: unknown[]): ProfilePerimeterOption[] {
  const seen = new Set<string>();
  const output: ProfilePerimeterOption[] = [];

  for (const row of rows as PerimeterMembership[]) {
    const companyId = normalizeId(row?.company_id);
    const perimeterId = normalizeId(row?.perimeter_id);
    if (!companyId || !perimeterId) continue;
    const dedupeKey = `${companyId}::${perimeterId}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    output.push({
      companyId,
      companyName: normalizeName(row?.company_name, "Company"),
      perimeterId,
      perimeterName: normalizeName(row?.perimeter_name, "Perimetro"),
      accessRole: typeof row?.access_role === "string" ? row.access_role : null,
    });
  }

  return output.sort((a, b) => {
    const companyCmp = a.companyName.localeCompare(b.companyName);
    if (companyCmp !== 0) return companyCmp;
    return a.perimeterName.localeCompare(b.perimeterName);
  });
}

function dedupeCompanies(rows: unknown[]): ProfileCompanyOption[] {
  const seen = new Set<string>();
  const output: ProfileCompanyOption[] = [];

  for (const row of rows as { company_id?: string | null; company_name?: string | null }[]) {
    const companyId = normalizeId(row?.company_id);
    if (!companyId || seen.has(companyId)) continue;
    seen.add(companyId);
    output.push({
      companyId,
      companyName: normalizeName(row?.company_name, "Company"),
    });
  }

  return output.sort((a, b) => a.companyName.localeCompare(b.companyName));
}

function companiesFromPerimeters(perimeters: ProfilePerimeterOption[]): ProfileCompanyOption[] {
  const seen = new Set<string>();
  const output: ProfileCompanyOption[] = [];

  for (const perimeter of perimeters) {
    if (seen.has(perimeter.companyId)) continue;
    seen.add(perimeter.companyId);
    output.push({
      companyId: perimeter.companyId,
      companyName: perimeter.companyName,
    });
  }

  return output.sort((a, b) => a.companyName.localeCompare(b.companyName));
}

function mapPerimetersByCompany(perimeters: ProfilePerimeterOption[]): Record<string, ProfilePerimeterOption[]> {
  const output: Record<string, ProfilePerimeterOption[]> = {};
  for (const perimeter of perimeters) {
    if (!output[perimeter.companyId]) {
      output[perimeter.companyId] = [];
    }
    output[perimeter.companyId].push(perimeter);
  }
  for (const companyId of Object.keys(output)) {
    output[companyId].sort((a, b) => a.perimeterName.localeCompare(b.perimeterName));
  }
  return output;
}

export function buildActiveContextSource(me: MeLike | null | undefined): ActiveContextSource {
  const access = me?.access ?? null;
  const allPerimeters = dedupePerimeters(Array.isArray(access?.perimeters) ? access.perimeters : []);
  const userPerimeters = allPerimeters.filter((perimeter) => USER_ACCESS_ROLES.has(String(perimeter.accessRole ?? "").toLowerCase()));
  const adminPerimeters = allPerimeters.filter((perimeter) => ADMIN_ACCESS_ROLES.has(String(perimeter.accessRole ?? "").toLowerCase()));
  const superAdminCompanies = dedupeCompanies(Array.isArray(access?.companies) ? access.companies : []);

  const availableCompaniesByProfile: Record<ActiveProfile, ProfileCompanyOption[]> = {
    owner: [],
    super_admin: superAdminCompanies,
    admin: companiesFromPerimeters(adminPerimeters),
    user: companiesFromPerimeters(userPerimeters),
  };

  const availablePerimetersByProfileAndCompany: Record<ActiveProfile, Record<string, ProfilePerimeterOption[]>> = {
    owner: {},
    super_admin: {},
    admin: mapPerimetersByCompany(adminPerimeters),
    user: mapPerimetersByCompany(userPerimeters),
  };

  const availableProfiles: ActiveProfile[] = PROFILE_PRIORITY.filter((profile) => {
    if (profile === "owner") return me?.isOwner === true;
    if (profile === "super_admin") return availableCompaniesByProfile.super_admin.length > 0;
    if (profile === "admin") return adminPerimeters.length > 0;
    return userPerimeters.length > 0;
  });

  return {
    availableProfiles,
    availableCompaniesByProfile,
    availablePerimetersByProfileAndCompany,
  };
}

export function getDefaultProfile(source: ActiveContextSource): ActiveProfile | null {
  for (const profile of PROFILE_PRIORITY) {
    if (source.availableProfiles.includes(profile)) return profile;
  }
  return null;
}

function pickCompany(
  companies: ProfileCompanyOption[],
  preferredCompanyId: string | null | undefined
): string | null {
  const normalizedPreferred = normalizeId(preferredCompanyId);
  if (normalizedPreferred && companies.some((company) => company.companyId === normalizedPreferred)) {
    return normalizedPreferred;
  }
  return companies[0]?.companyId ?? null;
}

function pickPerimeter(
  perimeters: ProfilePerimeterOption[],
  preferredPerimeterId: string | null | undefined
): string | null {
  const normalizedPreferred = normalizeId(preferredPerimeterId);
  if (normalizedPreferred && perimeters.some((perimeter) => perimeter.perimeterId === normalizedPreferred)) {
    return normalizedPreferred;
  }
  return perimeters[0]?.perimeterId ?? null;
}

export function resolveSelectionForProfile(
  source: ActiveContextSource,
  input: {
    profile: ActiveProfile;
    preferredCompanyId?: string | null;
    preferredPerimeterId?: string | null;
  }
): ActiveContextSelection | null {
  if (!source.availableProfiles.includes(input.profile)) return null;

  if (input.profile === "owner") {
    return { profile: "owner", companyId: null, perimeterId: null };
  }

  if (input.profile === "super_admin") {
    const companyId = pickCompany(
      source.availableCompaniesByProfile.super_admin,
      input.preferredCompanyId
    );
    if (!companyId) return null;
    return { profile: "super_admin", companyId, perimeterId: null };
  }

  const companies = source.availableCompaniesByProfile[input.profile];
  const companyId = pickCompany(companies, input.preferredCompanyId);
  if (!companyId) return null;
  const perimeters = source.availablePerimetersByProfileAndCompany[input.profile][companyId] ?? [];
  const perimeterId = pickPerimeter(perimeters, input.preferredPerimeterId);
  if (!perimeterId) return null;
  return { profile: input.profile, companyId, perimeterId };
}

export function resolveDefaultSelection(
  source: ActiveContextSource
): ActiveContextSelection | null {
  const profile = getDefaultProfile(source);
  if (!profile) return null;
  return resolveSelectionForProfile(source, { profile });
}

export function readStoredActiveProfile(): ActiveProfile | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY);
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "user" || normalized === "admin" || normalized === "super_admin" || normalized === "owner") {
    return normalized;
  }
  return null;
}

export function writeStoredActiveProfile(profile: ActiveProfile) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, profile);
}

export function deriveProfileFromPath(
  pathname: string,
  source: ActiveContextSource
): ActiveProfile | null {
  if (pathname.startsWith("/owner") && source.availableProfiles.includes("owner")) return "owner";
  if (pathname.startsWith("/companies/") && source.availableProfiles.includes("super_admin")) return "super_admin";
  if (pathname.startsWith("/admin") && source.availableProfiles.includes("admin")) return "admin";
  if (source.availableProfiles.includes("user")) return "user";
  return null;
}

export function getContextDestinationPath(
  selection: ActiveContextSelection,
  currentPathname: string
): string {
  if (selection.profile === "owner") return "/owner";
  if (selection.profile === "super_admin") {
    if (!selection.companyId) return "/owner";
    return `/companies/${selection.companyId}/perimeters`;
  }
  if (selection.profile === "admin") {
    if (currentPathname.startsWith("/admin/")) return currentPathname;
    return "/admin/interlocking";
  }
  return "/dashboard";
}

export function toTenantContext(selection: ActiveContextSelection): TenantContextSelection {
  return {
    companyId: selection.companyId,
    perimeterId: selection.perimeterId,
  };
}

export function isSameSelection(
  a: ActiveContextSelection | null | undefined,
  b: ActiveContextSelection | null | undefined
): boolean {
  if (!a || !b) return false;
  return a.profile === b.profile && a.companyId === b.companyId && a.perimeterId === b.perimeterId;
}
