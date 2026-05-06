'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { createUserWithRolesAction, type CreateUserResult } from './actions';
import type { UserRole } from '@/src/types/auth';

type CompanyOption = {
  id: string;
  companyName: string;
  companyCode: string;
};

type RoleOption = {
  slug: UserRole;
  label: string;
};

type AddUserFormProps = {
  roleOptions: RoleOption[];
  companies: CompanyOption[];
};

export default function AddUserForm({ roleOptions, companies }: AddUserFormProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<CreateUserResult | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const password = String(new FormData(form).get('password') ?? '');
    const confirm = String(new FormData(form).get('passwordConfirm') ?? '');
    if (password !== confirm) {
      setMessage({ ok: false, message: 'Passwords do not match.' });
      return;
    }
    const fd = new FormData(form);
    fd.delete('passwordConfirm');
    setMessage(null);
    startTransition(async () => {
      const result = await createUserWithRolesAction(fd);
      setMessage(result);
      if (result.ok) {
        form.reset();
      }
    });
  }

  const defaultPrimary = roleOptions[0]?.slug ?? ('requestor' as UserRole);

  return (
    <div className="rounded-lg border border-[var(--border)] bg-primary text-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-white text-left text-sm font-semibold text-[var(--text)]"
        aria-expanded={open}
      >
        Add new user
        <span className={`text-xs transition-transform ${open ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>
      {open ? (
        <div className="space-y-3 border-t border-[var(--border)] p-4 bg-secondary">
          <p className="text-sm text-[var(--text-muted)]">
            Create an account with a password and roles. The user receives an email with their username,
            password, and assigned roles.
          </p>

          {message ? (
            <div
              className={`rounded-md border px-3 py-2 text-sm ${
                message.ok
                  ? 'border-emerald-600/40 bg-emerald-950/20 text-emerald-100'
                  : 'border-red-600/40 bg-red-950/20 text-red-100'
              }`}
              role="status"
            >
              {message.message}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
                Full name
                <input
                  name="name"
                  required
                  autoComplete="name"
                  className="input mt-1 h-9 w-full py-0 text-sm"
                  disabled={pending}
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
                Email
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="input mt-1 h-9 w-full py-0 text-sm"
                  disabled={pending}
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
                Username
                <input
                  name="username"
                  required
                  autoComplete="username"
                  className="input mt-1 h-9 w-full py-0 text-sm"
                  disabled={pending}
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
                Company (optional)
                <select
                  name="companyId"
                  defaultValue=""
                  className="input mt-1 h-9 w-full py-0 text-sm"
                  disabled={pending}
                >
                  <option value="">No company</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName} ({c.companyCode})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
                Password
                <input
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="input mt-1 h-9 w-full py-0 text-sm"
                  disabled={pending}
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
                Confirm password
                <input
                  name="passwordConfirm"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="input mt-1 h-9 w-full py-0 text-sm"
                  disabled={pending}
                />
              </label>
            </div>

            <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
              Primary role
              <select
                name="primaryRole"
                defaultValue={defaultPrimary}
                className="input mt-1 h-9 w-full py-0 text-sm"
                disabled={pending}
              >
                {roleOptions.map((roleOption) => (
                  <option key={roleOption.slug} value={roleOption.slug}>
                    {roleOption.label}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
                Roles
              </p>
              <div className="mt-2 grid w-full gap-3 sm:grid-cols-2">
                {roleOptions.map((roleOption) => (
                  <label
                    key={roleOption.slug}
                    className="input flex w-full cursor-pointer items-center gap-2 text-sm text-[var(--text-muted)]"
                  >
                    <input
                      type="checkbox"
                      name="roles"
                      value={roleOption.slug}
                      className="shrink-0"
                      defaultChecked={roleOption.slug === defaultPrimary}
                      disabled={pending}
                    />
                    <span className="min-w-0 flex-1">{roleOption.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={pending}
                className="btn btn--accent btn--sm"
              >
                {pending ? 'Creating...' : 'Create user'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
