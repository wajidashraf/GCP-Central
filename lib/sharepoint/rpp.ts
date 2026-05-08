import "server-only";
import { randomUUID } from "node:crypto";
import { createItem, listCompanies, listItems, listUsers, updateItem } from "@/lib/sharepoint/lists";

type CreateRppBasePayload = {
  requestType: string;
  routingType: string;
  requestTitle: string;
  category: string;
  requestorName: string;
  requestorEmail: string;
  companyCode: string;
  companyName: string;
};

type SaveRppDetailsPayload = {
  requestId: string;
  projectId: string;
  projectCode?: string;
};

type SubmitRppPayload = {
  requestId: string;
  documentUrl: string;
  documentPublicId: string;
  documentFileName: string;
  documentMimeType: string;
  documentSizeBytes: number;
};

type RequestsListItem = { id: string; uuid?: string; requestNo?: string };
type ProjectsListItem = { id: string; uuid?: string; projectCode?: string };
type RppListItem = { id: string; uuid?: string };

function getRequestsListId() {
  const listId = process.env.REQUESTS_LIST_ID;
  if (!listId) throw new Error("REQUESTS_LIST_ID is not set in .env.local");
  return listId;
}

function getProjectsListId() {
  const listId = process.env.PROJECTS_LIST_ID;
  if (!listId) throw new Error("PROJECTS_LIST_ID is not set in .env.local");
  return listId;
}

function getRppRequestsListId() {
  const listId = process.env.RPP_REQUESTS_LIST_ID;
  if (!listId) throw new Error("RPP_REQUESTS_LIST_ID is not set in .env.local");
  return listId;
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

export async function createRppBaseRequestInSharePoint(
  payload: CreateRppBasePayload
): Promise<{ requestId: string; requestNo: string }> {
  const requestsListId = getRequestsListId();
  const requestUuid = randomUUID();
  const requestNo = await buildNextRequestNoFromSharePoint();

  const [users, companies] = await Promise.all([listUsers(), listCompanies()]);
  const user = users.find((u) => (u.emailLower ?? "").trim().toLowerCase() === payload.requestorEmail.trim().toLowerCase());
  const company = companies.find((c) => (c.companyCode ?? "").trim().toUpperCase() === payload.companyCode.trim().toUpperCase());

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

export async function saveRppDetailsInSharePoint(
  payload: SaveRppDetailsPayload
): Promise<{ projectId: string; projectCode: string }> {
  const requestsListId = getRequestsListId();
  const projectsListId = getProjectsListId();
  const rppRequestsListId = getRppRequestsListId();
  const [requests, projects, rppItems] = await Promise.all([
    listItems<RequestsListItem>(requestsListId),
    listItems<ProjectsListItem>(projectsListId),
    listItems<RppListItem>(rppRequestsListId),
  ]);
  const request = requests.find((r) => r.uuid === payload.requestId);
  if (!request?.id) throw new Error("Base request was not found. Please restart from Step 1.");
  const project = projects.find((p) => p.uuid === payload.projectId || p.id === payload.projectId);
  if (!project?.id) throw new Error("Selected project was not found.");
  const existing = rppItems.find((item) => item.uuid === payload.requestId);
  const projectCode = (project.projectCode ?? payload.projectCode ?? "").trim();
  const fields: Record<string, unknown> = {
    Title: request.requestNo ?? payload.requestId,
    uuid: payload.requestId,
    requestIdLookupId: Number(request.id),
    projectIdLookupId: Number(project.id),
    projectCode: projectCode || null,
  };
  if (existing?.id) await updateItem(rppRequestsListId, existing.id, fields);
  else await createItem(rppRequestsListId, fields);

  await updateItem(requestsListId, request.id, { status: "Draft-Details", outcome: "Draft-Details" });
  return { projectId: payload.projectId, projectCode };
}

export async function submitRppRequestInSharePoint(payload: SubmitRppPayload): Promise<{ requestNo: string }> {
  const requestsListId = getRequestsListId();
  const rppRequestsListId = getRppRequestsListId();
  const [requests, rppItems] = await Promise.all([
    listItems<RequestsListItem>(requestsListId),
    listItems<RppListItem>(rppRequestsListId),
  ]);
  const request = requests.find((r) => r.uuid === payload.requestId);
  if (!request?.id) throw new Error("Request was not found. Please restart the RPP form.");
  const rpp = rppItems.find((p) => p.uuid === payload.requestId);
  if (!rpp?.id) throw new Error("RPP details are incomplete. Please review Step 2 and try again.");

  await Promise.all([
    updateItem(rppRequestsListId, rpp.id, {
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
  return { requestNo: request.requestNo ?? "RPP" };
}

export async function clearRppDocumentByRequestUuid(requestUuid: string): Promise<void> {
  const rppRequestsListId = getRppRequestsListId();
  const rppItems = await listItems<RppListItem>(rppRequestsListId);
  const rpp = rppItems.find((item) => item.uuid === requestUuid);
  if (!rpp?.id) return;
  await updateItem(rppRequestsListId, rpp.id, {
    documentUrl: null,
    documentPublicId: null,
    documentFileName: null,
    documentMimeType: null,
    documentSizeBytes: null,
  });
}
