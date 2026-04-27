import { ReactNode } from 'react';

/**
 * Section Title Component
 * Used as a section header with branded styling
 */
export function SectionTitle({ title }: { title: string }) {
  return (
    <div className="rounded-md bg-[var(--brand-100)] px-3 py-2 text-sm font-semibold text-[var(--brand-700)]">
      {title}
    </div>
  );
}

/**
 * Detail Item Component
 * Used to display label-value pairs in grid layouts
 */
export function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-3">
      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{label}</dt>
      <dd className="mt-1 text-sm text-[var(--text)]">{value ?? '—'}</dd>
    </div>
  );
}

/**
 * Format DateTime Helper
 * Formats dates in GB locale format
 */
export function formatDateTime(value: Date | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

/**
 * Stringify JSON Helper
 * Safely converts values to formatted JSON string
 */
export function stringifyJson(value: unknown) {
  if (!value) return '—';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * Status Badge Class Map
 * Maps request status to badge CSS classes
 */
export const STATUS_BADGE_CLASS_MAP: Record<string, string> = {
  Draft: 'badge--neutral',
  'Draft-Details': 'badge--neutral',
  New: 'badge--info',
  'In Review': 'badge--warning',
  'Draft Review': 'badge--warning',
  'Pending Review': 'badge--warning',
  'Complete Review': 'badge--success',
  'Pending Acceptance': 'badge--info',
  Resubmit: 'badge--warning',
  Acknowledged: 'badge--success',
  Endorsed: 'badge--success',
  'For Record': 'badge--neutral',
  NC: 'badge--danger',
};
