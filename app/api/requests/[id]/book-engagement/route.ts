import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user || user.role !== 'requestor') {
      return NextResponse.json(
        { error: 'Only requestors can book engagements' },
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

    // Check if request exists
    const requestRecord = await prisma.request.findUnique({
      where: { id },
    });

    if (!requestRecord) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      );
    }

    // Check if slot exists
    const slot = await prisma.engagementSlot.findUnique({
      where: { id: slotId },
    });

    if (!slot) {
      return NextResponse.json(
        { error: 'Slot not found' },
        { status: 404 }
      );
    }

    // Check if engagement already exists for this request
    const existingEngagement = await prisma.engagement.findFirst({
      where: { requestId: id },
    });

    if (existingEngagement) {
      return NextResponse.json(
        { error: 'Engagement already booked for this request' },
        { status: 400 }
      );
    }

    // Create engagement
    const engagement = await prisma.engagement.create({
      data: {
        requestId: id,
        slotId,
        requestorId: user.id,
        notes: notes || null,
        status: 'booked',
      },
    });

    // Update request status
    await prisma.request.update({
      where: { id },
      data: { status: 'In Review' },
    });

    return NextResponse.json(engagement, { status: 201 });
  } catch (error) {
    console.error('Error booking engagement:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const engagement = await prisma.engagement.findFirst({
      where: { requestId: id },
      include: {
        slot: true,
      },
    });

    if (!engagement) {
      return NextResponse.json(null);
    }

    return NextResponse.json(engagement);
  } catch (error) {
    console.error('Error fetching engagement:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
