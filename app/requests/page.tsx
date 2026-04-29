import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Prisma } from '@prisma/client';
import Button from '@/src/components/ui/button';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';
import { hasRole } from '@/src/lib/auth/has-role';
import FilterBar from '@/src/components/requests/filterbar';



// AFTER:
const STATUS_BADGE_CLASS_MAP: Record<string, string> = {
  Draft: 'badge--neutral',
  'Draft-Details': 'badge--neutral',
  New: 'badge--primary',
  'In Review': 'badge--warning',
  Resubmit: 'badge--warning',
  RS: 'badge--warning',           // ReSubmit short code
  Acknowledged: 'badge--success',
  Endorsed: 'badge--success',
  'For Record': 'badge--neutral',
  FR: 'badge--neutral',           // For Record short code
  NC: 'badge--danger',
  R: 'badge--info',               // Ready for Review short code
  'Ready for Engagement': 'badge--success',
};

// Maps short DB codes → human-readable display labels
const STATUS_DISPLAY_MAP: Record<string, string> = {
  FR: 'For Record',
  RS: 'ReSubmit',
  R: 'Ready for Review',
};

function formatRequestDate(submittedAt: Date | null, createdAt: Date) {
  const timestamp = submittedAt ?? createdAt;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(timestamp);
}

// AFTER — added third branch for compact 8-digit date: REQ-0003-20260429
function cleanRequestNo(requestNo: string) {
  return requestNo.replace(
    /(\s*[-|/]\s*\d{1,2}[-/]\d{1,2}[-/]\d{2,4}.*$)|(\s*[-|/]\s*\d{4}-\d{2}-\d{2}.*$)|(-\d{8}.*$)/,
    ''
  ).trim();
}

type RequestsPageProps = {
  searchParams: Promise<{
    company?: string;
    status?: string;
    type?: string;
    sortBy?: 'requestNo' | 'submitted';
    sortDir?: 'asc' | 'desc';
  }>;
};

type RequestFilterOption = {
  companyName: string;
  status: string;
  requestType: string;
  routingType: string;
};

function buildVisibilityWhere(
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>
): Prisma.RequestWhereInput {
  const canViewAll =
    hasRole(user, 'admin') ||
    hasRole(user, 'verifier') ||
    hasRole(user, 'reviewer') ||
    hasRole(user, 'working_gcpc');

  if (canViewAll) {
    return {};
  }

  if (hasRole(user, 'hoc') && user.companyId) {
    return { companyId: user.companyId };
  }

  return { requestorId: user.id };
}

