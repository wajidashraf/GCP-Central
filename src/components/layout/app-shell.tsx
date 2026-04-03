import type { ReactNode } from 'react';
import type { CurrentUser } from '@/src/types/auth';
import AppHeader from './header';
import AppFooter from './footer';

type AppShellProps = {
  children: ReactNode;
  user: CurrentUser | null;
};

export default function AppShell({ children, user }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
      <AppFooter />
    </div>
  );
}
