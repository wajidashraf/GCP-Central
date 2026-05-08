import "server-only";
import { randomUUID } from "node:crypto";
import {
  createItem,
  listCompanies,
  listItems,
  listUsers,
  type SPCompany,
  type SPUser,
  updateItem,
} from "@/lib/sharepoint/lists";

type CreateCiBasePayload = {
  requestType: string;
  routingType: string;
  requestTitle: string;
  category: string;
  requestorName: string;
  requestorEmail: string;
  companyCode: string;
  companyName: string;
};

type SaveCiDetailsPayload = {
  requestId: string;
  projectId: string;
  projectCode?: string;
  companyRoleInIssue: string;
  category: string;
  voBriefOfIssues: string;
  voChronologyOfEvent: string;
  voTimeAndCostImpact: string;
  voContractClauseEntitlement: string;
  voAdvisoryRequiredFromGcp: string;
  paymentBriefOfIssues: string;
  paymentChronologyOfEvent: string;
  paymentContractClauseEntitlement: string;
  paymentAdvisoryRequiredFromGcp: string;
};

type SubmitCiPayload = {
  requestId: string;
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
  requestorEmail?: string;
  companyCode?: string;
  requestorIdLookupId?: string | number;
  companyIdLookupId?: string | number;
};

type ProjectsListItem = {
  id: string;
  uuid?: string;
  projectCode?: string;
};

type CiListItem = {
  id: string;
  uuid?: string;
  projectId?: string;
  projectIdLookupId?: string | number;
  projectIdId?: string | number;
  projectIdLookup?: string | number;
};

function getRequestsListId(): string {
  const listId = process.env.REQUESTS_LIST_ID;
  if (!listId) throw new Error("REQUESTS_LIST_ID is not set in .env.local");
  return listId;
}

function getProjectsListId(): string {
  const listId = process.env.PROJECTS_LIST_ID;
  if (!listId) throw new Error("PROJECTS_LIST_ID is not set in .env.local");
  return listId;
}

function getCiRequestsListId(): string {
  const listId = process.env.CI_REQUESTS_LIST_ID;
  if (!listId) throw new Error("CI_REQUESTS_LIST_ID is not set in .env.local");
  return listId;
}

function hasLookupValue(value: unknown): boolean {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 && normalized !== "0";
}

function normalizeText(value?: string): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
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

async function patchParentLookupFieldsIfMissing(request: RequestsListItem): Promise<void> {
  if (hasLookupValue(request.requestorIdLookupId) && hasLookupValue(request.companyIdLookupId)) {
    return;
  }

  const [users, companies] = await Promise.all([listUsers(), listCompanies()]);
  const requestorEmail = (request.requestorEmail ?? "").trim().toLowerCase();
  const companyCode = (request.companyCode ?? "").trim().toUpperCase();

  const user = users.find((entry: SPUser) => {
    const emailLower = (entry.emailLower ?? "").trim().toLowerCase();
    const email = (entry.email ?? "").trim().toLowerCase();
    return requestorEmail.length > 0 && (emailLower === requestorEmail || email === requestorEmail);
  });
  const company = companies.find((entry: SPCompany) => {
    const code = (entry.companyCode ?? "").trim().toUpperCase();
    return companyCode.length > 0 && code === companyCode;
  });

  const fields: Record<string, unknown> = {};
  if (!hasLookupValue(request.requestorIdLookupId) && user?.id) {
    fields.requestorIdLookupId = Number(user.id);
  }
  if (!hasLookupValue(request.companyIdLookupId) && company?.id) {
    fields.companyIdLookupId = Number(company.id);
  }
  if (Object.keys(fields).length === 0) return;
  await updateItem(getRequestsListId(), request.id, fields);
}

async function getRequestAndCiItemByUuid(requestUuid: string): Promise<{
  request: RequestsListItem | undefined;
  ci: CiListItem | undefined;
}> {
  const [requests, ciItems] = await Promise.all([
    listItems<RequestsListItem>(getRequestsListId()),
    listItems<CiListItem>(getCiRequestsListId()),
  ]);
  const request = requests.find((item) => item.uuid === requestUuid);
  const ci = ciItems.find((item) => item.uuid === requestUuid);
  return { request, ci };
}

