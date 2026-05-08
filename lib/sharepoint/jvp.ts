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

type CreateJvpBasePayload = {
  requestType: string;
  routingType: string;
  requestTitle: string;
  category: string;
  requestorName: string;
  requestorEmail: string;
  companyCode: string;
  companyName: string;
};

type SaveJvpProjectDetailsPayload = {
  requestId: string;
  projectId: string;
  projectCode?: string;
};

type JvpRiskItem = {
  riskIdentified: string;
  mitigationPlan: string;
};

type SaveJvpDetailsPayload = {
  requestId: string;
  teamLeader: string;
  financialMatters: string;
  technicalMatters: string;
  contractMatters: string;
  procurementMatters: string;
  costingAndEstimationMatters: string;
  implementationStage: string;
  backgroundOfCollabPoints: string[];
  scopeOfCollabPoints: string[];
  proposedStructurePoints: string[];
  keyTermsPoints: string[];
  financialOverviewPoints: string[];
  technicalCapabilitiesPoints: string[];
  workPackagesDivisionPoints: string[];
  resourcesContributionPoints: string[];
  riskReviewMitigationItems: JvpRiskItem[];
  cashflowForecastUrl: string;
  cashflowForecastPublicId: string;
  cashflowForecastFileName: string;
  cashflowForecastMimeType: string;
  cashflowForecastSizeBytes: number;
  costStructureUrl: string;
  costStructurePublicId: string;
  costStructureFileName: string;
  costStructureMimeType: string;
  costStructureSizeBytes: number;
};

