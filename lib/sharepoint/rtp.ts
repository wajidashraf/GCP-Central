import "server-only";
import { randomUUID } from "node:crypto";
import {
  createItem,
  listCompanies,
  listItems,
  listUsers,
  updateItem,
  type SPCompany,
  type SPUser,
} from "@/lib/sharepoint/lists";

type CreateRtpBasePayload = {
  requestType: string;
  routingType: string;
  requestTitle: string;
  category: string;
  requestorName: string;
  requestorEmail: string;
  companyCode: string;
  companyName: string;
};

type SaveRtpDetailsPayload = {
  requestId: string;
  clientName: string;
  registrationType: number;
  tenderClosingDate?: string;
  numberOfDaysAfterTenderClosingDate?: string;
  validityPeriod?: string;
  projectName: string;
  projectDescription: string;
  companyCode: string;
  companyName: string;
};

type SubmitRtpPayload = {
  requestId: string;
  acknowledgement: boolean;
  specialProject: boolean;
  documentUrl: string;
  documentPublicId: string;
  documentFileName: string;
  documentMimeType: string;
  documentSizeBytes: number;
};

type RequestsListItem = {
  id: string;
  uuid?: string;
  requestNo?: string;
  requestType?: string;
  routingType?: string;
  category?: string;
  requestorEmail?: string;
  companyCode?: string;
  companyName?: string;
  status?: string;
};

type ProjectsListItem = {
  id: string;
  uuid?: string;
  projectCode?: string;
  projectName?: string;
  companyCode?: string;
  companyName?: string;
  createdFromRequestId?: string;
  createdFromRequestIdLookupId?: string | number;
  createdFromRequestIdId?: string | number;
};

type RtpListItem = {
  id: string;
  uuid?: string;
  requestId?: string;
  projectName?: string;
  clientName?: string;
};

function projectLinksToRequest(project: ProjectsListItem, requestSpId: string): boolean {
  const record = project as Record<string, unknown>;
  const candidates = [
    project.createdFromRequestId,
    project.createdFromRequestIdLookupId,
    project.createdFromRequestIdId,
    record.createdFromRequestIdLookup,
    record.createdFromRequestIdLookupId,
    record.createdFromRequestIdId,
    record.createdFromRequestId,
  ];
  const normalized = candidates
    .map((value) => String(value ?? "").trim())
    .filter((value) => value.length > 0);
  return normalized.includes(String(requestSpId));
}

function buildDateSegment(date: Date) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}${month}${day}`;
}

function extractSequence(requestNo: string, dateSegment: string, prefix: string) {
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escapedPrefix}-(\\d+)-${dateSegment}$`);
  const match = requestNo.match(pattern);
  if (!match?.[1]) return null;
  const sequence = Number(match[1]);
  return Number.isFinite(sequence) && sequence > 0 ? sequence : null;
}

async function buildNextRequestNoFromSharePoint(prefix = "REQ", sequenceWidth = 4) {
  const requestsListId = getRequestsListId();
  const dateSegment = buildDateSegment(new Date());
  const requests = await listItems<RequestsListItem>(requestsListId);
  const maxSequence = requests.reduce((max, request) => {
    const value = extractSequence(request.requestNo ?? "", dateSegment, prefix);
    return value && value > max ? value : max;
  }, 0);
  const nextSequence = `${maxSequence + 1}`.padStart(sequenceWidth, "0");
  return `${prefix}-${nextSequence}-${dateSegment}`;
}

function getRequestsListId(): string {
  const listId = process.env.REQUESTS_LIST_ID;
  if (!listId) throw new Error("REQUESTS_LIST_ID is not set in .env.local");
  return listId;
}

function getRtpRequestsListId(): string {
  const listId = process.env.RTP_REQUESTS_LIST_ID;
  if (!listId) throw new Error("RTP_REQUESTS_LIST_ID is not set in .env.local");
  return listId;
}

function getProjectsListId(): string {
  const listId = process.env.PROJECTS_LIST_ID;
  if (!listId) throw new Error("PROJECTS_LIST_ID is not set in .env.local");
  return listId;
}

