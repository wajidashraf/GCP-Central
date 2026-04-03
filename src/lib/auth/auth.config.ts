import { compare } from "bcryptjs";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import { USER_ROLES, type UserRole } from "@/src/types/auth";

const FALLBACK_ROLE: UserRole = "requestor";

function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}

function normalizeRole(value: string | null | undefined): UserRole {
  if (!value) {
    return FALLBACK_ROLE;
  }

  return isUserRole(value) ? value : FALLBACK_ROLE;
}

function readCredentialValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export const authConfig = {
  session: {
    strategy: "jwt",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        identifier: { label: "Username or Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const identifier = readCredentialValue(credentials?.identifier);
        const password = readCredentialValue(credentials?.password);

        if (!identifier || !password) {
          return null;
        }

        const normalizedIdentifier = identifier.toLowerCase();
        const user = await prisma.user.findFirst({
          where: {
            isActive: true,
            OR: [
              { emailLower: normalizedIdentifier },
              { usernameLower: normalizedIdentifier },
            ],
          },
          include: {
            company: {
              select: {
                id: true,
                companyCode: true,
                companyName: true,
              },
            },
          },
        });

        if (!user) {
          return null;
        }

        const passwordMatches = await compare(password, user.passwordHash);
        if (!passwordMatches) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username,
          role: normalizeRole(user.primaryRole),
          roles: user.roles.map((role) => normalizeRole(role)),
          companyId: user.companyId,
          companyCode: user.company?.companyCode ?? null,
          companyName: user.company?.companyName ?? null,
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.username = user.username;
        token.role = normalizeRole(user.role);
        token.roles = (Array.isArray(user.roles) ? user.roles : []).map((role) =>
          normalizeRole(role)
        );
        token.companyId = user.companyId ?? null;
        token.companyCode = user.companyCode ?? null;
        token.companyName = user.companyName ?? null;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.username = typeof token.username === "string" ? token.username : "";
        session.user.role = normalizeRole(
          typeof token.role === "string" ? token.role : undefined
        );
        session.user.roles = Array.isArray(token.roles)
          ? token.roles.map((role) => normalizeRole(role))
          : [session.user.role];
        session.user.companyId =
          typeof token.companyId === "string" ? token.companyId : undefined;
        session.user.companyCode =
          typeof token.companyCode === "string" ? token.companyCode : undefined;
        session.user.companyName =
          typeof token.companyName === "string" ? token.companyName : undefined;
      }

      return session;
    },
  },
} satisfies NextAuthConfig;
