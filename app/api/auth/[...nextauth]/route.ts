/**
 * NextAuth.js API Route Handler
 *
 * STATUS: STUB — Authentication not yet implemented.
 *
 * When ready to implement, replace this file with:
 *
 *   import NextAuth from 'next-auth';
 *   import { authConfig } from '@/src/lib/auth/auth.config';
 *   const handler = NextAuth(authConfig);
 *   export { handler as GET, handler as POST };
 *
 * See src/lib/auth/auth.config.ts for full configuration guide.
 */
export async function GET() {
  return Response.json(
    { message: 'Authentication not yet implemented.' },
    { status: 501 }
  );
}

export async function POST() {
  return Response.json(
    { message: 'Authentication not yet implemented.' },
    { status: 501 }
  );
}
