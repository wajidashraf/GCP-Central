import { NextResponse } from "next/server";
import {
  listAllEngagementSlots,
  listAllRequests,
  listEngagements,
  parseSlotAttendeesJson,
  type SPEngagementRow,
  type SPEngagementSlotRow,
  type SPRequestRow,
} from "@/lib/sharepoint/engagements";
import { listUsers } from "@/lib/sharepoint/lists";
import { getCurrentUser } from "@/src/lib/auth/get-current-user";
import { hasRole } from "@/src/lib/auth/has-role";

const ENGAGEMENT_STATUS_SCHEDULED = "scheduled";
const ENGAGEMENT_STATUS_RESCHEDULED = "Re-Schedule";

type SlotWithId = SPEngagementSlotRow & { id: string };

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !hasRole(user, "admin")) {
      return NextResponse.json({ error: "Only admins can view engagements" }, { status: 403 });
    }

    const [engagements, requests, slots, users] = await Promise.all([
      listEngagements(),
      listAllRequests(),
      listAllEngagementSlots(),
      listUsers(),
    ]);

    const activeStatuses = new Set(
      [ENGAGEMENT_STATUS_SCHEDULED, ENGAGEMENT_STATUS_RESCHEDULED].map((s) => s.toLowerCase())
    );

    const filtered = engagements.filter((e) =>
      activeStatuses.has((e.status ?? "").toLowerCase())
    );

    const requestById = new Map<string, SPRequestRow & { id: string }>();
    for (const r of requests) {
      requestById.set(String(r.id).trim(), r as SPRequestRow & { id: string });
    }

    const slotById = new Map<string, SlotWithId>();
    for (const s of slots) {
      slotById.set(s.id, s);
    }

    const userById = new Map(users.map((u) => [u.id, u]));

    type EngagementListItem = SPEngagementRow & { id: string };

    const validEngagements = filtered.filter((engagement: EngagementListItem) => {
      const requestId = String(engagement.requestIdLookupId ?? "").trim();
      const slotId = engagement.slotItemId?.trim();
      const hasRequest = requestId ? requestById.has(requestId) : false;
      const hasSlot = slotId ? slotById.has(slotId) : false;
      if (!hasRequest || !hasSlot) {
        console.warn("Skipping orphaned scheduled engagement in admin list:", {
          engagementId: engagement.id,
          requestIdLookupId: requestId,
          slotItemId: slotId,
          hasRequest,
          hasSlot,
        });
      }
      return hasRequest && hasSlot;
    });

    const payload = validEngagements.map((engagement: EngagementListItem) => {
      const requestId = String(engagement.requestIdLookupId ?? "").trim();
      const slotId = engagement.slotItemId!.trim();
      const request = requestById.get(requestId)!;
      const slot = slotById.get(slotId)!;

      const attendeeIds = parseSlotAttendeesJson(slot.attendees);
      const reviewers = attendeeIds
        .map((reviewerId: string) => {
          const u = userById.get(reviewerId);
          if (!u) return null;
          return { id: u.id, name: u.Title, email: u.email };
        })
        .filter((reviewer): reviewer is NonNullable<typeof reviewer> => Boolean(reviewer));

      const requestorId = engagement.requestorUserId?.trim();
      const createdByUser = requestorId ? userById.get(requestorId) : undefined;

      const createdRaw =
        (engagement as SPEngagementRow & { Created?: string }).Created ??
        engagement["Created" as keyof typeof engagement];

      const createdAt =
        typeof createdRaw === "string"
          ? createdRaw
          : slot.startTime ?? new Date().toISOString();

      return {
        id: engagement.id,
        engagementNumber: engagement.engagementNumber ?? null,
        name: engagement.name ?? null,
        type: engagement.type ?? null,
        location: engagement.location ?? null,
        notes: engagement.notes ?? null,
        status: engagement.status ?? "",
        createdAt,
        request: {
          id: request.uuid ?? request.id,
          requestNo: request.requestNo ?? "",
          requestTitle: request.requestTitle ?? null,
          requestorId: String(request.requestorIdLookupId ?? requestorId ?? ""),
          requestorName: request.requestorName ?? null,
          requestorEmail: request.requestorEmail ?? null,
        },
        slot: {
          id: slot.id,
          slotName: slot.slotName ?? "",
          startTime: slot.startTime ?? "",
          endTime: slot.endTime ?? "",
        },
        createdBy: createdByUser
          ? {
              id: createdByUser.id,
              name: createdByUser.Title,
              email: createdByUser.email,
            }
          : {
              id: requestorId ?? "",
              name: request.requestorName ?? "",
              email: request.requestorEmail ?? "",
            },
        reviewers,
      };
    });

    payload.sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return tb - ta;
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error("GET /api/admin/engagement-management error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
