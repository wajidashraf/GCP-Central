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
  console.log('value', value);
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
const BASE_BADGE_STYLE = 'rounded-[6px] bg-gray-700 text-white px-3 py-2';
export const STATUS_BADGE_CLASS_MAP: Record<string, string> = {
  Draft: BASE_BADGE_STYLE,
  'Draft-Details': BASE_BADGE_STYLE,
  'Ready for Engagement': BASE_BADGE_STYLE,
  R: BASE_BADGE_STYLE,
  New: BASE_BADGE_STYLE,
  FR: BASE_BADGE_STYLE,
  RS: BASE_BADGE_STYLE,
  'In Review': BASE_BADGE_STYLE,
  'Draft Review': BASE_BADGE_STYLE,
  'Pending Review': BASE_BADGE_STYLE,
  'Complete Review': BASE_BADGE_STYLE,
  'Pending Acceptance': BASE_BADGE_STYLE,
  'Pending Endorse': BASE_BADGE_STYLE,
  'Pending Ack': BASE_BADGE_STYLE,
  Resubmit: BASE_BADGE_STYLE,
  Acknowledged: BASE_BADGE_STYLE,
  Endorsed: BASE_BADGE_STYLE,
  E: BASE_BADGE_STYLE,
  NC: BASE_BADGE_STYLE,
};
