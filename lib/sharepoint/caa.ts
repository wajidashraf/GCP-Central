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

// SharePoint truncates internal column names to 32 characters. The keys below
// map our app-side display names to the actual internal names used in the
// CAA_REQUESTS_LIST list. Keep this in sync with the list schema.
const CAA_FIELDS = {
  claimApplicationProcess: "claimApplicationProcess",
  claimCertificationProcess: "claimCertificationProcess",
  variationOrderApplicationProcess: "variationOrderApplicationProcess",
  extensionOfTimeApplicationProcess: "extensionOfTimeApplicationProces",
  commissioningCompletionManagementSystems: "commissioningCompletionManagemen",
  keyDeliveryMilestone: "keyDeliveryMilestone",
  mandatoryTestingRequiredToCommission: "mandatoryTestingRequiredToCommis",
  documentRequiredForContractualAcceptance: "documentRequiredForContractualAc",
  preRequisiteDocumentsForDlp: "preRequisiteDocumentsForDlp",
  organisationAndManpowerChartUrl: "organisationAndManpowerChartUrl",
  organisationAndManpowerChartPublicId: "organisationAndManpowerChartPubl",
  organisationAndManpowerChartFileName: "organisationAndManpowerChartFile",
  organisationAndManpowerChartMimeType: "organisationAndManpowerChartMime",
  organisationAndManpowerChartSizeBytes: "organisationAndManpowerChartSize",
} as const;

type CreateCaaBasePayload = {
  requestType: string;
  routingType: string;
  requestTitle: string;
  category: string;
  requestorName: string;
  requestorEmail: string;
  companyCode: string;
  companyName: string;
};

type SaveCaaProjectDetailsPayload = {
  requestId: string;
  projectId: string;
  projectCode?: string;
};

type CaaTableRow = {
  no_of_days?: string;
  clause_reference?: string;
  description?: string;
};

type SaveCaaDetailsPayload = {
  requestId: string;
  tenderProposalPrice?: number;
  finalContractAmount?: number;
  estimatedBudgetCost?: number;
  estimatedMarginPercent?: number;
  tenderProposalRefNo?: string;
  loaDate?: string;
  contractCommencementDate?: string;
  contractCompletionDate?: string;
  contractPeriodDays?: number;
  performanceBondForProject?: string;
  stampDutyInclusiveLegalFees?: number;
  insurance?: string;
  bumiputeraParticipation?: string;
  formationOfJvCompany?: string;
  criticalActivityMilestone?: string;
  defectLiabilityPeriodDlp?: string;
  liquidatedDamagesRate?: number;
  paymentTerm?: string;
  typeOfContract?: string;
  formOfContractCondition?: string;
  projectDirector?: string;
  contactPersonAtSite?: string;
  claimApplicationProcess?: CaaTableRow[];
  claimCertificationProcess?: CaaTableRow[];
  variationOrderApplicationProcess?: CaaTableRow[];
  extensionOfTimeApplicationProcess?: CaaTableRow[];
  commissioningCompletionManagementSystems?: CaaTableRow[];
  keyDeliveryMilestone?: CaaTableRow[];
  mandatoryTestingRequiredToCommission?: CaaTableRow[];
  documentRequiredForContractualAcceptance?: CaaTableRow[];
  preRequisiteDocumentsForDlp?: CaaTableRow[];
  organisationAndManpowerChartUrl?: string;
  organisationAndManpowerChartPublicId?: string;
  organisationAndManpowerChartFileName?: string;
  organisationAndManpowerChartMimeType?: string;
  organisationAndManpowerChartSizeBytes?: number;
};

