'use client';

import { type FormEvent, useState } from 'react';
import { signIn } from 'next-auth/react';
import Button from '@/src/components/ui/button';

export default function LoginForm() {
  const callbackUrl = '/';

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);
    const identifier = String(formData.get('identifier') || '').trim();
    const password = String(formData.get('password') || '');

    if (!identifier || !password) {
      setErrorMessage('Please provide both username/email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await signIn('credentials', {
        identifier,
        password,
        callbackUrl,
        redirect: false,
      });

      if (result?.error) {
        setErrorMessage('Invalid username/email or password.');
        return;
      }

      // Hard redirect so the server-rendered layout re-reads the session cookie
      window.location.href = callbackUrl;
    } catch {
      setErrorMessage('Unable to sign in right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="mt-6 space-y-4" aria-label="Sign in form" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="identifier" className="mb-1.5 block text-sm font-medium text-[var(--text)]">
          Username or email
        </label>
        <input
          id="identifier"
          name="identifier"
          type="text"
          className="input"
          placeholder="username or you@example.com"
          autoComplete="username"
          required
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
          autoComplete="current-password"
          required
        />
      </div>

      {errorMessage ? (
        <div className="alert alert--danger">
          <p className="alert__title">Sign in failed</p>
          <p className="alert__body">{errorMessage}</p>
        </div>
      ) : null}

      <Button className="w-full" type="submit" loading={isSubmitting}>
        {isSubmitting ? 'Signing in...' : 'Sign in'}
      </Button>
    </form>
  );
}
