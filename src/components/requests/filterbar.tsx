'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

type FilterBarProps = {
  companyOptions: string[];
  statusOptions: string[];
  typeOptions: string[];
  selectedCompany: string;
  selectedStatus: string;
  selectedType: string;
  sortBy: string;
  sortDir: string;
};

export default function FilterBar({
  companyOptions,
  statusOptions,
  typeOptions,
  selectedCompany,
  selectedStatus,
  selectedType,
  sortBy,
  sortDir,
}: FilterBarProps) {
  const router = useRouter();

  const updateFilter = (key: string, value: string) => {
    const next = {
      company: selectedCompany,
      status: selectedStatus,
      type: selectedType,
      sortBy,
      sortDir,
      [key]: value, // override the changed key
    };
    const params = new URLSearchParams();
    if (next.company) params.set('company', next.company);
    if (next.status) params.set('status', next.status);
    if (next.type) params.set('type', next.type);
    if (next.sortBy) params.set('sortBy', next.sortBy);
    if (next.sortDir) params.set('sortDir', next.sortDir);
    router.push(`/requests?${params.toString()}`);
  };

  const hasActiveFilters = Boolean(selectedCompany || selectedStatus || selectedType);

  return (
    <div className="surface-card p-4">
      <div className="grid gap-3 md:grid-cols-4">
        <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
          Company
          <select
            value={selectedCompany}
            onChange={(e) => updateFilter('company', e.target.value)}
            className="input mt-1 h-9 py-0 text-sm"
          >
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
          <select
            value={selectedStatus}
            onChange={(e) => updateFilter('status', e.target.value)}
            className="input mt-1 h-9 py-0 text-sm"
          >
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
          <select
            value={selectedType}
            onChange={(e) => updateFilter('type', e.target.value)}
            className="input mt-1 h-9 py-0 text-sm"
          >
            <option value="">All types</option>
            {typeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end justify-end">
          {hasActiveFilters && (
           <Link
           href="/requests"
           className="inline-flex items-center gap-1.5 h-9 px-3 badge badge--warning"
         >
              {/* ✕ icon — no extra dependency needed */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Reset filters
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}