'use server';

import { randomUUID } from 'crypto';
import { hash } from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { sendEmail } from '@/lib/email/email-service';
import { getNewUserAccountEmailHtml, htmlToPlainText } from '@/lib/email/email-templates';
import { createUser, findCompanyById, listUsers, updateUser } from '@/lib/sharepoint/lists';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';
import { USER_ROLE_LABELS, USER_ROLES, type UserRole } from '@/src/types/auth';

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

  await updateUser(userId, {
    primaryRole,
    roles: JSON.stringify(sortRolesByPriority([...new Set(roles)])),
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

  await updateUser(userId, {
    isActive: nextActive,
  });

  revalidatePath('/admin/roles');
}

export type CreateUserResult =
  | { ok: true; message: string; emailSent: boolean }
  | { ok: false; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createUserWithRolesAction(formData: FormData): Promise<CreateUserResult> {
  await ensureAdminAccess();

  const name = String(formData.get('name') ?? '').trim();
  const emailRaw = String(formData.get('email') ?? '').trim();
  const usernameRaw = String(formData.get('username') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const companyIdRaw = String(formData.get('companyId') ?? '').trim();
  const primaryRole = normalizeRole(String(formData.get('primaryRole') ?? '').trim());

  const emailLower = emailRaw.toLowerCase();
  const usernameLower = usernameRaw.toLowerCase();

  if (!name || !emailRaw || !usernameRaw || !password) {
    return { ok: false, message: 'Name, email, username, and password are required.' };
  }

  if (!EMAIL_RE.test(emailRaw)) {
    return { ok: false, message: 'Please enter a valid email address.' };
  }

  if (password.length < 8) {
    return { ok: false, message: 'Password must be at least 8 characters.' };
  }

  const selectedRoles = normalizeRoleSelection(formData.getAll('roles'));
  const roles = selectedRoles.length > 0 ? selectedRoles : [primaryRole];
  if (!roles.includes(primaryRole)) {
    roles.unshift(primaryRole);
  }
  const finalRoles = sortRolesByPriority([...new Set(roles)]);

  const users = await listUsers();
  const duplicate = users.find(
    (user) =>
      (user.emailLower ?? '').trim().toLowerCase() === emailLower ||
      (user.usernameLower ?? '').trim().toLowerCase() === usernameLower
  );

  if (duplicate) {
    if (duplicate.emailLower === emailLower) {
      return { ok: false, message: 'A user with this email already exists.' };
    }
    return { ok: false, message: 'A user with this username already exists.' };
  }

  let companyId: string | null = null;
  let companyLookupId: number | null = null;
  let companyCode: string | null = null;
  let companyName: string | null = null;
  if (companyIdRaw) {
    const company = await findCompanyById(companyIdRaw);
    if (!company) {
      return { ok: false, message: 'Selected company was not found.' };
    }
    companyId = company.id;
    const parsedLookupId = Number(company.id);
    if (Number.isFinite(parsedLookupId)) {
      companyLookupId = parsedLookupId;
    }
    companyCode = company.companyCode ?? null;
    companyName = company.companyName ?? company.Title ?? null;
  }

  const passwordHash = await hash(password, 10);

  await createUser({
    Title: name,
    uuid: randomUUID(),
    email: emailRaw,
    emailLower,
    username: usernameRaw,
    usernameLower,
    passwordHash,
    primaryRole,
    roles: JSON.stringify(finalRoles),
    companyId,
    companyIdLookupId: companyLookupId,
    companyCode,
    companyName,
    isActive: true,
  });

  const roleLabels = finalRoles.map((slug) => USER_ROLE_LABELS[slug]);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const loginUrl = `${appUrl.replace(/\/$/, '')}/login`;
  const html = getNewUserAccountEmailHtml(
    name,
    usernameRaw,
    password,
    roleLabels,
    loginUrl,
    'GCP Central'
  );

  const emailResult = await sendEmail({
    to: { email: emailLower, name },
    subject: 'Your GCP Central account',
    html,
    text: htmlToPlainText(html),
  });

  revalidatePath('/admin/roles');

  if (!emailResult.success) {
    return {
      ok: true,
      emailSent: false,
      message: `User created, but the welcome email could not be sent (${emailResult.error ?? 'unknown error'}). Share the username and password with them manually.`,
    };
  }

  return {
    ok: true,
    emailSent: true,
    message: 'User created and welcome email sent.',
  };
}
