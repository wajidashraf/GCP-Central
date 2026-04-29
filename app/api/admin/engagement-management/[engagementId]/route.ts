import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email/email-service";
import {
  getEngagementStatusUpdateTemplate,
  htmlToPlainText,
} from "@/lib/email/email-templates";
import { getCurrentUser } from "@/src/lib/auth/get-current-user";
import { hasRole } from "@/src/lib/auth/has-role";

const SLOT_STATUS_AVAILABLE = "available";
const SLOT_STATUS_BOOKED = "booked";
const ENGAGEMENT_STATUS_CANCELLED = "cancelled";
const ENGAGEMENT_STATUS_RESCHEDULED = "Re-Schedule";

type ActionPayload =
  | { action: "reschedule"; slotId: string }
  | { action: "cancel" };

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function sendEngagementChangeEmails(options: {
  changeType: "updated" | "cancelled";
  requestId: string;
  requestNo: string;
  requestTitle: string;
  requestorName: string;
  requestorEmail: string;
  engagementName: string;
  engagementType: string | null;
  engagementLocation: string | null;
  slotStartTime: Date | null;
  slotEndTime: Date | null;
  reviewerIds: string[];
}) {
  const {
    changeType,
    requestId,
    requestNo,
    requestTitle,
    requestorName,
    requestorEmail,
    engagementName,
    engagementType,
    engagementLocation,
    slotStartTime,
    slotEndTime,
    reviewerIds,
  } = options;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const detailsUrl = `${appUrl}/requests/${requestId}`;

  const reviewers = reviewerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: reviewerIds } },
        select: { id: true, name: true, email: true },
      })
    : [];

  const recipients = [
    {
      name: requestorName || "Requestor",
      email: requestorEmail.trim().toLowerCase(),
    },
    ...reviewers
      .map((reviewer) => ({
        name: reviewer.name || "Reviewer",
        email: reviewer.email?.trim().toLowerCase(),
      }))
      .filter((item) => Boolean(item.email)),
  ];

  const seen = new Set<string>();
  const dedupedRecipients = recipients.filter((item) => {
    if (!item.email || seen.has(item.email)) return false;
    seen.add(item.email);
    return true;
  });

  await Promise.all(
    dedupedRecipients.map(async (recipient) => {
      const html = getEngagementStatusUpdateTemplate(
        recipient.name,
        changeType,
        requestNo,
        requestTitle,
        engagementName,
        engagementType,
        engagementLocation,
        slotStartTime,
        slotEndTime,
        detailsUrl,
        "GCP Central"
      );

      const result = await sendEmail({
        to: recipient.email,
        subject:
          changeType === "updated"
            ? `Engagement Re-Schedule: ${requestNo}`
            : `Engagement Cancelled: ${requestNo}`,
        html,
        text: htmlToPlainText(html),
      });

      if (!result.success) {
        console.error("Failed engagement change email:", {
          recipient: recipient.email,
          error: result.error,
          changeType,
        });
      }
    })
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ engagementId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasRole(user, "admin")) {
      return NextResponse.json({ error: "Only admins can manage engagements" }, { status: 403 });
    }

    const { engagementId } = await params;
    const payload = (await request.json()) as Partial<ActionPayload>;
    const action = normalizeString(payload.action);

    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      include: {
        request: {
          select: {
            id: true,
            requestNo: true,
            requestTitle: true,
            requestorName: true,
            requestorEmail: true,
          },
        },
        slot: {
          select: {
            id: true,
            attendees: true,
            startTime: true,
            endTime: true,
          },
        },
      },
    });

    if (!engagement) {
      return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
    }

    if (action === "reschedule") {
      const slotId = normalizeString((payload as { slotId?: string }).slotId);
      if (!slotId) {
        return NextResponse.json({ error: "New slot is required for reschedule" }, { status: 400 });
      }

      if (slotId === engagement.slotId) {
        return NextResponse.json({ error: "Please select a different slot" }, { status: 400 });
      }

      const targetSlot = await prisma.engagementSlot.findUnique({
        where: { id: slotId },
        select: { id: true, startTime: true, endTime: true, status: true, attendees: true },
      });

      if (!targetSlot) {
        return NextResponse.json({ error: "Selected slot not found" }, { status: 404 });
      }

      if (targetSlot.startTime < new Date()) {
        return NextResponse.json({ error: "Cannot move engagement to a past slot" }, { status: 400 });
      }

      if (targetSlot.status && targetSlot.status !== SLOT_STATUS_AVAILABLE) {
        return NextResponse.json({ error: "Selected slot is not available" }, { status: 409 });
      }

      const locked = await prisma.engagementSlot.updateMany({
        where: {
          id: slotId,
          startTime: { gte: new Date() },
          OR: [{ status: SLOT_STATUS_AVAILABLE }, { status: null }],
        },
        data: { status: SLOT_STATUS_BOOKED },
      });

      if (locked.count !== 1) {
        return NextResponse.json({ error: "Selected slot is no longer available" }, { status: 409 });
      }

      try {
        const updated = await prisma.engagement.update({
          where: { id: engagementId },
          data: { slotId, status: ENGAGEMENT_STATUS_RESCHEDULED },
          include: { slot: true },
        });

        await prisma.engagementSlot.update({
          where: { id: engagement.slotId },
          data: { status: SLOT_STATUS_AVAILABLE },
        });

        const reviewerIds = Array.from(
          new Set([...(engagement.slot.attendees ?? []), ...(targetSlot.attendees ?? [])])
        );

        await sendEngagementChangeEmails({
          changeType: "updated",
          requestId: engagement.request.id,
          requestNo: engagement.request.requestNo,
          requestTitle: engagement.request.requestTitle,
          requestorName: engagement.request.requestorName,
          requestorEmail: engagement.request.requestorEmail,
          engagementName: engagement.name || "Engagement",
          engagementType: engagement.type,
          engagementLocation: engagement.location,
          slotStartTime: targetSlot.startTime,
          slotEndTime: targetSlot.endTime,
          reviewerIds,
        });

        return NextResponse.json(updated);
      } catch (innerError) {
        await prisma.engagementSlot
          .update({ where: { id: slotId }, data: { status: SLOT_STATUS_AVAILABLE } })
          .catch((unlockError) => {
            console.error("Failed to release newly locked slot:", unlockError);
          });
        throw innerError;
      }
    }

    if (action === "cancel") {
      if (engagement.status === ENGAGEMENT_STATUS_CANCELLED) {
        return NextResponse.json({ error: "Engagement already cancelled" }, { status: 400 });
      }

      const cancelled = await prisma.engagement.update({
        where: { id: engagementId },
        data: { status: ENGAGEMENT_STATUS_CANCELLED },
      });

      await Promise.all([
        prisma.engagementSlot.update({
          where: { id: engagement.slotId },
          data: { status: SLOT_STATUS_AVAILABLE },
        }),
        prisma.request.update({
          where: { id: engagement.requestId },
          data: { status: "Ready for Engagement" },
        }),
      ]);

      await sendEngagementChangeEmails({
        changeType: "cancelled",
        requestId: engagement.request.id,
        requestNo: engagement.request.requestNo,
        requestTitle: engagement.request.requestTitle,
        requestorName: engagement.request.requestorName,
        requestorEmail: engagement.request.requestorEmail,
        engagementName: engagement.name || "Engagement",
        engagementType: engagement.type,
        engagementLocation: engagement.location,
        slotStartTime: engagement.slot.startTime,
        slotEndTime: engagement.slot.endTime,
        reviewerIds: engagement.slot.attendees ?? [],
      });

      return NextResponse.json(cancelled);
    }

    return NextResponse.json(
      { error: "Invalid action. Use `reschedule` or `cancel`." },
      { status: 400 }
    );
  } catch (error) {
    console.error("PATCH /api/admin/engagement-management/[engagementId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
