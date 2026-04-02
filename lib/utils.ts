export function validateEmail(email: string): boolean {
  const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
  return emailRegex.test(email);
}

import { env } from "@/lib/env";

export function isProductionEnvironment(): boolean {
  return env.NODE_ENV === "production";
}

export function generateRandomString(length: number = 10): string {
  return Math.random().toString(36).substring(2, 2 + length);
}
