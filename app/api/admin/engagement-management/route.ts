import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/src/lib/auth/get-current-user";
import { hasRole } from "@/src/lib/auth/has-role";

const ENGAGEMENT_STATUS_SCHEDULED = "scheduled";
const ENGAGEMENT_STATUS_RESCHEDULED = "Re-Schedule";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !hasRole(user, "admin")) {
      return NextResponse.json({ error: "Only admins can view engagements" }, { status: 403 });
    }

    const engagements = await prisma.engagement.findMany({
      where: { status: { in: [ENGAGEMENT_STATUS_SCHEDULED, ENGAGEMENT_STATUS_RESCHEDULED] } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        requestId: true,
        slotId: true,
        requestorId: true,
        engagementNumber: true,
        name: true,
        type: true,
        location: true,
        notes: true,
        status: true,
        createdAt: true,
      },
    });

    const requestIds = Array.from(new Set(engagements.map((item) => item.requestId).filter(Boolean)));
    const slotIds = Array.from(new Set(engagements.map((item) => item.slotId).filter(Boolean)));

    const [requests, slots] = await Promise.all([
      requestIds.length > 0
        ? prisma.request.findMany({
            where: { id: { in: requestIds } },
            select: {
              id: true,
              requestNo: true,
              requestTitle: true,
              requestorId: true,
              requestorName: true,
              requestorEmail: true,
            },
          })
        : [],
      slotIds.length > 0
        ? prisma.engagementSlot.findMany({
            where: { id: { in: slotIds } },
            select: {
              id: true,
              slotName: true,
              startTime: true,
              endTime: true,
              attendees: true,
            },
          })
        : [],
    ]);

    const requestById = new Map(requests.map((item) => [item.id, item]));
    const slotById = new Map(slots.map((item) => [item.id, item]));

    const validEngagements = engagements.filter((engagement) => {
      const hasRequest = requestById.has(engagement.requestId);
      const hasSlot = slotById.has(engagement.slotId);
      if (!hasRequest || !hasSlot) {
        console.warn("Skipping orphaned scheduled engagement in admin list:", {
          engagementId: engagement.id,
          requestId: engagement.requestId,
          slotId: engagement.slotId,
          hasRequest,
          hasSlot,
        });
      }
      return hasRequest && hasSlot;
    });

    const requestorIds = Array.from(
      new Set(validEngagements.map((item) => item.requestorId).filter(Boolean))
    );
    const reviewerIds = Array.from(
      new Set(
        validEngagements.flatMap((item) => slotById.get(item.slotId)?.attendees ?? []).filter(Boolean)
      )
    );

    const [requestors, reviewers] = await Promise.all([
      requestorIds.length > 0
        ? prisma.user.findMany({
            where: { id: { in: requestorIds } },
            select: { id: true, name: true, email: true },
          })
        : [],
      reviewerIds.length > 0
        ? prisma.user.findMany({
            where: { id: { in: reviewerIds } },
            select: { id: true, name: true, email: true },
          })
        : [],
    ]);

    const requestorById = new Map(requestors.map((userRow) => [userRow.id, userRow]));
    const reviewerById = new Map(reviewers.map((userRow) => [userRow.id, userRow]));

    const payload = validEngagements.map((engagement) => {
      const request = requestById.get(engagement.requestId)!;
      const slot = slotById.get(engagement.slotId)!;
      return {
      id: engagement.id,
      engagementNumber: engagement.engagementNumber,
      name: engagement.name,
      type: engagement.type,
      location: engagement.location,
      notes: engagement.notes,
      status: engagement.status,
      createdAt: engagement.createdAt,
      request,
      slot: {
        id: slot.id,
        slotName: slot.slotName,
        startTime: slot.startTime,
        endTime: slot.endTime,
      },
      createdBy:
        requestorById.get(engagement.requestorId) ?? {
          id: engagement.requestorId,
          name: request.requestorName,
          email: request.requestorEmail,
        },
      reviewers: slot.attendees
        .map((reviewerId) => reviewerById.get(reviewerId))
        .filter((reviewer): reviewer is NonNullable<typeof reviewer> => Boolean(reviewer)),
      };
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error("GET /api/admin/engagement-management error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
