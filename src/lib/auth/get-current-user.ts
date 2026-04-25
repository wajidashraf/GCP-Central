import { auth } from "@/auth";
import type { CurrentUser } from "@/src/types/auth";

export async function getCurrentUser(): Promise<CurrentUser | null> {
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
}
