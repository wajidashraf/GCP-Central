export const SIGNATURE_MAX_BYTES = 2 * 1024 * 1024;

export const SIGNATURE_ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
] as const;

export type SignatureMimeType = (typeof SIGNATURE_ALLOWED_MIME_TYPES)[number];

export const SIGNATURE_ALLOWED_MIME_SET = new Set<string>(SIGNATURE_ALLOWED_MIME_TYPES);
