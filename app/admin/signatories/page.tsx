'use client';

import { useCallback, useEffect, useState } from 'react';
import Button from '@/src/components/ui/button';

type SignatoryGroup = 'prepared' | 'confirmed';

interface Member {
  id: string;
  group: string;
  name: string;
  email: string;
  sortOrder: number;
}

export default function SignatoriesAdminPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<{ group: SignatoryGroup; name: string; email: string }>({
    group: 'prepared',
    name: '',
    email: '',
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/signatory-members');
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed to load signatories');
      setMembers(Array.isArray(data) ? data : []);
      setErrorMessage(null);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const prepared = members.filter((m) => m.group === 'prepared').sort((a, b) => a.sortOrder - b.sortOrder);
  const confirmed = members.filter((m) => m.group === 'confirmed').sort((a, b) => a.sortOrder - b.sortOrder);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/admin/signatory-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed to add member');
      setForm((f) => ({ ...f, name: '', email: '' }));
      await load();
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Failed to add');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm('Remove this signatory from the group?')) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/admin/signatory-members/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed to remove');
      await load();
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Failed to remove');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="page-header">
        <h1 className="page-title">Signatory groups</h1>
        <p className="page-subtitle">
          Manage members for Prepared and Confirmed signature groups. These lists drive the signature grid on
          requests in Pending Review.
        </p>
      </header>

      {errorMessage ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{errorMessage}</div>
      ) : null}

      <section className="surface-card p-5">
        <h2 className="mb-3 text-lg font-semibold text-[var(--text)]">Add member</h2>
        <form onSubmit={(e) => void handleAdd(e)} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-[var(--text-muted)]">Group</span>
            <select
              className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-[var(--text)]"
              value={form.group}
              onChange={(e) => setForm((f) => ({ ...f, group: e.target.value as SignatoryGroup }))}
            >
              <option value="prepared">Prepared</option>
              <option value="confirmed">Confirmed</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-1">
            <span className="font-medium text-[var(--text-muted)]">Name</span>
            <input
              required
              className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-[var(--text)]"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-1">
            <span className="font-medium text-[var(--text-muted)]">Email</span>
            <input
              required
              type="email"
              className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-[var(--text)]"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </label>
          <div className="flex items-end">
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Add member'}
            </Button>
          </div>
        </form>
      </section>

      {isLoading ? (
        <p className="text-sm text-[var(--text-muted)]">Loading…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <MemberList title="Prepared" members={prepared} onRemove={handleRemove} disabled={isSubmitting} />
          <MemberList title="Confirmed" members={confirmed} onRemove={handleRemove} disabled={isSubmitting} />
        </div>
      )}
    </div>
  );
}

function MemberList({
  title,
  members,
  onRemove,
  disabled,
}: {
  title: string;
  members: Member[];
  onRemove: (id: string) => void;
  disabled: boolean;
}) {
  return (
    <section className="surface-card p-5">
      <h2 className="mb-3 text-lg font-semibold text-[var(--text)]">{title}</h2>
      {members.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No members yet.</p>
      ) : (
        <div className="table-shell overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td className="text-[var(--text-muted)]">{m.email}</td>
                  <td className="text-end">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={disabled}
                      onClick={() => onRemove(m.id)}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
