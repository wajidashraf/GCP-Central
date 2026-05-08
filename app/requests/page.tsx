import Link from 'next/link';
import { redirect } from 'next/navigation';
import Button from '@/src/components/ui/button';
import { listItems } from '@/lib/sharepoint/lists';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';
import { hasRole } from '@/src/lib/auth/has-role';
import { REQUEST_STATUS_MAP } from '@/src/constants/enums/requestStatus';
import FilterBar from '@/src/components/requests/filterbar';

const STATUS_BADGE_CLASS_MAP: Record<string, string> = {
  Draft: 'badge--neutral',
  'Draft-Details': 'badge--neutral',
  New: 'badge--primary',
  Submitted: 'badge--primary',
  Scheduled: 'badge--primary',
  'Under Verification': 'badge--warning',
  'In Review': 'badge--warning',
  Resubmit: 'badge--warning',
  RS: 'badge--warning',
  'Ready for Engagement': 'badge--info',
  'Pending Review': 'badge--warning',
  'Draft Review': 'badge--warning',
  'Complete Review': 'badge--success',
  'Pending Acceptance': 'badge--warning',
  'Complete Acceptance': 'badge--success',
  'Pending Endorse': 'badge--warning',
  'Pending Ack': 'badge--warning',
  ACK: 'badge--success',
  Acknowledged: 'badge--success',
  E: 'badge--success',
  Endorsed: 'badge--success',
  'For Record': 'badge--neutral',
  FR: 'badge--neutral',
  NC: 'badge--danger',
  NC3: 'badge--danger',
  NC4: 'badge--danger',
  W: 'badge--danger',
  R: 'badge--info',
};

const STATUS_DISPLAY_MAP: Record<string, string> = {
  FR: 'For Record',
  RS: 'ReSubmit',
  R: 'Ready for Review',
};

const ACTION_LABEL_MAP: Record<string, string> = {
  NEW: 'Verify',
  'READY FOR REVIEW': 'Review',
  R: 'Review',
  RESUBMIT: 'ReSubmit',
  RS: 'ReSubmit',
  'FOR RECORD': 'View',
  FR: 'View',
  'PENDING ENDORSE': 'Endorse',
  'PENDING ACK': 'Acknowledge',
  E: 'View',
};

type RequestsPageProps = {
  searchParams: Promise<{
    company?: string;
    project?: string;
    status?: string;
    type?: string;
    sortBy?: 'requestNo' | 'submitted';
    sortDir?: 'asc' | 'desc';
  }>;
};

type RequestRow = {
  id: string;
  requestNo: string;
  requestType: string;
  routingType: string;
  companyName: string;
  companyCode: string;
  requestorEmail: string;
  status: string;
  submittedAt: Date | null;
  createdAt: Date;
  projectName: string | null;
  projectCode: string | null;
  projectId: string | null;
};

function getActionLabel(status: string) {
  const normalizedStatus = status.trim().toUpperCase();
  return ACTION_LABEL_MAP[normalizedStatus] ?? 'Open';
}

function formatRequestDate(submittedAt: Date | null, createdAt: Date) {
  const timestamp = submittedAt ?? createdAt;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(timestamp);
}

function cleanRequestNo(requestNo: string) {
  return requestNo.replace(
    /(\s*[-|/]\s*\d{1,2}[-/]\d{1,2}[-/]\d{2,4}.*$)|(\s*[-|/]\s*\d{4}-\d{2}-\d{2}.*$)|(-\d{8}.*$)/,
    ''
  ).trim();
}

function canSeeRequest(
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
  request: RequestRow
) {
  const canViewAll =
    hasRole(user, 'admin') ||
    hasRole(user, 'verifier') ||
    hasRole(user, 'reviewer') ||
    hasRole(user, 'working_gcpc');
  if (canViewAll) return true;

  let visible = false;
  if (hasRole(user, 'requestor')) {
    visible =
      visible ||
      request.requestorEmail.trim().toLowerCase() === user.email.trim().toLowerCase();
  }
  if (hasRole(user, 'hoc') && user.companyCode) {
    visible =
      visible ||
      request.companyCode.trim().toUpperCase() === user.companyCode.trim().toUpperCase();
  }
  if (hasRole(user, 'endorser')) {
    visible = visible || request.status === REQUEST_STATUS_MAP.PENDING_ENDORSE.label;
  }
  return visible;
}

