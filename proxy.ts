import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = new Set(["/", "/login"]);
const AUTH_SESSION_COOKIE_NAMES = [
  "__Secure-authjs.session-token",
  "authjs.session-token",
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
];

function normalizeCallbackPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

function hasSessionCookie(request: NextRequest) {
  return AUTH_SESSION_COOKIE_NAMES.some((cookieName) => {
    const token = request.cookies.get(cookieName)?.value;
    return Boolean(token);
  });
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isAuthenticated = hasSessionCookie(request);
  const isPublicPath = PUBLIC_PATHS.has(pathname);

  if (isPublicPath) {
    if (pathname === "/login" && isAuthenticated) {
      const callbackPath = normalizeCallbackPath(
        request.nextUrl.searchParams.get("callbackUrl")
      );
      return NextResponse.redirect(new URL(callbackPath, request.nextUrl));
    }

    return NextResponse.next();
  }

  if (!isAuthenticated) {
    const loginUrl = new URL("/login", request.nextUrl);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
