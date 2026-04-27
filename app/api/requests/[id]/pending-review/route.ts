import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';
import { hasRole } from '@/src/lib/auth/has-role';
import { REQUEST_STATUS_MAP } from '@/src/constants/enums/requestStatus';
import { isValidVerifierDecisionCodeForRequestType } from '@/src/constants/verifierDecisionCodes';

const WORKING_GCPC_SOURCE_ROLE = 'working_gcpc';
const DRAFT_REVIEW_STATUS = REQUEST_STATUS_MAP.DRAFT_REVIEW.label;
const PENDING_REVIEW_STATUS = REQUEST_STATUS_MAP.PENDING_REVIEW.label;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || (!hasRole(user, 'verifier') && !hasRole(user, 'admin'))) {
      return NextResponse.json(
        { error: 'Only verifiers and admins can mark reviews as pending' },
        { status: 403 }
      );
    }

    const { id } = await params;
    let body: { comment?: unknown; decisionCode?: unknown } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      body = {};
    }

    const decisionCode =
      typeof body.decisionCode === 'string' ? body.decisionCode.trim() : '';
    const comment = typeof body.comment === 'string' ? body.comment.trim() : '';

    if (!decisionCode) {
      return NextResponse.json({ error: 'Decision code is required' }, { status: 400 });
    }

    const requestRecord = await prisma.request.findUnique({
      where: { id },
      select: { id: true, status: true, requestType: true },
    });

    if (!requestRecord) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (!isValidVerifierDecisionCodeForRequestType(requestRecord.requestType, decisionCode)) {
      return NextResponse.json(
        { error: 'Invalid decision code for this request type' },
        { status: 400 }
      );
    }

    if (requestRecord.status.trim().toLowerCase() !== DRAFT_REVIEW_STATUS.toLowerCase()) {
      return NextResponse.json(
        { error: 'Only Draft Review requests can be marked as Pending Review' },
        { status: 400 }
      );
    }

    const workingGcpcSuggestionsCount = await prisma.reviewerSuggestion.count({
      where: {
        requestId: id,
        sourceRole: WORKING_GCPC_SOURCE_ROLE,
      },
    });

    if (workingGcpcSuggestionsCount < 1) {
      return NextResponse.json(
        { error: 'At least one Working GCPC suggestion is required to mark Pending Review' },
        { status: 400 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.verifierComment.upsert({
        where: { requestId: id },
        update: {
          comment,
          decisionCode,
          verifiedBy: user.name,
          verifierId: user.id,
        },
        create: {
          requestId: id,
          verifierId: user.id,
          comment,
          decisionCode,
          verifiedBy: user.name,
        },
      });

      return tx.request.update({
        where: { id },
        data: {
          status: PENDING_REVIEW_STATUS,
          verifierCommentText: comment,
          verifierDecisionCode: decisionCode,
          verifiedBy: user.name,
          verifiedAt: new Date(),
        },
        select: { id: true, status: true, updatedAt: true, verifierCommentText: true, verifierDecisionCode: true },
      });
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error marking review as pending:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
