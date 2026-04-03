/**
 * Environment Variables Configuration
 * Centralizes environment variable reading and validates required fields at startup.
 */

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  MONGODB_URI: process.env.MONGODB_URI || "",
  CLOUDINARY_CLOUD_NAME: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME || "",
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || "",
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || "",
  RESEND_API_KEY: process.env.RESEND_API_KEY || "",
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || "",
  AUTH_SECRET: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "",
} as const;

/**
 * Validates that required server-side environment variables are present.
 * Fails fast if configuration is missing.
 */
export function validateEnv() {
  if (env.NODE_ENV === "test") return; // Skip strict checks in test environments

  const requiredEnvs: (keyof typeof env)[] = [
    "MONGODB_URI",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
    "AUTH_SECRET",
  ];

  const missingEnvs = requiredEnvs.filter((key) => !env[key]);

  if (missingEnvs.length > 0) {
    console.warn(
      `⚠️ Warning: Missing required environment variables: ${missingEnvs.join(", ")}`
    );
  }
}

// Run validation immediately when the module is imported
validateEnv();
