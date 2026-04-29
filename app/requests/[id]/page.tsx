import Button from '@/src/components/ui/button';
import RequestActionsSection from '@/src/components/sections/request-actions-section';
import GeneralReviewSectionClient from '@/src/components/sections/general-review-section-client';
import RequestSignatureSection from '@/src/components/sections/request-signature-section';
import { DocumentCards, DocumentItem } from '@/src/components/sections/document-card';
import {
  SectionTitle,
  DetailItem,
  formatDateTime,
  STATUS_BADGE_CLASS_MAP,
} from '@/src/components/sections/request-form-shared';
import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';
import { REQUEST_STATUS_MAP } from '@/src/constants/enums/requestStatus';
import { ensureCompleteReviewFromSignatures } from '@/src/lib/requests/ensure-complete-review-from-signatures';
import { REGISTRATION_TYPES } from '@/src/constants/enums/procurement';
import { PROCUREMENT_METHODS } from '@/src/constants/enums/procurement';
import ImagePreviewTrigger from '@/src/components/sections/image-preview-trigger';

// ─── Types ────────────────────────────────────────────────────────────────────

type RequestDetailPageProps = {
  params: Promise<{ id: string }>;
};

function verifierDecisionCodePrefill(
  relationCode: string | null | undefined,
  requestScalar: string | null | undefined
): string | null {
  const raw = (relationCode ?? requestScalar ?? '').trim();
  return /^[1-5]$/.test(raw) ? raw : null;
}

function getRtpNumberOfDaysAfterTenderClosingDate(
  rtp: unknown
): number | string | null {
  if (!rtp || typeof rtp !== 'object') {
    return null;
  }

  const value = (rtp as { numberOfDaysAfterTenderClosingDate?: unknown })
    .numberOfDaysAfterTenderClosingDate;

  return typeof value === 'number' || typeof value === 'string' ? value : null;
}

function getRtpValidityPeriod(rtp: unknown): Date | null {
  if (!rtp || typeof rtp !== 'object') {
    return null;
  }

  const value = (rtp as { validityPeriod?: unknown }).validityPeriod;
  return value instanceof Date ? value : null;
}

function getRequestReviewerComment(requestRow: unknown): string | null {
  if (!requestRow || typeof requestRow !== 'object') return null;
  const value = (requestRow as { reviewerCommentText?: unknown }).reviewerCommentText;
  return typeof value === 'string' ? value : null;
}

function getRequestReviewerDecisionCode(requestRow: unknown): string | null {
  if (!requestRow || typeof requestRow !== 'object') return null;
  const value = (requestRow as { reviewerDecisionCode?: unknown }).reviewerDecisionCode;
  return typeof value === 'string' ? value : null;
}

function isLikelyUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

function isLikelyImageUrl(value: string) {
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(value.trim());
}

function getDisplayFileNameFromUrl(value: string) {
  try {
    const parsedUrl = new URL(value);
    const segments = parsedUrl.pathname.split('/').filter(Boolean);
    return decodeURIComponent(segments[segments.length - 1] ?? 'Attachment');
  } catch {
    return 'Attachment';
  }
}

