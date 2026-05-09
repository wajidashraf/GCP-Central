import Link from 'next/link';
import { listCompanies, listRoles, listUsers, parseRoles } from '@/lib/sharepoint/lists';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';
import { USER_ROLES, USER_ROLE_LABELS, type UserRole } from '@/src/types/auth';
import AddUserForm from './add-user-form';
import PendingSubmitButton from './pending-submit-button';
import {
  toggleUserActiveStatusAction,
  updateUserRoleAssignmentsAction,
} from './actions';
import Button from '@/src/components/ui/button';

const FALLBACK_ROLE: UserRole = 'requestor';

function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}

function normalizeRole(value: string | null | undefined): UserRole {
  if (!value) {
    return FALLBACK_ROLE;
  }

  return isUserRole(value) ? value : FALLBACK_ROLE;
}

function normalizeRoles(primaryRole: UserRole, roles: string[]) {
  const normalized = roles.filter(isUserRole);
  const unique = [...new Set(normalized)];

  if (!unique.includes(primaryRole)) {
    unique.unshift(primaryRole);
  }

  return USER_ROLES.filter((role) => unique.includes(role));
}

const ROLE_BADGE_CLASSNAME: Record<UserRole, string> = {
  requestor: 'badge badge--neutral',
  verifier: 'badge badge--info',
  reviewer: 'badge badge--warning',
  working_gcpc: 'badge badge--info',
  hoc: 'badge badge--neutral',
  endorser: 'badge badge--success',
  main_committee: 'badge badge--success',
  admin: 'badge badge--danger',
};

type AdminRolesPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

