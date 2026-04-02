/**
 * NextAuth.js Configuration
 *
 * STATUS: STUB — Authentication not yet implemented.
 *
 * When ready to implement:
 * 1. Install:  npm install next-auth@beta @auth/prisma-adapter
 * 2. Add to .env.local:
 *      NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
 *      NEXTAUTH_URL=http://localhost:3000
 *      AZURE_AD_CLIENT_ID=...        (if using Azure/Office 365)
 *      AZURE_AD_CLIENT_SECRET=...
 *      AZURE_AD_TENANT_ID=...
 * 3. Uncomment the block below and configure providers.
 */

// import NextAuth, { type NextAuthConfig } from 'next-auth';
// import AzureAD from 'next-auth/providers/azure-ad';
// import CredentialsProvider from 'next-auth/providers/credentials';
// import { PrismaAdapter } from '@auth/prisma-adapter';
// import prisma from '@/lib/prisma';
// import type { UserRole } from '@/src/types/auth';
//
// export const authConfig: NextAuthConfig = {
//   adapter: PrismaAdapter(prisma),
//
//   providers: [
//     // Option A — Azure Active Directory / Office 365 (recommended for enterprise)
//     AzureAD({
//       clientId:     process.env.AZURE_AD_CLIENT_ID!,
//       clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
//       tenantId:     process.env.AZURE_AD_TENANT_ID!,
//     }),
//
//     // Option B — Email/Password credentials (development only)
//     // CredentialsProvider({
//     //   name: 'credentials',
//     //   credentials: { email: {}, password: {} },
//     //   async authorize(credentials) {
//     //     // TODO: validate against User model in MongoDB
//     //     return null;
//     //   },
//     // }),
//   ],
//
//   callbacks: {
//     async session({ session, token }) {
//       // Attach role to session so it's available in getCurrentUser()
//       if (token?.role) {
//         session.user.role = token.role as UserRole;
//       }
//       return session;
//     },
//     async jwt({ token, user }) {
//       if (user) {
//         // Fetch role from DB when user first signs in
//         const dbUser = await prisma.user.findUnique({
//           where: { email: user.email! },
//           select: { role: true },
//         });
//         token.role = dbUser?.role ?? 'requestor';
//       }
//       return token;
//     },
//   },
//
//   pages: {
//     signIn: '/login',
//     error:  '/login',
//   },
// };
//
// export const { auth, signIn, signOut } = NextAuth(authConfig);

// ─── Placeholder export until auth is implemented ────────────────
export const authConfig = {} as const;
