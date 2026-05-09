import "server-only";

import { randomUUID } from "crypto";
import {
  createItem,
  getItem,
  listItems,
  listUsers,
  parseRoles,
  updateItem,
  type SPUser,
} from "@/lib/sharepoint/lists";

// ─── list IDs ───────────────────────────────────────────────────────────────

function getRequestsListId(): string {
  const listId = process.env.REQUESTS_LIST_ID;
  if (!listId) throw new Error("REQUESTS_LIST_ID is not set in .env.local");
  return listId;
}

function getEngagementsListId(): string {
  const listId = process.env.ENGAGEMENTS_LIST_ID;
  if (!listId) throw new Error("ENGAGEMENTS_LIST_ID is not set in .env.local");
  return listId;
}

function getEngagementSlotsListId(): string {
  const listId = process.env.ENGAGEMENT_SLOTS_LIST_ID;
  if (!listId) throw new Error("ENGAGEMENT_SLOTS_LIST_ID is not set in .env.local");
  return listId;
}

function odataString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

// ─── types ─────────────────────────────────────────────────────────────────

export type SPEngagementRow = {
  id: string;
  Title?: string;
  uuid?: string;
  requestIdLookupId?: string | number;
  slotIdLookupId?: string | number;
  requestorIdLookupId?: string | number;
  engagementNumber?: string;
  name?: string;
  type?: string;
  location?: string;
  status?: string;
  notes?: string;
  requestUuid?: string;
  slotItemId?: string;
  requestorUserId?: string;
};

function normalizeLookupId(value: string | number | undefined): string | undefined {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim();
  return normalized || undefined;
}

export type SPEngagementSlotRow = {
  id: string;
  slotName?: string;
  startTime?: string;
  endTime?: string;
  attendees?: string;
  status?: string;
};

export type SPRequestRow = {
  id: string;
  uuid?: string;
  requestNo?: string;
  requestTitle?: string;
  requestorName?: string;
  requestorEmail?: string;
  requestType?: string;
  companyName?: string;
  requestorIdLookupId?: string | number;
  status?: string;
};

// ─── slot helpers ──────────────────────────────────────────────────────────

export function parseSlotAttendeesJson(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === "string");
  } catch {
    return [];
  }
}

export async function getEngagementSlotById(
  slotId: string
): Promise<(SPEngagementSlotRow & { id: string }) | null> {
  return getItem<SPEngagementSlotRow>(getEngagementSlotsListId(), slotId);
}

export async function updateEngagementSlot(
  slotId: string,
  fields: Record<string, unknown>
): Promise<void> {
  await updateItem(getEngagementSlotsListId(), slotId, fields);
}

/** Read slot, verify future + available, set status booked. Returns false if race lost. */
export async function tryLockSlot(slotId: string): Promise<boolean> {
  const slot = await getEngagementSlotById(slotId);
  if (!slot?.id) return false;
  const start = slot.startTime ? new Date(slot.startTime) : null;
  if (!start || Number.isNaN(start.getTime()) || start < new Date()) return false;
  const st = (slot.status ?? "available").toLowerCase();
  if (st !== "available" && st !== "") return false;
  await updateEngagementSlot(slotId, { status: "booked" });
  return true;
}

export async function releaseSlot(slotId: string): Promise<void> {
  await updateEngagementSlot(slotId, { status: "available" });
}

// ─── request helpers ─────────────────────────────────────────────────────────

export async function findRequestByUuid(
  requestUuid: string
): Promise<(SPRequestRow & { id: string }) | null> {
  const listId = getRequestsListId();
  try {
    const rows = await listItems<SPRequestRow>(listId, {
      filter: `fields/uuid eq ${odataString(requestUuid)}`,
      top: 1,
    });
    return rows[0] ?? null;
  } catch {
    const all = await listItems<SPRequestRow>(listId);
    return all.find((r) => (r.uuid ?? "").trim() === requestUuid.trim()) ?? null;
  }
}

export async function getRequestByItemId(
  requestItemId: string
): Promise<(SPRequestRow & { id: string }) | null> {
  return getItem<SPRequestRow>(getRequestsListId(), requestItemId);
}

export async function updateRequestStatusByItemId(
  requestItemId: string,
  status: string
): Promise<void> {
  await updateItem(getRequestsListId(), requestItemId, { status, outcome: status });
}

// ─── engagement CRUD ───────────────────────────────────────────────────────

function enrichEngagementRow(row: SPEngagementRow): SPEngagementRow {
  return {
    ...row,
    slotItemId: row.slotItemId ?? normalizeLookupId(row.slotIdLookupId),
    requestorUserId: row.requestorUserId ?? normalizeLookupId(row.requestorIdLookupId),
    notes: row.notes ?? "",
  };
}

export async function listEngagements(): Promise<SPEngagementRow[]> {
  const rows = await listItems<SPEngagementRow>(getEngagementsListId());
  return rows.map(enrichEngagementRow);
}

export async function listAllRequests(): Promise<SPRequestRow[]> {
  return listItems<SPRequestRow>(getRequestsListId());
}

export async function listAllEngagementSlots(): Promise<
  (SPEngagementSlotRow & { id: string })[]
> {
  return listItems<SPEngagementSlotRow>(getEngagementSlotsListId());
}

export async function findEngagementsByRequestUuid(
  requestUuid: string
): Promise<SPEngagementRow[]> {
  const request = await findRequestByUuid(requestUuid);
  if (!request) return [];
  const requestLookupId = String(request.id).trim();
  const all = await listEngagements();
  return all.filter((e) => {
    const lookup = normalizeLookupId(e.requestIdLookupId);
    if (lookup) return lookup === requestLookupId;
    return (e.requestUuid ?? "").trim() === requestUuid.trim();
  });
}

