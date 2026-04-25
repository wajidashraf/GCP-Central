import { NextResponse } from "next/server";
import { auth } from "@/auth";

const PUBLIC_PATHS = new Set(["/", "/login"]);

function normalizeCallbackPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

export default auth((request) => {
  const { pathname, search } = request.nextUrl;
  const isAuthenticated = Boolean(request.auth);
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
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
