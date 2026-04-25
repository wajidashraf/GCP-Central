import type { ReactNode } from 'react';
import Button from '@/src/components/ui/button';
import RequestActionsSection from '@/src/components/sections/request-actions-section';
import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';

// ─── Constants ────────────────────────────────────────────────────────────────

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

// ─── Types ────────────────────────────────────────────────────────────────────

type DocumentItem = {
  label: string;
  url: string;
  fileName?: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(value: Date | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

function stringifyJson(value: unknown) {
  if (!value) return '—';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

// ─── File Type Detection ──────────────────────────────────────────────────────

type FileType = 'xlsx' | 'pdf' | 'docx' | 'image' | 'other';

function getFileType(fileName?: string | null): FileType {
  if (!fileName) return 'other';
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') return 'xlsx';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx' || ext === 'doc') return 'docx';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext ?? '')) return 'image';
  return 'other';
}

// ─── File Icons ───────────────────────────────────────────────────────────────

function ExcelIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-16 w-16">
      <rect width="64" height="64" rx="10" fill="#E8F5E9" />
      <rect x="8" y="8" width="48" height="48" rx="7" fill="#ffffff" stroke="#c8e6c9" strokeWidth="1.5" />
      {/* Green sidebar */}
      <rect x="8" y="8" width="22" height="48" rx="7" fill="#1D6F42" />
      <rect x="18" y="8" width="12" height="48" fill="#1D6F42" />
      <text x="12" y="36" fontSize="14" fontWeight="800" fill="white" fontFamily="sans-serif">X</text>
      {/* Grid lines */}
      <line x1="30" y1="22" x2="56" y2="22" stroke="#b2dfdb" strokeWidth="1.5" />
      <line x1="30" y1="32" x2="56" y2="32" stroke="#b2dfdb" strokeWidth="1.5" />
      <line x1="30" y1="42" x2="56" y2="42" stroke="#b2dfdb" strokeWidth="1.5" />
      {/* Cells */}
      <rect x="32" y="24" width="9" height="7" rx="1" fill="#c8e6c9" />
      <rect x="44" y="24" width="9" height="7" rx="1" fill="#a5d6a7" />
      <rect x="32" y="34" width="9" height="7" rx="1" fill="#a5d6a7" />
      <rect x="44" y="34" width="9" height="7" rx="1" fill="#c8e6c9" />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-16 w-16">
      <rect width="64" height="64" rx="10" fill="#FEE2E2" />
      <rect x="8" y="8" width="48" height="48" rx="7" fill="#ffffff" stroke="#fecaca" strokeWidth="1.5" />
      <path d="M16 14 H37 L50 27 V50 H16 Z" fill="#EF4444" />
      <path d="M37 14 L37 27 L50 27 Z" fill="#B91C1C" />
      <text x="20" y="43" fontSize="11" fontWeight="800" fill="white" fontFamily="sans-serif">PDF</text>
    </svg>
  );
}

function WordIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-16 w-16">
      <rect width="64" height="64" rx="10" fill="#DBEAFE" />
      <rect x="8" y="8" width="48" height="48" rx="7" fill="#ffffff" stroke="#bfdbfe" strokeWidth="1.5" />
      {/* Blue sidebar */}
      <rect x="8" y="8" width="22" height="48" rx="7" fill="#1D4ED8" />
      <rect x="18" y="8" width="12" height="48" fill="#1D4ED8" />
      <text x="11" y="36" fontSize="13" fontWeight="800" fill="white" fontFamily="sans-serif">W</text>
      {/* Document lines */}
      <line x1="30" y1="22" x2="56" y2="22" stroke="#bfdbfe" strokeWidth="1.5" />
      <line x1="30" y1="29" x2="56" y2="29" stroke="#bfdbfe" strokeWidth="1.5" />
      <line x1="30" y1="36" x2="52" y2="36" stroke="#bfdbfe" strokeWidth="1.5" />
      <line x1="30" y1="43" x2="50" y2="43" stroke="#bfdbfe" strokeWidth="1.5" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-16 w-16">
      <rect width="64" height="64" rx="10" fill="#FDF4FF" />
      <rect x="8" y="8" width="48" height="48" rx="7" fill="#ffffff" stroke="#e9d5ff" strokeWidth="1.5" />
      <rect x="14" y="14" width="36" height="36" rx="4" fill="#A855F7" />
      {/* Mountain scene */}
      <path d="M14 38 L26 24 L34 32 L40 26 L50 38 Z" fill="#7C3AED" />
      {/* Sun */}
      <circle cx="42" cy="22" r="5" fill="#FDE68A" />
    </svg>
  );
}

function GenericFileIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-16 w-16">
      <rect width="64" height="64" rx="10" fill="#F3F4F6" />
      <rect x="8" y="8" width="48" height="48" rx="7" fill="#ffffff" stroke="#e5e7eb" strokeWidth="1.5" />
      <path d="M18 14 H37 L46 23 V50 H18 Z" fill="#6B7280" />
      <path d="M37 14 L37 23 L46 23 Z" fill="#4B5563" />
      <line x1="24" y1="32" x2="40" y2="32" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <line x1="24" y1="38" x2="40" y2="38" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <line x1="24" y1="44" x2="34" y2="44" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ─── Badge Styles ─────────────────────────────────────────────────────────────

const FILE_BADGE_STYLES: Record<FileType, string> = {
  xlsx:  'bg-emerald-100 text-emerald-800',
  pdf:   'bg-red-100    text-red-800',
  docx:  'bg-blue-100   text-blue-800',
  image: 'bg-purple-100 text-purple-800',
  other: 'bg-gray-100   text-gray-600',
};

const FILE_BADGE_LABEL: Record<FileType, string> = {
  xlsx:  'xlsx',
  pdf:   'pdf',
  docx:  'docx',
  image: 'image',
  other: 'file',
};

// ─── Document Card ────────────────────────────────────────────────────────────