function renderPointValue(point: unknown) {
  const value = typeof point === 'string' ? point.trim() : JSON.stringify(point);
  if (!isLikelyUrl(value)) {
    return <span>{value}</span>;
  }

  if (isLikelyImageUrl(value)) {
    return (
      <ImagePreviewTrigger imageUrl={value} alt="Field attachment preview" />
    );
  }

  return (
    <a
      href={value}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--text)] hover:bg-[var(--surface-soft)]"
    >
      Preview file: {getDisplayFileNameFromUrl(value)}
    </a>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function RequestDetailPage({ params }: RequestDetailPageProps) {
  const { id } = await params;
  const currentUser = await getCurrentUser();

  let request = await prisma.request.findUnique({
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
      signatures: {
        orderBy: { signedAt: 'desc' },
      },
    },
  });

  if (!request) {
    notFound();
  }

  const promotedToCompleteReview = await ensureCompleteReviewFromSignatures(request.id, request.status);
  if (promotedToCompleteReview) {
    request = {
      ...request,
      status: REQUEST_STATUS_MAP.COMPLETE_REVIEW.label,
    };
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
  // JVP cashflow and cost structure are field-level attachments and rendered in JVP detail section.

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

  const currentUserRoles = new Set(
    [currentUser?.role, ...(currentUser?.roles ?? [])]
      .filter(Boolean)
      .map((role) => String(role).toLowerCase()),
  );
  const hasCurrentUserRole = (role: string) => currentUserRoles.has(role);
  const isReviewerSuggestion = (sourceRole?: string | null) => !sourceRole || sourceRole === 'reviewer';
  const isWorkingGcpcSuggestion = (sourceRole?: string | null) => sourceRole === 'working_gcpc';
  const reviewerSuggestions = reviewerSuggestionsData.filter((suggestion) =>
    isReviewerSuggestion(suggestion.sourceRole),
  );
  const workingGcpcSuggestions = reviewerSuggestionsData.filter((suggestion) =>
    isWorkingGcpcSuggestion(suggestion.sourceRole),
  );
  const canSeeReviewerSuggestions =
    hasCurrentUserRole('reviewer') || hasCurrentUserRole('verifier') || hasCurrentUserRole('admin');
  const canSeeWorkingGcpcSuggestions =
    hasCurrentUserRole('working_gcpc') || hasCurrentUserRole('verifier');
  const isRtpRequest = request.requestType.trim().toLowerCase() === 'rtp';

  const signatoryMembers = await prisma.signatoryMember.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  const toSignatoryRow = (m: (typeof signatoryMembers)[number]) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    group: m.group as 'prepared' | 'confirmed',
    sortOrder: m.sortOrder,
  });

  const preparedMembers = signatoryMembers.filter((m) => m.group === 'prepared').map(toSignatoryRow);
  const confirmedMembers = signatoryMembers.filter((m) => m.group === 'confirmed').map(toSignatoryRow);

  const registrationTypeLabel =
    request.rtp ? REGISTRATION_TYPES.find(
      (item) => item.value === request.rtp?.registrationType
    )?.label : '—';

  const procurementMethodLabel =
    request.pbl ? PROCUREMENT_METHODS.find(
      (item) => item.value === request.pbl?.procurementMethod
    )?.label : '—';
  // Guard access to newly added RTP fields when generated Prisma types are stale in IDE.
  const rtpNumberOfDaysAfterTenderClosingDate = getRtpNumberOfDaysAfterTenderClosingDate(
    request.rtp
  );
  const rtpValidityPeriod = getRtpValidityPeriod(request.rtp);

  const signaturesData = request.signatures.map((s) => ({
    id: s.id,
    signatoryMemberId: s.signatoryMemberId,
    signatoryName: s.signatoryName,
    signatoryEmail: s.signatoryEmail,
    type: s.type,
    signUrl: s.signUrl,
    signedAt: s.signedAt.toISOString(),
  }));

  const addDecisionInitialComment =
    getRequestReviewerComment(request) ?? request.verifierComment?.comment ?? request.verifierCommentText ?? null;
  const addDecisionInitialCode = verifierDecisionCodePrefill(
    getRequestReviewerDecisionCode(request) ?? request.verifierComment?.decisionCode,
    request.verifierDecisionCode
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <header className="page-header sm:flex-row sm:items-start sm:justify-between">
        <Button href="/requests" variant="secondary" size="sm">
          Back to requests
        </Button>
        <div>
          <h1 className="page-title">Request details</h1>
          <p className="page-subtitle">
            {request.requestNo} · {request.requestType} · {request.routingType}
          </p>
        </div>
      </header>

      {/* ── Main card ── */}
      <section className="surface-card p-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--text)]">Request profile</h2>

          <span><span className="text-md font-semibold text-[var(--text)]">Status</span>:&nbsp;
            <span className={`${STATUS_BADGE_CLASS_MAP[request.status] ?? 'badge--neutral'}`}>
              {request.status}
            </span>
          </span>
        </div>

        <div className="space-y-5">

          {/* ── Documents ── */}
          <div>
            <SectionTitle title="Documents" />
            <div className="mt-1  bg-white">
              <DocumentCards documents={documents} />
            </div>
          </div>

          {/* ── General Information ── */}
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

          {/* ── RTP Details ── */}

          {request.rtp ? (
            <div>
              <SectionTitle title="RTP Details" />
              <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <DetailItem label="Client Name" value={request.rtp.clientName} />
                <DetailItem label="Registration Type" value={registrationTypeLabel} />
                <DetailItem label="Project Name" value={request.rtp.projectName} />
                <DetailItem label="Tender Closing Date" value={formatDateTime(request.rtp.tenderClosingDate)} />
                <DetailItem
                  label="No. of Days"
                  value={rtpNumberOfDaysAfterTenderClosingDate ?? '—'}
                />
                <DetailItem label="Validity Period" value={formatDateTime(rtpValidityPeriod)} />
                <DetailItem label="Special Project" value={request.rtp.specialProject ? 'Yes' : 'No'} />
              </dl>
              <div className="mt-3 rounded-lg border border-[var(--border)] bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  Project Description
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text)]">
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
                      ? `${request.pbl.project.projectName}`
                      : request.pbl.project.projectName
                  }
                />
                <DetailItem label="Project Code" value={request.pbl.projectCode || '—'} />
                <DetailItem label="Procurement Method" value={procurementMethodLabel} />
              </dl>
              {request.pbl?.justificationForLessBidders && (
                <div className="mt-3 rounded-lg border border-[var(--border)] bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    Justification For Less Bidders
                  </p>

                  <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text)]">
                    {request.pbl.justificationForLessBidders}
                  </p>
                </div>
              )}
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
                <DetailItem label="Project Code" value={request.jvp.projectCode || '—'} />
                <DetailItem label="Team Leader" value={request.jvp.teamLeader || '—'} />
                <DetailItem label="Financial Matters PIC" value={request.jvp.financialMatters || '—'} />
                <DetailItem label="Technical Matters PIC" value={request.jvp.technicalMatters || '—'} />
                <DetailItem label="Contract Matters PIC" value={request.jvp.contractMatters || '—'} />
                <DetailItem label="Procurement Matters PIC" value={request.jvp.procurementMatters || '—'} />
                <DetailItem label="Costing & Estimation PIC" value={request.jvp.costingAndEstimationMatters || '—'} />
                <DetailItem label="Implementation Stage" value={request.jvp.implementationStage || '—'} />
              </dl>
              <div className="mt-3 space-y-3 ">
                <div className="rounded-lg border border-[var(--border)] bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    Background of Collaboration
                  </p>

                  {Array.isArray(request.jvp?.backgroundOfCollabPoints) &&
                    request.jvp.backgroundOfCollabPoints.map((point, index) => (
                      <li key={index} className="ms-8">
                        {renderPointValue(point)}
                      </li>
                    ))
                  }
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    Scope of Collaboration
                  </p>
                  {Array.isArray(request.jvp?.scopeOfCollabPoints) &&
                    request.jvp.scopeOfCollabPoints.map((point, index) => (
                      <li key={index} className="ms-8">
                        {renderPointValue(point)}
                      </li>
                    ))
                  }
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    Financial Overview
                  </p>
                  {Array.isArray(request.jvp?.financialOverviewPoints) &&
                    request.jvp?.financialOverviewPoints.map((point, index) => (
                      <li key={index} className="ms-8">
                        {renderPointValue(point)}
                      </li>
                    ))
                  }
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    Key Terms
                  </p>
                  {Array.isArray(request.jvp?.keyTermsPoints) &&
                    request.jvp.keyTermsPoints.map((point, index) => (
                      <li key={index} className="ms-8">
                        {renderPointValue(point)}
                      </li>
                    ))
                  }
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    Proposed Structure
                  </p>
                  {Array.isArray(request.jvp?.proposedStructurePoints) &&
                    request.jvp.proposedStructurePoints.map((point, index) => (
                      <li key={index} className="ms-8">
                        {renderPointValue(point)}
                      </li>
                    ))
                  }
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    Resources Contribution
                  </p>
                  {Array.isArray(request.jvp?.resourcesContributionPoints) &&
                    request.jvp.resourcesContributionPoints.map((point, index) => (
                      <li key={index} className="ms-8">
                        {renderPointValue(point)}
                      </li>
                    ))
                  }
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    Cashflow Forecast
                  </p>
                  {request.jvp.cashflowForecastUrl ? (
                    <div className="mt-2 space-y-2">
                      {isLikelyImageUrl(request.jvp.cashflowForecastUrl) ? (
                        <ImagePreviewTrigger
                          imageUrl={request.jvp.cashflowForecastUrl}
                          alt={request.jvp.cashflowForecastFileName ?? 'Cashflow forecast preview'}
                        />
                      ) : (
                        <a
                          href={request.jvp.cashflowForecastUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--text)] hover:bg-[var(--surface-soft)]"
                        >
                          Preview {request.jvp.cashflowForecastFileName ?? 'Cashflow file'}
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--text-muted)]">No attachment uploaded.</p>
                  )}
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    Cost Structure
                  </p>
                  {request.jvp.costStructureUrl ? (
                    <div className="mt-2 space-y-2">
                      {isLikelyImageUrl(request.jvp.costStructureUrl) ? (
                        <ImagePreviewTrigger
                          imageUrl={request.jvp.costStructureUrl}
                          alt={request.jvp.costStructureFileName ?? 'Cost structure preview'}
                        />
                      ) : (
                        <a
                          href={request.jvp.costStructureUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--text)] hover:bg-[var(--surface-soft)]"
                        >
                          Preview {request.jvp.costStructureFileName ?? 'Cost structure file'}
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--text-muted)]">No attachment uploaded.</p>
                  )}
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    Work Packages Division
                  </p>
                  {Array.isArray(request.jvp?.workPackagesDivisionPoints) &&
                    request.jvp.workPackagesDivisionPoints.map((point, index) => (
                      <li key={index} className="ms-8">
                        {typeof point === 'string' ? point : JSON.stringify(point)}
                      </li>
                    ))
                  }
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] mb-2">
                    Risk Review & Mitigation
                  </p>
                  {Array.isArray(request.jvp?.riskReviewMitigationItems) &&
                    request.jvp.riskReviewMitigationItems.length > 0 ? (
                    <table className="w-full text-sm border-collapse border border-gray-200">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] w-1/2">
                            Risk Identified
                          </th>
                          <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] w-1/2">
                            Mitigation Plan
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {request.jvp.riskReviewMitigationItems.map((item, index) => (
                          <tr
                            key={index}
                          >
                            <td className="px-3 py-2 align-top border border-gray-200">
                              {item && typeof item === 'object' && 'riskIdentified' in item
                                ? String(item.riskIdentified ?? '—')
                                : '—'}
                            </td>
                            <td className="px-3 py-2 align-top border border-gray-200">
                              {item && typeof item === 'object' && 'mitigationPlan' in item
                                ? String(item.mitigationPlan ?? '—')
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-sm text-[var(--text-muted)]">No risk items found.</p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {/* ── General Review ── */}
          <GeneralReviewSectionClient
            verifierComment={verifierCommentData}
            reviewerSuggestions={canSeeReviewerSuggestions ? reviewerSuggestions : []}
            workingGcpcSuggestions={canSeeWorkingGcpcSuggestions ? workingGcpcSuggestions : []}
            userRole={currentUser?.role}
            userRoles={currentUser?.roles}
            status={request.status}
          />

          {!isRtpRequest && request.status === 'complete review' ? (
            <RequestSignatureSection
              requestId={request.id}
              status={request.status}
              preparedMembers={preparedMembers}
              confirmedMembers={confirmedMembers}
              signatures={signaturesData}
              currentUser={
                currentUser ? { name: currentUser.name, email: currentUser.email } : null
              }
            />
          ) : null}

        </div>
      </section>

      {/* ── Actions section ── */}
      <section className="space-y-4">
        <RequestActionsSection
          requestId={request.id}
          status={request.status}
          requestType={request.requestType}
          isSpecialProject={Boolean(request.rtp?.specialProject)}
          reviewerSuggestionsCount={reviewerSuggestions.length}
          workingGcpcSuggestionsCount={workingGcpcSuggestions.length}
          userRole={currentUser?.role}
          userRoles={currentUser?.roles}
          initialReviewerComment={addDecisionInitialComment}
          initialReviewerDecisionCode={addDecisionInitialCode}
        />
      </section>

    </div>
  );
}