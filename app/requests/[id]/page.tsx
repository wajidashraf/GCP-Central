import Button from '@/src/components/ui/button';
import RequestActionsSection from '@/src/components/sections/request-actions-section';
import GeneralReviewSectionClient from '@/src/components/sections/general-review-section-client';
import { DocumentCard, DocumentCards, DocumentItem } from '@/src/components/sections/document-card';
import {
  SectionTitle,
  DetailItem,
  formatDateTime,
  STATUS_BADGE_CLASS_MAP,
} from '@/src/components/sections/request-form-shared';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';
import { REGISTRATION_TYPES } from '@/src/constants/enums/procurement';
import { PROCUREMENT_METHODS } from '@/src/constants/enums/procurement';
import ImagePreviewTrigger from '@/src/components/sections/image-preview-trigger';
import PrintButton from '@/src/components/ui/printButton';
import { listItems } from '@/lib/sharepoint/lists';
import {
  listSuggestionsForRequestItem,
  mapSuggestionToApi,
} from '@/lib/sharepoint/working-gcp-suggestions';

// ─── Types ────────────────────────────────────────────────────────────────────

type RequestDetailPageProps = {
  params: Promise<{ id: string }>;
};

type SharePointRequestItem = {
  id: string;
  uuid?: string;
  requestNo?: string;
  requestType?: string;
  routingType?: string;
  requestTitle?: string;
  category?: string;
  acknowledgement?: boolean | string | number;
  requestorName?: string;
  requestorEmail?: string;
  companyCode?: string;
  companyName?: string;
  status?: string;
  reviewerCommentText?: string;
  reviewerDecisionCode?: string;
  submittedAt?: string;
  Created?: string;
  Modified?: string;
};

type SharePointRequestDocumentItem = {
  id: string;
  uuid?: string;
  requestId?: string;
  requestIdLookupId?: string | number;
  requestIdId?: string | number;
  requestIdLookup?: string | number;
  documentUrl?: string;
  documentFileName?: string;
};

type SharePointProjectItem = {
  id: string;
  uuid?: string;
  projectCode?: string;
  projectName?: string;
  Title?: string;
};

type SharePointRtpItem = SharePointRequestDocumentItem & {
  projectName?: string;
  clientName?: string;
  registrationType?: string | number;
  tenderClosingDate?: string;
  numberOfDaysAfterTenderClosingDate?: string | number;
  numberOfDaysAfterTenderClosingDa?: string | number;
  validityPeriod?: string;
  specialProject?: boolean | string | number;
  projectDescription?: string;
};

type SharePointPblItem = SharePointRequestDocumentItem & {
  projectCode?: string;
  projectId?: string;
  projectIdLookupId?: string | number;
  projectIdId?: string | number;
  projectIdLookup?: string | number;
  procurementMethod?: string | number;
  justificationForLessBidders?: string;
};

type SharePointPblBidderItem = {
  id: string;
  pblRequestId?: string;
  pblRequestIdLookupId?: string | number;
  pblRequestIdId?: string | number;
  pblRequestIdLookup?: string | number;
  companyName?: string;
  personInCharge?: string;
  picContactNumber?: string;
  sourcesFrom?: string;
  recommendationBy?: string;
};

type SharePointJvpItem = SharePointRequestDocumentItem & {
  projectCode?: string;
  projectId?: string;
  projectIdLookupId?: string | number;
  projectIdId?: string | number;
  projectIdLookup?: string | number;
  teamLeader?: string;
  financialMatters?: string;
  technicalMatters?: string;
  contractMatters?: string;
  procurementMatters?: string;
  costingAndEstimationMatters?: string;
  implementationStage?: string;
  backgroundOfCollabPoints?: unknown;
  scopeOfCollabPoints?: unknown;
  financialOverviewPoints?: unknown;
  keyTermsPoints?: unknown;
  proposedStructurePoints?: unknown;
  resourcesContributionPoints?: unknown;
  workPackagesDivisionPoints?: unknown;
  riskReviewMitigationItems?: unknown;
  cashflowForecastUrl?: string;
  cashflowForecastFileName?: string;
  costStructureUrl?: string;
  costStructureFileName?: string;
};

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

