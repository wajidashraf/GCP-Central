import "server-only";
import { randomUUID } from "node:crypto";
import { createItem, listCompanies, listItems, listUsers, updateItem } from "@/lib/sharepoint/lists";

type CreatePccaBasePayload = {
  requestType: string;
  routingType: string;
  requestTitle: string;
  category: string;
  requestorName: string;
  requestorEmail: string;
  companyCode: string;
  companyName: string;
};

type SavePccaProjectDetailsPayload = {
  requestId: string;
  projectId: string;
  projectCode?: string;
};

type SavePccaDetailsPayload = {
  requestId: string;
  priceRevenueFromContractBq: unknown[];
  costFromContractBq: unknown[];
  totalRevenueRm?: number;
  totalCostRm?: number;
  constructionCostRm?: number;
  internalCost?: number;
  remarks?: string;
};

type SubmitPccaPayload = {
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
  requestType?: string;
};

type ProjectsListItem = {
  id: string;
  uuid?: string;
  projectCode?: string;
};

type PccaListItem = {
  id: string;
  uuid?: string;
};

type PccaRequestType = "PCCA" | "R-PCCA";

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

function getPccaRequestsListId(): string {
  const listId = process.env.PCCA_REQUESTS_LIST_ID;
  if (!listId) throw new Error("PCCA_REQUESTS_LIST_ID is not set in .env.local");
  return listId;
}

function getRpccaRequestsListId(): string {
  const listId = process.env.RPCCA_REQUESTS_LIST_ID;
  if (!listId) throw new Error("RPCCA_REQUESTS_LIST_ID is not set in .env.local");
  return listId;
}

function normalizeRequestType(value?: string): PccaRequestType {
  return (value ?? "").trim().toUpperCase() === "R-PCCA" ? "R-PCCA" : "PCCA";
}

