export type HighestRole = "owner" | "super_admin" | "admin" | "user" | "guest" | string | null | undefined;
export type AccessRole = "admin" | "admin_user" | "user" | string | null | undefined;

export function labelAccessRole(role: AccessRole): string {
  if (role === "admin") return "Admin";
  if (role === "admin_user") return "Admin + User";
  if (role === "user") return "User";
  return "Non assegnato";
}

export function labelHighestRole(role: HighestRole): string {
  if (role === "owner") return "Owner";
  if (role === "super_admin") return "Super Admin";
  if (role === "admin") return "Admin";
  if (role === "user") return "User";
  return "Guest";
}

export function labelAdminContext(input: {
  isOwner?: boolean;
  isSuperAdmin?: boolean;
  isAdmin?: boolean;
}): string {
  if (input.isOwner) return "Owner piattaforma";
  if (input.isSuperAdmin) return "Super Admin company";
  if (input.isAdmin) return "Admin perimeter";
  return "Utente perimeter";
}
