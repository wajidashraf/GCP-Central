import "server-only";

import { listItems } from "@/lib/sharepoint/lists";

function getRequestsListId(): string {
  const listId = process.env.REQUESTS_LIST_ID;
  if (!listId) throw new Error("REQUESTS_LIST_ID is not set in .env.local");
  return listId;
}

function odataString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export type SPRequestRowExtended = Record<string, unknown> & {
  id: string;
  uuid?: string;
  requestNo?: string;
  requestTitle?: string;
  requestType?: string;
  routingType?: string;
  category?: string;
  status?: string;
  companyCode?: string;
  companyName?: string;
  companyId?: string;
  companyIdLookupId?: string | number;
  requestorEmail?: string;
  verifiedAt?: string;
  verifiedOn?: string;
  acknowledgement?: boolean | string | number;
  reviewerCommentText?: string;
  reviewerDecisionCode?: string;
  reviewConclusionCode1a?: boolean | string | number;
  reviewConclusionCode1b?: boolean | string | number;
  reviewConclusionCode1bComment?: string;
  reviewConclusionCode2?: boolean | string | number;
  reviewConclusionCode3?: boolean | string | number;
  reviewConclusionCode4?: boolean | string | number;
  hocReviewAcceptanceSignUrl?: string;
  hocReviewAcceptanceSignPublicId?: string;
  hocReviewAcceptanceSignedAt?: string;
  hocReviewAcceptanceSignerLookupId?: string | number;
  hocReviewAcceptanceSignerUserId?: string;
  ackLetterTextContent?: string;
  Created?: string;
  Modified?: string;
};

/**
 * Resolve a request row by route param (SharePoint item id, uuid, or requestNo).
 */
export async function findRequestByRouteId(
  routeId: string
): Promise<(SPRequestRowExtended & { id: string }) | null> {
  const listId = getRequestsListId();
  const trimmed = routeId.trim();
  if (!trimmed) return null;

  try {
    const byUuid = await listItems<SPRequestRowExtended>(listId, {
      filter: `fields/uuid eq ${odataString(trimmed)}`,
      top: 1,
    });
    if (byUuid[0]) return byUuid[0] as SPRequestRowExtended & { id: string };
  } catch {
    // non-indexed uuid — fall through to scan
  }

  try {
    const byNo = await listItems<SPRequestRowExtended>(listId, {
      filter: `fields/requestNo eq ${odataString(trimmed)}`,
      top: 1,
    });
    if (byNo[0]) return byNo[0] as SPRequestRowExtended & { id: string };
  } catch {
    // fall through
  }

  const all = await listItems<SPRequestRowExtended>(listId);
  return (
    all.find(
      (r) =>
        String(r.id).trim() === trimmed ||
        String(r.uuid ?? "").trim() === trimmed ||
        String(r.requestNo ?? "").trim() === trimmed
    ) ?? null
  );
}

export function requestRouteIdForUrl(row: SPRequestRowExtended & { id: string }): string {
  return String(row.uuid ?? "").trim() || row.id;
}

export function userMatchesRequestCompany(
  user: { companyId?: string; companyCode?: string },
  request: SPRequestRowExtended,
): boolean {
  const uid = String(user.companyId ?? "").trim();
  const rid = String(request.companyIdLookupId ?? request.companyId ?? "").trim();
  if (uid && rid && uid === rid) return true;
  const uc = (user.companyCode ?? "").trim().toUpperCase();
  const rc = (request.companyCode ?? "").trim().toUpperCase();
  return uc !== "" && rc !== "" && uc === rc;
}

export function parseSharePointBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const s = String(value ?? "")
    .trim()
    .toLowerCase();
  return s === "true" || s === "1" || s === "yes";
}
