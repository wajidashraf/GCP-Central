import Button from '@/src/components/ui/button';
import prisma from '@/lib/prisma';

const STATUS_TABS = ['All', 'New', 'In Review', 'Resubmit', 'Acknowledged', 'Endorsed', 'For Record', 'NC'] as const;

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

export default async function RequestsPage() {
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
  }> = [];

  try {
    requests = await prisma.request.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        requestNo: true,
        requestType: true,
        routingType: true,
        companyName: true,
        status: true,
        submittedAt: true,
        createdAt: true,
      },
    });
  } catch {
    loadError = true;
  }

  const statusCounts = requests.reduce<Record<string, number>>((accumulator, request) => {
    accumulator[request.status] = (accumulator[request.status] ?? 0) + 1;
    return accumulator;
  }, {});

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
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab, index) => (
            <span
              key={tab}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] ${
                index === 0
                  ? 'border-[#bfdbfe] bg-[var(--brand-100)] text-[var(--brand-700)]'
                  : 'border-[var(--border)] bg-white text-[var(--text-subtle)]'
              }`}
            >
              {tab}
              <span className="ml-1 opacity-70">
                ({tab === 'All' ? requests.length : (statusCounts[tab] ?? 0)})
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="table-shell">
        <table>
          <thead>
            <tr>
              <th>Request No</th>
              <th>Type</th>
              <th>Company</th>
              <th>Submitted</th>
              <th>Status</th>
              <th>SLA</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {requests.length > 0 ? (
              requests.map((request) => (
                <tr key={request.id}>
                  <td className="font-semibold text-[var(--text)]">{request.requestNo}</td>
                  <td>{request.requestType}</td>
                  <td>{request.companyName}</td>
                  <td>{formatRequestDate(request.submittedAt, request.createdAt)}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE_CLASS_MAP[request.status] ?? 'badge--neutral'}`}>
                      {request.status}
                    </span>
                  </td>
                  <td>Pending</td>
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
              ))
            ) : (
              <tr>
                <td colSpan={7} className="py-10 text-center">
                  <p className="text-sm font-semibold text-[var(--text)]">No requests found</p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    Submitted requests will appear here once records are created.
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
