import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createItem, listItems, listUsers, parseRoles } from '@/lib/sharepoint/lists';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';
import { hasRole } from '@/src/lib/auth/has-role';

type EngagementSlotListItem = {
  id: string;
  slotName?: string;
  startTime?: string;
  endTime?: string;
  attendees?: string;
  status?: 'available' | 'booked' | null;
  createdAt?: string;
  uuid?: string;
};

function getEngagementSlotsListId() {
  const listId = process.env.ENGAGEMENT_SLOTS_LIST_ID;
  if (!listId) {
    throw new Error('ENGAGEMENT_SLOTS_LIST_ID is not set in .env.local');
  }
  return listId;
}

function parseAttendees(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === 'string');
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const slots = await listItems<EngagementSlotListItem>(getEngagementSlotsListId());
    const payload = slots
      .map((slot) => ({
        id: slot.id,
        slotName: slot.slotName ?? '',
        startTime: slot.startTime ?? null,
        endTime: slot.endTime ?? null,
        attendees: parseAttendees(slot.attendees),
        status: slot.status ?? 'available',
        createdAt: slot.createdAt ?? slot.startTime ?? null,
        uuid: slot.uuid ?? null,
      }))
      .sort((left, right) => {
        const leftDate = new Date(left.createdAt ?? 0).getTime();
        const rightDate = new Date(right.createdAt ?? 0).getTime();
        return rightDate - leftDate;
      });

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Error fetching slots:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user || !hasRole(user, 'admin')) {
      return NextResponse.json(
        { error: 'Only admins can create slots' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { slotName, startTime, endTime, attendees } = body;
    const normalizedSlotName = typeof slotName === 'string' ? slotName.trim() : '';
    const attendeeIds = Array.isArray(attendees)
      ? attendees.filter((attendee: unknown): attendee is string => typeof attendee === 'string')
      : [];

    if (!normalizedSlotName || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Slot name, start time, and end time are required' },
        { status: 400 }
      );
    }

    const parsedStartTime = new Date(startTime);
    const parsedEndTime = new Date(endTime);
    if (Number.isNaN(parsedStartTime.getTime()) || Number.isNaN(parsedEndTime.getTime())) {
      return NextResponse.json(
        { error: 'Start time and end time must be valid date-time values' },
        { status: 400 }
      );
    }

    if (parsedEndTime <= parsedStartTime) {
      return NextResponse.json(
        { error: 'End time must be later than start time' },
        { status: 400 }
      );
    }

    if (Array.isArray(attendees) && attendeeIds.length !== attendees.length) {
      return NextResponse.json(
        { error: 'Attendees must be an array of user IDs' },
        { status: 400 }
      );
    }

    if (attendeeIds.length < 1) {
      return NextResponse.json(
        { error: 'At least one reviewer attendee is required' },
        { status: 400 }
      );
    }

    // Validate that attendees have reviewer role
    if (attendeeIds.length > 0) {
      const users = await listUsers();
      const reviewerIds = new Set(
        users
          .filter((item) => parseRoles(item.roles).includes('reviewer'))
          .map((item) => item.id)
      );
      const reviewers = attendeeIds.filter((id) => reviewerIds.has(id));

      if (reviewers.length !== attendeeIds.length) {
        return NextResponse.json(
          { error: 'All attendees must have reviewer role' },
          { status: 400 }
        );
      }
    }

    const slot = await createItem<EngagementSlotListItem>(getEngagementSlotsListId(), {
      Title: normalizedSlotName,
      uuid: randomUUID(),
      slotName: normalizedSlotName,
      startTime: parsedStartTime.toISOString(),
      endTime: parsedEndTime.toISOString(),
      attendees: JSON.stringify(attendeeIds),
      status: 'available',
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        ...slot,
        attendees: parseAttendees(slot.attendees),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating slot:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
