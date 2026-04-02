import type { UserRole } from '@/src/types/auth';

export type NavItem = {
  label: string;
  href: string;
  roles: UserRole[];
};

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    roles: ['requestor', 'verifier', 'reviewer', 'committee', 'admin'],
  },
  {
    label: 'Submit Request',
    href: '/submit',
    roles: ['requestor'],
  },
  {
    label: 'Review Requests',
    href: '/requests',
    roles: ['verifier', 'reviewer', 'admin'],
  },
  {
    label: 'Admin',
    href: '/admin',
    roles: ['admin'],
  },
];
