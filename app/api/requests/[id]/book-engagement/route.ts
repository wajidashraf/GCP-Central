import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email/email-service';
import {
  getEngagementBookingTemplate,
  htmlToPlainText,
} from '@/lib/email/email-templates';
import {
  buildBookingEngagementPayload,
  createEngagementRecord,
  findRequestByUuid,
  findScheduledEngagementForRequest,
  generateEngagementNumber,
  getEngagementSlotById,
  getUsersByIds,
  parseSlotAttendeesJson,
  releaseSlot,
  tryLockSlot,
  updateRequestStatusByItemId,
} from '@/lib/sharepoint/engagements';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';
import { hasRole } from '@/src/lib/auth/has-role';

const SLOT_STATUS_AVAILABLE = 'available';
const ENGAGEMENT_STATUS_SCHEDULED = 'scheduled';
const ENGAGEMENT_TYPES = ['virtual', 'in_person'] as const;
const OTHER_LOCATION = 'Other';

type EngagementType = (typeof ENGAGEMENT_TYPES)[number];

function userCanAccessRequest(
  user: { id: string; email: string },
  requestRow: NonNullable<Awaited<ReturnType<typeof findRequestByUuid>>>,
  isAdmin: boolean
): boolean {
  if (isAdmin) return true;
  const lookup = requestRow.requestorIdLookupId;
  if (lookup !== undefined && lookup !== null) {
    return String(lookup) === String(user.id);
  }
  const userEmail = user.email.trim().toLowerCase();
  const rowEmail = (requestRow.requestorEmail ?? '').trim().toLowerCase();
  return Boolean(userEmail && rowEmail && userEmail === rowEmail);
}

