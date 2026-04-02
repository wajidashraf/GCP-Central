'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from '@/src/config/navigation';
import type { CurrentUser } from '@/src/types/auth';

type AppHeaderProps = {
  user: CurrentUser;
};

function getUserInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function AppHeader({ user }: AppHeaderProps) {
  const pathname = usePathname();
  const visibleNavItems = NAV_ITEMS.filter((item) => item.roles.includes(user.role));
  const initials = getUserInitials(user.name);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--brand-600)] text-sm font-bold text-white shadow-sm">
            GC
          </span>
          <span className="hidden leading-tight sm:block">
            <strong className="block text-sm text-[var(--text)]">GCP Central</strong>
            <span className="block text-xs text-[var(--text-subtle)]">Procurement Portal</span>
          </span>
        </Link>

        <nav className="hidden flex-1 items-center gap-1 overflow-x-auto md:flex">
          {visibleNavItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(`${item.href}/`));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-[var(--brand-100)] text-[var(--brand-700)]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-sm font-medium text-[var(--text)]">{user.name}</p>
            <p className="text-xs capitalize text-[var(--text-subtle)]">{user.role}</p>
          </div>
          <span className="avatar-chip" title={`${user.name} (${user.role})`}>
            {initials}
          </span>
        </div>
      </div>

      {visibleNavItems.length > 0 ? (
        <div className="border-t border-[var(--border)] px-4 py-2 md:hidden">
          <div className="flex flex-wrap gap-2">
            {visibleNavItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(`${item.href}/`));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${
                    isActive
                      ? 'bg-[var(--brand-100)] text-[var(--brand-700)]'
                      : 'bg-[var(--surface-muted)] text-[var(--text-muted)]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </header>
  );
}
