import NextAuth from "next-auth";
import { authConfig } from "@/src/lib/auth/auth.config";

// Auto-detect hosting platform URL
const netlifySiteUrl = process.env.URL ?? process.env.DEPLOY_PRIME_URL;
const vercelSiteUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : undefined;

if (!process.env.AUTH_URL && !process.env.NEXTAUTH_URL) {
  const resolvedUrl = netlifySiteUrl ?? vercelSiteUrl;
  if (resolvedUrl) {
    process.env.AUTH_URL = resolvedUrl;
  }
}

// Strip trailing slash from NEXTAUTH_URL / AUTH_URL to prevent
// malformed callback URLs (e.g. https://gcp-central.vercel.app/ → /login becomes //login)
if (process.env.NEXTAUTH_URL) {
  process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL.replace(/\/$/, "");
}
if (process.env.AUTH_URL) {
  process.env.AUTH_URL = process.env.AUTH_URL.replace(/\/$/, "");
}

if (!process.env.AUTH_TRUST_HOST) {
  process.env.AUTH_TRUST_HOST = "true";
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
