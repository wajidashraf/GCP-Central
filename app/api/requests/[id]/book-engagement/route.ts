import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';
import { hasRole } from '@/src/lib/auth/has-role';
import { sendEmail } from '@/lib/email/email-service';
import {
  getEngagementBookingTemplate,
  htmlToPlainText,
} from '@/lib/email/email-templates';

const SLOT_STATUS_AVAILABLE = 'available';
const SLOT_STATUS_BOOKED = 'booked';
const ENGAGEMENT_STATUS_SCHEDULED = 'scheduled';
const ENGAGEMENT_STATUS_COMPLETED = 'completed';
const ENGAGEMENT_TYPES = ['virtual', 'in_person'] as const;
const OTHER_LOCATION = 'Other';

type EngagementType = (typeof ENGAGEMENT_TYPES)[number];

async function generateEngagementNumber(requestId: string) {
  const completedCount = await prisma.engagement.count({
    where: {
      requestId,
      status: ENGAGEMENT_STATUS_COMPLETED,
    },
  });

  return `R${String(completedCount + 1).padStart(2, '0')}`;
}

/**
 * Send engagement booking notifications to all slot attendees
 */
async function sendEngagementNotifications(
  engagement: any,
  requestId: string,
  slotId: string,
  engagementName: string,
  engagementType: EngagementType,
  engagementLocation: string | null
) {
  try {
    // Fetch engagement slot with attendees
    const slot = await prisma.engagementSlot.findUnique({
      where: { id: slotId },
      select: {
        attendees: true,
        startTime: true,
        endTime: true,
      },
    });

    if (!slot || !slot.attendees || slot.attendees.length === 0) {
      console.log('No attendees found for slot:', slotId);
      return;
    }

    // Fetch request details
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      select: {
        requestNo: true,
        requestTitle: true,
        requestType: true,
        requestorName: true,
        companyName: true,
      },
    });

    if (!request) {
      console.error('Request not found:', requestId);
      return;
    }

    // Fetch requestor user details (for name and reply-to)
    const requestor = await prisma.user.findUnique({
      where: { id: engagement.requestorId },
      select: { name: true, email: true },
    });

    // slot.attendees contains user IDs — look up their actual email addresses
    const attendeeUsers = await prisma.user.findMany({
      where: { id: { in: slot.attendees } },
      select: { id: true, name: true, email: true },
    });

    if (attendeeUsers.length === 0) {
      console.warn('Could not resolve any attendee emails for slot:', slotId);
      return;
    }

    const resolvedAttendeeIds = new Set(attendeeUsers.map((attendee) => attendee.id));
    const unresolvedAttendeeIds = slot.attendees.filter((attendeeId) => !resolvedAttendeeIds.has(attendeeId));
    if (unresolvedAttendeeIds.length > 0) {
      console.warn('Some slot attendee IDs could not be resolved to users:', {
        slotId,
        unresolvedAttendeeIds,
      });
    }

    const requestorName = requestor?.name || request.requestorName;
    const engagementUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/requests/${requestId}`;

    // Send email to each resolved attendee
    for (const attendee of attendeeUsers) {
      try {
        const attendeeEmail = attendee.email?.trim().toLowerCase();
        if (!attendeeEmail) {
          console.warn('Attendee has no email, skipping:', attendee.id);
          continue;
        }

        const html = getEngagementBookingTemplate(
          attendee.name || 'Attendee',
          requestorName,
          request.companyName,
          engagementType,
          engagementLocation,
          request.requestNo,
          request.requestTitle,
          request.requestType,
          slot.startTime,
          slot.endTime,
          engagementUrl,
          'GCP Central'
        );

        const emailResult = await sendEmail({
          to: attendeeEmail,
          subject: `Engagement Scheduled: ${request.requestNo} - ${requestorName}`,
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
          accepted: emailResult.accepted,
          rejected: emailResult.rejected,
          response: emailResult.response,
        });
      } catch (error) {
        console.error(`Failed to send email to attendee ${attendee.id}:`, error);
        // Continue sending to other attendees even if one fails
      }
    }
  } catch (error) {
    console.error('Error in sendEngagementNotifications:', error);
    // Don't throw - this shouldn't break the booking process
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

    const { id } = await params;
    const body = await request.json();
    const slotId = normalizeString(body.slotId);
    const name = normalizeString(body.name);
    const type = normalizeString(body.type) as EngagementType;
    const meetingRoom = normalizeString(body.meetingRoom);
    const manualLocation = normalizeString(body.manualLocation);
    const notes = normalizeString(body.notes);

    if (!slotId) {
      return NextResponse.json(
        { error: 'Slot ID is required' },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: 'Engagement name is required' },
        { status: 400 }
      );
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

    const requestRecord = await prisma.request.findUnique({
      where: { id },
      select: { requestorId: true },
    });

    if (!requestRecord) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      );
    }

    const isAdmin = hasRole(user, 'admin');
    if (!isAdmin && requestRecord.requestorId !== user.id) {
      return NextResponse.json(
        { error: 'You can only book engagements for your own requests' },
        { status: 403 }
      );
    }

    const slot = await prisma.engagementSlot.findUnique({
      where: { id: slotId },
      select: { id: true, startTime: true, status: true },
    });

    if (!slot) {
      return NextResponse.json(
        { error: 'Slot not found' },
        { status: 404 }
      );
    }

    if (slot.startTime < new Date()) {
      return NextResponse.json(
        { error: 'This slot is in the past. Please choose another slot.' },
        { status: 400 }
      );
    }

    if (slot.status && slot.status !== SLOT_STATUS_AVAILABLE) {
      return NextResponse.json(
        { error: 'This slot is no longer available. Please choose another slot.' },
        { status: 409 }
      );
    }

    // Block if there is already an active scheduled engagement for this request.
    const existingScheduled = await prisma.engagement.findFirst({
      where: { requestId: id, status: ENGAGEMENT_STATUS_SCHEDULED },
      select: { id: true },
    });

    if (existingScheduled) {
      return NextResponse.json(
        { error: 'Engagement already scheduled for this request' },
        { status: 409 }
      );
    }

    // Atomically lock the slot: only succeeds if it is still available and in the future.
    const lockedSlot = await prisma.engagementSlot.updateMany({
      where: {
        id: slotId,
        startTime: { gte: new Date() },
        OR: [
          { status: SLOT_STATUS_AVAILABLE },
          { status: null },
        ],
      },
      data: { status: SLOT_STATUS_BOOKED },
    });

    if (lockedSlot.count !== 1) {
      return NextResponse.json(
        { error: 'This slot is no longer available. Please choose another slot.' },
        { status: 409 }
      );
    }

    // Create engagement; if it fails, release the slot lock.
    let engagement;
    try {
      const engagementNumber = await generateEngagementNumber(id);

      engagement = await prisma.engagement.create({
        data: {
          requestId: id,
          slotId,
          requestorId: user.id,
          engagementNumber,
          name,
          type,
          location: type === 'in_person' ? selectedLocation : null,
          notes: notes || null,
          status: ENGAGEMENT_STATUS_SCHEDULED,
        },
      });

      await prisma.request.update({
        where: { id },
        data: { status: 'In Review' },
      });

      // Send email notifications to slot attendees
      try {
        await sendEngagementNotifications(
          engagement,
          id,
          slotId,
          name,
          type,
          selectedLocation || null
        );
      } catch (emailError) {
        console.error('Failed to send engagement notifications:', emailError);
        // Don't fail the entire request if email fails
      }
    } catch (innerError) {
      await prisma.engagementSlot
        .update({ where: { id: slotId }, data: { status: SLOT_STATUS_AVAILABLE } })
        .catch((e) => console.error('Failed to release slot lock:', e));
      throw innerError;
    }

    return NextResponse.json(engagement, { status: 201 });
  } catch (error) {
    console.error('POST /book-engagement error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
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

    const { id } = await params;

    const requestRecord = await prisma.request.findUnique({
      where: { id },
      select: {
        requestNo: true,
        requestTitle: true,
        requestorId: true,
      },
    });

    if (!requestRecord) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      );
    }

    const isAdmin = hasRole(user, 'admin');
    if (!isAdmin && requestRecord.requestorId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const engagement = await prisma.engagement.findFirst({
      where: {
        requestId: id,
        status: ENGAGEMENT_STATUS_SCHEDULED,
      },
      include: { slot: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      request: {
        requestNo: requestRecord.requestNo,
        requestTitle: requestRecord.requestTitle,
      },
      nextEngagementNumber: await generateEngagementNumber(id),
      activeEngagement: engagement,
    });
  } catch (error) {
    console.error('GET /book-engagement error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