export async function createCiBaseRequestInSharePoint(
  payload: CreateCiBasePayload
): Promise<{ requestId: string; requestNo: string }> {
  const requestsListId = getRequestsListId();
  const requestUuid = randomUUID();
  const requestNo = await buildNextRequestNoFromSharePoint();
  const [users, companies] = await Promise.all([listUsers(), listCompanies()]);

  const user = users.find(
    (entry) =>
      (entry.emailLower ?? "").trim().toLowerCase() === payload.requestorEmail.trim().toLowerCase() ||
      (entry.email ?? "").trim().toLowerCase() === payload.requestorEmail.trim().toLowerCase()
  );
  const company = companies.find(
    (entry) =>
      (entry.companyCode ?? "").trim().toUpperCase() === payload.companyCode.trim().toUpperCase()
  );

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

export async function saveCiDetailsInSharePoint(
  payload: SaveCiDetailsPayload
): Promise<{ projectId: string; projectCode: string }> {
  const requestsListId = getRequestsListId();
  const projectsListId = getProjectsListId();
  const ciRequestsListId = getCiRequestsListId();
  const [requests, projects, ciItems] = await Promise.all([
    listItems<RequestsListItem>(requestsListId),
    listItems<ProjectsListItem>(projectsListId),
    listItems<CiListItem>(ciRequestsListId),
  ]);

  const request = requests.find((item) => item.uuid === payload.requestId);
  if (!request?.id) throw new Error("Base request was not found. Please restart from Step 1.");
  await patchParentLookupFieldsIfMissing(request);

  const project = projects.find((item) => item.uuid === payload.projectId || item.id === payload.projectId);
  if (!project?.id) throw new Error("Selected project was not found.");

  const projectCode = (project.projectCode ?? payload.projectCode ?? "").trim();
  const existing = ciItems.find((item) => item.uuid === payload.requestId);
  const serializedCiData = JSON.stringify({
    companyRoleInIssue: payload.companyRoleInIssue,
    category: payload.category,
    voEotLeInformation: {
      briefOfIssues: payload.voBriefOfIssues,
      chronologyOfEvent: payload.voChronologyOfEvent,
      timeAndCostImpact: payload.voTimeAndCostImpact,
      contractClauseEntitlement: payload.voContractClauseEntitlement,
      advisoryRequiredFromGcp: payload.voAdvisoryRequiredFromGcp,
    },
    paymentsInformation: {
      briefOfIssues: payload.paymentBriefOfIssues,
      chronologyOfEvent: payload.paymentChronologyOfEvent,
      contractClauseEntitlement: payload.paymentContractClauseEntitlement,
      advisoryRequiredFromGcp: payload.paymentAdvisoryRequiredFromGcp,
    },
  });

  const fields: Record<string, unknown> = {
    Title: request.requestNo ?? payload.requestId,
    uuid: payload.requestId,
    requestIdLookupId: Number(request.id),
    projectIdLookupId: Number(project.id),
    projectCode: projectCode || null,
    voBriefOfIssues: normalizeText(payload.voBriefOfIssues),
    voChronologyOfEvent: normalizeText(payload.voChronologyOfEvent),
    voTimeAndCostImpact: normalizeText(payload.voTimeAndCostImpact),
    voContractClauseEntitlement: normalizeText(payload.voContractClauseEntitlement),
    voAdvisoryRequiredFromGcp: normalizeText(payload.voAdvisoryRequiredFromGcp),
    paymentBriefOfIssues: normalizeText(payload.paymentBriefOfIssues),
    paymentChronologyOfEvent: normalizeText(payload.paymentChronologyOfEvent),
    paymentContractClauseEntitlement: normalizeText(payload.paymentContractClauseEntitlement),
    paymentAdvisoryRequiredFromGcp: normalizeText(payload.paymentAdvisoryRequiredFromGcp),
    descriptionOfMatters: serializedCiData,
    eotLatestNo: null,
  };

  if (existing?.id) await updateItem(ciRequestsListId, existing.id, fields);
  else await createItem(ciRequestsListId, fields);

  await updateItem(requestsListId, request.id, {
    status: "Draft-Details",
    outcome: "Draft-Details",
  });
  return { projectId: payload.projectId, projectCode };
}

export async function submitCiRequestInSharePoint(
  payload: SubmitCiPayload
): Promise<{ requestNo: string }> {
  const { request, ci } = await getRequestAndCiItemByUuid(payload.requestId);
  if (!request?.id) throw new Error("Request was not found. Please restart the CI form.");
  await patchParentLookupFieldsIfMissing(request);
  if (!ci?.id) throw new Error("CI details are incomplete. Please review Steps 2-4 and try again.");

  const hasProject =
    hasLookupValue(ci.projectIdLookupId) ||
    hasLookupValue(ci.projectIdId) ||
    hasLookupValue(ci.projectIdLookup) ||
    hasLookupValue(ci.projectId);
  if (!hasProject) throw new Error("CI details are incomplete. Please review Steps 2-4 and try again.");

  await Promise.all([
    updateItem(getCiRequestsListId(), ci.id, {
      documentUrl: payload.documentUrl,
      documentPublicId: payload.documentPublicId,
      documentFileName: payload.documentFileName,
      documentMimeType: payload.documentMimeType,
      documentSizeBytes: String(payload.documentSizeBytes),
    }),
    updateItem(getRequestsListId(), request.id, {
      acknowledgement: true,
      status: "New",
      outcome: "New",
    }),
  ]);
  return { requestNo: request.requestNo ?? "CI" };
}

export async function clearCiDocumentByRequestUuid(requestUuid: string): Promise<void> {
  const { ci } = await getRequestAndCiItemByUuid(requestUuid);
  if (!ci?.id) return;
  await updateItem(getCiRequestsListId(), ci.id, {
    documentUrl: null,
    documentPublicId: null,
    documentFileName: null,
    documentMimeType: null,
    documentSizeBytes: null,
  });
}
