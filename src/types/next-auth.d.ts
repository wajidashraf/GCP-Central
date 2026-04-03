import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/src/types/auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      username: string;
      role: UserRole;
      roles: UserRole[];
      companyId?: string;
      companyCode?: string;
      companyName?: string;
    };
  }

  interface User {
    username: string;
    role: UserRole;
    roles: UserRole[];
    companyId?: string | null;
    companyCode?: string | null;
    companyName?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    username?: string;
    role?: UserRole;
    roles?: UserRole[];
    companyId?: string | null;
    companyCode?: string | null;
    companyName?: string | null;
  }
}
