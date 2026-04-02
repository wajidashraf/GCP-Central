import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

const GCPC_FORMS = [
  { code: 'RTP', label: 'Registration of Tender/Proposal' },
  { code: 'PBL', label: 'Prospective Bidders List' },
  { code: 'JVP', label: 'Joint Venture Partnership' },
  { code: 'ST/SP', label: 'Subcontracting / Special Purpose' },
  { code: 'CAA', label: 'Contract Award Acknowledgement' },
  { code: 'PCCA', label: 'Post-Contract Cost Analysis' },
  { code: 'PP', label: 'Post-Proposal' },
  { code: 'VAP', label: 'Value Added Proposal' },
  { code: 'Others', label: 'Other Procurement Matters' },
];

const GCP_FORMS = [
  { code: 'R-PCCA', label: 'Revised Post-Contract Cost Analysis' },
  { code: 'CI', label: 'Contractual Issues' },
  { code: 'CPR', label: 'Contract Progress Report' },
  { code: 'Others', label: 'Other Contract Matters' },
];

const getFormHref = (channel: 'gcpc' | 'gcp', formCode: string) =>
  `/submit/${channel}/${encodeURIComponent(formCode)}`;

export default function SubmitPage() {
  return (
    <div className="space-y-6">
      <header className="page-header">
        <h1 className="page-title">Create request</h1>
        <p className="page-subtitle">
          Start by selecting the channel and form type. Detailed forms are still under implementation.
        </p>
      </header>

      <div className="alert alert--warning">
        <p className="alert__title">Form pages are still being built</p>
        <p className="alert__body">
          You can now open each channel/form path while detailed pages are under implementation.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="surface-card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-subtle)]">
                GCPC Channel
              </p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">
                Group Contract Procurement Committee
              </h2>
            </div>
            <span className="badge badge--info">9 forms</span>
          </div>
          <ul className="space-y-2">
            {GCPC_FORMS.map((form) => (
              <li key={form.code}>
                <Link
                  href={getFormHref('gcpc', form.code)}
                  className="group flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5 transition hover:border-[var(--border-strong)] hover:bg-white"
                >
                  <span className="badge badge--brand min-w-[70px] justify-center">{form.code}</span>
                  <span className="flex-1 text-sm text-[var(--text-muted)]">{form.label}</span>
                  <span
                    aria-hidden="true"
                    className="inline-flex -translate-x-1 items-center justify-center rounded-full border border-[var(--border)] bg-white p-1 text-[var(--text-subtle)] opacity-0 transition-all duration-200 ease-out group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="surface-card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-subtle)]">
                GCP Channel
              </p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">Group Contract Procurement</h2>
            </div>
            <span className="badge badge--info">4 forms</span>
          </div>
          <ul className="space-y-2">
            {GCP_FORMS.map((form) => (
              <li key={form.code}>
                <Link
                  href={getFormHref('gcp', form.code)}
                  className="group flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5 transition hover:border-[var(--border-strong)] hover:bg-white"
                >
                  <span className="badge badge--brand min-w-[70px] justify-center">{form.code}</span>
                  <span className="flex-1 text-sm text-[var(--text-muted)]">{form.label}</span>
                  <span
                    aria-hidden="true"
                    className="inline-flex -translate-x-1 items-center justify-center rounded-full border border-[var(--border)] bg-white p-1 text-[var(--text-subtle)] opacity-0 transition-all duration-200 ease-out group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
