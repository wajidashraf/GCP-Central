import { auth } from "@/auth";
import type { Session } from "next-auth";
import type { CurrentUser } from "@/src/types/auth";

export async function getCurrentUser(): Promise<CurrentUser | null> {
  // Auth.js can throw `JWTSessionError` when the request carries a session
  // cookie that was encrypted with a different secret than the one currently
  // configured (e.g. after rotating NEXTAUTH_SECRET, or when a cookie issued
  // by another deployment lingers in the browser). Treat that as
  // "not signed in" — the user simply needs a fresh login flow — instead of
  // surfacing a noisy stack trace on every server-rendered page.
  let session: Session | null = null;
  try {
    session = await auth();
  } catch {
    return null;
  }

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
