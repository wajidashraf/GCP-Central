import type { CurrentUser } from '@/src/types/auth';

export async function getCurrentUser(): Promise<CurrentUser> {
  return {
    id: '1',
    name: 'Wajid Ashraf',
    email: 'wajid@example.com',
    role: 'admin',
    companyCode: 'US02',
  };
}