export default async function AdminRolesPage({ searchParams }: AdminRolesPageProps) {
  const currentUser = await getCurrentUser();
  const { q } = await searchParams;
  const query = (q ?? '').trim().toLowerCase();

  if (!currentUser || !currentUser.roles.includes('admin')) {
    return (
      <div className="space-y-6">
        <header className="page-header">
          <h1 className="page-title">User & Role Management</h1>
          <p className="page-subtitle">You do not have access to this admin section.</p>
        </header>

        <div className="alert alert--warning">
          <p className="alert__title">Admin access required</p>
          <p className="alert__body">
            Ask an administrator to grant the <strong>Admin</strong> role for your account.
          </p>
        </div>

        <div>
          <Link href="/dashboard" className="btn btn--secondary btn--sm">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const [spRoles, users, companies] = await Promise.all([listRoles(), listUsers(), listCompanies()]);
  const companyById = new Map(companies.map((company) => [company.id, company]));
  const usersWithCompany = users
    .map((user) => {
      const linkedCompany = user.companyId ? companyById.get(user.companyId) : undefined;
      const companyName = linkedCompany?.companyName ?? linkedCompany?.Title ?? user.companyName ?? null;
      const companyCode = linkedCompany?.companyCode ?? user.companyCode ?? null;

      return {
        ...user,
        name: user.Title,
        roles: parseRoles(user.roles),
        company: companyName || companyCode ? { companyName, companyCode } : null,
      };
    })
    .sort((left, right) => (left.usernameLower ?? '').localeCompare(right.usernameLower ?? ''));

  const roleNameMap: Map<UserRole, string> = new Map(
    spRoles.map((role) => [
      normalizeRole(role.slug ?? ''),
      role.name ?? role.Title ?? USER_ROLE_LABELS[normalizeRole(role.slug ?? '')],
    ])
  );
  const roleOptions: Array<{ slug: UserRole; label: string }> = USER_ROLES.map((slug: UserRole) => ({
    slug,
    label: roleNameMap.get(slug) ?? USER_ROLE_LABELS[slug],
  }));
  const companyOptions = companies.map((company) => ({
    id: company.id,
    companyName: company.companyName ?? company.Title ?? '',
    companyCode: company.companyCode ?? '',
  }));
  const filteredUsers = query
    ? usersWithCompany.filter((user: typeof usersWithCompany[number]) => {
        const searchable = [
          user.name,
          user.email,
          user.username,
          user.company?.companyName ?? '',
          user.company?.companyCode ?? '',
        ]
          .join(' ')
          .toLowerCase();
        return searchable.includes(query);
      })
    : usersWithCompany;
  const totalUsers = usersWithCompany.length;
  const activeUsers = usersWithCompany.filter((user: typeof usersWithCompany[number]) => user.isActive).length;
  const inactiveUsers = totalUsers - activeUsers;

  return (
    <div className="space-y-5">
      <header className="surface-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="page-title">User & Role Management</h1>
            <p className="page-subtitle">
              Manage account access, role assignments, and activation status from one place.
            </p>
          </div>
          <Button href="/admin" variant="secondary" size="sm">
            Back to admin
          </Button>
        </div>
      </header>

      <div className="surface-card space-y-4 p-4 sm:p-5">
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
              Total users
            </p>
            <p className="mt-1 text-xl font-semibold text-[var(--text)]">{totalUsers}</p>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
              Active
            </p>
            <p className="mt-1 text-xl font-semibold text-[var(--success)]">{activeUsers}</p>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
              Inactive
            </p>
            <p className="mt-1 text-xl font-semibold text-[var(--text)]">{inactiveUsers}</p>
          </div>
        </div>

        <form method="get" className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Search by name, email, username, or company"
            className="input h-10 w-full py-0 text-sm"
          />
          <div className="flex items-center gap-2">
            <button type="submit" className="btn btn--secondary btn--sm w-full sm:w-auto">
              Search
            </button>
            {query ? (
              <Link href="/admin/roles" className="btn btn--ghost btn--sm w-full sm:w-auto">
                Clear
              </Link>
            ) : null}
          </div>
        </form>
        {query ? (
          <p className="text-xs text-[var(--text-subtle)]">
            Showing {filteredUsers.length} of {totalUsers} users for "{q}".
          </p>
        ) : null}
      </div>

      <AddUserForm roleOptions={roleOptions} companies={companyOptions} />

      <div className="table-shell">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Company</th>
              <th>Status</th>
              <th>Roles</th>
              <th>Manage</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user: typeof filteredUsers[number]) => {
                const primaryRole = normalizeRole(user.primaryRole);
                const assignedRoles = normalizeRoles(primaryRole, user.roles);

                return (
                  <tr key={user.id}>
                    <td>
                      <p className="font-semibold text-[var(--text)]">{user.name}</p>
                      <p className="text-xs text-[var(--text-subtle)]">{user.email}</p>
                      <p className="text-xs text-[var(--text-subtle)]">@{user.username}</p>
                    </td>
                    <td>
                      {user.company ? (
                        <div>
                          <p className="text-sm text-[var(--text)]">{user.company.companyName}</p>
                          <p className="text-xs text-[var(--text-subtle)]">{user.company.companyCode}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--text-subtle)]">No company</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${user.isActive ? 'badge--success' : 'badge--neutral'}`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1.5">
                        {assignedRoles.map((role: UserRole) => (
                          <span key={role} className={ROLE_BADGE_CLASSNAME[role]}>
                            {USER_ROLE_LABELS[role]}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <details className="group rounded-md border border-[var(--border)] bg-[var(--bg-subtle)]">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-semibold text-[var(--text)]">
                          Manage user
                          <span className="text-xs text-[var(--text-subtle)] transition-transform group-open:rotate-180">
                            ▼
                          </span>
                        </summary>
                        <div className="space-y-3 border-t border-[var(--border)] p-3">
                          <form action={updateUserRoleAssignmentsAction} className="space-y-2 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
                            <input type="hidden" name="userId" value={user.id} />

                            <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
                              Primary Role
                              <select
                                name="primaryRole"
                                defaultValue={primaryRole}
                                className="input mt-1 h-9 py-0 text-sm"
                              >
                                {roleOptions.map((roleOption: typeof roleOptions[number]) => (
                                  <option key={roleOption.slug} value={roleOption.slug}>
                                    {roleOption.label}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                              {roleOptions.map((roleOption: typeof roleOptions[number]) => (
                                <label
                                  key={roleOption.slug}
                                  className="flex items-center gap-2 text-xs text-[var(--text-muted)]"
                                >
                                  <input
                                    type="checkbox"
                                    name="roles"
                                    value={roleOption.slug}
                                    defaultChecked={assignedRoles.includes(roleOption.slug)}
                                  />
                                  <span>{roleOption.label}</span>
                                </label>
                              ))}
                            </div>

                            <div>
                              <PendingSubmitButton
                                idleLabel="Save Roles"
                                pendingLabel="Saving..."
                                className="btn btn--secondary btn--sm w-full"
                              />
                            </div>
                          </form>
                          <form action={toggleUserActiveStatusAction} className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
                            <input type="hidden" name="userId" value={user.id} />
                            <input
                              type="hidden"
                              name="nextActive"
                              value={user.isActive ? 'false' : 'true'}
                            />
                            <PendingSubmitButton
                              idleLabel={user.isActive ? 'Deactivate' : 'Activate'}
                              pendingLabel={user.isActive ? 'Deactivating...' : 'Activating...'}
                              className={`btn btn--sm w-full ${user.isActive ? 'btn--danger' : 'btn--accent'}`}
                            />
                          </form>
                        </div>
                      </details>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="py-10 text-center">
                  <p className="text-sm font-semibold text-[var(--text)]">
                    {query ? 'No users match your search' : 'No users found'}
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    {query
                      ? 'Try another keyword for name, email, username, or company.'
                      : 'Run the seed script to create users, then refresh this page.'}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
