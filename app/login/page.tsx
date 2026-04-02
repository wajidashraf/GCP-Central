import Link from 'next/link';
import Button from '@/src/components/ui/button';

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-[68vh] w-full max-w-md items-center justify-center">
      <div className="surface-card w-full p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--brand-600)]">
          GCP Central
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--text)]">Sign in</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Authentication wiring is pending, but this screen reflects the updated light-mode design.
        </p>

        <div className="alert alert--info mt-5">
          <p className="alert__title">Authentication pending</p>
          <p className="alert__body">
            NextAuth integration is still a stub. Once enabled, this form will be connected to live
            sign-in.
          </p>
        </div>

        <form className="mt-6 space-y-4" aria-label="Sign in form (placeholder)">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-[var(--text)]">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="input"
              placeholder="you@example.com"
              disabled
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-[var(--text)]">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              className="input"
              placeholder="••••••••"
              disabled
            />
          </div>

          <Button className="w-full" disabled>
            Sign in (coming soon)
          </Button>
        </form>

        <div className="mt-5 text-sm">
          <Link href="/" className="font-medium text-[var(--brand-600)] hover:underline">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
