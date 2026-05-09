import { compare } from 'bcryptjs';
import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { findUserByIdentifier, parseRoles } from '@/lib/sharepoint/lists';
import { USER_ROLES, type UserRole } from '@/src/types/auth';

const FALLBACK_ROLE: UserRole = 'requestor';

function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}

function normalizeRole(value: string | null | undefined): UserRole {
  if (!value) return FALLBACK_ROLE;
  const normalized = value.trim().toLowerCase();
  return isUserRole(normalized) ? normalized : FALLBACK_ROLE;
}

function readCredentialValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

const isProd = process.env.NODE_ENV === 'production';

export const authConfig = {
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  cookies: {
    sessionToken: {
      name: isProd ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: isProd,
      },
    },
  },
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        identifier: { label: 'Username or Email', type: 'text' },
        password:   { label: 'Password',          type: 'password' },
      },
      async authorize(credentials) {
        const identifier = readCredentialValue(credentials?.identifier);
        const password   = readCredentialValue(credentials?.password);

        if (!identifier || !password) return null;

        const normalizedIdentifier = identifier.toLowerCase();

        // ── Look up user in SharePoint Users list ──────────────────────────
        const user = await findUserByIdentifier(normalizedIdentifier);

        if (!user) return null;

        // ── Verify password against stored bcrypt hash ─────────────────────
        if (!user.passwordHash) return null;
        const passwordMatches = await compare(password, user.passwordHash);
        if (!passwordMatches) return null;

        // ── Parse roles JSON field ─────────────────────────────────────────
        const parsedRoles = parseRoles(user.roles).map(normalizeRole);
        const primaryRole = normalizeRole(user.primaryRole);

        return {
          id:          user.id,
          name:        user.Title,
          email:       user.email,
          username:    user.username,
          role:        primaryRole,
          roles:       parsedRoles.length > 0 ? parsedRoles : [primaryRole],
          companyId:   user.companyId   ?? undefined,
          companyCode: user.companyCode ?? undefined,
          companyName: user.companyName ?? undefined,
        };
      },
    }),
  ],

  pages: {
    signIn: '/login',
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.username    = user.username;
        token.role        = normalizeRole(user.role);
        token.roles       = (Array.isArray(user.roles) ? user.roles : []).map(
          (r: unknown) => normalizeRole(typeof r === 'string' ? r : undefined)
        );
        token.companyId   = user.companyId   ?? null;
        token.companyCode = user.companyCode ?? null;
        token.companyName = user.companyName ?? null;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id          = token.sub ?? '';
        session.user.username    = typeof token.username    === 'string' ? token.username    : '';
        session.user.role        = normalizeRole(typeof token.role === 'string' ? token.role : undefined);
        session.user.roles       = Array.isArray(token.roles)
          ? token.roles.map((r: unknown) => normalizeRole(typeof r === 'string' ? r : undefined))
          : [session.user.role];
        session.user.companyId   = typeof token.companyId   === 'string' ? token.companyId   : undefined;
        session.user.companyCode = typeof token.companyCode === 'string' ? token.companyCode : undefined;
        session.user.companyName = typeof token.companyName === 'string' ? token.companyName : undefined;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
