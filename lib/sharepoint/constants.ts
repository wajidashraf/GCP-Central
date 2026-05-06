export const SHAREPOINT_LIST_FILES = {
  companiesSeed: "company-records.json",
  usersSeed: "users-records.json",
} as const;

export const SHAREPOINT_USER_FIELDS = {
  title: "Title",
  uuid: "uuid",
  isActive: "isActive",
  username: "username",
  usernameLower: "usernameLower",
  primaryRole: "primaryRole",
  companyId: "companyId",
  companyCode: "companyCode",
  companyName: "companyName",
  email: "email",
  emailLower: "emailLower",
  passwordHash: "passwordHash",
  roles: "roles",
} as const;

export const SHAREPOINT_COMPANY_FIELDS = {
  title: "Title",
  uuid: "uuid",
  companyName: "companyName",
  companyCode: "companyCode",
  sector: "sector",
} as const;
