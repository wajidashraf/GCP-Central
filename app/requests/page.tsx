import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Prisma } from '@prisma/client';
import Button from '@/src/components/ui/button';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';
import { hasRole } from '@/src/lib/auth/has-role';

const STATUS_BADGE_CLASS_MAP: Record<string, string> = {
  Draft: 'badge--neutral',
  'Draft-Details': 'badge--neutral',
  New: 'badge--info',
  'In Review': 'badge--warning',
  Resubmit: 'badge--warning',
  Acknowledged: 'badge--success',
  Endorsed: 'badge--success',
  'For Record': 'badge--neutral',
  NC: 'badge--danger',
};

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
    /(\s*[-|/]\s*\d{1,2}[-/]\d{1,2}[-/]\d{2,4}.*$)|(\s*[-|/]\s*\d{4}-\d{2}-\d{2}.*$)/,
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

  try {
    const filterWhere: Prisma.RequestWhereInput = {
      ...(selectedCompany ? { companyName: selectedCompany } : {}),
      ...(selectedStatus ? { status: selectedStatus } : {}),
      ...(selectedType
        ? {
            OR: [{ requestType: selectedType }, { routingType: selectedType }],
          }
        : {}),
    };
    const whereClause: Prisma.RequestWhereInput = {
      AND: [visibilityWhere, filterWhere],
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
  const statusOptions: string[] = [...new Set(filterOptions.map((item: RequestFilterOption) => item.status).filter(Boolean))].sort();
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

      <div className="surface-card p-4">
        <form method="get" className="grid gap-3 md:grid-cols-4">
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
            Company
            <select name="company" defaultValue={selectedCompany} className="input mt-1 h-9 py-0 text-sm">
              <option value="">All companies</option>
              {companyOptions.map((company) => (
                <option key={company} value={company}>
                  {company}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
            Status
            <select name="status" defaultValue={selectedStatus} className="input mt-1 h-9 py-0 text-sm">
              <option value="">All statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
            Type of request
            <select name="type" defaultValue={selectedType} className="input mt-1 h-9 py-0 text-sm">
              <option value="">All types</option>
              {typeOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <input type="hidden" name="sortBy" value={sortBy} />
            <input type="hidden" name="sortDir" value={sortDir} />
            <button type="submit" className="btn btn--secondary btn--sm">
              Apply Filters
            </button>
            <Link href="/requests" className="btn btn--ghost btn--sm">
              Reset
            </Link>
          </div>
        </form>
      </div>

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
                      <span className={`badge ${STATUS_BADGE_CLASS_MAP[request.status] ?? 'badge--neutral'}`}>
                        {request.status}
                      </span>
                    </td>
                    <td>
                      <Button
                        href={`/requests/${request.id}`}
                        variant="secondary"
                        size="sm"
                      >
                        Open
                      </Button>
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
