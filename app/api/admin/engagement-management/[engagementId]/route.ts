import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/email-service";
import {
  getEngagementStatusUpdateTemplate,
  htmlToPlainText,
} from "@/lib/email/email-templates";
import {
  findRequestByUuid,
  getRequestByItemId,
  getEngagementById,
  getEngagementSlotById,
  getUsersByIds,
  parseSlotAttendeesJson,
  releaseSlot,
  tryLockSlot,
  updateEngagementRecord,
  updateRequestStatusByItemId,
} from "@/lib/sharepoint/engagements";
import { getCurrentUser } from "@/src/lib/auth/get-current-user";
import { hasRole } from "@/src/lib/auth/has-role";

const SLOT_STATUS_AVAILABLE = "available";
const ENGAGEMENT_STATUS_CANCELLED = "cancelled";
const ENGAGEMENT_STATUS_RESCHEDULED = "Re-Schedule";

type ActionPayload =
  | { action: "reschedule"; slotId: string }
  | { action: "cancel" };

type EmailRecipient = {
  name: string;
  email?: string;
};

type EmailRecipientWithEmail = {
  name: string;
  email: string;
};

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function sendEngagementChangeEmails(options: {
  changeType: "updated" | "cancelled";
  requestRouteId: string;
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
    requestRouteId,
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
  const detailsUrl = `${appUrl}/requests/${requestRouteId}`;

  const reviewerUsers = reviewerIds.length ? await getUsersByIds(reviewerIds) : [];

  const recipients: EmailRecipient[] = [
    {
      name: requestorName || "Requestor",
      email: requestorEmail.trim().toLowerCase(),
    },
    ...reviewerUsers.map((reviewer) => ({
      name: reviewer.Title || "Reviewer",
      email: reviewer.email?.trim().toLowerCase(),
    })),
  ];

  const seen = new Set<string>();
  const dedupedRecipients = recipients.filter((item): item is EmailRecipientWithEmail => {
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

    const engagement = await getEngagementById(engagementId);

    if (!engagement?.slotItemId) {
      return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
    }

    const requestRow = engagement.requestIdLookupId
      ? await getRequestByItemId(String(engagement.requestIdLookupId).trim())
      : engagement.requestUuid
      ? await findRequestByUuid(engagement.requestUuid.trim())
      : null;
    if (!requestRow) {
      return NextResponse.json({ error: "Related request not found" }, { status: 404 });
    }
    const requestRouteId = (requestRow.uuid ?? "").trim() || requestRow.id;

    const oldSlot = await getEngagementSlotById(engagement.slotItemId.trim());

    if (action === "reschedule") {
      const slotId = normalizeString((payload as { slotId?: string }).slotId);
      if (!slotId) {
        return NextResponse.json({ error: "New slot is required for reschedule" }, { status: 400 });
      }

      if (slotId === engagement.slotItemId) {
        return NextResponse.json({ error: "Please select a different slot" }, { status: 400 });
      }

      const targetSlot = await getEngagementSlotById(slotId);

      if (!targetSlot) {
        return NextResponse.json({ error: "Selected slot not found" }, { status: 404 });
      }

      const targetStart = targetSlot.startTime ? new Date(targetSlot.startTime) : null;
      if (!targetStart || targetStart < new Date()) {
        return NextResponse.json({ error: "Cannot move engagement to a past slot" }, { status: 400 });
      }

      const ts = (targetSlot.status ?? SLOT_STATUS_AVAILABLE).toLowerCase();
      if (ts && ts !== SLOT_STATUS_AVAILABLE) {
        return NextResponse.json({ error: "Selected slot is not available" }, { status: 409 });
      }

      const locked = await tryLockSlot(slotId);

      if (!locked) {
        return NextResponse.json({ error: "Selected slot is no longer available" }, { status: 409 });
      }

      try {
        await updateEngagementRecord(engagementId, {
          slotItemId: slotId,
          status: ENGAGEMENT_STATUS_RESCHEDULED,
        });

        if (engagement.slotItemId) {
          await releaseSlot(engagement.slotItemId.trim());
        }

        const oldAttendees = oldSlot ? parseSlotAttendeesJson(oldSlot.attendees) : [];
        const newAttendees = parseSlotAttendeesJson(targetSlot.attendees);
        const reviewerIds = Array.from(new Set([...oldAttendees, ...newAttendees]));

        await sendEngagementChangeEmails({
          changeType: "updated",
          requestRouteId,
          requestNo: requestRow.requestNo ?? "",
          requestTitle: requestRow.requestTitle ?? "",
          requestorName: requestRow.requestorName ?? "",
          requestorEmail: requestRow.requestorEmail ?? "",
          engagementName: engagement.name || "Engagement",
          engagementType: engagement.type ?? null,
          engagementLocation: engagement.location ?? null,
          slotStartTime: targetStart,
          slotEndTime: targetSlot.endTime ? new Date(targetSlot.endTime) : null,
          reviewerIds,
        });

        const updated = await getEngagementById(engagementId);
        return NextResponse.json(updated);
      } catch (innerError) {
        await releaseSlot(slotId).catch((unlockError) => {
          console.error("Failed to release newly locked slot:", unlockError);
        });
        throw innerError;
      }
    }

    if (action === "cancel") {
      if ((engagement.status ?? "").toLowerCase() === ENGAGEMENT_STATUS_CANCELLED) {
        return NextResponse.json({ error: "Engagement already cancelled" }, { status: 400 });
      }

      await updateEngagementRecord(engagementId, {
        status: ENGAGEMENT_STATUS_CANCELLED,
      });

      if (engagement.slotItemId) {
        await releaseSlot(engagement.slotItemId.trim());
      }

      await updateRequestStatusByItemId(requestRow.id, "Ready for Engagement");

      const reviewerIds = oldSlot ? parseSlotAttendeesJson(oldSlot.attendees) : [];

      await sendEngagementChangeEmails({
        changeType: "cancelled",
        requestRouteId,
        requestNo: requestRow.requestNo ?? "",
        requestTitle: requestRow.requestTitle ?? "",
        requestorName: requestRow.requestorName ?? "",
        requestorEmail: requestRow.requestorEmail ?? "",
        engagementName: engagement.name || "Engagement",
        engagementType: engagement.type ?? null,
        engagementLocation: engagement.location ?? null,
        slotStartTime: oldSlot?.startTime ? new Date(oldSlot.startTime) : null,
        slotEndTime: oldSlot?.endTime ? new Date(oldSlot.endTime) : null,
        reviewerIds,
      });

      const cancelled = await getEngagementById(engagementId);
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
