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

type CreateStspBasePayload = {
  requestType: string;
  routingType: string;
  requestTitle: string;
  category: string;
  requestorName: string;
  requestorEmail: string;
  companyCode: string;
  companyName: string;
};

type SaveStspProjectDetailsPayload = {
  requestId: string;
  projectId: string;
  projectCode?: string;
  tenderProposalSubmissionDate: string;
  tenderValidityPeriodDays: number;
};

type StspRiskItem = {
  riskIdentified: string;
  mitigationPlan: string;
};

type SaveStspDetailsPayload = {
  requestId: string;
  teamLeader: string;
  financialMatters: string;
  technicalMatters: string;
  contractMatters: string;
  procurementMatters: string;
  costingAndEstimationMatters: string;
  implementationStage: string;
  backgroundReview: string;
  scopeOfWorks: string;
  keyTerms: string;
  financialPoints: string[];
  technical: string;
  procurementStrategyWorkPackages: string;
  sourcingReference: string;
  costBreakdown: string;
  riskReviewMitigationItems: StspRiskItem[];
  contractStructureUrl?: string;
  contractStructurePublicId?: string;
  contractStructureFileName?: string;
  contractStructureMimeType?: string;
  contractStructureSizeBytes?: number;
  revenueVsCostUrl?: string;
  revenueVsCostPublicId?: string;
  revenueVsCostFileName?: string;
  revenueVsCostMimeType?: string;
  revenueVsCostSizeBytes?: number;
  cashflowUrl?: string;
  cashflowPublicId?: string;
  cashflowFileName?: string;
  cashflowMimeType?: string;
  cashflowSizeBytes?: number;
};

