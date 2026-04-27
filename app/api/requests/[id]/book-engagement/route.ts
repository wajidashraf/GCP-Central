import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';
import { hasRole } from '@/src/lib/auth/has-role';

const SLOT_STATUS_AVAILABLE = 'available';
const SLOT_STATUS_BOOKED = 'booked';
const ENGAGEMENT_STATUS_SCHEDULED = 'scheduled';

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
    const { slotId, notes } = body;

    if (!slotId) {
      return NextResponse.json(
        { error: 'Slot ID is required' },
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
      engagement = await prisma.engagement.create({
        data: {
          requestId: id,
          slotId,
          requestorId: user.id,
          notes: notes || null,
          status: ENGAGEMENT_STATUS_SCHEDULED,
        },
      });

      await prisma.request.update({
        where: { id },
        data: { status: 'In Review' },
      });
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

    const engagement = await prisma.engagement.findFirst({
      where: {
        requestId: id,
        status: ENGAGEMENT_STATUS_SCHEDULED,
      },
      include: { slot: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(engagement ?? null);
  } catch (error) {
    console.error('GET /book-engagement error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
