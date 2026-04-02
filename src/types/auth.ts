export type UserRole =
  | 'requestor'
  | 'verifier'
  | 'reviewer'
  | 'committee'
  | 'admin';

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId?: string;
  companyCode?: string;
  companyName?: string;
};