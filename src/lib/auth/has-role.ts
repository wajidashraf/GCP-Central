import type { CurrentUser, UserRole } from "@/src/types/auth";

type RoleAwareUser =
  | CurrentUser
  | {
      role?: string | null;
      roles?: string[] | string | null;
    };

function normalizeRoleValue(role: string | null | undefined) {
  return role?.trim().toLowerCase();
}

function getUserRoles(user: RoleAwareUser) {
  const roles = Array.isArray(user.roles)
    ? user.roles
    : typeof user.roles === "string"
      ? user.roles.split(",")
      : [];

  return [user.role, ...roles].map(normalizeRoleValue).filter(Boolean);
}

export function hasRole(
  user: RoleAwareUser | null | undefined,
  requiredRole: UserRole
) {
  if (!user) {
    return false;
  }

  return getUserRoles(user).includes(requiredRole);
}
