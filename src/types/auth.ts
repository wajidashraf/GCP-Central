export const USER_ROLES = [
  "requestor",
  "verifier",
  "reviewer",
  "working_gcpc",
  "hoc",
  "endorser",
  "main_committee",
  "admin",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  requestor: "Requestor",
  verifier: "Verifier",
  reviewer: "Reviewer",
  working_gcpc: "Working GCPC",
  hoc: "HOC",
  endorser: "Endorser",
  main_committee: "Main Committee",
  admin: "Admin",
};

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  username: string;
  role: UserRole;
  roles: UserRole[];
  companyId?: string;
  companyCode?: string;
  companyName?: string;
};
