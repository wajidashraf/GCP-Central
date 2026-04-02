import Link from 'next/link';

const GCPC_FORMS = ['RTP', 'PBL', 'JVP', 'ST/SP', 'CAA', 'PCCA', 'PP', 'VAP', 'Others'];
const GCP_FORMS = ['R-PCCA', 'CI', 'CPR', 'Others'];

export default function AppFooter() {
  return (
    <footer className="mt-10 border-t border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-8 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div className="sm:col-span-2">
          <div className="mb-3 flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand-600)] text-xs font-bold text-white">
              GC
            </span>
            <span className="text-sm font-semibold text-[var(--text)]">GCP Central</span>
          </div>
          <p className="max-w-md text-sm text-[var(--text-muted)]">
            Centralized procurement workspace for GCP and GCPC teams with better clarity on request
            submission, review, and governance workflows.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/" className="badge badge--neutral">
              Home
            </Link>
            <Link href="/submit" className="badge badge--neutral">
              Submit
            </Link>
            <Link href="/requests" className="badge badge--neutral">
              Requests
            </Link>
            <Link href="/dashboard" className="badge badge--neutral">
              Dashboard
            </Link>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-subtle)]">
            GCPC Forms
          </h3>
          <ul className="space-y-1.5 text-sm text-[var(--text-muted)]">
            {GCPC_FORMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-subtle)]">
            GCP Forms
          </h3>
          <ul className="space-y-1.5 text-sm text-[var(--text-muted)]">
            {GCP_FORMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-[var(--border)]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-3 text-xs text-[var(--text-subtle)] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} GCP Central. All rights reserved.</p>
          <span className="badge badge--info">Light theme refresh</span>
        </div>
      </div>
    </footer>
  );
}