async function sendEngagementNotifications(options: {
  requestorUserId: string;
  requestUuid: string;
  slotId: string;
  engagementType: EngagementType;
  engagementLocation: string | null;
}) {
  const { requestorUserId, requestUuid, slotId, engagementType, engagementLocation } = options;

  try {
    const slot = await getEngagementSlotById(slotId);

    if (!slot) {
      console.log('No slot found:', slotId);
      return;
    }

    const attendeeIds = parseSlotAttendeesJson(slot.attendees);
    if (attendeeIds.length === 0) {
      console.log('No attendees found for slot:', slotId);
      return;
    }

    const request = await findRequestByUuid(requestUuid);

    if (!request) {
      console.error('Request not found:', requestUuid);
      return;
    }

    const requestors = requestorUserId
      ? await getUsersByIds([requestorUserId.trim()])
      : [];
    const requestor = requestors[0];

    const attendeeUsers = await getUsersByIds(attendeeIds);

    if (attendeeUsers.length === 0) {
      console.warn('Could not resolve any attendee emails for slot:', slotId);
      return;
    }

    const resolvedAttendeeIds = new Set(attendeeUsers.map((attendee) => attendee.id));
    const unresolvedAttendeeIds = attendeeIds.filter(
      (attendeeId: string) => !resolvedAttendeeIds.has(attendeeId)
    );
    if (unresolvedAttendeeIds.length > 0) {
      console.warn('Some slot attendee IDs could not be resolved to users:', {
        slotId,
        unresolvedAttendeeIds,
      });
    }

    const requestorName = requestor?.Title || request.requestorName;
    const engagementUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/requests/${requestUuid}`;

    const startTime = slot.startTime ? new Date(slot.startTime) : new Date();
    const endTime = slot.endTime ? new Date(slot.endTime) : new Date();

    for (const attendee of attendeeUsers) {
      try {
        const attendeeEmail = attendee.email?.trim().toLowerCase();
        if (!attendeeEmail) {
          console.warn('Attendee has no email, skipping:', attendee.id);
          continue;
        }

        const html = getEngagementBookingTemplate(
          attendee.Title || 'Attendee',
          requestorName ?? '',
          request.companyName ?? '',
          engagementType,
          engagementLocation,
          request.requestNo ?? '',
          request.requestTitle ?? '',
          request.requestType ?? '',
          startTime,
          endTime,
          engagementUrl,
          'GCP Central'
        );

        const emailResult = await sendEmail({
          to: attendeeEmail,
          subject: `Engagement Scheduled: ${request.requestNo ?? ''} - ${requestorName}`,
          html,
          text: htmlToPlainText(html),
          replyTo: requestor?.email || undefined,
        });

        if (!emailResult.success) {
          console.error('Engagement notification email failed:', {
            attendeeId: attendee.id,
            attendeeEmail,
            error: emailResult.error,
          });
          continue;
        }

        console.log('Engagement notification email accepted by SMTP:', {
          attendeeId: attendee.id,
          attendeeEmail,
          messageId: emailResult.messageId,
        });
      } catch (error) {
        console.error(`Failed to send email to attendee ${attendee.id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in sendEngagementNotifications:', error);
  }
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized – please sign in' },
        { status: 401 }
      );
    }

    const canBook = hasRole(user, 'requestor') || hasRole(user, 'admin');
    if (!canBook) {
      return NextResponse.json(
        { error: 'Only requestors or admins can book engagements' },
        { status: 403 }
      );
    }

    const { id: requestUuid } = await params;
    const body = await request.json();
    const slotId = normalizeString(body.slotId);
    const name = normalizeString(body.name);
    const type = normalizeString(body.type) as EngagementType;
    const meetingRoom = normalizeString(body.meetingRoom);
    const manualLocation = normalizeString(body.manualLocation);
    const notes = normalizeString(body.notes);

    if (!slotId) {
      return NextResponse.json({ error: 'Slot ID is required' }, { status: 400 });
    }

    if (!name) {
      return NextResponse.json({ error: 'Engagement name is required' }, { status: 400 });
    }

    if (!ENGAGEMENT_TYPES.includes(type)) {
      return NextResponse.json(
        { error: 'Engagement type must be virtual or in-person' },
        { status: 400 }
      );
    }

    const selectedLocation = meetingRoom === OTHER_LOCATION ? manualLocation : meetingRoom;
    if (type === 'in_person' && !selectedLocation) {
      return NextResponse.json(
        { error: 'Meeting location is required for in-person engagements' },
        { status: 400 }
      );
    }

    const requestRow = await findRequestByUuid(requestUuid);

    if (!requestRow) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const isAdmin = hasRole(user, 'admin');
    if (!userCanAccessRequest(user, requestRow, isAdmin)) {
      return NextResponse.json(
        { error: 'You can only book engagements for your own requests' },
        { status: 403 }
      );
    }

    const slot = await getEngagementSlotById(slotId);

    if (!slot) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
    }

    const startTime = slot.startTime ? new Date(slot.startTime) : null;
    if (!startTime || Number.isNaN(startTime.getTime())) {
      return NextResponse.json({ error: 'Slot has no valid start time' }, { status: 400 });
    }

    if (startTime < new Date()) {
      return NextResponse.json(
        { error: 'This slot is in the past. Please choose another slot.' },
        { status: 400 }
      );
    }

    const slotStatus = (slot.status ?? SLOT_STATUS_AVAILABLE).toLowerCase();
    if (slotStatus && slotStatus !== SLOT_STATUS_AVAILABLE) {
      return NextResponse.json(
        { error: 'This slot is no longer available. Please choose another slot.' },
        { status: 409 }
      );
    }

    const existingScheduled = await findScheduledEngagementForRequest(requestUuid);

    if (existingScheduled) {
      return NextResponse.json(
        { error: 'Engagement already scheduled for this request' },
        { status: 409 }
      );
    }

    const locked = await tryLockSlot(slotId);

    if (!locked) {
      return NextResponse.json(
        { error: 'This slot is no longer available. Please choose another slot.' },
        { status: 409 }
      );
    }

    try {
      const engagementNumber = await generateEngagementNumber(requestUuid);

      const engagementRow = await createEngagementRecord({
        requestUuid,
        slotItemId: slotId,
        requestorUserId: user.id,
        engagementNumber,
        name,
        type,
        location: type === 'in_person' ? selectedLocation : null,
        notes: notes || null,
        status: ENGAGEMENT_STATUS_SCHEDULED,
      });

      await updateRequestStatusByItemId(requestRow.id, 'R');

      try {
        await sendEngagementNotifications({
          requestorUserId: user.id,
          requestUuid,
          slotId,
          engagementType: type,
          engagementLocation: selectedLocation || null,
        });
      } catch (emailError) {
        console.error('Failed to send engagement notifications:', emailError);
      }

      return NextResponse.json(engagementRow, { status: 201 });
    } catch (innerError) {
      await releaseSlot(slotId).catch((e) =>
        console.error('Failed to release slot lock:', e)
      );
      throw innerError;
    }
  } catch (error) {
    console.error('POST /book-engagement error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized – please sign in' },
        { status: 401 }
      );
    }

    const { id: requestUuid } = await params;

    const requestRecord = await findRequestByUuid(requestUuid);

    if (!requestRecord) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const isAdmin = hasRole(user, 'admin');
    if (!userCanAccessRequest(user, requestRecord, isAdmin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const engagementRow = await findScheduledEngagementForRequest(requestUuid);

    let activeEngagement: ReturnType<typeof buildBookingEngagementPayload> | null = null;

    if (engagementRow?.slotItemId) {
      const slot = await getEngagementSlotById(engagementRow.slotItemId);
      if (slot) {
        activeEngagement = buildBookingEngagementPayload(engagementRow, slot);
      }
    }

    const nextEngagementNumber = await generateEngagementNumber(requestUuid);

    return NextResponse.json({
      request: {
        requestNo: requestRecord.requestNo ?? '',
        requestTitle: requestRecord.requestTitle ?? '',
      },
      nextEngagementNumber,
      activeEngagement,
      existingEngagement: activeEngagement,
    });
  } catch (error) {
    console.error('GET /book-engagement error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
