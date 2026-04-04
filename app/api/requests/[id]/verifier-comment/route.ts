import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';
import { hasRole } from '@/src/lib/auth/has-role';

const ALLOWED_DECISION_CODES = ['approved', 'rejected', 'resubmit'] as const;

function normalizeDecisionCode(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!ALLOWED_DECISION_CODES.includes(normalized as (typeof ALLOWED_DECISION_CODES)[number])) {
    return null;
  }

  return normalized as (typeof ALLOWED_DECISION_CODES)[number];
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user || !hasRole(user, 'verifier')) {
      return NextResponse.json(
        { error: 'Only verifiers can submit verification comments' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { comment, decisionCode } = body;
    const normalizedComment = typeof comment === 'string' ? comment.trim() : '';
    const normalizedDecisionCode = normalizeDecisionCode(decisionCode);

    if (!normalizedComment || !normalizedDecisionCode) {
      return NextResponse.json(
        { error: 'Comment and decision code are required' },
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

    // Create or update verifier comment
    const verifierComment = await prisma.verifierComment.upsert({
      where: { requestId: id },
      update: {
        comment: normalizedComment,
        decisionCode: normalizedDecisionCode,
        verifiedBy: user.name,
      },
      create: {
        requestId: id,
        verifierId: user.id,
        comment: normalizedComment,
        decisionCode: normalizedDecisionCode,
        verifiedBy: user.name,
      },
    });

    // Update request status based on decision code
    await prisma.request.update({
      where: { id },
      data: {
        status: normalizedDecisionCode === 'approved' ? 'Acknowledged' : 'Resubmit',
        verifierCommentText: normalizedComment,
        verifierDecisionCode: normalizedDecisionCode,
        verifiedBy: user.name,
        verifiedAt: new Date(),
      },
    });

    return NextResponse.json(verifierComment);
  } catch (error) {
    console.error('Error creating verifier comment:', error);
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

    const verifierComment = await prisma.verifierComment.findUnique({
      where: { requestId: id },
    });

    if (!verifierComment) {
      return NextResponse.json(null);
    }

    return NextResponse.json(verifierComment);
  } catch (error) {
    console.error('Error fetching verifier comment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