function hasTokenMatch(tokens: Set<string>, ...candidates: Array<string | number | null | undefined>) {
  for (const candidate of candidates) {
    const normalized = String(candidate ?? '').trim();
    if (normalized && tokens.has(normalized)) {
      return true;
    }
  }
  return false;
}

function parseDate(value: unknown): Date | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

function parseJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function getSharePointRequestDocuments(tokens: Set<string>): Promise<DocumentItem[]> {
  const listConfigs = [
    { label: 'RTP Document', listId: process.env.RTP_REQUESTS_LIST_ID },
    { label: 'PBL Document', listId: process.env.PBL_REQUESTS_LIST_ID },
    { label: 'JVP Main Document', listId: process.env.JVP_REQUESTS_LIST_ID },
    { label: 'STSP Document', listId: process.env.STSP_REQUESTS_LIST_ID },
    { label: 'CAA Document', listId: process.env.CAA_REQUESTS_LIST_ID },
    { label: 'PCCA Document', listId: process.env.PCCA_REQUESTS_LIST_ID },
    { label: 'R-PCCA Document', listId: process.env.RPCCA_REQUESTS_LIST_ID },
    { label: 'PP Document', listId: process.env.PP_REQUESTS_LIST_ID },
    { label: 'VAP Document', listId: process.env.VAP_REQUESTS_LIST_ID },
    { label: 'RPP Document', listId: process.env.RPP_REQUESTS_LIST_ID },
    { label: 'Other Document', listId: process.env.OTHERS_REQUESTS_LIST_ID },
    { label: 'CPR Document', listId: process.env.CPR_REQUESTS_LIST_ID },
    { label: 'CI Document', listId: process.env.CI_REQUESTS_LIST_ID },
  ].filter(
    (config): config is { label: string; listId: string } =>
      typeof config.listId === 'string' && config.listId.trim().length > 0,
  );

  if (listConfigs.length === 0) {
    return [];
  }

  const loadedLists = await Promise.all(
    listConfigs.map(async (config) => {
      const items = await listItems<SharePointRequestDocumentItem>(config.listId);
      return { label: config.label, items };
    }),
  );

  const documents: DocumentItem[] = [];
  for (const loaded of loadedLists) {
    const matchedItem = loaded.items.find((item) =>
      hasTokenMatch(
        tokens,
        item.id,
        item.uuid,
        item.requestId,
        item.requestIdLookupId,
        item.requestIdId,
        item.requestIdLookup,
      ),
    );

    const url = (matchedItem?.documentUrl ?? '').trim();
    if (!url) continue;

    documents.push({
      label: loaded.label,
      url,
      fileName: matchedItem?.documentFileName,
    });
  }

  return documents;
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
  const normalizedRequestParam = id.trim();
  const currentUser = await getCurrentUser();
  const requestsListId = process.env.REQUESTS_LIST_ID;
  if (!requestsListId) {
    notFound();
  }
  const sharePointRequests = await listItems<SharePointRequestItem>(requestsListId);
  const requestLookupTokens = new Set<string>([normalizedRequestParam]);
  const sharePointRequest = sharePointRequests.find((item) =>
    hasTokenMatch(requestLookupTokens, item.id, item.uuid, item.requestNo),
  );

  if (!sharePointRequest) {
    notFound();
  }
  requestLookupTokens.add(sharePointRequest.id);
  if ((sharePointRequest.uuid ?? '').trim()) requestLookupTokens.add((sharePointRequest.uuid ?? '').trim());
  if ((sharePointRequest.requestNo ?? '').trim()) requestLookupTokens.add((sharePointRequest.requestNo ?? '').trim());

  const [projects, rtpItems, pblItems, jvpItems, pblBidderItems] = await Promise.all([
    process.env.PROJECTS_LIST_ID ? listItems<SharePointProjectItem>(process.env.PROJECTS_LIST_ID) : Promise.resolve([]),
    process.env.RTP_REQUESTS_LIST_ID ? listItems<SharePointRtpItem>(process.env.RTP_REQUESTS_LIST_ID) : Promise.resolve([]),
    process.env.PBL_REQUESTS_LIST_ID ? listItems<SharePointPblItem>(process.env.PBL_REQUESTS_LIST_ID) : Promise.resolve([]),
    process.env.JVP_REQUESTS_LIST_ID ? listItems<SharePointJvpItem>(process.env.JVP_REQUESTS_LIST_ID) : Promise.resolve([]),
    process.env.PBL_BIDDERS_LIST_ID ? listItems<SharePointPblBidderItem>(process.env.PBL_BIDDERS_LIST_ID) : Promise.resolve([]),
  ]);

  const request = {
    id: (sharePointRequest.uuid ?? '').trim() || sharePointRequest.id,
    requestNo: (sharePointRequest.requestNo ?? '').trim(),
    requestType: (sharePointRequest.requestType ?? '').trim(),
    routingType: (sharePointRequest.routingType ?? '').trim(),
    requestTitle: (sharePointRequest.requestTitle ?? '').trim(),
    category: (sharePointRequest.category ?? '').trim(),
    acknowledgement: parseBoolean(sharePointRequest.acknowledgement),
    requestorName: (sharePointRequest.requestorName ?? '').trim(),
    requestorEmail: (sharePointRequest.requestorEmail ?? '').trim(),
    companyCode: (sharePointRequest.companyCode ?? '').trim(),
    companyName: (sharePointRequest.companyName ?? '').trim(),
    status: (sharePointRequest.status ?? '').trim(),
    submittedAt: parseDate(sharePointRequest.submittedAt),
    createdAt: parseDate(sharePointRequest.Created),
    updatedAt: parseDate(sharePointRequest.Modified),
    reviewerCommentText: (sharePointRequest.reviewerCommentText ?? '').trim(),
    reviewerDecisionCode: (sharePointRequest.reviewerDecisionCode ?? '').trim(),
  };

  const rtp = rtpItems.find((item) =>
    hasTokenMatch(
      requestLookupTokens,
      item.id,
      item.uuid,
      item.requestId,
      item.requestIdLookupId,
      item.requestIdId,
      item.requestIdLookup,
    ),
  );
  const pbl = pblItems.find((item) =>
    hasTokenMatch(
      requestLookupTokens,
      item.id,
      item.uuid,
      item.requestId,
      item.requestIdLookupId,
      item.requestIdId,
      item.requestIdLookup,
    ),
  );
  const jvp = jvpItems.find((item) =>
    hasTokenMatch(
      requestLookupTokens,
      item.id,
      item.uuid,
      item.requestId,
      item.requestIdLookupId,
      item.requestIdId,
      item.requestIdLookup,
    ),
  );

  const projectById = new Map(projects.map((project) => [project.id, project]));
  const projectByUuid = new Map(
    projects
      .filter((project) => (project.uuid ?? '').trim())
      .map((project) => [(project.uuid ?? '').trim(), project]),
  );
  const resolveProject = (projectId?: string | number) => {
    const normalized = String(projectId ?? '').trim();
    return projectById.get(normalized) ?? projectByUuid.get(normalized) ?? null;
  };
  const pblProject = resolveProject(
    pbl?.projectIdLookupId ?? pbl?.projectIdId ?? pbl?.projectIdLookup ?? pbl?.projectId,
  );
  const jvpProject = resolveProject(
    jvp?.projectIdLookupId ?? jvp?.projectIdId ?? jvp?.projectIdLookup ?? jvp?.projectId,
  );

  // ── Build documents list ──────────────────────────────────────────────────
  const documents: DocumentItem[] = await getSharePointRequestDocuments(requestLookupTokens);

  if (!documents.some((item) => item.label === 'RTP Document') && (rtp?.documentUrl ?? '').trim()) {
    documents.push({
      label: 'RTP Document',
      url: String(rtp?.documentUrl),
      fileName: rtp?.documentFileName,
    });
  }
  if (!documents.some((item) => item.label === 'PBL Document') && (pbl?.documentUrl ?? '').trim()) {
    documents.push({
      label: 'PBL Document',
      url: String(pbl?.documentUrl),
      fileName: pbl?.documentFileName,
    });
  }
  if (!documents.some((item) => item.label === 'JVP Main Document') && (jvp?.documentUrl ?? '').trim()) {
    documents.push({
      label: 'JVP Main Document',
      url: String(jvp?.documentUrl),
      fileName: jvp?.documentFileName,
    });
  }

  const currentUserRoles = new Set(
    [currentUser?.role, ...(currentUser?.roles ?? [])]
      .filter(Boolean)
      .map((role) => String(role).toLowerCase()),
  );
  const suggestionRouteId = (sharePointRequest.uuid ?? '').trim() || sharePointRequest.id;
  const reviewerSuggestions: Array<{
    id: string;
    suggestion: string;
    sourceRole?: string | null;
    createdAt: string;
  }> = [];
  const workingGcpcSuggestions: Array<{
    id: string;
    suggestion: string;
    sourceRole?: string | null;
    createdAt: string;
  }> = [];
  try {
    if (process.env.WORKING_GCP_SUGGESTIONS_LIST_ID) {
      const suggestionRows = await listSuggestionsForRequestItem(sharePointRequest.id);
      for (const row of suggestionRows) {
        const mapped = mapSuggestionToApi(row, suggestionRouteId);
        const entry = {
          id: String(mapped.id),
          suggestion: String(mapped.suggestion ?? ''),
          sourceRole: (mapped.sourceRole as string | null | undefined) ?? null,
          createdAt: String(mapped.createdAt ?? ''),
        };
        const sr = (entry.sourceRole ?? '').trim().toLowerCase();
        if (sr === 'working_gcpc') {
          workingGcpcSuggestions.push(entry);
        } else {
          reviewerSuggestions.push(entry);
        }
      }
    }
  } catch {
    // List optional until env is set — leave arrays empty
  }
  const verifierCommentData = null;
  const requestIdForActions = (sharePointRequest.uuid ?? '').trim() || sharePointRequest.id;

  const registrationTypeLabel =
    rtp
      ? REGISTRATION_TYPES.find((item) => item.value === Number(rtp.registrationType))?.label ?? '—'
      : '—';

  const procurementMethodLabel =
    pbl
      ? PROCUREMENT_METHODS.find((item) => item.value === Number(pbl.procurementMethod))?.label ??
        String(pbl.procurementMethod ?? '—')
      : '—';
  const rtpNumberOfDaysAfterTenderClosingDate =
    rtp?.numberOfDaysAfterTenderClosingDate ?? rtp?.numberOfDaysAfterTenderClosingDa ?? null;
  const rtpValidityPeriod = parseDate(rtp?.validityPeriod);
  const pblBidders = pbl
    ? pblBidderItems.filter((bidder) =>
        hasTokenMatch(
          new Set([pbl.id]),
          bidder.pblRequestId,
          bidder.pblRequestIdLookupId,
          bidder.pblRequestIdId,
          bidder.pblRequestIdLookup,
        ),
      )
    : [];
  const addDecisionInitialComment = request.reviewerCommentText || null;
  const reviewerDecisionCode = request.reviewerDecisionCode || null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6" >

      {/* ── Page header ── */}
      <header className="page-header sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center justify-between gap-2 w-full py-0">

          <div>
            <Button href="/requests" variant="secondary" size="sm">
              Back to requests
            </Button>
          </div>
          <div>
            <PrintButton />
          </div>
        </div>
      </header>

      {/* ── Main card ── */}
      <section className="surface-card p-5" id="request-detail-page">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h1 className="page-title">Request Profile</h1>
            <h2 className="text-lg font-semibold text-gray-500">
              {request.requestNo} · {request.requestType} · {request.routingType}
            </h2>
          </div>

          <div className="text-md font-semibold">
            <span className="text-lg font-semibold text-[var(--text)]">Request Status</span>:&nbsp;&nbsp;
            <span className={`${STATUS_BADGE_CLASS_MAP[request.status] ?? 'badge--neutral'}`}>
              {request.status}
            </span>
          </div>
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

          {rtp ? (
            <div>
              <SectionTitle title="RTP Details" />
              <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <DetailItem label="Client Name" value={rtp.clientName ?? '—'} />
                <DetailItem label="Registration Type" value={registrationTypeLabel} />
                <DetailItem label="Project Name" value={rtp.projectName ?? '—'} />
                <DetailItem label="Tender Closing Date" value={formatDateTime(parseDate(rtp.tenderClosingDate))} />
                <DetailItem
                  label="No. of Days"
                  value={rtpNumberOfDaysAfterTenderClosingDate ?? '—'}
                />
                <DetailItem label="Validity Period" value={formatDateTime(rtpValidityPeriod)} />
                <DetailItem label="Special Project" value={parseBoolean(rtp.specialProject) ? 'Yes' : 'No'} />
              </dl>
              <div className="mt-3 rounded-lg border border-[var(--border)] bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  Project Description
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text)]">
                  {rtp.projectDescription ?? '—'}
                </p>
              </div>
            </div>
          ) : null}

          {/* ── PBL Details ── */}
          {pbl ? (
            <div>
              <SectionTitle title="PBL Details" />
              <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <DetailItem
                  label="Project"
                  value={
                    pblProject?.projectCode
                      ? `${pblProject.projectName ?? pblProject.Title ?? '—'}`
                      : pblProject?.projectName ?? pblProject?.Title ?? '—'
                  }
                />
                <DetailItem label="Project Code" value={pbl.projectCode || pblProject?.projectCode || '—'} />
                <DetailItem label="Procurement Method" value={procurementMethodLabel} />
              </dl>
              {pbl.justificationForLessBidders && (
                <div className="mt-3 rounded-lg border border-[var(--border)] bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    Justification For Less Bidders
                  </p>

                  <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text)]">
                    {pbl.justificationForLessBidders}
                  </p>
                </div>
              )}
              <div className="mt-3">
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  Bidders
                </h3>
                {pblBidders.length > 0 ? (
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
                        {pblBidders.map((bidder) => (
                          <tr key={bidder.id}>
                            <td>{bidder.companyName ?? '—'}</td>
                            <td>{bidder.personInCharge ?? '—'}</td>
                            <td>{bidder.picContactNumber ?? '—'}</td>
                            <td>{bidder.sourcesFrom ?? '—'}</td>
                            <td>{bidder.recommendationBy ?? '—'}</td>
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
          {jvp ? (
            <div>
              <SectionTitle title="JVP Details" />
              <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <DetailItem
                  label="Project"
                  value={
                    jvpProject?.projectCode
                      ? `${jvpProject.projectName ?? jvpProject.Title ?? '—'} (${jvpProject.projectCode})`
                      : jvpProject?.projectName ?? jvpProject?.Title ?? '—'
                  }
                />
                <DetailItem label="Project Code" value={jvp.projectCode || jvpProject?.projectCode || '—'} />
                <DetailItem label="Team Leader" value={jvp.teamLeader || '—'} />
                <DetailItem label="Financial Matters PIC" value={jvp.financialMatters || '—'} />
                <DetailItem label="Technical Matters PIC" value={jvp.technicalMatters || '—'} />
                <DetailItem label="Contract Matters PIC" value={jvp.contractMatters || '—'} />
                <DetailItem label="Procurement Matters PIC" value={jvp.procurementMatters || '—'} />
                <DetailItem label="Costing & Estimation PIC" value={jvp.costingAndEstimationMatters || '—'} />
                <DetailItem label="Implementation Stage" value={jvp.implementationStage || '—'} />
              </dl>
              <div className="mt-3 space-y-3 ">
                <div className="rounded-lg border border-[var(--border)] bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    Background of Collaboration
                  </p>

                  {parseJsonArray(jvp.backgroundOfCollabPoints).map((point, index) => (
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
                  {parseJsonArray(jvp.scopeOfCollabPoints).map((point, index) => (
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
                  {parseJsonArray(jvp.financialOverviewPoints).map((point, index) => (
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
                  {parseJsonArray(jvp.keyTermsPoints).map((point, index) => (
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
                  {parseJsonArray(jvp.proposedStructurePoints).map((point, index) => (
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
                  {parseJsonArray(jvp.resourcesContributionPoints).map((point, index) => (
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
                  {jvp.cashflowForecastUrl ? (
                    <div className="mt-2 space-y-2">
                      {isLikelyImageUrl(jvp.cashflowForecastUrl) ? (
                        <ImagePreviewTrigger
                          imageUrl={jvp.cashflowForecastUrl}
                          alt={jvp.cashflowForecastFileName ?? 'Cashflow forecast preview'}
                        />
                      ) : (
                        <DocumentCard
                          doc={{
                            label: 'Cashflow file',
                            url: jvp.cashflowForecastUrl,
                            fileName:
                              jvp.cashflowForecastFileName ??
                              getDisplayFileNameFromUrl(jvp.cashflowForecastUrl),
                          }}
                        />
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
                  {jvp.costStructureUrl ? (
                    <div className="mt-2 space-y-2">
                      {isLikelyImageUrl(jvp.costStructureUrl) ? (
                        <ImagePreviewTrigger
                          imageUrl={jvp.costStructureUrl}
                          alt={jvp.costStructureFileName ?? 'Cost structure preview'}
                        />
                      ) : (
                        <DocumentCard
                          doc={{
                            label: 'Cost structure file',
                            url: jvp.costStructureUrl,
                            fileName:
                              jvp.costStructureFileName ??
                              getDisplayFileNameFromUrl(jvp.costStructureUrl),
                          }}
                        />
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
                  {parseJsonArray(jvp.workPackagesDivisionPoints).map((point, index) => (
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
                  {parseJsonArray(jvp.riskReviewMitigationItems).length > 0 ? (
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
                        {parseJsonArray(jvp.riskReviewMitigationItems).map((item, index) => (
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
          {request.status !== 'new' ?
            <GeneralReviewSectionClient
              verifierComment={verifierCommentData}
              reviewerDecisionCode={reviewerDecisionCode}
              reviewerSuggestions={currentUserRoles.has('reviewer') || currentUserRoles.has('verifier') || currentUserRoles.has('admin') ? reviewerSuggestions : []}
              workingGcpcSuggestions={currentUserRoles.has('working_gcpc') || currentUserRoles.has('verifier') ? workingGcpcSuggestions : []}
              userRole={currentUser?.role}
              userRoles={currentUser?.roles}
              status={request.status}
            />
            : null}

        </div>
      </section>

      {/* ── Actions section ── */}
      <section className="space-y-4">
        <RequestActionsSection
          requestId={requestIdForActions}
          status={request.status}
          requestType={request.requestType}
          isSpecialProject={parseBoolean(rtp?.specialProject)}
          reviewerSuggestionsCount={reviewerSuggestions.length}
          workingGcpcSuggestionsCount={workingGcpcSuggestions.length}
          userRole={currentUser?.role}
          userRoles={currentUser?.roles}
          initialReviewerComment={addDecisionInitialComment}
          initialReviewerDecisionCode={reviewerDecisionCode}
        />
      </section>

    </div>
  );
}