import type { CurrentUser, UserRole } from "@/src/types/auth";

type RoleAwareUser =
  | CurrentUser
  | {
      role?: string | null;
      roles?: string[] | null;
    };

export function hasRole(
  user: RoleAwareUser | null | undefined,
  requiredRole: UserRole
) {
  if (!user) {
    return false;
  }

  if (user.role === requiredRole) {
    return true;
  }

  if (Array.isArray(user.roles)) {
    return user.roles.includes(requiredRole);
  }

  return false;
}