export async function countCompletedEngagementsForRequest(requestUuid: string): Promise<number> {
  const rows = await findEngagementsByRequestUuid(requestUuid);
  return rows.filter((r) => (r.status ?? "").toLowerCase() === "completed").length;
}

export async function findScheduledEngagementForRequest(
  requestUuid: string
): Promise<SPEngagementRow | null> {
  const rows = await findEngagementsByRequestUuid(requestUuid);
  const scheduled = rows.filter((r) => (r.status ?? "").toLowerCase() === "scheduled");
  if (scheduled.length === 0) return null;
  scheduled.sort((a, b) => Number(b.id) - Number(a.id));
  return scheduled[0] ?? null;
}

export async function getEngagementById(
  engagementId: string
): Promise<(SPEngagementRow & { id: string }) | null> {
  const row = await getItem<SPEngagementRow>(getEngagementsListId(), engagementId);
  return row ? enrichEngagementRow(row) : null;
}

export async function createEngagementRecord(input: {
  requestUuid: string;
  slotItemId: string;
  requestorUserId: string;
  engagementNumber: string;
  name: string;
  type: string;
  location: string | null;
  notes: string | null;
  status: string;
}): Promise<SPEngagementRow & { id: string }> {
  const request = await findRequestByUuid(input.requestUuid);
  if (!request) {
    throw new Error(`Request not found for engagement create: ${input.requestUuid}`);
  }

  const requestLookupId = Number(request.id);
  const slotLookupId = Number(input.slotItemId);
  const requestorLookupId = Number(input.requestorUserId);

  const fields: Record<string, unknown> = {
    Title: input.name,
    uuid: randomUUID(),
    requestIdLookupId: Number.isFinite(requestLookupId) ? requestLookupId : undefined,
    slotIdLookupId: Number.isFinite(slotLookupId) ? slotLookupId : undefined,
    requestorIdLookupId: Number.isFinite(requestorLookupId) ? requestorLookupId : undefined,
    engagementNumber: input.engagementNumber,
    name: input.name,
    type: input.type,
    location: input.location ?? "",
    status: input.status,
    notes: input.notes ?? "",
  };
  const created = await createItem<SPEngagementRow>(getEngagementsListId(), fields);
  return enrichEngagementRow(created);
}

export async function updateEngagementRecord(
  engagementId: string,
  fields: Record<string, unknown>
): Promise<void> {
  const patch: Record<string, unknown> = { ...fields };
  const nextSlotItemId =
    typeof patch.slotItemId === "string" ? patch.slotItemId.trim() : undefined;
  const nextRequestorUserId =
    typeof patch.requestorUserId === "string" ? patch.requestorUserId.trim() : undefined;

  if (nextSlotItemId !== undefined) {
    const lookupId = Number(nextSlotItemId);
    if (Number.isFinite(lookupId)) {
      patch.slotIdLookupId = lookupId;
    }
  }
  if (nextRequestorUserId !== undefined) {
    const lookupId = Number(nextRequestorUserId);
    if (Number.isFinite(lookupId)) {
      patch.requestorIdLookupId = lookupId;
    }
  }

  delete patch.requestUuid;
  delete patch.slotItemId;
  delete patch.requestorUserId;

  await updateItem(getEngagementsListId(), engagementId, patch);
}

export async function generateEngagementNumber(requestUuid: string): Promise<string> {
  const n = await countCompletedEngagementsForRequest(requestUuid);
  return `R${String(n + 1).padStart(2, "0")}`;
}

// ─── users / email ─────────────────────────────────────────────────────────

export async function getUsersByIds(ids: string[]): Promise<SPUser[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];
  const users = await listUsers();
  const set = new Set(unique);
  return users.filter((u) => set.has(u.id));
}

export async function getReviewersByIds(ids: string[]): Promise<SPUser[]> {
  const users = await getUsersByIds(ids);
  return users.filter((u) => parseRoles(u.roles).includes("reviewer"));
}

// ─── Booking UI mapping ─────────────────────────────────────────────────────

const KNOWN_MEETING_ROOMS = [
  "O3CS Meeting Room",
  "Hyrangea Meeting Room",
  "Petunia Meeting Room",
] as const;

export function mapEngagementStatusToNumeric(status: string | undefined): number {
  switch ((status ?? "").toLowerCase()) {
    case "cancelled":
      return 0;
    case "completed":
      return 2;
    case "scheduled":
    case "re-schedule":
    default:
      return 1;
  }
}

export function splitMeetingLocation(location: string | null | undefined): {
  meetingRoom?: string;
  manualLocation?: string;
} {
  const loc = (location ?? "").trim();
  if (!loc) return {};
  if ((KNOWN_MEETING_ROOMS as readonly string[]).includes(loc)) {
    return { meetingRoom: loc };
  }
  return { meetingRoom: "Other", manualLocation: loc };
}

export function buildBookingEngagementPayload(
  row: SPEngagementRow,
  slot: { id: string; startTime?: string; endTime?: string }
) {
  const { meetingRoom, manualLocation } = splitMeetingLocation(row.location);
  return {
    id: row.id,
    engagementNumber: row.engagementNumber ?? "",
    name: row.name ?? "",
    type: (row.type === "in_person" ? "in_person" : "virtual") as "virtual" | "in_person",
    meetingRoom,
    manualLocation,
    notes: row.notes ?? "",
    status: mapEngagementStatusToNumeric(row.status),
    slot: {
      id: slot.id,
      startTime: slot.startTime ?? "",
      endTime: slot.endTime ?? "",
    },
  };
}
