import { auth } from "@/auth";

const PROTECTED_PATH_PREFIXES = ["/dashboard", "/submit", "/requests", "/admin"];

export const proxy = auth((request) => {
  const { pathname, search } = request.nextUrl;
  const isAuthenticated = Boolean(request.auth);

  const isProtectedPath = PROTECTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (!isAuthenticated && isProtectedPath) {
    const loginUrl = new URL("/login", request.nextUrl.origin);
    const callbackUrl = `${pathname}${search}`;
    loginUrl.searchParams.set("callbackUrl", callbackUrl);
    return Response.redirect(loginUrl);
  }

  if (isAuthenticated && pathname === "/login") {
    return Response.redirect(new URL("/dashboard", request.nextUrl.origin));
  }

  return undefined;
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
