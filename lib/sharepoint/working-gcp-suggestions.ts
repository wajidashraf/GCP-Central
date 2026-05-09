import "server-only";

import { createItem, getItem, listItems, updateItem } from "@/lib/sharepoint/lists";

function getSuggestionsListId(): string {
  const listId = process.env.WORKING_GCP_SUGGESTIONS_LIST_ID;
  if (!listId) {
    throw new Error("WORKING_GCP_SUGGESTIONS_LIST_ID is not set in .env.local");
  }
  return listId;
}

/** Matches SharePoint columns — adjust internal names if your list differs. */
export type SPWorkingGcpSuggestionRow = {
  id: string;
  Title?: string;
  suggestionText?: string;
  reviewerName?: string;
  sourceRole?: string;
  /** pending | reviewed */
  reviewStatus?: string;
  /** accepted | no_need | pending */
  reviewAction?: string;
  requestIdLookupId?: string | number;
  submitterLookupId?: string | number;
  Created?: string;
  Modified?: string;
};

function isoFromRow(row: SPWorkingGcpSuggestionRow): string {
  const raw = row.Created ?? row.Modified;
  if (!raw) return new Date().toISOString();
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export async function listSuggestionsForRequestItem(
  requestItemId: string,
): Promise<SPWorkingGcpSuggestionRow[]> {
  const listId = getSuggestionsListId();
  const rid = Number(requestItemId);
  if (!Number.isFinite(rid)) return [];
  try {
    const rows = await listItems<SPWorkingGcpSuggestionRow>(listId, {
      filter: `fields/requestIdLookupId eq ${rid}`,
      orderby: "fields/Created desc",
    });
    return rows;
  } catch {
    const all = await listItems<SPWorkingGcpSuggestionRow>(listId);
    return all.filter(
      (r) => String(r.requestIdLookupId ?? "").trim() === String(requestItemId).trim(),
    );
  }
}

export async function createSuggestion(input: {
  requestItemId: string;
  submitterUserItemId: string;
  reviewerName: string;
  suggestionText: string;
  sourceRole: string;
}): Promise<SPWorkingGcpSuggestionRow & { id: string }> {
  const listId = getSuggestionsListId();
  const reqId = Number(input.requestItemId);
  const subId = Number(input.submitterUserItemId);
  const title =
    input.suggestionText.length > 255
      ? `${input.suggestionText.slice(0, 252)}...`
      : input.suggestionText;

  const fields: Record<string, unknown> = {
    Title: title,
    suggestionText: input.suggestionText,
    reviewerName: input.reviewerName,
    sourceRole: input.sourceRole,
    reviewStatus: "pending",
    requestIdLookupId: Number.isFinite(reqId) ? reqId : undefined,
    submitterLookupId: Number.isFinite(subId) ? subId : undefined,
  };

  return createItem<SPWorkingGcpSuggestionRow>(listId, fields);
}

export async function updateSuggestionAction(
  suggestionItemId: string,
  action: string,
): Promise<void> {
  const listId = getSuggestionsListId();
  const status = action === "pending" ? "pending" : "reviewed";
  await updateItem(listId, suggestionItemId, {
    reviewAction: action,
    reviewStatus: status,
  });
}

export async function getSuggestionForRequestOrThrow(
  suggestionItemId: string,
  requestItemId: string,
): Promise<SPWorkingGcpSuggestionRow & { id: string }> {
  const rows = await listSuggestionsForRequestItem(requestItemId);
  const found = rows.find((r) => String(r.id) === String(suggestionItemId));
  if (!found?.id) {
    throw new Error("Suggestion not found for this request");
  }
  return found as SPWorkingGcpSuggestionRow & { id: string };
}

export async function getSuggestionById(
  suggestionItemId: string,
): Promise<(SPWorkingGcpSuggestionRow & { id: string }) | null> {
  return getItem<SPWorkingGcpSuggestionRow>(getSuggestionsListId(), suggestionItemId);
}

/** API shape expected by existing UI (Prisma-compatible subset). */
export function mapSuggestionToApi(
  row: SPWorkingGcpSuggestionRow & { id: string },
  requestUuidOrId: string,
): Record<string, unknown> {
  return {
    id: row.id,
    requestId: requestUuidOrId,
    reviewerId: String(row.submitterLookupId ?? ""),
    reviewerName: row.reviewerName ?? null,
    suggestion: row.suggestionText ?? row.Title ?? "",
    sourceRole: row.sourceRole ?? null,
    status: row.reviewStatus ?? "pending",
    action: row.reviewAction ?? null,
    createdAt: isoFromRow(row),
    updatedAt: row.Modified ? new Date(String(row.Modified)).toISOString() : isoFromRow(row),
  };
}
