import "server-only";
import { randomUUID } from "node:crypto";
import {
  createItem,
  deleteItem,
  listItems,
  listCompanies,
  listUsers,
  type SPCompany,
  type SPUser,
  updateItem,
} from "@/lib/sharepoint/lists";
import { PROCUREMENT_METHODS } from "@/src/constants/enums";

type CreatePblBasePayload = {
  requestType: string;
  routingType: string;
  requestTitle: string;
  category: string;
  requestorName: string;
  requestorEmail: string;
  companyCode: string;
  companyName: string;
};

type SavePblDetailsPayload = {
  requestId: string;
  projectId: string;
  projectCode?: string;
  procurementMethod: number;
};

type SavePblBiddersPayload = {
  requestId: string;
  bidders: Array<{
    companyName: string;
    customCompanyName?: string;
    customSector?: string;
    location: string;
    personInCharge: string;
    picContactNumber: string;
    sourcesFrom?: string;
    recommendationBy?: string;
  }>;
  justificationForLessBidders?: string;
};

type SubmitPblPayload = {
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

type PblListItem = {
  id: string;
  uuid?: string;
  requestId?: string;
};

type PblBidderListItem = {
  id: string;
  pblRequestId?: string;
  pblRequestIdLookupId?: string | number;
  pblRequestIdId?: string | number;
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

function getPblRequestsListId(): string {
  const listId = process.env.PBL_REQUESTS_LIST_ID;
  if (!listId) throw new Error("PBL_REQUESTS_LIST_ID is not set in .env.local");
  return listId;
}

function getPblBiddersListId(): string {
  const listId = process.env.PBL_BIDDERS_LIST_ID;
  if (!listId) throw new Error("PBL_BIDDERS_LIST_ID is not set in .env.local");
  return listId;
}

function procurementMethodLabel(value: number): string {
  return PROCUREMENT_METHODS.find((method) => method.value === value)?.label ?? String(value);
}

function normalizeText(value?: string): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
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

  const user = users.find((entry) => {
    const emailLower = (entry.emailLower ?? "").trim().toLowerCase();
    const email = (entry.email ?? "").trim().toLowerCase();
    return requestorEmail.length > 0 && (emailLower === requestorEmail || email === requestorEmail);
  });
  const company = companies.find((entry) => {
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

function bidderLinksToPbl(bidder: PblBidderListItem, pblId: string): boolean {
  const record = bidder as Record<string, unknown>;
  const candidates = [
    bidder.pblRequestId,
    bidder.pblRequestIdLookupId,
    bidder.pblRequestIdId,
    record.pblRequestIdLookup,
    record.pblRequestIdLookupId,
    record.pblRequestIdId,
    record.pblRequestId,
  ];
  const normalized = candidates
    .map((value) => String(value ?? "").trim())
    .filter((value) => value.length > 0);
  return normalized.includes(String(pblId));
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

export async function createPblBaseRequestInSharePoint(
  payload: CreatePblBasePayload
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
  if (user?.id) {
    fields.requestorIdLookupId = Number(user.id);
  }
  if (company?.id) {
    fields.companyIdLookupId = Number(company.id);
  }

  await createItem(requestsListId, fields);

  return { requestId: requestUuid, requestNo };
}

export async function savePblDetailsInSharePoint(
  payload: SavePblDetailsPayload
): Promise<{ projectId: string; projectCode: string }> {
  const requestsListId = getRequestsListId();
  const projectsListId = getProjectsListId();
  const pblRequestsListId = getPblRequestsListId();

  const [requests, projects, pblItems] = await Promise.all([
    listItems<RequestsListItem>(requestsListId),
    listItems<ProjectsListItem>(projectsListId),
    listItems<PblListItem>(pblRequestsListId),
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
  const existingPbl = pblItems.find((item) => item.uuid === payload.requestId);

  const pblFields: Record<string, unknown> = {
    Title: request.requestNo ?? payload.requestId,
    uuid: payload.requestId,
    projectCode: projectCode || null,
    procurementMethod: procurementMethodLabel(payload.procurementMethod),
    requestIdLookupId: Number(request.id),
    projectIdLookupId: Number(project.id),
  };

  if (existingPbl?.id) {
    await updateItem(pblRequestsListId, existingPbl.id, pblFields);
  } else {
    await createItem(pblRequestsListId, pblFields);
  }

  await updateItem(requestsListId, request.id, {
    status: "Draft-Details",
    outcome: "Draft-Details",
  });

  return {
    projectId: payload.projectId,
    projectCode,
  };
}

export async function savePblBiddersInSharePoint(
  payload: SavePblBiddersPayload
): Promise<{ bidderCount: number }> {
  const pblRequestsListId = getPblRequestsListId();
  const pblBiddersListId = getPblBiddersListId();
  const requestsListId = getRequestsListId();

  const [pblItems, existingBidders, requests, companies] = await Promise.all([
    listItems<PblListItem>(pblRequestsListId),
    listItems<PblBidderListItem>(pblBiddersListId),
    listItems<RequestsListItem>(requestsListId),
    listCompanies(),
  ]);

  const pbl = pblItems.find((item) => item.uuid === payload.requestId);
  if (!pbl?.id) {
    throw new Error("Project details are missing. Complete Step 2 first.");
  }

  const request = requests.find((item) => item.uuid === payload.requestId);
  if (!request?.id) {
    throw new Error("Base request was not found. Please restart from Step 1.");
  }

  const biddersToDelete = existingBidders.filter((item) => bidderLinksToPbl(item, pbl.id));
  await Promise.all(biddersToDelete.map((item) => deleteItem(pblBiddersListId, item.id)));

  await Promise.all(
    payload.bidders.map(async (bidder) => {
      const company = companies.find(
        (entry) =>
          (entry.Title ?? "").trim().toLowerCase() === bidder.companyName.trim().toLowerCase()
      );

      const bidderFields: Record<string, unknown> = {
        Title: bidder.companyName,
        uuid: randomUUID(),
        pblRequestIdLookupId: Number(pbl.id),
        customCompanyName: normalizeText(bidder.customCompanyName),
        customSector: normalizeText(bidder.customSector),
        location: bidder.location,
        personInCharge: bidder.personInCharge,
        picContactNumber: bidder.picContactNumber,
        sourcesFrom: bidder.sourcesFrom ?? "",
        recommendationBy: bidder.recommendationBy ?? "",
      };

      if (company?.id) {
        bidderFields.companyNameLookupId = Number(company.id);
      }

      await createItem(pblBiddersListId, bidderFields);
    })
  );

  await Promise.all([
    updateItem(pblRequestsListId, pbl.id, {
      justificationForLessBidders: normalizeText(payload.justificationForLessBidders),
    }),
    updateItem(requestsListId, request.id, {
      status: "Draft-Bidders",
      outcome: "Draft-Bidders",
    }),
  ]);

  return { bidderCount: payload.bidders.length };
}

export async function submitPblRequestInSharePoint(
  payload: SubmitPblPayload
): Promise<{ requestNo: string }> {
  const requestsListId = getRequestsListId();
  const pblRequestsListId = getPblRequestsListId();
  const pblBiddersListId = getPblBiddersListId();

  const [requests, pblItems, bidders] = await Promise.all([
    listItems<RequestsListItem>(requestsListId),
    listItems<PblListItem & { justificationForLessBidders?: string }>(pblRequestsListId),
    listItems<PblBidderListItem>(pblBiddersListId),
  ]);

  const request = requests.find((item) => item.uuid === payload.requestId);
  if (!request?.id) {
    throw new Error("Request was not found. Please restart the PBL form.");
  }
  await patchParentLookupFieldsIfMissing(request);

  const pbl = pblItems.find((item) => item.uuid === payload.requestId);
  if (!pbl?.id) {
    throw new Error("PBL project details are missing. Complete Step 2 first.");
  }

  await Promise.all([
    updateItem(pblRequestsListId, pbl.id, {
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

  return {
    requestNo: request.requestNo ?? "PBL",
  };
}

export async function getPblSubmissionSnapshotFromSharePoint(requestId: string): Promise<{
  bidderCount: number;
  justificationForLessBidders: string | null;
}> {
  const pblRequestsListId = getPblRequestsListId();
  const pblBiddersListId = getPblBiddersListId();

  const [pblItems, bidders] = await Promise.all([
    listItems<PblListItem & { justificationForLessBidders?: string }>(pblRequestsListId),
    listItems<PblBidderListItem>(pblBiddersListId),
  ]);

  const pbl = pblItems.find((item) => item.uuid === requestId);
  if (!pbl?.id) {
    throw new Error("PBL project details are missing. Complete Step 2 first.");
  }

  const linkedBidders = bidders.filter((item) => bidderLinksToPbl(item, pbl.id));

  return {
    bidderCount: linkedBidders.length,
    justificationForLessBidders: normalizeText(pbl.justificationForLessBidders),
  };
}

export async function clearPblDocumentByRequestUuid(requestUuid: string): Promise<void> {
  const pblRequestsListId = getPblRequestsListId();
  const pblItems = await listItems<PblListItem>(pblRequestsListId);
  const pbl = pblItems.find((item) => item.uuid === requestUuid);
  if (!pbl?.id) return;

  await updateItem(pblRequestsListId, pbl.id, {
    documentUrl: null,
    documentPublicId: null,
    documentFileName: null,
    documentMimeType: null,
    documentSizeBytes: null,
  });
}