function getListIdForRequestType(requestType: PccaRequestType): string {
  return requestType === "R-PCCA" ? getRpccaRequestsListId() : getPccaRequestsListId();
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

function normalizeText(value?: string): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export async function createPccaBaseRequestInSharePoint(
  payload: CreatePccaBasePayload
): Promise<{ requestId: string; requestNo: string }> {
  const requestsListId = getRequestsListId();
  const requestUuid = randomUUID();
  const requestNo = await buildNextRequestNoFromSharePoint();

  const [users, companies] = await Promise.all([listUsers(), listCompanies()]);
  const user = users.find(
    (entry) =>
      (entry.emailLower ?? "").trim().toLowerCase() ===
      payload.requestorEmail.trim().toLowerCase()
  );
  const company = companies.find(
    (entry) =>
      (entry.companyCode ?? "").trim().toUpperCase() ===
      payload.companyCode.trim().toUpperCase()
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

export async function savePccaProjectDetailsInSharePoint(
  payload: SavePccaProjectDetailsPayload
): Promise<{ projectId: string; projectCode: string }> {
  const requestsListId = getRequestsListId();
  const projectsListId = getProjectsListId();
  const [requests, projects] = await Promise.all([
    listItems<RequestsListItem>(requestsListId),
    listItems<ProjectsListItem>(projectsListId),
  ]);

  const request = requests.find((item) => item.uuid === payload.requestId);
  if (!request?.id) {
    throw new Error("Base request was not found. Please restart from Step 1.");
  }
  const requestType = normalizeRequestType(request.requestType);
  const requestListId = getListIdForRequestType(requestType);
  const pccaItems = await listItems<PccaListItem>(requestListId);

  const project = projects.find((item) => item.uuid === payload.projectId || item.id === payload.projectId);
  if (!project?.id) {
    throw new Error("Selected project was not found.");
  }

  const projectCode = (project.projectCode ?? payload.projectCode ?? "").trim();
  const existing = pccaItems.find((item) => item.uuid === payload.requestId);

  const fields: Record<string, unknown> = {
    Title: request.requestNo ?? payload.requestId,
    uuid: payload.requestId,
    requestIdLookupId: Number(request.id),
    projectIdLookupId: Number(project.id),
    projectCode: projectCode || null,
  };

  if (existing?.id) {
    await updateItem(requestListId, existing.id, fields);
  } else {
    await createItem(requestListId, fields);
  }

  await updateItem(requestsListId, request.id, {
    status: "Draft-Details",
    outcome: "Draft-Details",
  });

  return { projectId: payload.projectId, projectCode };
}

export async function savePccaDetailsInSharePoint(payload: SavePccaDetailsPayload): Promise<void> {
  const requestsListId = getRequestsListId();
  const requests = await listItems<RequestsListItem>(requestsListId);

  const request = requests.find((item) => item.uuid === payload.requestId);
  if (!request?.id) throw new Error("Base request was not found. Please restart from Step 1.");
  const requestType = normalizeRequestType(request.requestType);
  const requestListId = getListIdForRequestType(requestType);
  const pccaItems = await listItems<PccaListItem>(requestListId);
  const pcca = pccaItems.find((item) => item.uuid === payload.requestId);
  if (!pcca?.id) throw new Error("Project details are missing. Complete Step 2 first.");

  const workItemEntryJson = JSON.stringify(payload.priceRevenueFromContractBq ?? []);
  const costFromContractBqJson = JSON.stringify(payload.costFromContractBq ?? []);
  const remarksValue = normalizeText(payload.remarks);

  // Keep field names aligned with their dedicated list schemas.
  // PCCA: `priceRevenueFromContractBq`/`costFromContractBq` + `remarks`
  // R-PCCA: `workItemEntry` + `Remarks`
  const detailFields: Record<string, unknown> = {
    priceRevenueFromContractBq: workItemEntryJson,
    costFromContractBq: costFromContractBqJson,
    totalRevenueRm: payload.totalRevenueRm ?? null,
    totalCostRm: payload.totalCostRm ?? null,
    constructionCostRm: payload.constructionCostRm ?? null,
    internalCost: payload.internalCost ?? null,
    remarks: remarksValue,
  };
  if (requestType === "R-PCCA") {
    delete detailFields.priceRevenueFromContractBq;
    delete detailFields.costFromContractBq;
    delete detailFields.remarks;
    detailFields.workItemEntry = workItemEntryJson;
    detailFields.Remarks = remarksValue;
  }

  await Promise.all([
    updateItem(requestListId, pcca.id, detailFields),
    updateItem(requestsListId, request.id, {
      status: "Draft-PCCA",
      outcome: "Draft-PCCA",
    }),
  ]);
}

export async function submitPccaRequestInSharePoint(
  payload: SubmitPccaPayload
): Promise<{ requestNo: string }> {
  const requestsListId = getRequestsListId();
  const requests = await listItems<RequestsListItem>(requestsListId);

  const request = requests.find((item) => item.uuid === payload.requestId);
  if (!request?.id) throw new Error("Request was not found. Please restart the PCCA form.");
  const requestType = normalizeRequestType(request.requestType);
  const requestListId = getListIdForRequestType(requestType);
  const pccaItems = await listItems<PccaListItem>(requestListId);
  const pcca = pccaItems.find((item) => item.uuid === payload.requestId);
  if (!pcca?.id) throw new Error("PCCA details are incomplete. Please review Steps 2-4 and try again.");

  await Promise.all([
    updateItem(requestListId, pcca.id, {
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

  return { requestNo: request.requestNo ?? "PCCA" };
}

export async function clearPccaDocumentByRequestUuid(
  requestUuid: string,
  requestType?: string
): Promise<void> {
  const normalizedType = normalizeRequestType(requestType);
  const targetLists =
    requestType && requestType.trim().length > 0
      ? [getListIdForRequestType(normalizedType)]
      : [getPccaRequestsListId(), getRpccaRequestsListId()];

  for (const listId of targetLists) {
    const pccaItems = await listItems<PccaListItem>(listId);
    const pcca = pccaItems.find((item) => item.uuid === requestUuid);
    if (!pcca?.id) continue;
    await updateItem(listId, pcca.id, {
      documentUrl: null,
      documentPublicId: null,
      documentFileName: null,
      documentMimeType: null,
      documentSizeBytes: null,
    });
    return;
  }
}
