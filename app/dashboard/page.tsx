import Button from '@/src/components/ui/button';

const DASHBOARD_STATS = [
  { label: 'Total Requests', value: '—', note: 'Awaiting live data' },
  { label: 'Pending Review', value: '—', note: 'Awaiting live data' },
  { label: 'SLA Breaches', value: '—', note: 'Awaiting live data' },
  { label: 'Closed This Month', value: '—', note: 'Awaiting live data' },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <header className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          Operational overview for procurement activity, review queue health, and SLA trend visibility.
        </p>
      </header>

      <div className="alert alert--info">
        <p className="alert__title">Dashboard data binding pending</p>
        <p className="alert__body">
          This layout is ready for Prisma-based aggregates and visualizations scheduled for Sprint 3.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {DASHBOARD_STATS.map((item) => (
          <article key={item.label} className="surface-card p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.09em] text-[var(--text-subtle)]">
              {item.label}
            </p>
            <p className="mt-2 text-3xl font-semibold leading-none text-[var(--text)]">{item.value}</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">{item.note}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="surface-card p-5">
          <h2 className="text-lg font-semibold text-[var(--text)]">Quick actions</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Jump into frequent procurement operations.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button href="/submit" variant="primary" size="sm">
              New Request
            </Button>
            <Button href="/requests" variant="secondary" size="sm">
              Review Queue
            </Button>
          </div>
        </article>

        <article className="surface-card p-5">
          <h2 className="text-lg font-semibold text-[var(--text)]">Recent activity</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Timeline will appear here once request creation and role actions are connected.
          </p>
          <div className="mt-4 rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)] p-6 text-sm text-[var(--text-subtle)]">
            No activity to display yet.
          </div>
        </article>
      </section>
    </div>
  );
}
