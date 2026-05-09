import 'server-only';
import { getGraphClient, getSiteId } from '@/lib/graph';
import { SHAREPOINT_COMPANY_FIELDS } from '@/lib/sharepoint/constants';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Raw item returned by Graph API — fields wrapped under `fields` key */
interface GraphListItem<T = Record<string, unknown>> {
  id: string;
  fields: T & { id?: string };
}

/** Options for querying a SharePoint list */
export interface ListQueryOptions {
  /** OData $filter expression e.g. "fields/emailLower eq 'john'" */
  filter?: string;
  /** OData $select on the items (not fields) — rarely needed */
  select?: string;
  /** Max results to return (default: no limit — SharePoint pages at 100) */
  top?: number;
  /** OData $orderby on fields e.g. "fields/Title asc" */
  orderby?: string;
}

// ─── Core CRUD helpers ────────────────────────────────────────────────────────

/**
 * Get all items from a SharePoint list with optional OData filtering.
 * Always expands `fields` and returns items as a flat object with `id` injected.
 */
export async function listItems<T = Record<string, unknown>>(
  listName: string,
  options: ListQueryOptions = {}
): Promise<(T & { id: string })[]> {
  const client = getGraphClient();
  const siteId = getSiteId();

  const params = new URLSearchParams();
  params.set('$expand', 'fields');

  if (options.filter)  params.set('$filter',  options.filter);
  if (options.select)  params.set('$select',  options.select);
  if (options.top)     params.set('$top',     String(options.top));
  if (options.orderby) params.set('$orderby', options.orderby);

  const url = `/sites/${siteId}/lists/${listName}/items?${params.toString()}`;

  // Handle SharePoint pagination (@odata.nextLink)
  const results: (T & { id: string })[] = [];
  let nextUrl: string | undefined = url;

  while (nextUrl) {
    const res = await client.api(nextUrl).get();
    const page = res.value as GraphListItem<T>[];
    for (const item of page) {
      results.push({ ...item.fields, id: item.id } as T & { id: string });
    }
    nextUrl = res['@odata.nextLink'];
  }

  return results;
}

/**
 * Get a single item by its SharePoint integer item ID.
 */
export async function getItem<T = Record<string, unknown>>(
  listName: string,
  itemId: string
): Promise<(T & { id: string }) | null> {
  try {
    const client = getGraphClient();
    const siteId = getSiteId();
    const res = await client
      .api(`/sites/${siteId}/lists/${listName}/items/${itemId}?$expand=fields`)
      .get();
    return { ...res.fields, id: res.id } as T & { id: string };
  } catch {
    return null;
  }
}

/**
 * Create a new item in a SharePoint list.
 * Returns the created item including its new SharePoint integer ID.
 */
export async function createItem<T = Record<string, unknown>>(
  listName: string,
  fields: Record<string, unknown>
): Promise<T & { id: string }> {
  const client = getGraphClient();
  const siteId = getSiteId();
  const res = await client
    .api(`/sites/${siteId}/lists/${listName}/items`)
    .post({ fields });
  return { ...res.fields, id: res.id } as T & { id: string };
}

/**
 * Update fields on an existing SharePoint list item.
 */
export async function updateItem(
  listName: string,
  itemId: string,
  fields: Record<string, unknown>
): Promise<void> {
  const client = getGraphClient();
  const siteId = getSiteId();
  await client
    .api(`/sites/${siteId}/lists/${listName}/items/${itemId}/fields`)
    .patch(fields);
}

/**
 * Delete a SharePoint list item by its integer ID.
 */
export async function deleteItem(
  listName: string,
  itemId: string
): Promise<void> {
  const client = getGraphClient();
  const siteId = getSiteId();
  await client
    .api(`/sites/${siteId}/lists/${listName}/items/${itemId}`)
    .delete();
}

// ─── Typed helpers for common lists ───────────────────────────────────────────

export interface SPUser {
  id: string;
  Title: string;           // display name
  email: string;
  emailLower: string;
  username: string;
  usernameLower: string;
  passwordHash: string;
  entraId?: string;
  primaryRole: string;
  roles: string;           // JSON string: '["requestor","verifier"]'
  companyId?: string;
  companyCode?: string;
  companyName?: string;
  isActive: boolean;
}

export interface SPCompany {
  id: string;
  Title: string;           // company name (display)
  companyName?: string;    // company name field
  companyCode: string;
  sector: string;
}

export interface SPRole {
  id: string;
  Title?: string;
  slug?: string;
  name?: string;
  uuid?: string;
}

function getUsersListId(): string {
  const listId = process.env.USERS_LIST_ID;
  if (!listId) {
    throw new Error('USERS_LIST_ID is not set in .env.local');
  }
  return listId;
}