type SubmitStspPayload = {
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

type StspListItem = {
  id: string;
  uuid?: string;
  projectId?: string;
  projectIdLookupId?: string | number;
  projectIdId?: string | number;
  projectIdLookup?: string | number;
  teamLeader?: string;
  backgroundReview?: string;
  riskReviewMitigationItems?: string;
  documentPublicId?: string;
  contractStructurePublicId?: string;
  revenueVsCostPublicId?: string;
  cashflowPublicId?: string;
};

type StspUploadedField =
  | "document"
  | "contractStructure"
  | "revenueVsCost"
  | "cashflow";

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

function getStspRequestsListId(): string {
  const listId = process.env.STSP_REQUESTS_LIST_ID;
  if (!listId) throw new Error("STSP_REQUESTS_LIST_ID is not set in .env.local");
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

function risksJson(items: StspRiskItem[]): string {
  return JSON.stringify(items);
}

async function getRequestAndStspItemByUuid(requestUuid: string): Promise<{
  request: RequestsListItem | undefined;
  stsp: StspListItem | undefined;
}> {
  const [requests, stspItems] = await Promise.all([
    listItems<RequestsListItem>(getRequestsListId()),
    listItems<StspListItem>(getStspRequestsListId()),
  ]);
  const request = requests.find((item) => item.uuid === requestUuid);
  const stsp = stspItems.find((item) => item.uuid === requestUuid);
  return { request, stsp };
}

export async function createStspBaseRequestInSharePoint(
  payload: CreateStspBasePayload
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

export async function saveStspProjectDetailsInSharePoint(
  payload: SaveStspProjectDetailsPayload
): Promise<{ projectId: string; projectCode: string }> {
  const requestsListId = getRequestsListId();
  const projectsListId = getProjectsListId();
  const stspRequestsListId = getStspRequestsListId();

  const [requests, projects, stspItems] = await Promise.all([
    listItems<RequestsListItem>(requestsListId),
    listItems<ProjectsListItem>(projectsListId),
    listItems<StspListItem>(stspRequestsListId),
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
  const existing = stspItems.find((item) => item.uuid === payload.requestId);
  const fields: Record<string, unknown> = {
    Title: request.requestNo ?? payload.requestId,
    uuid: payload.requestId,
    requestIdLookupId: Number(request.id),
    projectIdLookupId: Number(project.id),
    projectCode: projectCode || null,
    tenderProposalSubmissionDate: payload.tenderProposalSubmissionDate,
    tenderValidityPeriodDays: String(payload.tenderValidityPeriodDays),
  };

  if (existing?.id) {
    await updateItem(stspRequestsListId, existing.id, fields);
  } else {
    await createItem(stspRequestsListId, fields);
  }

  await updateItem(requestsListId, request.id, {
    status: "Draft-Details",
    outcome: "Draft-Details",
  });

  return { projectId: payload.projectId, projectCode };
}

export async function saveStspDetailsInSharePoint(payload: SaveStspDetailsPayload): Promise<void> {
  const { request, stsp } = await getRequestAndStspItemByUuid(payload.requestId);
  if (!request?.id) {
    throw new Error("Base request was not found. Please restart from Step 1.");
  }
  if (!stsp?.id) {
    throw new Error("Project details are missing. Complete Step 2 first.");
  }

  const stspRequestsListId = getStspRequestsListId();
  const requestsListId = getRequestsListId();
  const fields: Record<string, unknown> = {
    teamLeader: payload.teamLeader,
    financialMatters: payload.financialMatters,
    technicalMatters: payload.technicalMatters,
    contractMatters: payload.contractMatters,
    procurementMatters: payload.procurementMatters,
    costingAndEstimationMatters: payload.costingAndEstimationMatters,
    implementationStage: payload.implementationStage,
    backgroundReview: payload.backgroundReview,
    scopeOfWorks: payload.scopeOfWorks,
    keyTerms: payload.keyTerms,
    financialPoints: pointsJson(payload.financialPoints),
    technical: payload.technical,
    procurementStrategyWorkPackages: payload.procurementStrategyWorkPackages,
    sourcingReference: payload.sourcingReference,
    costBreakdown: payload.costBreakdown,
    riskReviewMitigationItems: risksJson(payload.riskReviewMitigationItems),
    contractStructureUrl: normalizeText(payload.contractStructureUrl),
    contractStructurePublicId: normalizeText(payload.contractStructurePublicId),
    contractStructureFileName: normalizeText(payload.contractStructureFileName),
    contractStructureMimeType: normalizeText(payload.contractStructureMimeType),
    contractStructureSizeBytes:
      payload.contractStructureSizeBytes != null ? String(payload.contractStructureSizeBytes) : null,
    revenueVsCostUrl: normalizeText(payload.revenueVsCostUrl),
    revenueVsCostPublicId: normalizeText(payload.revenueVsCostPublicId),
    revenueVsCostFileName: normalizeText(payload.revenueVsCostFileName),
    revenueVsCostMimeType: normalizeText(payload.revenueVsCostMimeType),
    revenueVsCostSizeBytes:
      payload.revenueVsCostSizeBytes != null ? String(payload.revenueVsCostSizeBytes) : null,
    cashflowUrl: normalizeText(payload.cashflowUrl),
    cashflowPublicId: normalizeText(payload.cashflowPublicId),
    cashflowFileName: normalizeText(payload.cashflowFileName),
    cashflowMimeType: normalizeText(payload.cashflowMimeType),
    cashflowSizeBytes: payload.cashflowSizeBytes != null ? String(payload.cashflowSizeBytes) : null,
  };

  await Promise.all([
    updateItem(stspRequestsListId, stsp.id, fields),
    updateItem(requestsListId, request.id, {
      status: "Draft-STSP",
      outcome: "Draft-STSP",
    }),
  ]);
}

export async function submitStspRequestInSharePoint(
  payload: SubmitStspPayload
): Promise<{ requestNo: string }> {
  const { request, stsp } = await getRequestAndStspItemByUuid(payload.requestId);
  if (!request?.id) {
    throw new Error("Request was not found. Please restart the STSP form.");
  }
  await patchParentLookupFieldsIfMissing(request);
  if (!stsp?.id) {
    throw new Error("STSP details are missing. Complete Steps 2-5 first.");
  }

  const hasProject =
    hasLookupValue(stsp.projectIdLookupId) ||
    hasLookupValue(stsp.projectIdId) ||
    hasLookupValue(stsp.projectIdLookup) ||
    hasLookupValue(stsp.projectId);
  if (!hasProject || !stsp.teamLeader || !stsp.backgroundReview || !stsp.riskReviewMitigationItems) {
    throw new Error("STSP details are incomplete. Please review Steps 2-5 and try again.");
  }

  const stspRequestsListId = getStspRequestsListId();
  const requestsListId = getRequestsListId();
  await Promise.all([
    updateItem(stspRequestsListId, stsp.id, {
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

  return { requestNo: request.requestNo ?? "STSP" };
}

export async function clearStspDocumentByRequestUuid(requestUuid: string): Promise<void> {
  const { stsp } = await getRequestAndStspItemByUuid(requestUuid);
  if (!stsp?.id) return;
  await updateItem(getStspRequestsListId(), stsp.id, {
    documentUrl: null,
    documentPublicId: null,
    documentFileName: null,
    documentMimeType: null,
    documentSizeBytes: null,
  });
}

export async function clearStspContractStructureByRequestUuid(requestUuid: string): Promise<void> {
  const { stsp } = await getRequestAndStspItemByUuid(requestUuid);
  if (!stsp?.id) return;
  await updateItem(getStspRequestsListId(), stsp.id, {
    contractStructureUrl: null,
    contractStructurePublicId: null,
    contractStructureFileName: null,
    contractStructureMimeType: null,
    contractStructureSizeBytes: null,
  });
}

export async function clearStspRevenueVsCostByRequestUuid(requestUuid: string): Promise<void> {
  const { stsp } = await getRequestAndStspItemByUuid(requestUuid);
  if (!stsp?.id) return;
  await updateItem(getStspRequestsListId(), stsp.id, {
    revenueVsCostUrl: null,
    revenueVsCostPublicId: null,
    revenueVsCostFileName: null,
    revenueVsCostMimeType: null,
    revenueVsCostSizeBytes: null,
  });
}

export async function clearStspCashflowByRequestUuid(requestUuid: string): Promise<void> {
  const { stsp } = await getRequestAndStspItemByUuid(requestUuid);
  if (!stsp?.id) return;
  await updateItem(getStspRequestsListId(), stsp.id, {
    cashflowUrl: null,
    cashflowPublicId: null,
    cashflowFileName: null,
    cashflowMimeType: null,
    cashflowSizeBytes: null,
  });
}

export async function resolveStspUploadedFieldByPublicId(
  requestUuid: string,
  publicId: string
): Promise<StspUploadedField | null> {
  const { stsp } = await getRequestAndStspItemByUuid(requestUuid);
  if (!stsp?.id) return null;

  const target = publicId.trim();
  if (!target) return null;
  if (target === (stsp.documentPublicId ?? "").trim()) return "document";
  if (target === (stsp.contractStructurePublicId ?? "").trim()) return "contractStructure";
  if (target === (stsp.revenueVsCostPublicId ?? "").trim()) return "revenueVsCost";
  if (target === (stsp.cashflowPublicId ?? "").trim()) return "cashflow";
  return null;
}