type SubmitJvpPayload = {
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

type JvpListItem = {
  id: string;
  uuid?: string;
  projectId?: string;
  projectIdLookupId?: string | number;
  projectIdId?: string | number;
  projectIdLookup?: string | number;
  teamLeader?: string;
  backgroundOfCollabPoints?: string;
  riskReviewMitigationItems?: string;
  cashflowForecastPublicId?: string;
  costStructurePublicId?: string;
  documentPublicId?: string;
};

type JvpUploadedField = "document" | "cashflowForecast" | "costStructure";

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

function getJvpRequestsListId(): string {
  const listId = process.env.JVP_REQUESTS_LIST_ID;
  if (!listId) throw new Error("JVP_REQUESTS_LIST_ID is not set in .env.local");
  return listId;
}

function hasLookupValue(value: unknown): boolean {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 && normalized !== "0";
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

function pointsJson(points: string[]): string {
  return JSON.stringify(points);
}

function risksJson(items: JvpRiskItem[]): string {
  return JSON.stringify(items);
}

async function getRequestAndJvpItemByUuid(requestUuid: string): Promise<{
  request: RequestsListItem | undefined;
  jvp: JvpListItem | undefined;
}> {
  const requestsListId = getRequestsListId();
  const jvpRequestsListId = getJvpRequestsListId();
  const [requests, jvpItems] = await Promise.all([
    listItems<RequestsListItem>(requestsListId),
    listItems<JvpListItem>(jvpRequestsListId),
  ]);
  const request = requests.find((item) => item.uuid === requestUuid);
  const jvp = jvpItems.find((item) => item.uuid === requestUuid);
  return { request, jvp };
}

export async function createJvpBaseRequestInSharePoint(
  payload: CreateJvpBasePayload
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

export async function saveJvpProjectDetailsInSharePoint(
  payload: SaveJvpProjectDetailsPayload
): Promise<{ projectId: string; projectCode: string }> {
  const requestsListId = getRequestsListId();
  const projectsListId = getProjectsListId();
  const jvpRequestsListId = getJvpRequestsListId();

  const [requests, projects, jvpItems] = await Promise.all([
    listItems<RequestsListItem>(requestsListId),
    listItems<ProjectsListItem>(projectsListId),
    listItems<JvpListItem>(jvpRequestsListId),
  ]);

  const request = requests.find((item) => item.uuid === payload.requestId);
  if (!request?.id) {
    throw new Error("Base request was not found. Please restart from Step 1.");
  }
  await patchParentLookupFieldsIfMissing(request);

  const project = projects.find(
    (item) => item.uuid === payload.projectId || item.id === payload.projectId
  );
  if (!project?.id) {
    throw new Error("Selected project was not found.");
  }

  const projectCode = (project.projectCode ?? payload.projectCode ?? "").trim();
  const existing = jvpItems.find((item) => item.uuid === payload.requestId);

  const fields: Record<string, unknown> = {
    Title: request.requestNo ?? payload.requestId,
    uuid: payload.requestId,
    requestIdLookupId: Number(request.id),
    projectIdLookupId: Number(project.id),
    projectCode: projectCode || null,
  };

  if (existing?.id) {
    await updateItem(jvpRequestsListId, existing.id, fields);
  } else {
    await createItem(jvpRequestsListId, fields);
  }

  await updateItem(requestsListId, request.id, {
    status: "Draft-Details",
    outcome: "Draft-Details",
  });

  return { projectId: payload.projectId, projectCode };
}

export async function saveJvpDetailsInSharePoint(payload: SaveJvpDetailsPayload): Promise<void> {
  const { request, jvp } = await getRequestAndJvpItemByUuid(payload.requestId);
  if (!request?.id) {
    throw new Error("Base request was not found. Please restart from Step 1.");
  }
  if (!jvp?.id) {
    throw new Error("Project details are missing. Complete Step 2 first.");
  }

  const jvpRequestsListId = getJvpRequestsListId();
  const requestsListId = getRequestsListId();
  const fields: Record<string, unknown> = {
    teamLeader: payload.teamLeader,
    financialMatters: payload.financialMatters,
    technicalMatters: payload.technicalMatters,
    contractMatters: payload.contractMatters,
    procurementMatters: payload.procurementMatters,
    costingAndEstimationMatters: payload.costingAndEstimationMatters,
    implementationStage: payload.implementationStage,
    backgroundOfCollabPoints: pointsJson(payload.backgroundOfCollabPoints),
    scopeOfCollabPoints: pointsJson(payload.scopeOfCollabPoints),
    proposedStructurePoints: pointsJson(payload.proposedStructurePoints),
    keyTermsPoints: pointsJson(payload.keyTermsPoints),
    financialOverviewPoints: pointsJson(payload.financialOverviewPoints),
    technicalCapabilitiesPoints: pointsJson(payload.technicalCapabilitiesPoints),
    workPackagesDivisionPoints: pointsJson(payload.workPackagesDivisionPoints),
    resourcesContributionPoints: pointsJson(payload.resourcesContributionPoints),
    riskReviewMitigationItems: risksJson(payload.riskReviewMitigationItems),
    cashflowForecastUrl: payload.cashflowForecastUrl,
    cashflowForecastPublicId: payload.cashflowForecastPublicId,
    cashflowForecastFileName: payload.cashflowForecastFileName,
    cashflowForecastMimeType: payload.cashflowForecastMimeType,
    cashflowForecastSizeBytes: String(payload.cashflowForecastSizeBytes),
    costStructureUrl: payload.costStructureUrl,
    costStructurePublicId: payload.costStructurePublicId,
    costStructureFileName: payload.costStructureFileName,
    costStructureMimeType: payload.costStructureMimeType,
    costStructureSizeBytes: String(payload.costStructureSizeBytes),
  };

  await Promise.all([
    updateItem(jvpRequestsListId, jvp.id, fields),
    updateItem(requestsListId, request.id, {
      status: "Draft-JVP",
      outcome: "Draft-JVP",
    }),
  ]);
}

export async function submitJvpRequestInSharePoint(
  payload: SubmitJvpPayload
): Promise<{ requestNo: string }> {
  const { request, jvp } = await getRequestAndJvpItemByUuid(payload.requestId);
  if (!request?.id) {
    throw new Error("Request was not found. Please restart the JVP form.");
  }
  await patchParentLookupFieldsIfMissing(request);
  if (!jvp?.id) {
    throw new Error("JVP details are missing. Complete Step 6 first.");
  }

  const hasRequiredDetails =
    hasLookupValue(jvp.projectIdLookupId) ||
    hasLookupValue(jvp.projectIdId) ||
    hasLookupValue(jvp.projectIdLookup) ||
    hasLookupValue(jvp.projectId);

  if (
    !hasRequiredDetails ||
    !jvp.teamLeader ||
    !jvp.backgroundOfCollabPoints ||
    !jvp.riskReviewMitigationItems ||
    !jvp.cashflowForecastPublicId ||
    !jvp.costStructurePublicId
  ) {
    throw new Error("JVP details are incomplete. Please review Steps 2-6 and try again.");
  }

  const jvpRequestsListId = getJvpRequestsListId();
  const requestsListId = getRequestsListId();

  await Promise.all([
    updateItem(jvpRequestsListId, jvp.id, {
      documentUrl: payload.documentUrl,
      documentPublicId: payload.documentPublicId,
      documentFileName: payload.documentFileName,
      documentMimeType: payload.documentMimeType,
      documentSizeBytes: String(payload.documentSizeBytes),
    }),
    updateItem(requestsListId, request.id, {
      acknowledgement: true,
      status: "New",
      outcome: "New",
    }),
  ]);

  return { requestNo: request.requestNo ?? "JVP" };
}

export async function clearJvpDocumentByRequestUuid(requestUuid: string): Promise<void> {
  const { jvp } = await getRequestAndJvpItemByUuid(requestUuid);
  if (!jvp?.id) return;
  await updateItem(getJvpRequestsListId(), jvp.id, {
    documentUrl: null,
    documentPublicId: null,
    documentFileName: null,
    documentMimeType: null,
    documentSizeBytes: null,
  });
}

export async function clearJvpCashflowForecastByRequestUuid(requestUuid: string): Promise<void> {
  const { jvp } = await getRequestAndJvpItemByUuid(requestUuid);
  if (!jvp?.id) return;
  await updateItem(getJvpRequestsListId(), jvp.id, {
    cashflowForecastUrl: null,
    cashflowForecastPublicId: null,
    cashflowForecastFileName: null,
    cashflowForecastMimeType: null,
    cashflowForecastSizeBytes: null,
  });
}

export async function clearJvpCostStructureByRequestUuid(requestUuid: string): Promise<void> {
  const { jvp } = await getRequestAndJvpItemByUuid(requestUuid);
  if (!jvp?.id) return;
  await updateItem(getJvpRequestsListId(), jvp.id, {
    costStructureUrl: null,
    costStructurePublicId: null,
    costStructureFileName: null,
    costStructureMimeType: null,
    costStructureSizeBytes: null,
  });
}

export async function resolveJvpUploadedFieldByPublicId(
  requestUuid: string,
  publicId: string
): Promise<JvpUploadedField | null> {
  const { jvp } = await getRequestAndJvpItemByUuid(requestUuid);
  if (!jvp?.id) return null;

  const target = publicId.trim();
  if (!target) return null;

  if (target === (jvp.documentPublicId ?? "").trim()) return "document";
  if (target === (jvp.cashflowForecastPublicId ?? "").trim()) return "cashflowForecast";
  if (target === (jvp.costStructurePublicId ?? "").trim()) return "costStructure";
  return null;
}