function getCompaniesListId(): string {
  const listId = process.env.COMPANIES_LIST_ID;
  if (!listId) {
    throw new Error('COMPANIES_LIST_ID is not set in .env.local');
  }
  return listId;
}

function getRolesListId(): string {
  const listId = process.env.ROLES_LIST_ID;
  if (!listId) {
    throw new Error('ROLES_LIST_ID is not set in .env.local');
  }
  return listId;
}

function odataString(value: string): string {
  // OData string escaping: single quote must be doubled.
  return `'${value.replace(/'/g, "''")}'`;
}

function isNonIndexedFieldError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /cannot be referenced in filter or orderby as it is not indexed/i.test(error.message);
}

/**
 * Find a user by their lowercased email OR username.
 * Used by the NextAuth Credentials authorize() function.
 */
export async function findUserByIdentifier(
  identifier: string
): Promise<SPUser | null> {
  const usersListId = getUsersListId();

  try {
    // Try emailLower first, then usernameLower
    const byEmail = await listItems<SPUser>(usersListId, {
      filter: `fields/emailLower eq ${odataString(identifier)} and fields/isActive eq 1`,
      top: 1,
    });
    if (byEmail.length > 0) return byEmail[0];

    const byUsername = await listItems<SPUser>(usersListId, {
      filter: `fields/usernameLower eq ${odataString(identifier)} and fields/isActive eq 1`,
      top: 1,
    });
    return byUsername[0] ?? null;
  } catch (error: unknown) {
    if (!isNonIndexedFieldError(error)) {
      throw error;
    }

    // Fallback path when SharePoint columns are not indexed yet.
    const normalized = identifier.trim().toLowerCase();
    const users = await listUsers();
    return (
      users.find(
        (user) =>
          user.isActive &&
          ((user.emailLower ?? "").trim().toLowerCase() === normalized ||
            (user.usernameLower ?? "").trim().toLowerCase() === normalized)
      ) ?? null
    );
  }
}

export async function listUsers(): Promise<SPUser[]> {
  const usersListId = getUsersListId();
  return listItems<SPUser>(usersListId);
}

export async function createUser(fields: Record<string, unknown>): Promise<SPUser> {
  const usersListId = getUsersListId();
  return createItem<SPUser>(usersListId, fields);
}

export async function updateUser(userId: string, fields: Record<string, unknown>): Promise<void> {
  const usersListId = getUsersListId();
  await updateItem(usersListId, userId, fields);
}

/**
 * Parse the JSON-encoded roles field from a SharePoint User item.
 */
export function parseRoles(rolesJson: string): string[] {
  try {
    const parsed = JSON.parse(rolesJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function listCompanies(): Promise<SPCompany[]> {
  const companiesListId = getCompaniesListId();
  const companies = await listItems<SPCompany>(companiesListId);
  return companies.sort((left, right) =>
    (left.companyCode ?? '').localeCompare(right.companyCode ?? '')
  );
}

export async function findCompanyById(companyId: string): Promise<SPCompany | null> {
  const normalizedId = companyId.trim();
  if (!normalizedId) return null;
  const companies = await listCompanies();
  return companies.find((company) => company.id === normalizedId) ?? null;
}

export async function listRoles(): Promise<SPRole[]> {
  const rolesListId = getRolesListId();
  const roles = await listItems<SPRole>(rolesListId);
  return roles.sort((left, right) => {
    const leftName = (left.name ?? left.Title ?? '').trim();
    const rightName = (right.name ?? right.Title ?? '').trim();
    return leftName.localeCompare(rightName);
  });
}

export async function createCompany(input: {
  companyName: string;
  companyCode: string;
  sector: string;
  guid?: string;
}): Promise<SPCompany> {
  const companiesListId = getCompaniesListId();
  const fields: Record<string, unknown> = {
    [SHAREPOINT_COMPANY_FIELDS.title]: input.companyName,
    [SHAREPOINT_COMPANY_FIELDS.companyName]: input.companyName,
    [SHAREPOINT_COMPANY_FIELDS.companyCode]: input.companyCode,
    [SHAREPOINT_COMPANY_FIELDS.sector]: input.sector,
  };

  if (input.guid) {
    fields[SHAREPOINT_COMPANY_FIELDS.uuid] = input.guid;
  }

  return createItem<SPCompany>(companiesListId, fields);
}

export async function findCompanyByCode(companyCode: string): Promise<SPCompany | null> {
  const normalizedCode = companyCode.trim().toUpperCase();
  const companies = await listCompanies();
  return (
    companies.find(
      (company) => (company.companyCode ?? '').trim().toUpperCase() === normalizedCode
    ) ?? null
  );
}
