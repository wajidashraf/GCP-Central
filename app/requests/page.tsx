import Link from 'next/link';
import { redirect } from 'next/navigation';
import Button from '@/src/components/ui/button';
import { listItems } from '@/lib/sharepoint/lists';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';
import { hasRole } from '@/src/lib/auth/has-role';
import { REQUEST_STATUS_MAP } from '@/src/constants/enums/requestStatus';
import FilterBar from '@/src/components/requests/filterbar';

// ─── Types ─────────────────────────────────────────────────────────────────

/** Shape shared by every form-type sub-list (PBL, PCCA, STSP, CAA, JVP …) */
type SubListItem = {
  id: string;
  uuid?: string;
  requestId?: string;
  requestIdLookupId?: string | number;
  requestIdId?: string | number;
  requestIdLookup?: string | number;
  projectId?: string;
  projectCode?: string;
  projectIdLookupId?: string | number;
  projectIdId?: string | number;
  projectIdLookup?: string | number;
  projectName?: string;
};

// ─── Helper ─────────────────────────────────────────────────────────────────

/**
 * Build a Map<requestKey, projectName> from a sub-list (e.g. PCCA, STSP, CAA…).
 *
 * Each sub-list item carries the parent request's UUID in its own `uuid` field
 * AND the request's SharePoint integer ID via `requestIdLookupId`. We key the
 * map by BOTH values so the caller can resolve by either UUID or integer ID.
 *
 * Project name is resolved in priority order:
 *   1. Projects list integer-ID lookup  (projectIdLookupId)
 *   2. Projects list UUID lookup        (projectIdLookupId treated as uuid)
 *   3. Projects list projectCode lookup (projectCode)
 *   4. Inline projectName text field    (fallback for older records)
 */
function buildProjectNameMap(
  items: SubListItem[],
  projectNameById: Map<string, string | null>,
  projectNameByUuid: Map<string, string | null>,
  projectNameByCode: Map<string, string | null>,
): Map<string, string> {
  const result = new Map<string, string>();

  for (const item of items) {
    const requestUuid = (item.uuid ?? '').trim();
    const requestLookupValue = String(
      item.requestIdLookupId ?? item.requestIdId ?? item.requestIdLookup ?? item.requestId ?? ''
    ).trim();

    const projectIdValue = String(
      item.projectIdLookupId ?? item.projectIdId ?? item.projectIdLookup ?? item.projectId ?? ''
    ).trim();
    const projectCodeValue = (item.projectCode ?? '').trim().toUpperCase();
    const fallbackProjectName = (item.projectName ?? '').trim();

    const projectName =
      projectNameById.get(projectIdValue) ??
      projectNameByUuid.get(projectIdValue) ??
      projectNameByCode.get(projectCodeValue) ??
      (fallbackProjectName.length > 0 ? fallbackProjectName : null);

    const normalizedProjectName = projectName?.trim();
    if (!normalizedProjectName) continue;

    if (requestUuid) result.set(requestUuid, normalizedProjectName);
    if (requestLookupValue) result.set(requestLookupValue, normalizedProjectName);
  }

  return result;
}

const STATUS_BADGE_CLASS_MAP: Record<string, string> = {
  Draft: 'badge--neutral',
  'Draft-Details': 'badge--neutral',
  New: 'badge--primary',
  Submitted: 'badge--primary',
  Scheduled: 'badge--primary',
  'Under Verification': 'badge--warning',
  'In Review': 'badge--warning',
  Resubmit: 'badge--warning',
  RS: 'badge--warning',
  'Ready for Engagement': 'badge--info',
  'Pending Review': 'badge--warning',
  'Draft Review': 'badge--warning',
  'Complete Review': 'badge--success',
  'Pending Acceptance': 'badge--warning',
  'Complete Acceptance': 'badge--success',
  'Pending Endorse': 'badge--warning',
  'Pending Ack': 'badge--warning',
  ACK: 'badge--success',
  Acknowledged: 'badge--success',
  E: 'badge--success',
  Endorsed: 'badge--success',
  'For Record': 'badge--neutral',
  FR: 'badge--neutral',
  NC: 'badge--danger',
  NC3: 'badge--danger',
  NC4: 'badge--danger',
  W: 'badge--danger',
  R: 'badge--info',
};

