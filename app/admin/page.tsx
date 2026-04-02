import Link from 'next/link';

const ADMIN_SECTIONS = [
  {
    title: 'Role Management',
    description: 'Assign and update user roles across requestor, verifier, reviewer, committee, and admin access.',
    sprint: 'Sprint 3 · FR17',
    href: '/admin/roles',
  },
  {
    title: 'SLA Configuration',
    description: 'Configure threshold timing by workflow stage and define breach conditions.',
    sprint: 'Sprint 3 · FR19',
    href: '/admin/sla',
  },
  {
    title: 'Company Inventory',
    description: 'Maintain company records, sector mapping, and operational metadata.',
    sprint: 'Sprint 1 · Existing',
    href: '/admin/companies',
  },
  {
    title: 'Export Reports',
    description: 'Prepare printable and shareable summary reports in PDF/Excel formats.',
    sprint: 'Sprint 3 · FR20',
    href: '/admin/reports',
  },
];

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <header className="page-header">
        <h1 className="page-title">Admin panel</h1>
        <p className="page-subtitle">
          Central controls for governance policies, workflow thresholds, and system configuration.
        </p>
      </header>

      <div className="alert alert--warning">
        <p className="alert__title">Admin modules are scaffolded</p>
        <p className="alert__body">
          Functional wiring for role updates, SLA controls, and reporting is planned in Sprint 3.
        </p>
      </div>

      <section className="grid gap-5 md:grid-cols-2">
        {ADMIN_SECTIONS.map((section) => (
          <article key={section.title} className="surface-card p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--text)]">{section.title}</h2>
              <span className="badge badge--neutral">{section.sprint}</span>
            </div>
            <p className="text-sm text-[var(--text-muted)]">{section.description}</p>
            <div className="mt-4">
              <Link href={section.href} className="btn btn--secondary btn--sm">
                Open Section
              </Link>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
