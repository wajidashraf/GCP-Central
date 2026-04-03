'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';
import { USER_ROLES, type UserRole } from '@/src/types/auth';

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

function sortRolesByPriority(roles: UserRole[]) {
  const roleRank = new Map<UserRole, number>(USER_ROLES.map((role, index) => [role, index]));
  return [...roles].sort((left, right) => {
    const leftRank = roleRank.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = roleRank.get(right) ?? Number.MAX_SAFE_INTEGER;
    return leftRank - rightRank;
  });
}

function normalizeRoleSelection(entries: FormDataEntryValue[]) {
  const deduped = new Set<UserRole>();

  for (const entry of entries) {
    if (typeof entry !== 'string') {
      continue;
    }
    const role = entry.trim();
    if (!isUserRole(role)) {
      continue;
    }
    deduped.add(role);
  }

  return sortRolesByPriority([...deduped]);
}

async function ensureAdminAccess() {
  const currentUser = await getCurrentUser();
  const canManageRoles = Boolean(currentUser && currentUser.roles.includes('admin'));

  if (!canManageRoles) {
    throw new Error('Unauthorized');
  }
}

export async function updateUserRoleAssignmentsAction(formData: FormData) {
  await ensureAdminAccess();

  const userId = String(formData.get('userId') ?? '').trim();
  const primaryRole = normalizeRole(String(formData.get('primaryRole') ?? '').trim());

  if (!userId) {
    return;
  }

  const selectedRoles = normalizeRoleSelection(formData.getAll('roles'));
  const roles = selectedRoles.length > 0 ? selectedRoles : [primaryRole];

  if (!roles.includes(primaryRole)) {
    roles.unshift(primaryRole);
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      primaryRole,
      roles: sortRolesByPriority([...new Set(roles)]),
    },
  });

  revalidatePath('/admin/roles');
}

export async function toggleUserActiveStatusAction(formData: FormData) {
  await ensureAdminAccess();

  const userId = String(formData.get('userId') ?? '').trim();
  const nextActive = String(formData.get('nextActive') ?? 'true').trim().toLowerCase() === 'true';

  if (!userId) {
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      isActive: nextActive,
    },
  });

  revalidatePath('/admin/roles');
}