function DocumentCard({ doc }: { doc: DocumentItem }) {
  const fileType = getFileType(doc.fileName);
  const displayName = doc.fileName ?? 'Download document';

  const iconMap: Record<FileType, ReactNode> = {
    xlsx:  <ExcelIcon />,
    pdf:   <PdfIcon />,
    docx:  <WordIcon />,
    image: <ImageIcon />,
    other: <GenericFileIcon />,
  };

  return (
    <a
      href={doc.url}
      download
      target="_blank"
      rel="noopener noreferrer"
      title={`Download ${displayName}`}
      className="group flex min-w-[100px] cursor-pointer flex-col items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface,#f8fafc)] px-3 py-2 no-underline transition-all duration-150 hover:-translate-y-0.5 hover:border-[var(--brand-600)] hover:bg-[var(--brand-50,#eef2ff)] hover:shadow-[0_4px_16px_rgba(59,91,219,0.12)]"
    >
      {iconMap[fileType]}

      {/* File type badge */}
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${FILE_BADGE_STYLES[fileType]}`}
      >
        {FILE_BADGE_LABEL[fileType]}
      </span>

      {/* File name */}
      <span className="max-w-[120px] break-words text-center text-xs font-medium text-[var(--text)] transition-colors group-hover:text-[var(--brand-600)]">
        {displayName}
      </span>
    </a>
  );
}

// ─── Documents Section ────────────────────────────────────────────────────────

function DocumentCards({ documents }: { documents: DocumentItem[] }) {
  if (documents.length === 0) {
    return (
      <p className="text-sm text-[var(--text-muted)]">No documents attached to this request.</p>
    );
  }

  return (
    <div className="flex flex-wrap gap-4 mt-2">
      {documents.map((doc) => (
        <DocumentCard key={`${doc.label}-${doc.url}`} doc={doc} />
      ))}
    </div>
  );
}

// ─── Page Shared Components ───────────────────────────────────────────────────

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="rounded-md bg-[var(--brand-100)] px-3 py-2 text-sm font-semibold text-[var(--brand-700)]">
      {title}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="mt-2">
      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{label}</dt>
      <dd className="rounded-lg border border-[var(--border)] bg-white p-3 mt-1 text-sm text-[var(--text)]">{value ?? '—'}</dd>
    </div>
  );
}

// ─── Page Props ───────────────────────────────────────────────────────────────

type RequestDetailPageProps = {
  params: Promise<{ id: string }>;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function RequestDetailPage({ params }: RequestDetailPageProps) {
  const { id } = await params;
  const currentUser = await getCurrentUser();

  const request = await prisma.request.findUnique({
    where: { id },
    include: {
      company: {
        select: {
          companyName: true,
          companyCode: true,
          sector: true,
        },
      },
      rtp: true,
      pbl: {
        include: {
          bidders: true,
          project: {
            select: {
              projectName: true,
              projectCode: true,
            },
          },
        },
      },
      jvp: {
        include: {
          project: {
            select: {
              projectName: true,
              projectCode: true,
            },
          },
        },
      },
      verifierComment: true,
      reviewerSuggestions: {
        orderBy: { createdAt: 'desc' },
      },
      engagements: {
        include: {
          slot: true,
        },
      },
    },
  });

  if (!request) {
    notFound();
  }

  // ── Build documents list ──────────────────────────────────────────────────
  const documents: DocumentItem[] = [];

  if (request.rtp?.documentUrl) {
    documents.push({
      label: 'RTP Document',
      url: request.rtp.documentUrl,
      fileName: request.rtp.documentFileName,
    });
  }
  if (request.pbl?.documentUrl) {
    documents.push({
      label: 'PBL Document',
      url: request.pbl.documentUrl,
      fileName: request.pbl.documentFileName,
    });
  }
  if (request.jvp?.documentUrl) {
    documents.push({
      label: 'JVP Main Document',
      url: request.jvp.documentUrl,
      fileName: request.jvp.documentFileName,
    });
  }
  if (request.jvp?.cashflowForecastUrl) {
    documents.push({
      label: 'JVP Cashflow Forecast',
      url: request.jvp.cashflowForecastUrl,
      fileName: request.jvp.cashflowForecastFileName,
    });
  }
  if (request.jvp?.costStructureUrl) {
    documents.push({
      label: 'JVP Cost Structure',
      url: request.jvp.costStructureUrl,
      fileName: request.jvp.costStructureFileName,
    });
  }

  // ── Derived flags ─────────────────────────────────────────────────────────
  const hasEngagementSlots   = (await prisma.engagementSlot.count()) > 0;
  const hasBookedEngagement  = request.engagements.length > 0;

  // ── Serialise dates for client components ─────────────────────────────────
  const verifierCommentData = request.verifierComment
    ? { ...request.verifierComment, createdAt: request.verifierComment.createdAt.toISOString() }
    : null;

  const reviewerSuggestionsData = request.reviewerSuggestions.map(
    (s: typeof request.reviewerSuggestions[number]) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
    }),
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <header className="page-header sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="page-title">Request details</h1>
          <p className="page-subtitle">
            {request.requestNo} · {request.requestType} · {request.routingType}
          </p>
        </div>
        <Button href="/requests" variant="secondary" size="sm">
          Back to requests
        </Button>
      </header>

      {/* ── Main card ── */}
      <section className="surface-card p-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--text)]">Request profile</h2>
          <span className={`badge ${STATUS_BADGE_CLASS_MAP[request.status] ?? 'badge--neutral'}`}>
            {request.status}
          </span>
        </div>

        <div className="space-y-5">

          {/* ── Documents ── */}
          <div>
            <SectionTitle title="Documents" />
              <DocumentCards documents={documents} />
          </div>

          {/* ── General Information ── */}
          <div>
            <SectionTitle title="General Information" />
            <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <DetailItem label="Request No"       value={request.requestNo} />
              <DetailItem label="Request Type"     value={request.requestType} />
              <DetailItem label="Routing Type"     value={request.routingType} />
              <DetailItem label="Request Title"    value={request.requestTitle} />
              <DetailItem label="Category"         value={request.category} />
              <DetailItem label="Acknowledgement"  value={request.acknowledgement ? 'Yes' : 'No'} />
              <DetailItem label="Requestor Name"   value={request.requestorName} />
              <DetailItem label="Requestor Email"  value={request.requestorEmail} />
              <DetailItem label="Company"          value={`${request.companyName} (${request.companyCode})`} />
              <DetailItem label="Submitted At"     value={formatDateTime(request.submittedAt)} />
              <DetailItem label="Created At"       value={formatDateTime(request.createdAt)} />
              <DetailItem label="Updated At"       value={formatDateTime(request.updatedAt)} />
            </dl>
          </div>

          {/* ── RTP Details ── */}
          {request.rtp ? (
            <div>
              <SectionTitle title="RTP Details" />
              <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <DetailItem label="Client Name"        value={request.rtp.clientName} />
                <DetailItem label="Registration Type"  value={request.rtp.registrationType} />
                <DetailItem label="Project Name"       value={request.rtp.projectName} />
                <DetailItem label="Tender Closing Date" value={formatDateTime(request.rtp.tenderClosingDate)} />
                <DetailItem label="Special Project"    value={request.rtp.specialProject ? 'Yes' : 'No'} />
              </dl>
              <div className="mt-2">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  Project Description
                </p>
                <p className="rounded-lg border border-[var(--border)] bg-white p-3 mt-1 whitespace-pre-wrap text-sm text-[var(--text)]">
                  {request.rtp.projectDescription}
                </p>
              </div>
            </div>
          ) : null}

          {/* ── PBL Details ── */}
          {request.pbl ? (
            <div>
              <SectionTitle title="PBL Details" />
              <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <DetailItem
                  label="Project"
                  value={
                    request.pbl.project.projectCode
                      ? `${request.pbl.project.projectName} (${request.pbl.project.projectCode})`
                      : request.pbl.project.projectName
                  }
                />
                <DetailItem label="Project Code"        value={request.pbl.projectCode || '—'} />
                <DetailItem label="Procurement Method"  value={request.pbl.procurementMethod} />
              </dl>
              <div className="mt-3 rounded-lg border border-[var(--border)] bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  Justification For Less Bidders
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text)]">
                  {request.pbl.justificationForLessBidders || '—'}
                </p>
              </div>
              <div className="mt-3">
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  Bidders
                </h3>
                {request.pbl.bidders.length > 0 ? (
                  <div className="table-shell">
                    <table>
                      <thead>
                        <tr>
                          <th>Company</th>
                          <th>Person In Charge</th>
                          <th>Contact</th>
                          <th>Source</th>
                          <th>Recommendation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {request.pbl.bidders.map((bidder: typeof request.pbl.bidders[number]) => (
                          <tr key={bidder.id}>
                            <td>{bidder.companyName}</td>
                            <td>{bidder.personInCharge}</td>
                            <td>{bidder.picContactNumber}</td>
                            <td>{bidder.sourcesFrom}</td>
                            <td>{bidder.recommendationBy}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--text-muted)]">No bidder records found.</p>
                )}
              </div>
            </div>
          ) : null}

          {/* ── JVP Details ── */}
          {request.jvp ? (
            <div>
              <SectionTitle title="JVP Details" />
              <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <DetailItem
                  label="Project"
                  value={
                    request.jvp.project.projectCode
                      ? `${request.jvp.project.projectName} (${request.jvp.project.projectCode})`
                      : request.jvp.project.projectName
                  }
                />
                <DetailItem label="Project Code"              value={request.jvp.projectCode || '—'} />
                <DetailItem label="Team Leader"               value={request.jvp.teamLeader || '—'} />
                <DetailItem label="Financial Matters PIC"     value={request.jvp.financialMatters || '—'} />
                <DetailItem label="Technical Matters PIC"     value={request.jvp.technicalMatters || '—'} />
                <DetailItem label="Contract Matters PIC"      value={request.jvp.contractMatters || '—'} />
                <DetailItem label="Procurement Matters PIC"   value={request.jvp.procurementMatters || '—'} />
                <DetailItem label="Costing & Estimation PIC"  value={request.jvp.costingAndEstimationMatters || '—'} />
                <DetailItem label="Implementation Stage"      value={request.jvp.implementationStage || '—'} />
              </dl>
              <div className="mt-3 space-y-3">
                <div className="rounded-lg border border-[var(--border)] bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    Background of Collaboration
                  </p>
                  <pre className="mt-1 overflow-x-auto text-xs text-[var(--text)]">
                    {stringifyJson(request.jvp.backgroundOfCollabPoints)}
                  </pre>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    Scope of Collaboration
                  </p>
                  <pre className="mt-1 overflow-x-auto text-xs text-[var(--text)]">
                    {stringifyJson(request.jvp.scopeOfCollabPoints)}
                  </pre>
                </div>
              </div>
            </div>
          ) : null}

        </div>
      </section>

      {/* ── Actions section ── */}
      <section className="space-y-4">
        <RequestActionsSection
          requestId={request.id}
          status={request.status}
          userRole={currentUser?.role}
          userRoles={currentUser?.roles}
          verifierComment={verifierCommentData}
          reviewerSuggestions={reviewerSuggestionsData}
          hasEngagementSlots={hasEngagementSlots}
          hasBookedEngagement={hasBookedEngagement}
        />
      </section>

    </div>
  );
}