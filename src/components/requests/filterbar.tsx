'use client';

import Link from 'next/link';
import { RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';

type FilterBarProps = {
  companyOptions: string[];
  projectOptions: string[];
  statusOptions: string[];
  typeOptions: string[];
  selectedCompany: string;
  selectedProject: string;
  selectedStatus: string;
  selectedType: string;
  sortBy: string;
  sortDir: string;
};

export default function FilterBar({
  companyOptions,
  projectOptions,
  statusOptions,
  typeOptions,
  selectedCompany,
  selectedProject,
  selectedStatus,
  selectedType,
  sortBy,
  sortDir,
}: FilterBarProps) {
  const router = useRouter();

  const updateFilter = (key: string, value: string) => {
    const next = {
      company: selectedCompany,
      project: selectedProject,
      status: selectedStatus,
      type: selectedType,
      sortBy,
      sortDir,
      [key]: value, // override the changed key
    };
    const params = new URLSearchParams();
    if (next.company) params.set('company', next.company);
    if (next.project) params.set('project', next.project);
    if (next.status) params.set('status', next.status);
    if (next.type) params.set('type', next.type);
    if (next.sortBy) params.set('sortBy', next.sortBy);
    if (next.sortDir) params.set('sortDir', next.sortDir);
    router.push(`/requests?${params.toString()}`);
  };

  const hasActiveFilters = Boolean(
    selectedCompany || selectedProject || selectedStatus || selectedType
  );

  return (
    <div className="surface-card p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          Project
          <select
            value={selectedProject}
            onChange={(e) => updateFilter('project', e.target.value)}
            className="input mt-1 h-9 w-full py-0 text-sm"
          >
            <option value="">All projects</option>
            {projectOptions.map((project) => (
              <option key={project} value={project}>
                {project}
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

      </div>
        <div className="flex items-end justify-center rounded-md mt-3 w-full bg-primary">
          {hasActiveFilters ? (
            <Link
              href="/requests"
              className=" inline-flex h-12 w-150 shrink-0 items-center justify-center rounded-md p-0 text-white"
              title="Reset filters"
              aria-label="Reset filters"
            > 
              <RotateCcw className="h-5 w-5 mr-2 align-center" aria-hidden /> Reset Filters
            </Link>
          ) : null}
        </div>
    </div>
  );
}