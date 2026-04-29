import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';
import { hasRole } from '@/src/lib/auth/has-role';
import { REQUEST_STATUS_MAP } from '@/src/constants/enums/requestStatus';

const WORKING_GCPC_ROLE = 'working_gcpc';
const PENDING_REVIEW_STATUS = REQUEST_STATUS_MAP.PENDING_REVIEW.label;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || (!hasRole(user, 'working_gcpc') && !hasRole(user, 'admin'))) {
      return NextResponse.json(
        { error: 'Only working_gcpc and admins can mark reviews as Pending Review' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const requestRecord = await prisma.request.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!requestRecord) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (requestRecord.status.trim().toLowerCase() !== 'r') {
      return NextResponse.json(
        { error: 'Only requests in review can be marked as Pending Review' },
        { status: 400 }
      );
    }

    // Count reviewer-phase suggestions (anything except explicit working_gcpc).
    // Do not rely on Prisma `count` + `NOT` / `null` on MongoDB: documents with no `sourceRole`
    // field can be excluded from DB-level filters, which incorrectly yields 0.
    const suggestionRows = await prisma.reviewerSuggestion.findMany({
      where: { requestId: id },
      select: { sourceRole: true },
    });
    const reviewerSuggestionsCount = suggestionRows.filter(
      (row) => row.sourceRole !== WORKING_GCPC_ROLE
    ).length;

    if (reviewerSuggestionsCount < 1) {
      return NextResponse.json(
        { error: 'At least one working-gcpc suggestion is required to mark Pending Review' },
        { status: 400 }
      );
    }

    const updated = await prisma.request.update({
      where: { id },
      data: { status: PENDING_REVIEW_STATUS },
      select: { id: true, status: true, updatedAt: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error marking review as Pending Review:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