const STATUS_DISPLAY_MAP: Record<string, string> = {
  FR: 'For Record',
  RS: 'ReSubmit',
  R: 'Ready for Review',
};

const ACTION_LABEL_MAP: Record<string, string> = {
  NEW: 'Verify',
  'READY FOR REVIEW': 'Review',
  R: 'Review',
  RESUBMIT: 'ReSubmit',
  RS: 'ReSubmit',
  'FOR RECORD': 'View',
  FR: 'View',
  'PENDING ENDORSE': 'Endorse',
  'PENDING ACK': 'Acknowledge',
  E: 'View',
};

const PAGE_SIZE = 10;

type RequestsPageProps = {
  searchParams: Promise<{
    company?: string;
    project?: string;
    status?: string;
    type?: string;
    sortBy?: 'requestNo' | 'submitted';
    sortDir?: 'asc' | 'desc';
    page?: string;
  }>;
};

type RequestRow = {
  id: string;
  requestNo: string;
  requestType: string;
  routingType: string;
  companyName: string;
  companyCode: string;
  requestorEmail: string;
  status: string;
  submittedAt: Date | null;
  createdAt: Date;
  projectName: string | null;
  projectCode: string | null;
  projectId: string | null;
};

function getActionLabel(status: string) {
  const normalizedStatus = status.trim().toUpperCase();
  return ACTION_LABEL_MAP[normalizedStatus] ?? 'Open';
}

function formatRequestDate(submittedAt: Date | null, createdAt: Date) {
  const timestamp = submittedAt ?? createdAt;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(timestamp);
}

function cleanRequestNo(requestNo: string) {
  return requestNo.replace(
    /(\s*[-|/]\s*\d{1,2}[-/]\d{1,2}[-/]\d{2,4}.*$)|(\s*[-|/]\s*\d{4}-\d{2}-\d{2}.*$)|(-\d{8}.*$)/,
    ''
  ).trim();
}

function canSeeRequest(
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
  request: RequestRow
) {
  const canViewAll =
    hasRole(user, 'admin') ||
    hasRole(user, 'verifier') ||
    hasRole(user, 'reviewer') ||
    hasRole(user, 'working_gcpc');
  if (canViewAll) return true;

  let visible = false;
  if (hasRole(user, 'requestor')) {
    visible =
      visible ||
      request.requestorEmail.trim().toLowerCase() === user.email.trim().toLowerCase();
  }
  if (hasRole(user, 'hoc') && user.companyCode) {
    visible =
      visible ||
      request.companyCode.trim().toUpperCase() === user.companyCode.trim().toUpperCase();
  }
  if (hasRole(user, 'endorser')) {
    visible = visible || request.status === REQUEST_STATUS_MAP.PENDING_ENDORSE.label;
  }
  return visible;
}

