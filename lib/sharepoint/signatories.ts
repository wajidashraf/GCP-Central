import "server-only";

import { createItem, deleteItem, getItem, listItems } from "@/lib/sharepoint/lists";

function getSignatoryMembersListId(): string {
  const listId = process.env.SIGNATORY_MEMBERS_LIST_ID;
  if (!listId) throw new Error("SIGNATORY_MEMBERS_LIST_ID is not set in .env.local");
  return listId;
}

function getRequestSignaturesListId(): string {
  const listId = process.env.REQUEST_SIGNATURES_LIST_ID;
  if (!listId) throw new Error("REQUEST_SIGNATURES_LIST_ID is not set in .env.local");
  return listId;
}

/** SharePoint Signatory Members — columns should align with list provisioning. */
export type SPSignatoryMemberRow = {
  id: string;
  Title?: string;
  signatoryGroup?: string;
  /** legacy plain text if present */
  group?: string;
  email?: string;
  emailLower?: string;
  sortOrder?: string | number;
};

/** SharePoint Request Signatures list */
export type SPRequestSignatureRow = {
  id: string;
  requestIdLookupId?: string | number;
  signatoryMemberLookupId?: string | number;
  signatoryName?: string;
  signatoryEmail?: string;
  signatoryEmailLower?: string;
  signatureGroup?: string;
  signUrl?: string;
  signPublicId?: string;
  signedAt?: string;
  signerUserLookupId?: string | number;
};

function memberGroup(row: SPSignatoryMemberRow): string {
  return String(row.signatoryGroup ?? row.group ?? "").trim().toLowerCase();
}

export async function getSignatoryMemberById(
  memberId: string,
): Promise<(SPSignatoryMemberRow & { id: string }) | null> {
  return getItem<SPSignatoryMemberRow>(getSignatoryMembersListId(), memberId);
}

export async function listSignatoryMembersOrdered(): Promise<SPSignatoryMemberRow[]> {
  const listId = getSignatoryMembersListId();
  const rows = await listItems<SPSignatoryMemberRow>(listId);
  return rows.sort((a, b) => {
    const ga = memberGroup(a);
    const gb = memberGroup(b);
    if (ga !== gb) return ga.localeCompare(gb);
    const sa = Number(a.sortOrder ?? 0);
    const sb = Number(b.sortOrder ?? 0);
    if (sa !== sb) return sa - sb;
    return String(a.Title ?? "").localeCompare(String(b.Title ?? ""));
  });
}

export async function createSignatoryMember(input: {
  group: string;
  name: string;
  email: string;
  emailLower: string;
  sortOrder: number;
}): Promise<SPSignatoryMemberRow & { id: string }> {
  const listId = getSignatoryMembersListId();
  return createItem<SPSignatoryMemberRow>(listId, {
    Title: input.name,
    signatoryGroup: input.group,
    email: input.email,
    emailLower: input.emailLower,
    sortOrder: input.sortOrder,
  });
}

export async function deleteSignatoryMember(memberId: string): Promise<void> {
  await deleteItem(getSignatoryMembersListId(), memberId);
}

export async function countSignaturesForSignatoryMember(memberId: string): Promise<number> {
  const listId = getRequestSignaturesListId();
  const mid = Number(memberId);
  if (!Number.isFinite(mid)) return 0;
  try {
    const rows = await listItems<{ id: string }>(listId, {
      filter: `fields/signatoryMemberLookupId eq ${mid}`,
      top: 500,
    });
    return rows.length;
  } catch {
    const all = await listItems<SPRequestSignatureRow>(listId);
    return all.filter((r) => String(r.signatoryMemberLookupId ?? "").trim() === memberId.trim())
      .length;
  }
}

export async function listSignaturesForRequest(requestItemId: string): Promise<SPRequestSignatureRow[]> {
  const listId = getRequestSignaturesListId();
  const rid = Number(requestItemId);
  if (!Number.isFinite(rid)) return [];
  try {
    return listItems<SPRequestSignatureRow>(listId, {
      filter: `fields/requestIdLookupId eq ${rid}`,
    });
  } catch {
    const all = await listItems<SPRequestSignatureRow>(listId);
    return all.filter((r) => String(r.requestIdLookupId ?? "").trim() === requestItemId.trim());
  }
}

export async function findSignatureByRequestAndMember(
  requestItemId: string,
  signatoryMemberItemId: string,
): Promise<(SPRequestSignatureRow & { id: string }) | null> {
  const rid = Number(requestItemId);
  const mid = Number(signatoryMemberItemId);
  if (!Number.isFinite(rid) || !Number.isFinite(mid)) return null;
  const listId = getRequestSignaturesListId();
  try {
    const rows = await listItems<SPRequestSignatureRow>(listId, {
      filter: `fields/requestIdLookupId eq ${rid} and fields/signatoryMemberLookupId eq ${mid}`,
      top: 1,
    });
    return (rows[0] as (SPRequestSignatureRow & { id: string }) | undefined) ?? null;
  } catch {
    const rows = await listSignaturesForRequest(requestItemId);
    return (
      rows.find((r) => String(r.signatoryMemberLookupId ?? "").trim() === signatoryMemberItemId.trim()) ??
      null
    );
  }
}

export async function createRequestSignature(input: {
  requestItemId: string;
  signatoryMemberItemId: string;
  signatoryName: string;
  signatoryEmail: string;
  signatoryEmailLower: string;
  signatureGroup: string;
  signUrl: string;
  signPublicId: string | null;
  signerUserItemId: string;
}): Promise<SPRequestSignatureRow & { id: string }> {
  const listId = getRequestSignaturesListId();
  const reqId = Number(input.requestItemId);
  const memId = Number(input.signatoryMemberItemId);
  const signerLookupId = Number(input.signerUserItemId);

  const fields: Record<string, unknown> = {
    Title: `${input.signatoryName} — ${input.signatureGroup}`,
    requestIdLookupId: Number.isFinite(reqId) ? reqId : undefined,
    signatoryMemberLookupId: Number.isFinite(memId) ? memId : undefined,
    signatoryName: input.signatoryName,
    signatoryEmail: input.signatoryEmail,
    signatoryEmailLower: input.signatoryEmailLower,
    signatureGroup: input.signatureGroup,
    signUrl: input.signUrl,
    signPublicId: input.signPublicId ?? "",
    signedAt: new Date().toISOString(),
    signerUserLookupId: Number.isFinite(signerLookupId) ? signerLookupId : undefined,
  };

  return createItem<SPRequestSignatureRow>(listId, fields);
}