export default async function RequestsPage({ searchParams }: RequestsPageProps) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect('/login?callbackUrl=/requests');
  }

  const params = await searchParams;
  const selectedCompany = params.company?.trim() ?? '';
  const selectedStatus = params.status?.trim() ?? '';
  const selectedType = params.type?.trim() ?? '';
  const sortBy = params.sortBy === 'requestNo' || params.sortBy === 'submitted' ? params.sortBy : 'submitted';
  const sortDir = params.sortDir === 'asc' || params.sortDir === 'desc' ? params.sortDir : 'desc';
  const visibilityWhere = buildVisibilityWhere(currentUser);

  let loadError = false;
  let requests: Array<{
    id: string;
    requestNo: string;
    requestType: string;
    routingType: string;
    companyName: string;
    status: string;
    submittedAt: Date | null;
    createdAt: Date;
    rtp: { projectName: string } | null;
    pbl: { project: { projectName: string } } | null;
    jvp: { project: { projectName: string } } | null;
  }> = [];

  const HIDDEN_STATUSES = ['Draft', 'Draft-Details'] as const;
  const baseWhere: Prisma.RequestWhereInput = {
    status: { notIn: [...HIDDEN_STATUSES] },
  };
  try {
    // AFTER — add baseWhere that is always applied:
    const filterWhere: Prisma.RequestWhereInput = {
      ...(selectedCompany ? { companyName: selectedCompany } : {}),
      ...(selectedStatus ? { status: selectedStatus } : {}),
      ...(selectedType
        ? { OR: [{ requestType: selectedType }, { routingType: selectedType }] }
        : {}),
    };

    const whereClause: Prisma.RequestWhereInput = {
      AND: [visibilityWhere, baseWhere, filterWhere],  // baseWhere added here
    };

    const sortOrder =
      sortBy === 'requestNo'
        ? ({ requestNo: sortDir } as const)
        : ({ submittedAt: sortDir } as const);

    requests = await prisma.request.findMany({
      where: whereClause,
      orderBy: [sortOrder, { createdAt: 'desc' }],
      select: {
        id: true,
        requestNo: true,
        requestType: true,
        routingType: true,
        companyName: true,
        status: true,
        submittedAt: true,
        createdAt: true,
        rtp: {
          select: {
            projectName: true,
          },
        },
        pbl: {
          select: {
            project: {
              select: {
                projectName: true,
              },
            },
          },
        },
        jvp: {
          select: {
            project: {
              select: {
                projectName: true,
              },
            },
          },
        },
      },
    });
  } catch {
    loadError = true;
  }
  console.log(requests)

  const filterOptions: RequestFilterOption[] = await prisma.request.findMany({
    where: visibilityWhere,
    select: {
      companyName: true,
      status: true,
      requestType: true,
      routingType: true,
    },
    distinct: ['companyName', 'status', 'requestType', 'routingType'],
  });

  const companyOptions: string[] = [...new Set(filterOptions.map((item: RequestFilterOption) => item.companyName).filter(Boolean))].sort();
  const statusOptions: string[] = [
    ...new Set(
      filterOptions
        .map((item: RequestFilterOption) => item.status)
        .filter((s): s is string => Boolean(s) && !HIDDEN_STATUSES.includes(s as typeof HIDDEN_STATUSES[number]))
    ),
  ].sort();
  const typeOptions: string[] = [
    ...new Set(
      filterOptions
        .flatMap((item: RequestFilterOption) => [item.requestType, item.routingType])
        .filter((value: string): value is string => Boolean(value))
    ),
  ].sort();

  const buildSortHref = (column: 'requestNo' | 'submitted') => {
    const isCurrentColumn = sortBy === column;
    const nextDir: 'asc' | 'desc' = isCurrentColumn ? (sortDir === 'asc' ? 'desc' : 'asc') : 'desc';
    const query = new URLSearchParams();
    if (selectedCompany) query.set('company', selectedCompany);
    if (selectedStatus) query.set('status', selectedStatus);
    if (selectedType) query.set('type', selectedType);
    query.set('sortBy', column);
    query.set('sortDir', nextDir);
    return `/requests?${query.toString()}`;
  };

  return (
    <div className="space-y-6">
      <header className="page-header sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="page-title">Review requests</h1>
          <p className="page-subtitle">
            Inspect procurement submissions, apply role-based actions, and monitor lifecycle status.
          </p>
        </div>
        <Button href="/submit" variant="primary" size="sm">
          + New Request
        </Button>
      </header>

      {loadError ? (
        <div className="alert alert--danger">
          <p className="alert__title">Unable to load requests</p>
          <p className="alert__body">Please check the database connection and try again.</p>
        </div>
      ) : null}

      <FilterBar
        companyOptions={companyOptions}
        statusOptions={statusOptions}
        typeOptions={typeOptions}
        selectedCompany={selectedCompany}
        selectedStatus={selectedStatus}
        selectedType={selectedType}
        sortBy={sortBy}
        sortDir={sortDir}
      />

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
            {requests.length > 0 ? (
              requests.map((request) => {
                const projectName =
                  request.rtp?.projectName ??
                  request.pbl?.project?.projectName ??
                  request.jvp?.project?.projectName ??
                  '—';
                const typeWithChannel = `${request.requestType} - ${request.routingType}`;

                return (
                  <tr key={request.id}>
                    <td className="font-semibold text-[var(--text)]">{cleanRequestNo(request.requestNo)}</td>
                    <td>{projectName}</td>
                    <td>{typeWithChannel}</td>
                    <td>{request.companyName}</td>
                    <td>{formatRequestDate(request.submittedAt, request.createdAt)}</td>
                    <td>
                      <span className={`badge text-sm ${STATUS_BADGE_CLASS_MAP[request.status]?? 'badge--neutral'}`}>
                        {STATUS_DISPLAY_MAP[request.status] ?? request.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Button href={`/requests/${request.id}`} variant="primary" size="sm">
                          Open
                        </Button>
                        {request.status === 'Ready for Engagement' && (
                          <Button
                            href={`/requests/${request.id}/book-engagement`}
                            variant="accent"
                            size="sm"
                          >
                            Book
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="py-10 text-center">
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
    </div>
  );
}
