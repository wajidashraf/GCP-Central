import Link from 'next/link';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';
import { USER_ROLES, USER_ROLE_LABELS, type UserRole } from '@/src/types/auth';
import {
  toggleUserActiveStatusAction,
  updateUserRoleAssignmentsAction,
} from './actions';

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

export default async function AdminRolesPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect('/login');
  }

  if (!currentUser.roles.includes('admin')) {
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

  const [dbRoles, users] = await Promise.all([
    prisma.role.findMany({
      select: {
        slug: true,
        name: true,
      },
    }),
    prisma.user.findMany({
      orderBy: { usernameLower: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        primaryRole: true,
        roles: true,
        isActive: true,
        company: {
          select: {
            companyName: true,
            companyCode: true,
          },
        },
      },
    }),
  ]);

  const roleNameMap: Map<UserRole, string> = new Map(
    (dbRoles as Array<{ slug: string; name: string }>).map((role) => [
      normalizeRole(role.slug),
      role.name,
    ])
  );
  const roleOptions: Array<{ slug: UserRole; label: string }> = USER_ROLES.map((slug: UserRole) => ({
    slug,
    label: roleNameMap.get(slug) ?? USER_ROLE_LABELS[slug],
  }));

  return (
    <div className="space-y-6">
      <header className="page-header">
        <h1 className="page-title">User & Role Management</h1>
        <p className="page-subtitle">
          View accounts, update role assignments, and activate/deactivate users directly from the
          admin panel.
        </p>
      </header>

      <div className="surface-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge badge--brand">Users: {users.length}</span>
          <span className="badge badge--success">
            Active: {users.filter((user: typeof users[number]) => user.isActive).length}
          </span>
          <span className="badge badge--neutral">
            Inactive: {users.filter((user: typeof users[number]) => !user.isActive).length}
          </span>
        </div>
      </div>

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
            {users.length > 0 ? (
              users.map((user: typeof users[number]) => {
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
                      <div className="space-y-3">
                        <form action={updateUserRoleAssignmentsAction} className="space-y-2">
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

                          <button type="submit" className="btn btn--secondary btn--sm">
                            Save Roles
                          </button>
                        </form>

                        <form action={toggleUserActiveStatusAction}>
                          <input type="hidden" name="userId" value={user.id} />
                          <input
                            type="hidden"
                            name="nextActive"
                            value={user.isActive ? 'false' : 'true'}
                          />
                          <button
                            type="submit"
                            className={`btn btn--sm ${user.isActive ? 'btn--danger' : 'btn--accent'}`}
                          >
                            {user.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="py-10 text-center">
                  <p className="text-sm font-semibold text-[var(--text)]">No users found</p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    Run the seed script to create users, then refresh this page.
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