export default async function RequestsPage({ searchParams }: RequestsPageProps) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect('/login?callbackUrl=/requests');
  }

  const params = await searchParams;
  const selectedCompany = params.company?.trim() ?? '';
  const selectedProject = params.project?.trim() ?? '';
  const selectedStatus = params.status?.trim() ?? '';
  const selectedType = params.type?.trim() ?? '';
  const sortBy = params.sortBy === 'requestNo' || params.sortBy === 'submitted' ? params.sortBy : 'submitted';
  const sortDir = params.sortDir === 'asc' || params.sortDir === 'desc' ? params.sortDir : 'desc';
  const currentPage = Math.max(1, parseInt(params.page ?? '1', 10) || 1);
  const canCreateRequest = hasRole(currentUser, 'requestor');
  const canSeeBookEngagement =
    hasRole(currentUser, 'requestor') &&
    hasRole(currentUser, 'admin') &&
    selectedStatus === 'ready for engagement';

  const HIDDEN_STATUSES = ['Draft', 'Draft-Details'] as const;

  let loadError = false;
  let visibleRequests: RequestRow[] = [];
  let baseVisibleRequests: RequestRow[] = [];
  
  try {
    const requestsListId = process.env.REQUESTS_LIST_ID;
    if (!requestsListId) {
      throw new Error('REQUESTS_LIST_ID is not set in .env.local');
    }

    const [requestItems, rtpItems, pblItems, pccaItems, rpccaItems, ppItems, rppItems, vapItems, othersItems, cprItems, ciItems, stspItems, caaItems, jvpItems, projectItems] = await Promise.all([
      listItems<{
        id: string;
        uuid?: string;
        requestNo?: string;
        requestType?: string;
        routingType?: string;
        companyName?: string;
        companyCode?: string;
        requestorEmail?: string;
        status?: string;
        projectCode?: string;
        projectId?: string;
        Created?: string;
        submittedAt?: string;
      }>(requestsListId),
      process.env.RTP_REQUESTS_LIST_ID
        ? listItems<{ id: string; uuid?: string; projectName?: string }>(process.env.RTP_REQUESTS_LIST_ID)
        : Promise.resolve([]),
      process.env.PBL_REQUESTS_LIST_ID   ? listItems<SubListItem>(process.env.PBL_REQUESTS_LIST_ID)   : Promise.resolve([]),
      process.env.PCCA_REQUESTS_LIST_ID  ? listItems<SubListItem>(process.env.PCCA_REQUESTS_LIST_ID)  : Promise.resolve([]),
      process.env.RPCCA_REQUESTS_LIST_ID ? listItems<SubListItem>(process.env.RPCCA_REQUESTS_LIST_ID) : Promise.resolve([]),
      process.env.PP_REQUESTS_LIST_ID    ? listItems<SubListItem>(process.env.PP_REQUESTS_LIST_ID)    : Promise.resolve([]),
      process.env.RPP_REQUESTS_LIST_ID   ? listItems<SubListItem>(process.env.RPP_REQUESTS_LIST_ID)   : Promise.resolve([]),
      process.env.VAP_REQUESTS_LIST_ID   ? listItems<SubListItem>(process.env.VAP_REQUESTS_LIST_ID)   : Promise.resolve([]),
      process.env.OTHERS_REQUESTS_LIST_ID? listItems<SubListItem>(process.env.OTHERS_REQUESTS_LIST_ID): Promise.resolve([]),
      process.env.CPR_REQUESTS_LIST_ID   ? listItems<SubListItem>(process.env.CPR_REQUESTS_LIST_ID)   : Promise.resolve([]),
      process.env.CI_REQUESTS_LIST_ID    ? listItems<SubListItem>(process.env.CI_REQUESTS_LIST_ID)    : Promise.resolve([]),
      process.env.STSP_REQUESTS_LIST_ID  ? listItems<SubListItem>(process.env.STSP_REQUESTS_LIST_ID)  : Promise.resolve([]),
      process.env.CAA_REQUESTS_LIST_ID   ? listItems<SubListItem>(process.env.CAA_REQUESTS_LIST_ID)   : Promise.resolve([]),
      process.env.JVP_REQUESTS_LIST_ID   ? listItems<SubListItem>(process.env.JVP_REQUESTS_LIST_ID)   : Promise.resolve([]),
      process.env.PROJECTS_LIST_ID
        ? listItems<{ id: string; uuid?: string; Title?: string; projectName?: string; projectCode?: string }>(process.env.PROJECTS_LIST_ID)
        : Promise.resolve([]),
    ]);

    const projectNameById = new Map(
      projectItems.map((project) => [project.id, project.projectName ?? project.Title ?? null])
    );
    const projectNameByUuid = new Map(
      projectItems
        .filter((project) => (project.uuid ?? "").trim().length > 0)
        .map((project) => [(project.uuid ?? "").trim(), project.projectName ?? project.Title ?? null])
    );
    const projectNameByCode = new Map(
      projectItems
        .filter((project) => (project.projectCode ?? "").trim().length > 0)
        .map((project) => [(project.projectCode ?? "").trim().toUpperCase(), project.projectName ?? project.Title ?? null])
    );
    // RTP stores projectName as a plain text field directly on the list item.
    const rtpProjectNameByRequestUuid = new Map(
      rtpItems
        .filter((item) => (item.uuid ?? '').trim() && (item.projectName ?? '').trim())
        .map((item) => [(item.uuid ?? '').trim(), (item.projectName ?? '').trim()])
    );

    // Every other form type resolves the project name via projectIdLookupId → Projects list.
    // R-PCCA entries are merged into the same PCCA map since they share the same lookup logic.
    const pblProjectNameByRequestUuid    = buildProjectNameMap(pblItems,    projectNameById, projectNameByUuid, projectNameByCode);
    const pccaProjectNameByRequestUuid   = buildProjectNameMap([...pccaItems, ...rpccaItems], projectNameById, projectNameByUuid, projectNameByCode);
    const ppProjectNameByRequestUuid     = buildProjectNameMap(ppItems,     projectNameById, projectNameByUuid, projectNameByCode);
    const rppProjectNameByRequestUuid    = buildProjectNameMap(rppItems,    projectNameById, projectNameByUuid, projectNameByCode);
    const vapProjectNameByRequestUuid    = buildProjectNameMap(vapItems,    projectNameById, projectNameByUuid, projectNameByCode);
    const othersProjectNameByRequestUuid = buildProjectNameMap(othersItems, projectNameById, projectNameByUuid, projectNameByCode);
    const cprProjectNameByRequestUuid    = buildProjectNameMap(cprItems,    projectNameById, projectNameByUuid, projectNameByCode);
    const ciProjectNameByRequestUuid     = buildProjectNameMap(ciItems,     projectNameById, projectNameByUuid, projectNameByCode);
    const stspProjectNameByRequestUuid   = buildProjectNameMap(stspItems,   projectNameById, projectNameByUuid, projectNameByCode);
    const caaProjectNameByRequestUuid    = buildProjectNameMap(caaItems,    projectNameById, projectNameByUuid, projectNameByCode);
    const jvpProjectNameByRequestUuid    = buildProjectNameMap(jvpItems,    projectNameById, projectNameByUuid, projectNameByCode);

    baseVisibleRequests = requestItems
      .map((item) => {
        const uuid = (item.uuid ?? '').trim();
        const id = uuid || item.id;
        const createdAt = item.Created ? new Date(item.Created) : new Date();
        const submittedAt = item.submittedAt ? new Date(item.submittedAt) : null;
        // Try every form-type sub-list map using the request UUID first, then its integer ID.
        // Falls back to projectId / projectCode directly on the main request row.
        const formTypeMaps = [
          rtpProjectNameByRequestUuid,
          pblProjectNameByRequestUuid,
          pccaProjectNameByRequestUuid,
          ppProjectNameByRequestUuid,
          rppProjectNameByRequestUuid,
          vapProjectNameByRequestUuid,
          othersProjectNameByRequestUuid,
          cprProjectNameByRequestUuid,
          ciProjectNameByRequestUuid,
          stspProjectNameByRequestUuid,
          caaProjectNameByRequestUuid,
          jvpProjectNameByRequestUuid,
        ];
        let projectName: string | null = null;
        for (const map of formTypeMaps) {
          const hit = (uuid ? map.get(uuid) : undefined) ?? map.get(item.id);
          if (hit) { projectName = hit; break; }
        }
        if (!projectName) {
          const pid = (item.projectId ?? '').trim();
          projectName =
            projectNameById.get(pid) ??
            projectNameByUuid.get(pid) ??
            projectNameByCode.get((item.projectCode ?? '').trim().toUpperCase()) ??
            null;
        }
        return {
          id,
          requestNo: (item.requestNo ?? '').trim(),
          requestType: (item.requestType ?? '').trim(),
          routingType: (item.routingType ?? '').trim(),
          companyName: (item.companyName ?? '').trim(),
          companyCode: (item.companyCode ?? '').trim(),
          requestorEmail: (item.requestorEmail ?? '').trim(),
          status: (item.status ?? '').trim(),
          submittedAt: Number.isNaN(submittedAt?.getTime() ?? Number.NaN) ? null : submittedAt,
          createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
          projectName,
          projectCode: (item.projectCode ?? '').trim(),
          projectId: (item.projectId ?? '').trim(),
        } satisfies RequestRow;
      })
      .filter((item) => item.requestNo.length > 0 && item.status.length > 0)
      .filter((item) => !HIDDEN_STATUSES.includes(item.status as typeof HIDDEN_STATUSES[number]))
      .filter((item) => canSeeRequest(currentUser, item));

    visibleRequests = baseVisibleRequests.filter((item) => {
      if (selectedCompany && item.companyName !== selectedCompany) return false;
      if (selectedProject && (item.projectName ?? '') !== selectedProject) return false;
      if (selectedStatus && item.status !== selectedStatus) return false;
      if (selectedType && item.requestType !== selectedType && item.routingType !== selectedType) return false;
      return true;
    });

    visibleRequests.sort((left, right) => {
      if (sortBy === 'requestNo') {
        const cmp = left.requestNo.localeCompare(right.requestNo);
        return sortDir === 'asc' ? cmp : -cmp;
      }
      const leftTs = (left.submittedAt ?? left.createdAt).getTime();
      const rightTs = (right.submittedAt ?? right.createdAt).getTime();
      const cmp = leftTs - rightTs;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  } catch {
    loadError = true;
  }

  const totalRequests = visibleRequests.length;
  const totalPages = Math.max(1, Math.ceil(totalRequests / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, totalRequests);
  const pagedRequests = visibleRequests.slice(pageStart, pageEnd);

  const companyOptions: string[] = [
    ...new Set(baseVisibleRequests.map((item) => item.companyName).filter(Boolean)),
  ].sort();
  const statusOptions: string[] = [
    ...new Set(baseVisibleRequests.map((item) => item.status).filter(Boolean)),
  ].sort();
  const typeOptions: string[] = [
    ...new Set(
      baseVisibleRequests
        .flatMap((item) => [item.requestType, item.routingType])
        .filter(Boolean)
    ),
  ].sort();
  const projectOptions: string[] = [
    ...new Set(baseVisibleRequests.map((item) => item.projectName).filter((item): item is string => Boolean(item))),
  ].sort((a, b) => a.localeCompare(b));

  const projectOptionsForFilter =
    selectedProject && !projectOptions.includes(selectedProject)
      ? [...projectOptions, selectedProject].sort((a, b) => a.localeCompare(b))
      : projectOptions;

  const buildHref = (overrides: Record<string, string | undefined>) => {
    const query = new URLSearchParams();
    if (selectedCompany) query.set('company', selectedCompany);
    if (selectedProject) query.set('project', selectedProject);
    if (selectedStatus) query.set('status', selectedStatus);
    if (selectedType) query.set('type', selectedType);
    query.set('sortBy', sortBy);
    query.set('sortDir', sortDir);
    if (safePage > 1) query.set('page', String(safePage));
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined || value === '') query.delete(key);
      else query.set(key, value);
    }
    return `/requests?${query.toString()}`;
  };

  const buildSortHref = (column: 'requestNo' | 'submitted') => {
    const isCurrentColumn = sortBy === column;
    const nextDir: 'asc' | 'desc' = isCurrentColumn ? (sortDir === 'asc' ? 'desc' : 'asc') : 'desc';
    return buildHref({ sortBy: column, sortDir: nextDir, page: undefined });
  };

  const prevHref = safePage > 1 ? buildHref({ page: String(safePage - 1) }) : null;
  const nextHref = safePage < totalPages ? buildHref({ page: String(safePage + 1) }) : null;

  return (
    <div className="space-y-6">
      <header className="page-header sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="page-title">Review requests</h1>
          <p className="page-subtitle">
            Inspect procurement submissions, apply role-based actions, and monitor lifecycle status.
          </p>
        </div>
        {canCreateRequest ? (
          <Button href="/submit" variant="primary" size="sm">
            + New Request
          </Button>
        ) : null}
      </header>

      {loadError ? (
        <div className="alert alert--danger">
          <p className="alert__title">Unable to load requests</p>
          <p className="alert__body">Please check the SharePoint configuration and try again.</p>
        </div>
      ) : null}

      <FilterBar
        companyOptions={companyOptions}
        projectOptions={projectOptionsForFilter}
        statusOptions={statusOptions}
        typeOptions={typeOptions}
        selectedCompany={selectedCompany}
        selectedProject={selectedProject}
        selectedStatus={selectedStatus}
        selectedType={selectedType}
        sortBy={sortBy}
        sortDir={sortDir}
      />

      {/* Table + pagination wrapper */}
      <div className="space-y-3">

        {/* Row count summary */}
        {totalRequests > 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            Showing <span className="font-medium text-[var(--text)]">{pageStart + 1}–{pageEnd}</span> of{' '}
            <span className="font-medium text-[var(--text)]">{totalRequests}</span> request{totalRequests !== 1 ? 's' : ''}
          </p>
        ) : null}

        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>
                  <Link href={buildSortHref('requestNo')} className="inline-flex items-center gap-1 hover:underline">
                    Request No
                    {sortBy === 'requestNo' ? <span>{sortDir === 'asc' ? '↑' : '↓'}</span> : null}
                  </Link>
                </th>
                <th>Project Name</th>
                <th>Type</th>
                <th>Company</th>
                <th>
                  <Link href={buildSortHref('submitted')} className="inline-flex items-center gap-1 hover:underline">
                    Submitted
                    {sortBy === 'submitted' ? <span>{sortDir === 'asc' ? '↑' : '↓'}</span> : null}
                  </Link>
                </th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pagedRequests.length > 0 ? (
                pagedRequests.map((request) => {
                  const projectName = request.projectName ?? '—';
                  const typeWithChannel = `${request.requestType} - ${request.routingType}`;

                  return (
                    <tr key={request.id}>
                      <td className="font-semibold text-[var(--text)]">{cleanRequestNo(request.requestNo)}</td>
                      <td>{projectName}</td>
                      <td>{typeWithChannel}</td>
                      <td>{request.companyName}</td>
                      <td>{formatRequestDate(request.submittedAt, request.createdAt)}</td>
                      <td>
                        <span className={`badge text-sm ${STATUS_BADGE_CLASS_MAP[request.status] ?? 'badge--neutral'}`}>
                          {STATUS_DISPLAY_MAP[request.status] ?? request.status}
                        </span>
                      </td>
                      <td>
                        <div className="grid w-full items-center gap-2">
                          <Button href={`/requests/${request.id}`} variant="primary" size="sm" className="w-full flex-wrap">
                            {getActionLabel(request.status)}
                          </Button>
                          {canSeeBookEngagement ? (
                            <Button
                              href={`/requests/${request.id}/book-engagement`}
                              variant="accent"
                              size="sm"
                            >
                              Book
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-10 text-center">
                    <p className="text-sm font-semibold text-[var(--text)]">No requests found</p>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      Try adjusting filters, or create a new request.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 ? (
          <div className="flex items-center justify-between gap-4 pt-1">
            <span className="text-sm text-[var(--text-muted)]">
              Page <span className="font-medium text-[var(--text)]">{safePage}</span> of{' '}
              <span className="font-medium text-[var(--text)]">{totalPages}</span>
            </span>

            <div className="flex items-center gap-2">
              {prevHref ? (
                <Link
                  href={prevHref}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)] hover:text-[var(--text)]"
                  aria-label="Previous page"
                >
                  ‹
                </Link>
              ) : (
                <span className="inline-flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-subtle)] opacity-40">
                  ‹
                </span>
              )}

              {nextHref ? (
                <Link
                  href={nextHref}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)] hover:text-[var(--text)]"
                  aria-label="Next page"
                >
                  ›
                </Link>
              ) : (
                <span className="inline-flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-subtle)] opacity-40">
                  ›
                </span>
              )}
            </div>
          </div>
        ) : null}

      </div>
    </div>
  );
}
