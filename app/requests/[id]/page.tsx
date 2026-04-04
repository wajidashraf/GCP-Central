import type { ReactNode } from 'react';
import Button from '@/src/components/ui/button';
import RequestActionsSection from '@/src/components/sections/request-actions-section';
import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';

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

type DocumentItem = {
  label: string;
  url: string;
  fileName?: string | null;
};

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

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="rounded-md bg-[var(--brand-100)] px-3 py-2 text-sm font-semibold text-[var(--brand-700)]">
      {title}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-3">
      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{label}</dt>
      <dd className="mt-1 text-sm text-[var(--text)]">{value ?? '—'}</dd>
    </div>
  );
}

type RequestDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

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

  const hasEngagementSlots = (await prisma.engagementSlot.count()) > 0;
  const hasBookedEngagement = request.engagements.length > 0;

  // Convert dates to serializable format
  const verifierCommentData = request.verifierComment ? {
    ...request.verifierComment,
    createdAt: request.verifierComment.createdAt.toISOString(),
  } : null;

  const reviewerSuggestionsData = request.reviewerSuggestions.map(
    (suggestion: typeof request.reviewerSuggestions[number]) => ({
    ...suggestion,
    createdAt: suggestion.createdAt.toISOString(),
    })
  );

  return (
    <div className="space-y-6">
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

      <section className="surface-card p-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--text)]">Request profile</h2>
          <span className={`badge ${STATUS_BADGE_CLASS_MAP[request.status] ?? 'badge--neutral'}`}>
            {request.status}
          </span>
        </div>

        <div className="space-y-5">
          <div>
            <SectionTitle title="Documents" />
            <div className="mt-3 rounded-lg border border-[var(--border)] bg-white p-3">
              {documents.length > 0 ? (
                <ul className="space-y-2">
                  {documents.map((doc) => (
                    <li key={`${doc.label}-${doc.url}`} className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-[var(--text)]">{doc.label}:</span>
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[var(--brand-600)] underline"
                      >
                        {doc.fileName ?? 'Download document'}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[var(--text-muted)]">No documents attached to this request.</p>
              )}
            </div>
          </div>

          <div>
            <SectionTitle title="General Information" />
            <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <DetailItem label="Request No" value={request.requestNo} />
              <DetailItem label="Request Type" value={request.requestType} />
              <DetailItem label="Routing Type" value={request.routingType} />
              <DetailItem label="Request Title" value={request.requestTitle} />
              <DetailItem label="Category" value={request.category} />
              <DetailItem label="Acknowledgement" value={request.acknowledgement ? 'Yes' : 'No'} />
              <DetailItem label="Requestor Name" value={request.requestorName} />
              <DetailItem label="Requestor Email" value={request.requestorEmail} />
              <DetailItem label="Company" value={`${request.companyName} (${request.companyCode})`} />
              <DetailItem label="Submitted At" value={formatDateTime(request.submittedAt)} />
              <DetailItem label="Created At" value={formatDateTime(request.createdAt)} />
              <DetailItem label="Updated At" value={formatDateTime(request.updatedAt)} />
            </dl>
          </div>

          {request.rtp ? (
            <div>
              <SectionTitle title="RTP Details" />
              <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <DetailItem label="Client Name" value={request.rtp.clientName} />
                <DetailItem label="Registration Type" value={request.rtp.registrationType} />
                <DetailItem label="Project Name" value={request.rtp.projectName} />
                <DetailItem label="Tender Closing Date" value={formatDateTime(request.rtp.tenderClosingDate)} />
                <DetailItem label="Special Project" value={request.rtp.specialProject ? 'Yes' : 'No'} />
              </dl>
              <div className="mt-3 rounded-lg border border-[var(--border)] bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  Project Description
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text)]">{request.rtp.projectDescription}</p>
              </div>
            </div>
          ) : null}

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
                <DetailItem label="Project Code" value={request.pbl.projectCode || '—'} />
                <DetailItem label="Procurement Method" value={request.pbl.procurementMethod} />
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
                <DetailItem label="Project Code" value={request.jvp.projectCode || '—'} />
                <DetailItem label="Team Leader" value={request.jvp.teamLeader || '—'} />
                <DetailItem label="Financial Matters PIC" value={request.jvp.financialMatters || '—'} />
                <DetailItem label="Technical Matters PIC" value={request.jvp.technicalMatters || '—'} />
                <DetailItem label="Contract Matters PIC" value={request.jvp.contractMatters || '—'} />
                <DetailItem label="Procurement Matters PIC" value={request.jvp.procurementMatters || '—'} />
                <DetailItem label="Costing & Estimation PIC" value={request.jvp.costingAndEstimationMatters || '—'} />
                <DetailItem label="Implementation Stage" value={request.jvp.implementationStage || '—'} />
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
