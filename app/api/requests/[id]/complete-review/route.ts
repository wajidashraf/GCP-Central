import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';
import { hasRole } from '@/src/lib/auth/has-role';
import { REQUEST_STATUS_MAP } from '@/src/constants/enums/requestStatus';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || (!hasRole(user, 'verifier') && !hasRole(user, 'admin'))) {
      return NextResponse.json(
        { error: 'Only verifiers and admins can complete review' },
        { status: 403 }
      );
    }

    const { id } = await params;

    const requestRecord = await prisma.request.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!requestRecord) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const suggestionsCount = await prisma.reviewerSuggestion.count({
      where: { requestId: id },
    });

    if (suggestionsCount < 1) {
      return NextResponse.json(
        { error: 'At least one suggestion is required to complete review' },
        { status: 400 }
      );
    }

    const updated = await prisma.request.update({
      where: { id },
      data: {
        status: REQUEST_STATUS_MAP.COMPLETE_REVIEW.label,
      },
      select: { id: true, status: true, updatedAt: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error completing review:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
