import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Routes that require authentication
const PROTECTED_PATTERNS = [
  /^\/admin(\/.*)?$/,               // /admin and all sub-paths
  /^\/submit\/[^/]+\/[^/]+/,        // /submit/channel/code (not /submit itself)
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_PATTERNS.some((pattern) => pattern.test(pathname));
  if (!isProtected) return NextResponse.next();

  // Use same secureCookie logic as NextAuth to ensure consistent cookie name lookup.
  // NODE_ENV=development → next-auth.session-token
  // NODE_ENV=production  → __Secure-next-auth.session-token
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
    secureCookie: process.env.NODE_ENV === 'production',
  });

  if (!token) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run on all paths except Next.js internals and static assets
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
