import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

import AppShell from '@/src/components/layout/app-shell';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'GCP Central',
  description: 'Group contract procurement management platform',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-screen  text-[var(--text)]">
        <AppShell user={user}>{children}</AppShell>
      </body>
    </html>
  );
}
