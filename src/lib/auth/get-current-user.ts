import { auth } from "@/auth";
import type { CurrentUser } from "@/src/types/auth";

// Default user for no-auth mode - has all roles
const DEFAULT_USER: CurrentUser = {
  id: "default-user-no-auth",
  name: "Guest User",
  email: "guest@gcpcentral.local",
  username: "guest",
  role: "requestor",
  roles: ["requestor", "reviewer", "verifier", "admin"],
  companyId: undefined,
  companyCode: null,
  companyName: null,
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  // Return default user without requiring session (auth disabled)
  return DEFAULT_USER;

  // Original session-based auth (commented out for no-auth mode)
  /*
  const session = await auth();
  const sessionUser = session?.user;

  if (!sessionUser?.id || !sessionUser.name || !sessionUser.email) {
    return null;
  }

  return {
    id: sessionUser.id,
    name: sessionUser.name,
    email: sessionUser.email,
    username: sessionUser.username,
    role: sessionUser.role,
    roles: sessionUser.roles,
    companyId: sessionUser.companyId,
    companyCode: sessionUser.companyCode,
    companyName: sessionUser.companyName,
  };
  */
}
