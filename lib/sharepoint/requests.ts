import "server-only";
import prisma from "@/lib/prisma";
import {
  createItem,
  listCompanies,
  listItems,
  listUsers,
  type SPCompany,
  type SPUser,
  updateItem,
} from "@/lib/sharepoint/lists";

const REVIEW_COMMENT_URL_FIELD = "review_x002d_comment_x002d_url";

function getRequestsListId(): string {
  const listId = process.env.REQUESTS_LIST_ID;
  if (!listId) {
    throw new Error("REQUESTS_LIST_ID is not set in .env.local");
  }
  return listId;
}

type ParentRequestRecord = {
  id: string;
  requestNo: string;
  requestType: string;
  routingType: string;
  category: string;
  requestorId: string;
  requestorName: string;
  requestorEmail: string;
  companyId: string;
  companyCode: string;
  companyName: string;
  status: string;
  acknowledgement: boolean;
  reviewerCommentUrls: string[];
  reviewConclusionCode1a: boolean;
  reviewConclusionCode1b: boolean;
  reviewConclusionCode2: boolean;
  reviewConclusionCode3: boolean;
  reviewConclusionCode4: boolean;
};

function buildRequestFields(
  request: ParentRequestRecord,
  user: SPUser | undefined,
  company: SPCompany | undefined
) {
  const fields: Record<string, unknown> = {
    Title: request.requestNo,
    uuid: request.id,
    requestNo: request.requestNo,
    requestType: request.requestType,
    routingType: request.routingType,
    category: request.category,
    requestorName: request.requestorName,
    requestorEmail: request.requestorEmail,
    companyCode: request.companyCode,
    companyName: request.companyName,
    status: request.status,
    acknowledgement: request.acknowledgement,
    [REVIEW_COMMENT_URL_FIELD]: request.reviewerCommentUrls ?? [],
    reviewConclusionCode1a: request.reviewConclusionCode1a,
    reviewConclusionCode1b: request.reviewConclusionCode1b,
    reviewConclusionCode2: request.reviewConclusionCode2,
    reviewConclusionCode3: request.reviewConclusionCode3,
    reviewConclusionCode4: request.reviewConclusionCode4,
    outcome: request.status,
  };

  if (user?.id) {
    fields.requestorIdLookupId = Number(user.id);
  }
  if (company?.id) {
    fields.companyIdLookupId = Number(company.id);
  }

  return fields;
}

export async function syncRequestParentToSharePoint(requestId: string): Promise<void> {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      requestNo: true,
      requestType: true,
      routingType: true,
      category: true,
      requestorId: true,
      requestorName: true,
      requestorEmail: true,
      companyId: true,
      companyCode: true,
      companyName: true,
      status: true,
      acknowledgement: true,
      reviewerCommentUrls: true,
      reviewConclusionCode1a: true,
      reviewConclusionCode1b: true,
      reviewConclusionCode2: true,
      reviewConclusionCode3: true,
      reviewConclusionCode4: true,
    },
  });

  if (!request) {
    throw new Error(`Request not found for SharePoint sync: ${requestId}`);
  }

  const requestsListId = getRequestsListId();
  const [users, companies, existingItems] = await Promise.all([
    listUsers(),
    listCompanies(),
    listItems<{ uuid?: string }>(requestsListId),
  ]);

  const requestorEmailLower = request.requestorEmail.trim().toLowerCase();
  const user = users.find(
    (u) => (u.emailLower ?? "").trim().toLowerCase() === requestorEmailLower
  );
  const company = companies.find(
    (c) => (c.companyCode ?? "").trim().toUpperCase() === request.companyCode.trim().toUpperCase()
  );

  const fields = buildRequestFields(request, user, company);
  const existing = existingItems.find((item) => item.uuid === request.id);

  if (existing?.id) {
    await updateItem(requestsListId, existing.id, fields);
    return;
  }

  await createItem(requestsListId, fields);
}

