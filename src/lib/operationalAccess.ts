type AccessPerimeter = {
  company_id?: string | null;
  perimeter_id?: string | null;
  access_role?: string | null;
};

type AccessPayload = {
  currentCompanyId?: string | null;
  currentPerimeterId?: string | null;
  perimeters?: AccessPerimeter[] | null;
};

type MePayload = {
  access?: AccessPayload | null;
};

export function canManageCampaignInCurrentPerimeter(me: MePayload | null | undefined): boolean {
  const access = me?.access;
  if (!access?.currentCompanyId || !access?.currentPerimeterId) return false;

  const directPerimeters = Array.isArray(access.perimeters) ? access.perimeters : [];
  return directPerimeters.some((perimeter) => {
    if ((perimeter?.company_id ?? "") !== access.currentCompanyId) return false;
    if ((perimeter?.perimeter_id ?? "") !== access.currentPerimeterId) return false;
    const role = String(perimeter?.access_role ?? "").toLowerCase();
    return role === "admin" || role === "admin_user";
  });
}
