import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';
import { hasRole } from '@/src/lib/auth/has-role';

export async function GET() {
  try {
    const slots = await prisma.engagementSlot.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(slots);
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
    const attendeeIds = Array.isArray(attendees)
      ? attendees.filter((attendee: unknown): attendee is string => typeof attendee === 'string')
      : [];

    if (!slotName || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Slot name, start time, and end time are required' },
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
      const reviewers = await prisma.user.findMany({
        where: {
          id: { in: attendeeIds },
          roles: { has: 'reviewer' },
        },
        select: { id: true },
      });

      if (reviewers.length !== attendeeIds.length) {
        return NextResponse.json(
          { error: 'All attendees must have reviewer role' },
          { status: 400 }
        );
      }
    }

    const slot = await prisma.engagementSlot.create({
      data: {
        slotName,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        attendees: attendeeIds,
        createdBy: user.id,
      },
    });

    return NextResponse.json(slot, { status: 201 });
  } catch (error) {
    console.error('Error creating slot:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