type SubmitCaaPayload = {
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

type CaaListItem = {
  id: string;
  uuid?: string;
  documentPublicId?: string;
  organisationAndManpowerChartPubl?: string;
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

function getCaaRequestsListId(): string {
  const listId = process.env.CAA_REQUESTS_LIST_ID;
  if (!listId) throw new Error("CAA_REQUESTS_LIST_ID is not set in .env.local");
  return listId;
}

function normalizeText(value?: string): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNumber(value?: number): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function tableJson(rows?: CaaTableRow[]): string {
  return JSON.stringify(rows ?? []);
}

function hasLookupValue(value: unknown): boolean {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 && normalized !== "0";
}

async function patchParentLookupFieldsIfMissing(request: RequestsListItem): Promise<void> {
  if (
    hasLookupValue(request.requestorIdLookupId) &&
    hasLookupValue(request.companyIdLookupId)
  ) {
    return;
  }

  const [users, companies] = await Promise.all([listUsers(), listCompanies()]);
  const requestorEmail = (request.requestorEmail ?? "").trim().toLowerCase();
  const companyCode = (request.companyCode ?? "").trim().toUpperCase();

  const user = users.find((entry: SPUser) => {
    const emailLower = (entry.emailLower ?? "").trim().toLowerCase();
    const email = (entry.email ?? "").trim().toLowerCase();
    return (
      requestorEmail.length > 0 && (emailLower === requestorEmail || email === requestorEmail)
    );
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

export async function createCaaBaseRequestInSharePoint(
  payload: CreateCaaBasePayload
): Promise<{ requestId: string; requestNo: string }> {
  const requestsListId = getRequestsListId();
  const requestUuid = randomUUID();
  const requestNo = await buildNextRequestNoFromSharePoint();

  const [users, companies] = await Promise.all([listUsers(), listCompanies()]);
  const user = users.find(
    (entry) =>
      (entry.emailLower ?? "").trim().toLowerCase() ===
        payload.requestorEmail.trim().toLowerCase() ||
      (entry.email ?? "").trim().toLowerCase() ===
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

export async function saveCaaProjectDetailsInSharePoint(
  payload: SaveCaaProjectDetailsPayload
): Promise<{ projectId: string; projectCode: string }> {
  const requestsListId = getRequestsListId();
  const projectsListId = getProjectsListId();
  const caaRequestsListId = getCaaRequestsListId();

  const [requests, projects, caaItems] = await Promise.all([
    listItems<RequestsListItem>(requestsListId),
    listItems<ProjectsListItem>(projectsListId),
    listItems<CaaListItem>(caaRequestsListId),
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
  const existing = caaItems.find((item) => item.uuid === payload.requestId);

  const fields: Record<string, unknown> = {
    Title: request.requestNo ?? payload.requestId,
    uuid: payload.requestId,
    requestIdLookupId: Number(request.id),
    projectIdLookupId: Number(project.id),
    projectCode: projectCode || null,
  };

  if (existing?.id) {
    await updateItem(caaRequestsListId, existing.id, fields);
  } else {
    await createItem(caaRequestsListId, fields);
  }

  await updateItem(requestsListId, request.id, {
    status: "Draft-Details",
    outcome: "Draft-Details",
  });

  return { projectId: payload.projectId, projectCode };
}

export async function saveCaaDetailsInSharePoint(
  payload: SaveCaaDetailsPayload
): Promise<void> {
  const requestsListId = getRequestsListId();
  const caaRequestsListId = getCaaRequestsListId();

  const [requests, caaItems] = await Promise.all([
    listItems<RequestsListItem>(requestsListId),
    listItems<CaaListItem>(caaRequestsListId),
  ]);

  const request = requests.find((item) => item.uuid === payload.requestId);
  if (!request?.id) {
    throw new Error("Base request was not found. Please restart from Step 1.");
  }
  const caa = caaItems.find((item) => item.uuid === payload.requestId);
  if (!caa?.id) {
    throw new Error("Project details are missing. Complete Step 2 first.");
  }

  const fields: Record<string, unknown> = {
    tenderProposalPrice: normalizeNumber(payload.tenderProposalPrice),
    finalContractAmount: normalizeNumber(payload.finalContractAmount),
    estimatedBudgetCost: normalizeNumber(payload.estimatedBudgetCost),
    estimatedMarginPercent: normalizeNumber(payload.estimatedMarginPercent),
    tenderProposalRefNo: normalizeText(payload.tenderProposalRefNo),
    contractPeriodDays: normalizeNumber(payload.contractPeriodDays),
    performanceBondForProject: normalizeText(payload.performanceBondForProject),
    stampDutyInclusiveLegalFees: normalizeNumber(payload.stampDutyInclusiveLegalFees),
    insurance: normalizeText(payload.insurance),
    bumiputeraParticipation: normalizeText(payload.bumiputeraParticipation),
    formationOfJvCompany: normalizeText(payload.formationOfJvCompany),
    criticalActivityMilestone: normalizeText(payload.criticalActivityMilestone),
    defectLiabilityPeriodDlp: normalizeText(payload.defectLiabilityPeriodDlp),
    liquidatedDamagesRate: normalizeNumber(payload.liquidatedDamagesRate),
    paymentTerm: normalizeText(payload.paymentTerm),
    typeOfContract: normalizeText(payload.typeOfContract),
    formOfContractCondition: normalizeText(payload.formOfContractCondition),
    projectDirector: normalizeText(payload.projectDirector),
    contactPersonAtSite: normalizeText(payload.contactPersonAtSite),

    [CAA_FIELDS.claimApplicationProcess]: tableJson(payload.claimApplicationProcess),
    [CAA_FIELDS.claimCertificationProcess]: tableJson(payload.claimCertificationProcess),
    [CAA_FIELDS.variationOrderApplicationProcess]: tableJson(
      payload.variationOrderApplicationProcess
    ),
    [CAA_FIELDS.extensionOfTimeApplicationProcess]: tableJson(
      payload.extensionOfTimeApplicationProcess
    ),
    [CAA_FIELDS.commissioningCompletionManagementSystems]: tableJson(
      payload.commissioningCompletionManagementSystems
    ),
    [CAA_FIELDS.keyDeliveryMilestone]: tableJson(payload.keyDeliveryMilestone),
    [CAA_FIELDS.mandatoryTestingRequiredToCommission]: tableJson(
      payload.mandatoryTestingRequiredToCommission
    ),
    [CAA_FIELDS.documentRequiredForContractualAcceptance]: tableJson(
      payload.documentRequiredForContractualAcceptance
    ),
    [CAA_FIELDS.preRequisiteDocumentsForDlp]: tableJson(payload.preRequisiteDocumentsForDlp),

    [CAA_FIELDS.organisationAndManpowerChartUrl]: normalizeText(
      payload.organisationAndManpowerChartUrl
    ),
    [CAA_FIELDS.organisationAndManpowerChartPublicId]: normalizeText(
      payload.organisationAndManpowerChartPublicId
    ),
    [CAA_FIELDS.organisationAndManpowerChartFileName]: normalizeText(
      payload.organisationAndManpowerChartFileName
    ),
    [CAA_FIELDS.organisationAndManpowerChartMimeType]: normalizeText(
      payload.organisationAndManpowerChartMimeType
    ),
    [CAA_FIELDS.organisationAndManpowerChartSizeBytes]:
      payload.organisationAndManpowerChartSizeBytes != null
        ? String(payload.organisationAndManpowerChartSizeBytes)
        : null,
  };

  await Promise.all([
    updateItem(caaRequestsListId, caa.id, fields),
    updateItem(requestsListId, request.id, {
      status: "Draft-CAA",
      outcome: "Draft-CAA",
    }),
  ]);
}

export async function submitCaaRequestInSharePoint(
  payload: SubmitCaaPayload
): Promise<{ requestNo: string }> {
  const requestsListId = getRequestsListId();
  const caaRequestsListId = getCaaRequestsListId();

  const [requests, caaItems] = await Promise.all([
    listItems<RequestsListItem>(requestsListId),
    listItems<CaaListItem>(caaRequestsListId),
  ]);

  const request = requests.find((item) => item.uuid === payload.requestId);
  if (!request?.id) {
    throw new Error("Request was not found. Please restart the CAA form.");
  }
  await patchParentLookupFieldsIfMissing(request);

  const caa = caaItems.find((item) => item.uuid === payload.requestId);
  if (!caa?.id) {
    throw new Error("CAA details are incomplete. Please review the previous steps and try again.");
  }

  await Promise.all([
    updateItem(caaRequestsListId, caa.id, {
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

  return { requestNo: request.requestNo ?? "CAA" };
}

export async function clearCaaDocumentByRequestUuid(requestUuid: string): Promise<void> {
  const caaRequestsListId = getCaaRequestsListId();
  const caaItems = await listItems<CaaListItem>(caaRequestsListId);
  const caa = caaItems.find((item) => item.uuid === requestUuid);
  if (!caa?.id) return;

  await updateItem(caaRequestsListId, caa.id, {
    documentUrl: null,
    documentPublicId: null,
    documentFileName: null,
    documentMimeType: null,
    documentSizeBytes: null,
  });
}

export async function clearCaaOrganisationChartByRequestUuid(
  requestUuid: string
): Promise<void> {
  const caaRequestsListId = getCaaRequestsListId();
  const caaItems = await listItems<CaaListItem>(caaRequestsListId);
  const caa = caaItems.find((item) => item.uuid === requestUuid);
  if (!caa?.id) return;

  await updateItem(caaRequestsListId, caa.id, {
    [CAA_FIELDS.organisationAndManpowerChartUrl]: null,
    [CAA_FIELDS.organisationAndManpowerChartPublicId]: null,
    [CAA_FIELDS.organisationAndManpowerChartFileName]: null,
    [CAA_FIELDS.organisationAndManpowerChartMimeType]: null,
    [CAA_FIELDS.organisationAndManpowerChartSizeBytes]: null,
  });
}

/**
 * Resolve which uploaded asset on a CAA item a given Drive item ID corresponds to.
 * Used by the upload route's DELETE handler so we know which set of columns to clear
 * (final document vs. organisation chart) without requiring the caller to specify it.
 */
export async function resolveCaaUploadedFieldByPublicId(
  requestUuid: string,
  publicId: string
): Promise<"document" | "organisationChart" | null> {
  const caaRequestsListId = getCaaRequestsListId();
  const caaItems = await listItems<CaaListItem>(caaRequestsListId);
  const caa = caaItems.find((item) => item.uuid === requestUuid);
  if (!caa?.id) return null;

  const documentPublicId = (caa.documentPublicId ?? "").trim();
  const orgChartPublicId = (caa.organisationAndManpowerChartPubl ?? "").trim();
  const target = publicId.trim();

  if (target.length > 0 && target === documentPublicId) return "document";
  if (target.length > 0 && target === orgChartPublicId) return "organisationChart";
  return null;
}
