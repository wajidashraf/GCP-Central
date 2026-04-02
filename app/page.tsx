import Button from '@/src/components/ui/button';
import { StepsIllustration } from '@/src/components/illustrations/stepIllustration';
import { ArrowRight, BarChart3, CheckCircle2, ShieldCheck } from 'lucide-react';

const METRICS = [
  { value: '13', label: 'Request forms', icon: <BarChart3 className="h-5 w-5 text-blue-600" /> },
  { value: '7', label: 'User Roles', icon: <ShieldCheck className="h-5 w-5 text-indigo-600" /> },
  { value: '99%', label: 'Uptime SLA', icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" /> },
];

const LIFECYCLE_STATUSES = [
  { code: 'ACK', label: 'Acknowledged', tone: 'success' as const },
  { code: 'E', label: 'Endorsed', tone: 'info' as const },
  { code: 'RS', label: 'Resubmission', tone: 'warning' as const },
  { code: 'NC', label: 'Non-Compliant', tone: 'danger' as const },
  { code: 'FR', label: 'For Record', tone: 'neutral' as const },
];

const STATUS_CLASS_MAP: Record<string, string> = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-rose-50 text-rose-700 border-rose-200',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
};

export default function HomePage() {
  return (
    <div className="space-y-6">
      <section className="surface-card relative overflow-hidden px-6 pb-14 pt-12 lg:px-10 lg:pb-16 lg:pt-14">
        <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[520px] w-full -translate-x-1/2 [background:radial-gradient(60%_50%_at_50%_0%,rgba(37,99,235,0.12)_0%,rgba(37,99,235,0.03)_45%,transparent_100%)]" />
        <div className="pointer-events-none absolute -left-8 bottom-8 -z-10 h-56 w-56 rounded-full bg-sky-300/20 blur-[100px]" />
        <div className="pointer-events-none absolute -right-10 top-10 -z-10 h-64 w-64 rounded-full bg-blue-300/20 blur-[100px]" />

        <div className="mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/90 px-4 py-1.5 text-sm font-medium text-[var(--brand-700)] shadow-[var(--shadow-soft)]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brand-500)] opacity-60"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--brand-600)]"></span>
            </span>
            GROUP CONTRACT PROCUREMENT
          </div>

          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-[var(--text)] sm:text-6xl lg:text-7xl">
            Procurement, <br />
            <span className="bg-gradient-to-r from-blue-700 via-indigo-600 to-sky-500 bg-clip-text text-transparent">
              Governed with Precision.
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-[var(--text-muted)]">
            A unified digital platform for end-to-end contract procurement review—structured,
            trackable, and compliant.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button href="/submit" variant="primary" size="lg" className="group h-14 px-8 text-lg shadow-[var(--shadow-mid)]">
              Create Request
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button href="/requests" variant="secondary" size="lg" className="h-14 bg-white/95 px-8 text-lg">
              Review Requests
            </Button>
          </div>

          <div className="mx-auto mt-10 max-w-md rounded-2xl border border-[var(--border)] bg-white/85 p-4 shadow-[var(--shadow-soft)] [--accent:#0ea5e9] [--accent-light:#e0f2fe] [--primary:#1d4ed8] [--primary-light:#dbeafe] [--secondary:#0284c7] [--secondary-light:#e0f2fe]">
            <StepsIllustration className="mx-auto w-48 sm:w-52" />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {METRICS.map((metric) => (
          <div key={metric.label} className="surface-card flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--surface-muted)]">
              {metric.icon}
            </div>
            <div>
              <p className="text-3xl font-bold text-[var(--text)]">{metric.value}</p>
              <p className="text-sm font-medium uppercase tracking-wider text-[var(--text-subtle)]">
                {metric.label}
              </p>
            </div>
          </div>
        ))}
      </section>

      <section className="surface-card p-6">
        <h2 className="text-lg font-semibold text-[var(--text)]">Lifecycle statuses</h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Common request outcomes visible across the workflow.
        </p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          {LIFECYCLE_STATUSES.map((status) => (
            <div
              key={status.code}
              className={`flex items-center gap-2 rounded-full border px-4 py-1 text-xs font-semibold uppercase tracking-tight ${STATUS_CLASS_MAP[status.tone]}`}
            >
              <span className="opacity-70">{status.code}</span>
              <span className="h-1 w-1 rounded-full bg-current opacity-50" />
              {status.label}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
