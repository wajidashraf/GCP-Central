import NextAuth from "next-auth";
import { authConfig } from "@/src/lib/auth/auth.config";

const netlifySiteUrl = process.env.URL ?? process.env.DEPLOY_PRIME_URL;

if (!process.env.AUTH_URL && !process.env.NEXTAUTH_URL && netlifySiteUrl) {
  process.env.AUTH_URL = netlifySiteUrl;
}

if (!process.env.AUTH_TRUST_HOST) {
  process.env.AUTH_TRUST_HOST = "true";
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
