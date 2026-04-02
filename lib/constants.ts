export const APP_NAME = "GCP Central";
export const APP_DESCRIPTION = "Secure file and image management platform";

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: "/api/auth/callback/credentials",
    REGISTER: "/api/auth/register",
    LOGOUT: "/api/auth/signout",
  },
  UPLOAD: "/api/upload",
  USER: "/api/protected/user",
  FILES: "/api/protected/files",
} as const;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
} as const;
