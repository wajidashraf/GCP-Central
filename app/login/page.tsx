import Link from 'next/link';
import LoginForm from './login-form';

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-[68vh] w-full max-w-md items-center justify-center">
      <div className="surface-card w-full p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--brand-600)]">
          GCP Central
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--text)]">Sign in</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Use your username or email with password to access GCP Central.
        </p>
        <LoginForm />

        <div className="mt-5 text-sm">
          <Link href="/" className="font-medium text-[var(--brand-600)] hover:underline">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