export default async function RequestsPage({ searchParams }: RequestsPageProps) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect('/login?callbackUrl=/requests');
  }

  const params = await searchParams;
  const selectedCompany = params.company?.trim() ?? '';
  const selectedProject = params.project?.trim() ?? '';
  const selectedStatus = params.status?.trim() ?? '';
  const selectedType = params.type?.trim() ?? '';
  const sortBy = params.sortBy === 'requestNo' || params.sortBy === 'submitted' ? params.sortBy : 'submitted';
  const sortDir = params.sortDir === 'asc' || params.sortDir === 'desc' ? params.sortDir : 'desc';
  const canCreateRequest = hasRole(currentUser, 'requestor');
  const canSeeBookEngagement =
    hasRole(currentUser, 'requestor') &&
    hasRole(currentUser, 'admin') &&
    selectedStatus === 'ready for engagement';

  const HIDDEN_STATUSES = ['Draft', 'Draft-Details'] as const;

  let loadError = false;
  let visibleRequests: RequestRow[] = [];
  let baseVisibleRequests: RequestRow[] = [];
  
  try {
    const requestsListId = process.env.REQUESTS_LIST_ID;
    if (!requestsListId) {
      throw new Error('REQUESTS_LIST_ID is not set in .env.local');
    }

    const [requestItems, rtpItems, pblItems, pccaItems, rpccaItems, ppItems, rppItems, vapItems, othersItems, cprItems, ciItems, projectItems] = await Promise.all([
      listItems<{
        id: string;
        uuid?: string;
        requestNo?: string;
        requestType?: string;
        routingType?: string;
        companyName?: string;
        companyCode?: string;
        requestorEmail?: string;
        status?: string;
        projectCode?: string;
        projectId?: string;
        Created?: string;
        submittedAt?: string;
      }>(requestsListId),
      process.env.RTP_REQUESTS_LIST_ID
        ? listItems<{ id: string; uuid?: string; projectName?: string }>(process.env.RTP_REQUESTS_LIST_ID)
        : Promise.resolve([]),
      process.env.PBL_REQUESTS_LIST_ID
        ? listItems<{
            id: string;
            uuid?: string;
            requestId?: string;
            requestIdLookupId?: string | number;
            requestIdId?: string | number;
            requestIdLookup?: string | number;
            projectId?: string;
            projectCode?: string;
            projectIdLookupId?: string | number;
            projectIdId?: string | number;
            projectIdLookup?: string | number;
            projectName?: string;
          }>(process.env.PBL_REQUESTS_LIST_ID)
        : Promise.resolve([]),
      process.env.PCCA_REQUESTS_LIST_ID
        ? listItems<{
            id: string;
            uuid?: string;
            requestId?: string;
            requestIdLookupId?: string | number;
            requestIdId?: string | number;
            requestIdLookup?: string | number;
            projectId?: string;
            projectCode?: string;
            projectIdLookupId?: string | number;
            projectIdId?: string | number;
            projectIdLookup?: string | number;
            projectName?: string;
          }>(process.env.PCCA_REQUESTS_LIST_ID)
        : Promise.resolve([]),
      process.env.RPCCA_REQUESTS_LIST_ID
        ? listItems<{
            id: string;
            uuid?: string;
            requestId?: string;
            requestIdLookupId?: string | number;
            requestIdId?: string | number;
            requestIdLookup?: string | number;
            projectId?: string;
            projectCode?: string;
            projectIdLookupId?: string | number;
            projectIdId?: string | number;
            projectIdLookup?: string | number;
            projectName?: string;
          }>(process.env.RPCCA_REQUESTS_LIST_ID)
        : Promise.resolve([]),
      process.env.PP_REQUESTS_LIST_ID
        ? listItems<{
            id: string;
            uuid?: string;
            requestId?: string;
            requestIdLookupId?: string | number;
            requestIdId?: string | number;
            requestIdLookup?: string | number;
            projectId?: string;
            projectCode?: string;
            projectIdLookupId?: string | number;
            projectIdId?: string | number;
            projectIdLookup?: string | number;
            projectName?: string;
          }>(process.env.PP_REQUESTS_LIST_ID)
        : Promise.resolve([]),
      process.env.RPP_REQUESTS_LIST_ID
        ? listItems<{
            id: string;
            uuid?: string;
            requestId?: string;
            requestIdLookupId?: string | number;
            requestIdId?: string | number;
            requestIdLookup?: string | number;
            projectId?: string;
            projectCode?: string;
            projectIdLookupId?: string | number;
            projectIdId?: string | number;
            projectIdLookup?: string | number;
            projectName?: string;
          }>(process.env.RPP_REQUESTS_LIST_ID)
        : Promise.resolve([]),
      process.env.VAP_REQUESTS_LIST_ID
        ? listItems<{
            id: string;
            uuid?: string;
            requestId?: string;
            requestIdLookupId?: string | number;
            requestIdId?: string | number;
            requestIdLookup?: string | number;
            projectId?: string;
            projectCode?: string;
            projectIdLookupId?: string | number;
            projectIdId?: string | number;
            projectIdLookup?: string | number;
            projectName?: string;
          }>(process.env.VAP_REQUESTS_LIST_ID)
        : Promise.resolve([]),
      process.env.OTHERS_REQUESTS_LIST_ID
        ? listItems<{
            id: string;
            uuid?: string;
            requestId?: string;
            requestIdLookupId?: string | number;
            requestIdId?: string | number;
            requestIdLookup?: string | number;
            projectId?: string;
            projectCode?: string;
            projectIdLookupId?: string | number;
            projectIdId?: string | number;
            projectIdLookup?: string | number;
            projectName?: string;
          }>(process.env.OTHERS_REQUESTS_LIST_ID)
        : Promise.resolve([]),
      process.env.CPR_REQUESTS_LIST_ID
        ? listItems<{
            id: string;
            uuid?: string;
            requestId?: string;
            requestIdLookupId?: string | number;
            requestIdId?: string | number;
            requestIdLookup?: string | number;
            projectId?: string;
            projectCode?: string;
            projectIdLookupId?: string | number;
            projectIdId?: string | number;
            projectIdLookup?: string | number;
            projectName?: string;
          }>(process.env.CPR_REQUESTS_LIST_ID)
        : Promise.resolve([]),
      process.env.CI_REQUESTS_LIST_ID
        ? listItems<{
            id: string;
            uuid?: string;
            requestId?: string;
            requestIdLookupId?: string | number;
            requestIdId?: string | number;
            requestIdLookup?: string | number;
            projectId?: string;
            projectCode?: string;
            projectIdLookupId?: string | number;
            projectIdId?: string | number;
            projectIdLookup?: string | number;
            projectName?: string;
          }>(process.env.CI_REQUESTS_LIST_ID)
        : Promise.resolve([]),
      process.env.PROJECTS_LIST_ID
        ? listItems<{ id: string; uuid?: string; Title?: string; projectName?: string; projectCode?: string }>(process.env.PROJECTS_LIST_ID)
        : Promise.resolve([]),
    ]);

    const projectNameById = new Map(
      projectItems.map((project) => [project.id, project.projectName ?? project.Title ?? null])
    );
    const projectNameByUuid = new Map(
      projectItems
        .filter((project) => (project.uuid ?? "").trim().length > 0)
        .map((project) => [(project.uuid ?? "").trim(), project.projectName ?? project.Title ?? null])
    );
    const projectNameByCode = new Map(
      projectItems
        .filter((project) => (project.projectCode ?? "").trim().length > 0)
        .map((project) => [(project.projectCode ?? "").trim().toUpperCase(), project.projectName ?? null])
    );
    const rtpProjectNameByRequestUuid = new Map(
      rtpItems
        .filter((item) => (item.uuid ?? '').trim() && (item.projectName ?? '').trim())
        .map((item) => [(item.uuid ?? '').trim(), (item.projectName ?? '').trim()])
    );
    const pblProjectNameByRequestUuid = new Map<string, string>();
    for (const item of pblItems) {
      const requestUuid = (item.uuid ?? '').trim();
      const requestLookupValue = String(
        item.requestIdLookupId ??
          item.requestIdId ??
          item.requestIdLookup ??
          item.requestId ??
          ""
      ).trim();
      const projectIdValue =
        String(
          item.projectIdLookupId ??
          item.projectIdId ??
          item.projectIdLookup ??
          item.projectId ??
          ""
        ).trim();
      const projectCodeValue = (item.projectCode ?? "").trim().toUpperCase();
      const fallbackProjectName = (item.projectName ?? "").trim();
      const projectName =
        projectNameById.get(projectIdValue) ??
        projectNameByUuid.get(projectIdValue) ??
        projectNameByCode.get(projectCodeValue) ??
        (fallbackProjectName.length > 0 ? fallbackProjectName : null);
      const normalizedProjectName = projectName?.trim();
      if (!normalizedProjectName) continue;
      if (requestUuid) pblProjectNameByRequestUuid.set(requestUuid, normalizedProjectName);
      if (requestLookupValue) pblProjectNameByRequestUuid.set(requestLookupValue, normalizedProjectName);
    }
    const pccaProjectNameByRequestUuid = new Map<string, string>();
    for (const item of pccaItems) {
      const requestUuid = (item.uuid ?? '').trim();
      const requestLookupValue = String(
        item.requestIdLookupId ??
          item.requestIdId ??
          item.requestIdLookup ??
          item.requestId ??
          ""
      ).trim();
      const projectIdValue =
        String(
          item.projectIdLookupId ??
          item.projectIdId ??
          item.projectIdLookup ??
          item.projectId ??
          ""
        ).trim();
      const projectCodeValue = (item.projectCode ?? "").trim().toUpperCase();
      const fallbackProjectName = (item.projectName ?? "").trim();
      const projectName =
        projectNameById.get(projectIdValue) ??
        projectNameByUuid.get(projectIdValue) ??
        projectNameByCode.get(projectCodeValue) ??
        (fallbackProjectName.length > 0 ? fallbackProjectName : null);
      const normalizedProjectName = projectName?.trim();
      if (!normalizedProjectName) continue;
      if (requestUuid) pccaProjectNameByRequestUuid.set(requestUuid, normalizedProjectName);
      if (requestLookupValue) pccaProjectNameByRequestUuid.set(requestLookupValue, normalizedProjectName);
    }
    for (const item of rpccaItems) {
      const requestUuid = (item.uuid ?? '').trim();
      const requestLookupValue = String(
        item.requestIdLookupId ??
          item.requestIdId ??
          item.requestIdLookup ??
          item.requestId ??
          ""
      ).trim();
      const projectIdValue =
        String(
          item.projectIdLookupId ??
          item.projectIdId ??
          item.projectIdLookup ??
          item.projectId ??
          ""
        ).trim();
      const projectCodeValue = (item.projectCode ?? "").trim().toUpperCase();
      const fallbackProjectName = (item.projectName ?? "").trim();
      const projectName =
        projectNameById.get(projectIdValue) ??
        projectNameByUuid.get(projectIdValue) ??
        projectNameByCode.get(projectCodeValue) ??
        (fallbackProjectName.length > 0 ? fallbackProjectName : null);
      const normalizedProjectName = projectName?.trim();
      if (!normalizedProjectName) continue;
      if (requestUuid) pccaProjectNameByRequestUuid.set(requestUuid, normalizedProjectName);
      if (requestLookupValue) pccaProjectNameByRequestUuid.set(requestLookupValue, normalizedProjectName);
    }
    const ppProjectNameByRequestUuid = new Map<string, string>();
    for (const item of ppItems) {
      const requestUuid = (item.uuid ?? '').trim();
      const requestLookupValue = String(
        item.requestIdLookupId ??
          item.requestIdId ??
          item.requestIdLookup ??
          item.requestId ??
          ""
      ).trim();
      const projectIdValue =
        String(
          item.projectIdLookupId ??
          item.projectIdId ??
          item.projectIdLookup ??
          item.projectId ??
          ""
        ).trim();
      const projectCodeValue = (item.projectCode ?? "").trim().toUpperCase();
      const fallbackProjectName = (item.projectName ?? "").trim();
      const projectName =
        projectNameById.get(projectIdValue) ??
        projectNameByUuid.get(projectIdValue) ??
        projectNameByCode.get(projectCodeValue) ??
        (fallbackProjectName.length > 0 ? fallbackProjectName : null);
      const normalizedProjectName = projectName?.trim();
      if (!normalizedProjectName) continue;
      if (requestUuid) ppProjectNameByRequestUuid.set(requestUuid, normalizedProjectName);
      if (requestLookupValue) ppProjectNameByRequestUuid.set(requestLookupValue, normalizedProjectName);
    }
    const rppProjectNameByRequestUuid = new Map<string, string>();
    for (const item of rppItems) {
      const requestUuid = (item.uuid ?? '').trim();
      const requestLookupValue = String(
        item.requestIdLookupId ??
          item.requestIdId ??
          item.requestIdLookup ??
          item.requestId ??
          ""
      ).trim();
      const projectIdValue =
        String(
          item.projectIdLookupId ??
          item.projectIdId ??
          item.projectIdLookup ??
          item.projectId ??
          ""
        ).trim();
      const projectCodeValue = (item.projectCode ?? "").trim().toUpperCase();
      const fallbackProjectName = (item.projectName ?? "").trim();
      const projectName =
        projectNameById.get(projectIdValue) ??
        projectNameByUuid.get(projectIdValue) ??
        projectNameByCode.get(projectCodeValue) ??
        (fallbackProjectName.length > 0 ? fallbackProjectName : null);
      const normalizedProjectName = projectName?.trim();
      if (!normalizedProjectName) continue;
      if (requestUuid) rppProjectNameByRequestUuid.set(requestUuid, normalizedProjectName);
      if (requestLookupValue) rppProjectNameByRequestUuid.set(requestLookupValue, normalizedProjectName);
    }
    const vapProjectNameByRequestUuid = new Map<string, string>();
    for (const item of vapItems) {
      const requestUuid = (item.uuid ?? '').trim();
      const requestLookupValue = String(
        item.requestIdLookupId ??
          item.requestIdId ??
          item.requestIdLookup ??
          item.requestId ??
          ""
      ).trim();
      const projectIdValue =
        String(
          item.projectIdLookupId ??
          item.projectIdId ??
          item.projectIdLookup ??
          item.projectId ??
          ""
        ).trim();
      const projectCodeValue = (item.projectCode ?? "").trim().toUpperCase();
      const fallbackProjectName = (item.projectName ?? "").trim();
      const projectName =
        projectNameById.get(projectIdValue) ??
        projectNameByUuid.get(projectIdValue) ??
        projectNameByCode.get(projectCodeValue) ??
        (fallbackProjectName.length > 0 ? fallbackProjectName : null);
      const normalizedProjectName = projectName?.trim();
      if (!normalizedProjectName) continue;
      if (requestUuid) vapProjectNameByRequestUuid.set(requestUuid, normalizedProjectName);
      if (requestLookupValue) vapProjectNameByRequestUuid.set(requestLookupValue, normalizedProjectName);
    }
    const othersProjectNameByRequestUuid = new Map<string, string>();
    for (const item of othersItems) {
      const requestUuid = (item.uuid ?? '').trim();
      const requestLookupValue = String(
        item.requestIdLookupId ??
          item.requestIdId ??
          item.requestIdLookup ??
          item.requestId ??
          ""
      ).trim();
      const projectIdValue =
        String(
          item.projectIdLookupId ??
          item.projectIdId ??
          item.projectIdLookup ??
          item.projectId ??
          ""
        ).trim();
      const projectCodeValue = (item.projectCode ?? "").trim().toUpperCase();
      const fallbackProjectName = (item.projectName ?? "").trim();
      const projectName =
        projectNameById.get(projectIdValue) ??
        projectNameByUuid.get(projectIdValue) ??
        projectNameByCode.get(projectCodeValue) ??
        (fallbackProjectName.length > 0 ? fallbackProjectName : null);
      const normalizedProjectName = projectName?.trim();
      if (!normalizedProjectName) continue;
      if (requestUuid) othersProjectNameByRequestUuid.set(requestUuid, normalizedProjectName);
      if (requestLookupValue) othersProjectNameByRequestUuid.set(requestLookupValue, normalizedProjectName);
    }
    const cprProjectNameByRequestUuid = new Map<string, string>();
    for (const item of cprItems) {
      const requestUuid = (item.uuid ?? '').trim();
      const requestLookupValue = String(
        item.requestIdLookupId ??
          item.requestIdId ??
          item.requestIdLookup ??
          item.requestId ??
          ""
      ).trim();
      const projectIdValue =
        String(
          item.projectIdLookupId ??
          item.projectIdId ??
          item.projectIdLookup ??
          item.projectId ??
          ""
        ).trim();
      const projectCodeValue = (item.projectCode ?? "").trim().toUpperCase();
      const fallbackProjectName = (item.projectName ?? "").trim();
      const projectName =
        projectNameById.get(projectIdValue) ??
        projectNameByUuid.get(projectIdValue) ??
        projectNameByCode.get(projectCodeValue) ??
        (fallbackProjectName.length > 0 ? fallbackProjectName : null);
      const normalizedProjectName = projectName?.trim();
      if (!normalizedProjectName) continue;
      if (requestUuid) cprProjectNameByRequestUuid.set(requestUuid, normalizedProjectName);
      if (requestLookupValue) cprProjectNameByRequestUuid.set(requestLookupValue, normalizedProjectName);
    }
    const ciProjectNameByRequestUuid = new Map<string, string>();
    for (const item of ciItems) {
      const requestUuid = (item.uuid ?? '').trim();
      const requestLookupValue = String(
        item.requestIdLookupId ??
          item.requestIdId ??
          item.requestIdLookup ??
          item.requestId ??
          ""
      ).trim();
      const projectIdValue =
        String(
          item.projectIdLookupId ??
          item.projectIdId ??
          item.projectIdLookup ??
          item.projectId ??
          ""
        ).trim();
      const projectCodeValue = (item.projectCode ?? "").trim().toUpperCase();
      const fallbackProjectName = (item.projectName ?? "").trim();
      const projectName =
        projectNameById.get(projectIdValue) ??
        projectNameByUuid.get(projectIdValue) ??
        projectNameByCode.get(projectCodeValue) ??
        (fallbackProjectName.length > 0 ? fallbackProjectName : null);
      const normalizedProjectName = projectName?.trim();
      if (!normalizedProjectName) continue;
      if (requestUuid) ciProjectNameByRequestUuid.set(requestUuid, normalizedProjectName);
      if (requestLookupValue) ciProjectNameByRequestUuid.set(requestLookupValue, normalizedProjectName);
    }

    baseVisibleRequests = requestItems
      .map((item) => {
        const uuid = (item.uuid ?? '').trim();
        const id = uuid || item.id;
        const createdAt = item.Created ? new Date(item.Created) : new Date();
        const submittedAt = item.submittedAt ? new Date(item.submittedAt) : null;
        const projectName =
          (uuid ? rtpProjectNameByRequestUuid.get(uuid) : null) ??
          rtpProjectNameByRequestUuid.get(item.id) ??
          pblProjectNameByRequestUuid.get(uuid) ??
          pblProjectNameByRequestUuid.get(item.id) ??
          pccaProjectNameByRequestUuid.get(uuid) ??
          pccaProjectNameByRequestUuid.get(item.id) ??
          ppProjectNameByRequestUuid.get(uuid) ??
          ppProjectNameByRequestUuid.get(item.id) ??
          rppProjectNameByRequestUuid.get(uuid) ??
          rppProjectNameByRequestUuid.get(item.id) ??
          vapProjectNameByRequestUuid.get(uuid) ??
          vapProjectNameByRequestUuid.get(item.id) ??
          othersProjectNameByRequestUuid.get(uuid) ??
          othersProjectNameByRequestUuid.get(item.id) ??
          cprProjectNameByRequestUuid.get(uuid) ??
          cprProjectNameByRequestUuid.get(item.id) ??
          ciProjectNameByRequestUuid.get(uuid) ??
          ciProjectNameByRequestUuid.get(item.id) ??
          projectNameById.get((item.projectId ?? '').trim()) ??
          projectNameByUuid.get((item.projectId ?? '').trim()) ??
          projectNameByCode.get((item.projectCode ?? '').trim().toUpperCase()) ??
          null;
        return {
          id,
          requestNo: (item.requestNo ?? '').trim(),
          requestType: (item.requestType ?? '').trim(),
          routingType: (item.routingType ?? '').trim(),
          companyName: (item.companyName ?? '').trim(),
          companyCode: (item.companyCode ?? '').trim(),
          requestorEmail: (item.requestorEmail ?? '').trim(),
          status: (item.status ?? '').trim(),
          submittedAt: Number.isNaN(submittedAt?.getTime() ?? Number.NaN) ? null : submittedAt,
          createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
          projectName,
          projectCode: (item.projectCode ?? '').trim(),
          projectId: (item.projectId ?? '').trim(),
        } satisfies RequestRow;
      })
      .filter((item) => item.requestNo.length > 0 && item.status.length > 0)
      .filter((item) => !HIDDEN_STATUSES.includes(item.status as typeof HIDDEN_STATUSES[number]))
      .filter((item) => canSeeRequest(currentUser, item));

    visibleRequests = baseVisibleRequests.filter((item) => {
      if (selectedCompany && item.companyName !== selectedCompany) return false;
      if (selectedProject && (item.projectName ?? '') !== selectedProject) return false;
      if (selectedStatus && item.status !== selectedStatus) return false;
      if (selectedType && item.requestType !== selectedType && item.routingType !== selectedType) return false;
      return true;
    });

    visibleRequests.sort((left, right) => {
      if (sortBy === 'requestNo') {
        const cmp = left.requestNo.localeCompare(right.requestNo);
        return sortDir === 'asc' ? cmp : -cmp;
      }
      const leftTs = (left.submittedAt ?? left.createdAt).getTime();
      const rightTs = (right.submittedAt ?? right.createdAt).getTime();
      const cmp = leftTs - rightTs;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  } catch {
    loadError = true;
  }

  const companyOptions: string[] = [
    ...new Set(baseVisibleRequests.map((item) => item.companyName).filter(Boolean)),
  ].sort();
  const statusOptions: string[] = [
    ...new Set(baseVisibleRequests.map((item) => item.status).filter(Boolean)),
  ].sort();
  const typeOptions: string[] = [
    ...new Set(
      baseVisibleRequests
        .flatMap((item) => [item.requestType, item.routingType])
        .filter(Boolean)
    ),
  ].sort();
  const projectOptions: string[] = [
    ...new Set(baseVisibleRequests.map((item) => item.projectName).filter((item): item is string => Boolean(item))),
  ].sort((a, b) => a.localeCompare(b));

  const projectOptionsForFilter =
    selectedProject && !projectOptions.includes(selectedProject)
      ? [...projectOptions, selectedProject].sort((a, b) => a.localeCompare(b))
      : projectOptions;

  const buildSortHref = (column: 'requestNo' | 'submitted') => {
    const isCurrentColumn = sortBy === column;
    const nextDir: 'asc' | 'desc' = isCurrentColumn ? (sortDir === 'asc' ? 'desc' : 'asc') : 'desc';
    const query = new URLSearchParams();
    if (selectedCompany) query.set('company', selectedCompany);
    if (selectedProject) query.set('project', selectedProject);
    if (selectedStatus) query.set('status', selectedStatus);
    if (selectedType) query.set('type', selectedType);
    query.set('sortBy', column);
    query.set('sortDir', nextDir);
    return `/requests?${query.toString()}`;
  };

  return (
    <div className="space-y-6">
      <header className="page-header sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="page-title">Review requests</h1>
          <p className="page-subtitle">
            Inspect procurement submissions, apply role-based actions, and monitor lifecycle status.
          </p>
        </div>
        {canCreateRequest ? (
          <Button href="/submit" variant="primary" size="sm">
            + New Request
          </Button>
        ) : null}
      </header>

      {loadError ? (
        <div className="alert alert--danger">
          <p className="alert__title">Unable to load requests</p>
          <p className="alert__body">Please check the SharePoint configuration and try again.</p>
        </div>
      ) : null}

      <FilterBar
        companyOptions={companyOptions}
        projectOptions={projectOptionsForFilter}
        statusOptions={statusOptions}
        typeOptions={typeOptions}
        selectedCompany={selectedCompany}
        selectedProject={selectedProject}
        selectedStatus={selectedStatus}
        selectedType={selectedType}
        sortBy={sortBy}
        sortDir={sortDir}
      />

      <div className="table-shell">
        <table>
          <thead>
            <tr>
              <th>
                <Link href={buildSortHref('requestNo')} className="inline-flex items-center gap-1 hover:underline">
                  Request No
                  {sortBy === 'requestNo' ? <span>{sortDir === 'asc' ? '↑' : '↓'}</span> : null}
                </Link>
              </th>
              <th>Project Name</th>
              <th>Type</th>
              <th>Company</th>
              <th>
                <Link href={buildSortHref('submitted')} className="inline-flex items-center gap-1 hover:underline">
                  Submitted
                  {sortBy === 'submitted' ? <span>{sortDir === 'asc' ? '↑' : '↓'}</span> : null}
                </Link>
              </th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {visibleRequests.length > 0 ? (
              visibleRequests.map((request) => {
                const projectName = request.projectName ?? '—';
                const typeWithChannel = `${request.requestType} - ${request.routingType}`;

                return (
                  <tr key={request.id}>
                    <td className="font-semibold text-[var(--text)]">{cleanRequestNo(request.requestNo)}</td>
                    <td>{projectName}</td>
                    <td>{typeWithChannel}</td>
                    <td>{request.companyName}</td>
                    <td>{formatRequestDate(request.submittedAt, request.createdAt)}</td>
                    <td>
                      <span className={`badge text-sm ${STATUS_BADGE_CLASS_MAP[request.status] ?? 'badge--neutral'}`}>
                        {STATUS_DISPLAY_MAP[request.status] ?? request.status}
                      </span>
                    </td>
                    <td>
                      <div className="grid w-full items-center gap-2">
                        <Button href={`/requests/${request.id}`} variant="primary" size="sm" className="w-full flex-wrap">
                          {getActionLabel(request.status)}
                        </Button>
                        {canSeeBookEngagement ? (
                          <Button
                            href={`/requests/${request.id}/book-engagement`}
                            variant="accent"
                            size="sm"
                          >
                            Book
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="py-10 text-center">
                  <p className="text-sm font-semibold text-[var(--text)]">No requests found</p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    Try adjusting filters, or create a new request.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