function normalizeDateTime(value?: string): string | null {
  if (!value?.trim()) return null;
  const date = new Date(`${value.trim()}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function resolveLookups(requestorEmail: string, companyCode: string): Promise<{
  user: SPUser | undefined;
  company: SPCompany | undefined;
}> {
  const [users, companies] = await Promise.all([listUsers(), listCompanies()]);
  const user = users.find(
    (u) => (u.emailLower ?? "").trim().toLowerCase() === requestorEmail.trim().toLowerCase()
  );
  const company = companies.find(
    (c) => (c.companyCode ?? "").trim().toUpperCase() === companyCode.trim().toUpperCase()
  );
  return { user, company };
}

export async function createRtpBaseRequestInSharePoint(
  payload: CreateRtpBasePayload
): Promise<{ requestId: string; requestNo: string }> {
  const requestsListId = getRequestsListId();
  const requestUuid = randomUUID();
  const requestNo = await buildNextRequestNoFromSharePoint();
  const { user, company } = await resolveLookups(payload.requestorEmail, payload.companyCode);

  const fields: Record<string, unknown> = {
    Title: payload.requestTitle,
    uuid: requestUuid,
    requestNo,
    requestType: payload.requestType,
    routingType: payload.routingType,
    category: payload.category,
    requestorName: payload.requestorName,
    requestorEmail: payload.requestorEmail,
    companyCode: payload.companyCode,
    companyName: payload.companyName,
    status: "Draft",
    acknowledgement: false,
    outcome: "Draft",
  };

  if (user?.id) fields.requestorIdLookupId = Number(user.id);
  if (company?.id) fields.companyIdLookupId = Number(company.id);

  await createItem(requestsListId, fields);
  return { requestId: requestUuid, requestNo };
}

export async function saveRtpDetailsInSharePoint(
  payload: SaveRtpDetailsPayload
): Promise<{ projectId: string }> {
  const requestsListId = getRequestsListId();
  const projectsListId = getProjectsListId();
  const rtpListId = getRtpRequestsListId();

  const [requests, projects, rtpItems, companies] = await Promise.all([
    listItems<RequestsListItem>(requestsListId),
    listItems<ProjectsListItem>(projectsListId),
    listItems<RtpListItem>(rtpListId),
    listCompanies(),
  ]);

  const request = requests.find((item) => item.uuid === payload.requestId);
  if (!request) {
    throw new Error("Base request was not found. Please restart from Step 1.");
  }

  const company = companies.find(
    (c) => (c.companyCode ?? "").trim().toUpperCase() === payload.companyCode.trim().toUpperCase()
  );

  let project = projects.find((p) => p.uuid === payload.requestId);
  if (!project) {
    project = projects.find((p) => projectLinksToRequest(p, request.id));
  }
  if (!project) {
    project = projects.find(
      (p) =>
        (p.projectName ?? "").trim().toLowerCase() === payload.projectName.trim().toLowerCase() &&
        (p.companyCode ?? "").trim().toUpperCase() === payload.companyCode.trim().toUpperCase()
    );
  }

  // Keep one project record per originating request to avoid duplicates.
  const projectUuid = project?.uuid ?? payload.requestId;
  const projectCode = project?.projectCode ?? `PRJ-${projectUuid.slice(0, 8).toUpperCase()}`;

  const projectFields: Record<string, unknown> = {
    Title: payload.projectName,
    uuid: projectUuid,
    projectStatus: "Inactive",
    companyCode: payload.companyCode,
    companyName: payload.companyName,
    projectCode,
  };
  if (request.id) {
    projectFields.createdFromRequestIdLookupId = Number(request.id);
  }
  if (company?.id) {
    projectFields.companyIdLookupId = Number(company.id);
  }

  if (project?.id) {
    await updateItem(projectsListId, project.id, projectFields);
  } else {
    await createItem(projectsListId, projectFields);
  }

  const latestProjects = await listItems<ProjectsListItem>(projectsListId);
  const persistedProject = latestProjects.find((p) => p.uuid === projectUuid);
  if (!persistedProject?.id) {
    throw new Error("Unable to persist project in SharePoint.");
  }

  const rtpFields: Record<string, unknown> = {
    Title: request.requestNo ?? payload.requestId,
    uuid: payload.requestId,
    clientName: payload.clientName,
    registrationType: String(payload.registrationType),
    numberOfDaysAfterTenderClosingDa: payload.numberOfDaysAfterTenderClosingDate
      ? Number(payload.numberOfDaysAfterTenderClosingDate)
      : null,
    tenderClosingDate: payload.tenderClosingDate
      ? new Date(`${payload.tenderClosingDate}T00:00:00.000Z`).toISOString()
      : null,
    validityPeriod: normalizeDateTime(payload.validityPeriod),
    projectName: payload.projectName,
    projectDescription: payload.projectDescription,
    requestIdLookupId: Number(request.id),
  };

  const existingRtp = rtpItems.find((item) => item.uuid === payload.requestId);
  if (existingRtp?.id) {
    await updateItem(rtpListId, existingRtp.id, rtpFields);
  } else {
    await createItem(rtpListId, rtpFields);
  }

  await updateItem(requestsListId, request.id, {
    status: "Draft-Details",
    outcome: "Draft-Details",
  });

  return { projectId: projectUuid };
}

export async function submitRtpRequestInSharePoint(
  payload: SubmitRtpPayload
): Promise<{ requestNo: string }> {
  const requestsListId = getRequestsListId();
  const rtpListId = getRtpRequestsListId();

  const [requests, rtpItems] = await Promise.all([
    listItems<RequestsListItem>(requestsListId),
    listItems<RtpListItem>(rtpListId),
  ]);

  const request = requests.find((item) => item.uuid === payload.requestId);
  if (!request?.id) {
    throw new Error("Request was not found. Please restart the RTP form.");
  }

  const rtp = rtpItems.find((item) => item.uuid === payload.requestId);
  if (!rtp?.id) {
    throw new Error("RTP details are missing. Complete Step 2 first.");
  }

  await updateItem(rtpListId, rtp.id, {
    specialProject: payload.specialProject ?? false,
    documentUrl: payload.documentUrl,
    documentPublicId: payload.documentPublicId,
    documentFileName: payload.documentFileName,
    documentMimeType: payload.documentMimeType,
    documentSizeBytes: String(payload.documentSizeBytes),
  });

  await updateItem(requestsListId, request.id, {
    acknowledgement: payload.acknowledgement,
    status: "New",
    outcome: "New",
  });

  return { requestNo: request.requestNo ?? "RTP" };
}

export async function clearRtpDocumentByRequestUuid(requestUuid: string): Promise<void> {
  const rtpListId = getRtpRequestsListId();
  const items = await listItems<RtpListItem>(rtpListId);
  const rtp = items.find((item) => item.uuid === requestUuid);
  if (!rtp?.id) return;
  await updateItem(rtpListId, rtp.id, {
    documentUrl: null,
    documentPublicId: null,
    documentFileName: null,
    documentMimeType: null,
    documentSizeBytes: null,
  });
}

